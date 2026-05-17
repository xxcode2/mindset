// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title HabitStaking
 * @notice Non-custodial habit commitment staking.
 *
 * Mechanics:
 *  1. User creates a habit, stakes ETH, sets duration (days) and required check-ins.
 *  2. User checks in at most once per UTC day during the active period.
 *  3. If user reaches required check-ins before deadline, they can claim() their full stake back.
 *  4. After deadline, if user failed to reach target, anyone can call forfeit():
 *     the stake is sent to an immutable charity address set at deploy time.
 *
 * Trust model:
 *  - There is NO owner, NO admin, NO upgrade path, NO emergency withdraw.
 *  - The deployer cannot move user funds. Only the contract logic moves ETH.
 *  - charityAddress is fixed forever once deployed.
 */
contract HabitStaking {
    enum Status { Active, Completed, Failed }

    struct Habit {
        address owner;
        string description;
        uint256 stake;
        uint64 startTime;
        uint32 durationDays;
        uint32 requiredCheckIns;
        uint32 checkInsCount;
        uint32 lastCheckInDay; // day number from startTime; max means never
        Status status;
    }

    /// @notice Address that receives forfeited stakes. Immutable, set at deploy time.
    address public immutable charityAddress;

    /// @notice Auto-incrementing habit ID.
    uint256 public nextHabitId;

    /// @notice habitId => Habit
    mapping(uint256 => Habit) private _habits;

    /// @notice user => list of habit IDs they own
    mapping(address => uint256[]) private _userHabits;

    event HabitCreated(
        uint256 indexed habitId,
        address indexed owner,
        uint256 stake,
        uint32 durationDays,
        uint32 requiredCheckIns,
        string description
    );
    event CheckedIn(uint256 indexed habitId, uint32 dayNumber, uint32 totalCheckIns);
    event HabitClaimed(uint256 indexed habitId, address indexed owner, uint256 amount);
    event HabitForfeited(uint256 indexed habitId, address indexed owner, uint256 amount);

    error InvalidStake();
    error InvalidDuration();
    error InvalidRequiredCheckIns();
    error NotHabitOwner();
    error HabitNotActive();
    error AlreadyCheckedInToday();
    error HabitExpired();
    error HabitNotExpired();
    error CheckInsTargetNotMet();
    error CheckInsTargetMet();
    error InvalidCharityAddress();
    error TransferFailed();

    constructor(address _charityAddress) {
        if (_charityAddress == address(0)) revert InvalidCharityAddress();
        charityAddress = _charityAddress;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core actions
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Create a new habit and stake ETH against it.
    function createHabit(
        string calldata description,
        uint32 durationDays,
        uint32 requiredCheckIns
    ) external payable returns (uint256 habitId) {
        if (msg.value == 0) revert InvalidStake();
        if (durationDays == 0 || durationDays > 365) revert InvalidDuration();
        if (requiredCheckIns == 0 || requiredCheckIns > durationDays) revert InvalidRequiredCheckIns();

        habitId = nextHabitId++;
        _habits[habitId] = Habit({
            owner: msg.sender,
            description: description,
            stake: msg.value,
            startTime: uint64(block.timestamp),
            durationDays: durationDays,
            requiredCheckIns: requiredCheckIns,
            checkInsCount: 0,
            lastCheckInDay: type(uint32).max,
            status: Status.Active
        });
        _userHabits[msg.sender].push(habitId);

        emit HabitCreated(habitId, msg.sender, msg.value, durationDays, requiredCheckIns, description);
    }

    /// @notice Check in for today. One check-in per UTC day from startTime.
    function checkIn(uint256 habitId) external {
        Habit storage h = _habits[habitId];
        if (h.owner != msg.sender) revert NotHabitOwner();
        if (h.status != Status.Active) revert HabitNotActive();

        uint256 currentDay = (block.timestamp - h.startTime) / 1 days;
        if (currentDay >= h.durationDays) revert HabitExpired();
        if (h.checkInsCount > 0 && h.lastCheckInDay == uint32(currentDay)) revert AlreadyCheckedInToday();

        h.lastCheckInDay = uint32(currentDay);
        unchecked { h.checkInsCount += 1; }

        emit CheckedIn(habitId, uint32(currentDay), h.checkInsCount);
    }

    /// @notice Claim back the full stake once required check-ins are reached.
    function claim(uint256 habitId) external {
        Habit storage h = _habits[habitId];
        if (h.owner != msg.sender) revert NotHabitOwner();
        if (h.status != Status.Active) revert HabitNotActive();
        if (h.checkInsCount < h.requiredCheckIns) revert CheckInsTargetNotMet();

        h.status = Status.Completed;
        uint256 amount = h.stake;

        emit HabitClaimed(habitId, msg.sender, amount);

        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    /// @notice Anyone can finalize a failed habit after the deadline; stake goes to charity.
    function forfeit(uint256 habitId) external {
        Habit storage h = _habits[habitId];
        if (h.status != Status.Active) revert HabitNotActive();

        uint256 endTime = uint256(h.startTime) + (uint256(h.durationDays) * 1 days);
        if (block.timestamp < endTime) revert HabitNotExpired();
        if (h.checkInsCount >= h.requiredCheckIns) revert CheckInsTargetMet();

        h.status = Status.Failed;
        uint256 amount = h.stake;

        emit HabitForfeited(habitId, h.owner, amount);

        (bool ok, ) = charityAddress.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View helpers
    // ─────────────────────────────────────────────────────────────────────────

    function getHabit(uint256 habitId) external view returns (Habit memory) {
        return _habits[habitId];
    }

    function getUserHabits(address user) external view returns (uint256[] memory) {
        return _userHabits[user];
    }

    function getCurrentDay(uint256 habitId) external view returns (uint256) {
        Habit memory h = _habits[habitId];
        if (block.timestamp < h.startTime) return 0;
        return (block.timestamp - h.startTime) / 1 days;
    }

    function canCheckInToday(uint256 habitId) external view returns (bool) {
        Habit memory h = _habits[habitId];
        if (h.status != Status.Active) return false;
        uint256 currentDay = (block.timestamp - h.startTime) / 1 days;
        if (currentDay >= h.durationDays) return false;
        if (h.checkInsCount > 0 && h.lastCheckInDay == uint32(currentDay)) return false;
        return true;
    }

    function isExpired(uint256 habitId) external view returns (bool) {
        Habit memory h = _habits[habitId];
        return block.timestamp >= uint256(h.startTime) + (uint256(h.durationDays) * 1 days);
    }
}

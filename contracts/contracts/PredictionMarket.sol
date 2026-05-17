// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title PredictionMarket
 * @notice Non-custodial parimutuel binary (YES/NO) prediction markets denominated in an ERC20 token (USDC).
 *
 * Mechanics:
 *  1. Anyone can create a market with a question, description, closeTime and resolver address.
 *  2. While open (block.timestamp < closeTime), users place YES or NO bets in the configured ERC20.
 *  3. After closeTime the resolver calls resolve(YES) or resolve(NO).
 *  4. Winners call claim() and receive a share of the entire pool proportional to their stake:
 *        payout = (userBet * distributable) / winningPool
 *     A 1% protocol fee is taken from the LOSING pool only and sent to feeRecipient.
 *  5. Safety net: if not resolved within RESOLUTION_GRACE_PERIOD after closeTime, anyone can call
 *     markInvalid(); bettors then call refund() to recover their stake. No funds get stuck.
 *
 * Trust model:
 *  - No owner, no admin, no upgrade path, no emergency withdraw on this contract.
 *  - feeRecipient and bettingToken are set in the constructor and immutable forever.
 *  - The deployer cannot move user funds. Only contract logic moves tokens.
 *  - Each market's resolver is chosen by the creator. Pick wisely (multisig, oracle, etc.).
 */
contract PredictionMarket {
    enum Outcome { Unresolved, Yes, No, Invalid }

    /// @notice Discovery + UI categorization. Stored as a hint; pure presentation in the contract,
    ///         but used by the frontend to filter and to choose a default resolver (e.g. ChainlinkPriceResolver
    ///         for Price markets).
    enum Category { Custom, Price, Sports, Politics, Social, Crypto }

    struct Market {
        address creator;
        address resolver;
        string question;
        string description;
        uint64 createdAt;
        uint64 closeTime;
        uint128 yesPool;
        uint128 noPool;
        uint32 yesBettors;
        uint32 noBettors;
        Outcome outcome;
        Category category;
    }

    uint256 public constant RESOLUTION_GRACE_PERIOD = 7 days;
    uint16 public constant FEE_BPS = 100; // 1.00%
    uint16 public constant BPS_DENOMINATOR = 10_000;

    /// @notice ERC20 token used for all bets and payouts. Immutable.
    IERC20 public immutable bettingToken;
    /// @notice Receives the protocol fee from losing pools. Immutable.
    address public immutable feeRecipient;

    uint256 public nextMarketId;

    mapping(uint256 => Market) private _markets;
    /// @notice marketId => user => YES bet amount
    mapping(uint256 => mapping(address => uint256)) public yesBets;
    /// @notice marketId => user => NO bet amount
    mapping(uint256 => mapping(address => uint256)) public noBets;
    /// @notice marketId => user => has claimed/refunded
    mapping(uint256 => mapping(address => bool)) public hasClaimed;
    /// @notice creator => market IDs they created
    mapping(address => uint256[]) private _userCreated;
    /// @notice user => market IDs they have bet on (deduped)
    mapping(address => uint256[]) private _userBets;
    mapping(uint256 => mapping(address => bool)) private _hasBetRecorded;

    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        address indexed resolver,
        string question,
        string description,
        uint64 closeTime,
        Category category
    );
    event BetPlaced(
        uint256 indexed marketId,
        address indexed bettor,
        bool yes,
        uint256 amount,
        uint128 newYesPool,
        uint128 newNoPool
    );
    event MarketResolved(uint256 indexed marketId, Outcome outcome, uint256 feeTaken);
    event MarketInvalidated(uint256 indexed marketId);
    event Claimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event Refunded(uint256 indexed marketId, address indexed user, uint256 amount);

    error InvalidFeeRecipient();
    error InvalidToken();
    error InvalidResolver();
    error EmptyQuestion();
    error CloseTimeInPast();
    error MarketNotOpen();
    error MarketNotClosed();
    error MarketAlreadyResolved();
    error AlreadyClaimed();
    error InvalidOutcome();
    error NotResolver();
    error NothingToClaim();
    error NotInGracePeriod();
    error TransferFailed();
    error ZeroBet();

    constructor(IERC20 _bettingToken, address _feeRecipient) {
        if (address(_bettingToken) == address(0)) revert InvalidToken();
        if (_feeRecipient == address(0)) revert InvalidFeeRecipient();
        bettingToken = _bettingToken;
        feeRecipient = _feeRecipient;
    }

    // ─── Market lifecycle ────────────────────────────────────────────────────

    function createMarket(
        string calldata question,
        string calldata description,
        uint64 closeTime,
        address resolver,
        Category category
    ) external returns (uint256 marketId) {
        if (bytes(question).length == 0 || bytes(question).length > 280) revert EmptyQuestion();
        if (closeTime <= block.timestamp) revert CloseTimeInPast();
        if (resolver == address(0)) revert InvalidResolver();

        marketId = nextMarketId++;
        _markets[marketId] = Market({
            creator: msg.sender,
            resolver: resolver,
            question: question,
            description: description,
            createdAt: uint64(block.timestamp),
            closeTime: closeTime,
            yesPool: 0,
            noPool: 0,
            yesBettors: 0,
            noBettors: 0,
            outcome: Outcome.Unresolved,
            category: category
        });
        _userCreated[msg.sender].push(marketId);

        emit MarketCreated(marketId, msg.sender, resolver, question, description, closeTime, category);
    }

    function bet(uint256 marketId, bool yes, uint256 amount) external {
        if (amount == 0) revert ZeroBet();
        Market storage m = _markets[marketId];
        if (m.outcome != Outcome.Unresolved) revert MarketNotOpen();
        if (block.timestamp >= m.closeTime) revert MarketNotOpen();

        // Pull tokens; require approval beforehand.
        bool ok = bettingToken.transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();

        if (yes) {
            if (yesBets[marketId][msg.sender] == 0) m.yesBettors += 1;
            yesBets[marketId][msg.sender] += amount;
            m.yesPool += uint128(amount);
        } else {
            if (noBets[marketId][msg.sender] == 0) m.noBettors += 1;
            noBets[marketId][msg.sender] += amount;
            m.noPool += uint128(amount);
        }

        if (!_hasBetRecorded[marketId][msg.sender]) {
            _hasBetRecorded[marketId][msg.sender] = true;
            _userBets[msg.sender].push(marketId);
        }

        emit BetPlaced(marketId, msg.sender, yes, amount, m.yesPool, m.noPool);
    }

    function resolve(uint256 marketId, bool yesWon) external {
        Market storage m = _markets[marketId];
        if (msg.sender != m.resolver) revert NotResolver();
        if (m.outcome != Outcome.Unresolved) revert MarketAlreadyResolved();
        if (block.timestamp < m.closeTime) revert MarketNotClosed();

        m.outcome = yesWon ? Outcome.Yes : Outcome.No;

        uint256 losingPool = yesWon ? m.noPool : m.yesPool;
        uint256 fee = (losingPool * FEE_BPS) / BPS_DENOMINATOR;

        emit MarketResolved(marketId, m.outcome, fee);

        if (fee > 0) {
            bool ok = bettingToken.transfer(feeRecipient, fee);
            if (!ok) revert TransferFailed();
        }
    }

    /// @notice After grace period, anyone can mark a stuck market as invalid so bettors get refunds.
    function markInvalid(uint256 marketId) external {
        Market storage m = _markets[marketId];
        if (m.outcome != Outcome.Unresolved) revert MarketAlreadyResolved();
        if (block.timestamp < uint256(m.closeTime) + RESOLUTION_GRACE_PERIOD) revert NotInGracePeriod();

        m.outcome = Outcome.Invalid;
        emit MarketInvalidated(marketId);
    }

    // ─── Payouts ─────────────────────────────────────────────────────────────

    function claim(uint256 marketId) external {
        Market storage m = _markets[marketId];
        if (m.outcome == Outcome.Unresolved) revert MarketNotClosed();
        if (m.outcome == Outcome.Invalid) revert InvalidOutcome();
        if (hasClaimed[marketId][msg.sender]) revert AlreadyClaimed();

        uint256 payout;
        if (m.outcome == Outcome.Yes) {
            uint256 stake = yesBets[marketId][msg.sender];
            if (stake == 0) revert NothingToClaim();
            uint256 losingPool = m.noPool;
            uint256 fee = (losingPool * FEE_BPS) / BPS_DENOMINATOR;
            uint256 distributable = uint256(m.yesPool) + losingPool - fee;
            payout = (stake * distributable) / m.yesPool;
        } else {
            uint256 stake = noBets[marketId][msg.sender];
            if (stake == 0) revert NothingToClaim();
            uint256 losingPool = m.yesPool;
            uint256 fee = (losingPool * FEE_BPS) / BPS_DENOMINATOR;
            uint256 distributable = uint256(m.noPool) + losingPool - fee;
            payout = (stake * distributable) / m.noPool;
        }

        hasClaimed[marketId][msg.sender] = true;
        emit Claimed(marketId, msg.sender, payout);

        bool ok = bettingToken.transfer(msg.sender, payout);
        if (!ok) revert TransferFailed();
    }

    function refund(uint256 marketId) external {
        Market storage m = _markets[marketId];
        if (m.outcome != Outcome.Invalid) revert InvalidOutcome();
        if (hasClaimed[marketId][msg.sender]) revert AlreadyClaimed();

        uint256 amount = yesBets[marketId][msg.sender] + noBets[marketId][msg.sender];
        if (amount == 0) revert NothingToClaim();

        hasClaimed[marketId][msg.sender] = true;
        emit Refunded(marketId, msg.sender, amount);

        bool ok = bettingToken.transfer(msg.sender, amount);
        if (!ok) revert TransferFailed();
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function getMarket(uint256 marketId) external view returns (Market memory) {
        return _markets[marketId];
    }

    function getUserBets(address user) external view returns (uint256[] memory) {
        return _userBets[user];
    }

    function getUserCreated(address user) external view returns (uint256[] memory) {
        return _userCreated[user];
    }

    /// @notice Preview payout if `yesOutcome` were the result and user has the given bet.
    function previewPayout(uint256 marketId, address user, bool yesOutcome)
        external
        view
        returns (uint256)
    {
        Market memory m = _markets[marketId];
        uint256 stake = yesOutcome ? yesBets[marketId][user] : noBets[marketId][user];
        if (stake == 0) return 0;
        uint256 winningPool = yesOutcome ? m.yesPool : m.noPool;
        uint256 losingPool = yesOutcome ? m.noPool : m.yesPool;
        if (winningPool == 0) return 0;
        uint256 fee = (losingPool * FEE_BPS) / BPS_DENOMINATOR;
        uint256 distributable = winningPool + losingPool - fee;
        return (stake * distributable) / winningPool;
    }

    /// @notice Implied probability of YES, in basis points (0–10000).
    function impliedYesBps(uint256 marketId) external view returns (uint16) {
        Market memory m = _markets[marketId];
        uint256 total = uint256(m.yesPool) + m.noPool;
        if (total == 0) return 5000;
        return uint16((uint256(m.yesPool) * BPS_DENOMINATOR) / total);
    }
}

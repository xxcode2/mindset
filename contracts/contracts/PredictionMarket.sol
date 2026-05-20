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
 *      - If the resolver is on the `trustedResolver` whitelist (e.g. an automated oracle contract),
 *        the market is finalized in the same call.
 *      - Otherwise the call only PROPOSES an outcome and locks a `resolverBond`. The owner has
 *        REVIEW_PERIOD seconds to approveOutcome() (finalize) or rejectOutcome() (slash bond,
 *        invalidate market). If the owner stays silent past the deadline, anyone can call
 *        finalizeIfTimeout() to apply the resolver's proposal and refund the bond.
 *  4. Winners call claim() and receive a share of the entire pool proportional to their stake:
 *        payout = (userBet * distributable) / winningPool
 *     A 5% protocol fee is taken from the LOSING pool only and sent to feeRecipient.
 *  5. Safety net: if not resolved within RESOLUTION_GRACE_PERIOD after closeTime, anyone can call
 *     markInvalid(); bettors then call refund() to recover their stake. No funds get stuck.
 *
 * Trust model:
 *  - `owner` is a single role with two narrow powers: maintain the trustedResolver whitelist, and
 *    approve/reject pending outcome proposals from non-trusted resolvers. The owner cannot move
 *    user funds, cannot change fees, and cannot upgrade the contract.
 *  - feeRecipient and bettingToken are set in the constructor and immutable forever.
 *  - Each market's resolver is chosen by the creator. For human resolvers the bond + review window
 *    bounds the damage of a dishonest resolution: at worst the market becomes Invalid and everyone
 *    refunds (winners lose profit but not principal). For trusted oracle contracts the resolution
 *    is instant and bond-free.
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
        // Two-phase resolution state (only used for non-trusted resolvers)
        Outcome proposedOutcome;     // Unresolved when no proposal is pending
        uint64 proposedAt;            // timestamp the proposal was submitted (0 if none)
        uint128 resolverBondLocked;   // bond held in escrow for the pending proposal
    }

    uint256 public constant RESOLUTION_GRACE_PERIOD = 7 days;
    uint256 public constant REVIEW_PERIOD = 3 days;
    uint16 public constant FEE_BPS = 500; // 5.00%
    uint16 public constant BPS_DENOMINATOR = 10_000;

    /// @notice Fixed fee (in betting token units) charged when creating a market. Sent to feeRecipient.
    ///         Set to 5 USDC (5 * 10^6) assuming 6-decimal token. Immutable.
    uint256 public immutable creationFee;

    /// @notice Bond (in betting token units) that a non-trusted resolver must lock when proposing
    ///         an outcome. Returned on approval or timeout finalization, slashed to feeRecipient on rejection.
    uint256 public immutable resolverBond;

    /// @notice ERC20 token used for all bets and payouts. Immutable.
    IERC20 public immutable bettingToken;
    /// @notice Receives the protocol fee from losing pools + creation fees + slashed resolver bonds. Immutable.
    address public immutable feeRecipient;

    /// @notice Single role permitted to approve/reject pending outcome proposals and to maintain
    ///         the trustedResolver whitelist. Cannot move user funds.
    address public owner;

    /// @notice Resolvers in this set bypass the review window — their resolve() calls finalize the
    ///         market in the same transaction and they pay no bond. Intended for automated, trustless
    ///         resolver contracts (e.g. ChainlinkPriceResolver).
    mapping(address => bool) public trustedResolver;

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
    event OutcomeProposed(
        uint256 indexed marketId,
        address indexed resolver,
        Outcome proposedOutcome,
        uint64 reviewDeadline,
        uint256 bondLocked
    );
    event OutcomeApproved(uint256 indexed marketId, address indexed approver);
    event OutcomeRejected(uint256 indexed marketId, address indexed rejecter, uint256 bondSlashed);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event TrustedResolverSet(address indexed resolver, bool trusted);

    error InvalidFeeRecipient();
    error InvalidToken();
    error InvalidResolver();
    error InvalidOwner();
    error EmptyQuestion();
    error CloseTimeInPast();
    error MarketNotOpen();
    error MarketNotClosed();
    error MarketAlreadyResolved();
    error AlreadyClaimed();
    error InvalidOutcome();
    error NotResolver();
    error NotOwner();
    error NothingToClaim();
    error NotInGracePeriod();
    error TransferFailed();
    error ZeroBet();
    error CreationFeeFailed();
    error AlreadyProposed();
    error NoProposal();
    error ReviewPeriodOver();
    error StillInReview();
    error HasPendingProposal();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(
        IERC20 _bettingToken,
        address _feeRecipient,
        uint256 _creationFee,
        address _owner,
        uint256 _resolverBond
    ) {
        if (address(_bettingToken) == address(0)) revert InvalidToken();
        if (_feeRecipient == address(0)) revert InvalidFeeRecipient();
        if (_owner == address(0)) revert InvalidOwner();
        bettingToken = _bettingToken;
        feeRecipient = _feeRecipient;
        creationFee = _creationFee;
        resolverBond = _resolverBond;
        owner = _owner;
        emit OwnershipTransferred(address(0), _owner);
    }

    // ─── Owner administration ────────────────────────────────────────────────

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidOwner();
        address prev = owner;
        owner = newOwner;
        emit OwnershipTransferred(prev, newOwner);
    }

    /// @notice Mark a resolver address as trusted. Trusted resolvers finalize markets immediately
    ///         and pay no bond. Use for audited oracle contracts only.
    function setTrustedResolver(address resolver_, bool trusted) external onlyOwner {
        if (resolver_ == address(0)) revert InvalidResolver();
        trustedResolver[resolver_] = trusted;
        emit TrustedResolverSet(resolver_, trusted);
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

        // Charge creation fee (anti-spam). Requires prior approval.
        if (creationFee > 0) {
            bool ok = bettingToken.transferFrom(msg.sender, feeRecipient, creationFee);
            if (!ok) revert CreationFeeFailed();
        }

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
            category: category,
            proposedOutcome: Outcome.Unresolved,
            proposedAt: 0,
            resolverBondLocked: 0
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

    /**
     * @notice Resolve (or propose to resolve) a market.
     *         - Trusted resolvers: finalizes in the same call, no bond.
     *         - Non-trusted (human) resolvers: locks `resolverBond`, sets a pending proposal that
     *           the owner can approve/reject within REVIEW_PERIOD. After the window expires anyone
     *           can call finalizeIfTimeout() to apply the proposal.
     *         - Edge case: if the proposed winning side has zero pool, the market is immediately
     *           marked Invalid (regardless of trust), bypassing the bond/review entirely so
     *           bettors can refund.
     */
    function resolve(uint256 marketId, bool yesWon) external {
        Market storage m = _markets[marketId];
        if (msg.sender != m.resolver) revert NotResolver();
        if (m.outcome != Outcome.Unresolved) revert MarketAlreadyResolved();
        if (m.proposedOutcome != Outcome.Unresolved) revert AlreadyProposed();
        if (block.timestamp < m.closeTime) revert MarketNotClosed();

        uint256 winningPool = yesWon ? m.yesPool : m.noPool;

        // Edge case: if no one bet on the winning side, no one can claim. Falling through with
        // a normal resolve would let the fee leave the contract and trap the rest of the funds.
        // Instead, mark the market Invalid so every bettor can refund their original stake.
        if (winningPool == 0) {
            m.outcome = Outcome.Invalid;
            emit MarketInvalidated(marketId);
            emit MarketResolved(marketId, Outcome.Invalid, 0);
            return;
        }

        Outcome outcome = yesWon ? Outcome.Yes : Outcome.No;

        if (trustedResolver[msg.sender]) {
            _finalize(marketId, outcome);
            return;
        }

        // Human resolver path: propose + bond + wait for owner.
        m.proposedOutcome = outcome;
        m.proposedAt = uint64(block.timestamp);

        if (resolverBond > 0) {
            m.resolverBondLocked = uint128(resolverBond);
            bool ok = bettingToken.transferFrom(msg.sender, address(this), resolverBond);
            if (!ok) revert TransferFailed();
        }

        emit OutcomeProposed(
            marketId,
            msg.sender,
            outcome,
            uint64(block.timestamp + REVIEW_PERIOD),
            resolverBond
        );
    }

    /// @notice Owner approves a pending proposal — finalizes the market and refunds the resolver's bond.
    function approveOutcome(uint256 marketId) external onlyOwner {
        Market storage m = _markets[marketId];
        if (m.outcome != Outcome.Unresolved) revert MarketAlreadyResolved();
        if (m.proposedOutcome == Outcome.Unresolved) revert NoProposal();

        Outcome outcome = m.proposedOutcome;
        uint256 bond = m.resolverBondLocked;
        address resolverAddr = m.resolver;
        m.resolverBondLocked = 0;
        m.proposedOutcome = Outcome.Unresolved;

        emit OutcomeApproved(marketId, msg.sender);
        _finalize(marketId, outcome);

        if (bond > 0) {
            bool ok = bettingToken.transfer(resolverAddr, bond);
            if (!ok) revert TransferFailed();
        }
    }

    /// @notice Owner rejects a pending proposal — slashes the resolver's bond and invalidates the
    ///         market so all bettors can refund their stake. Only callable during the review window.
    function rejectOutcome(uint256 marketId) external onlyOwner {
        Market storage m = _markets[marketId];
        if (m.outcome != Outcome.Unresolved) revert MarketAlreadyResolved();
        if (m.proposedOutcome == Outcome.Unresolved) revert NoProposal();
        if (block.timestamp >= uint256(m.proposedAt) + REVIEW_PERIOD) revert ReviewPeriodOver();

        uint256 bond = m.resolverBondLocked;
        m.resolverBondLocked = 0;
        m.proposedOutcome = Outcome.Unresolved;
        m.outcome = Outcome.Invalid;

        emit OutcomeRejected(marketId, msg.sender, bond);
        emit MarketInvalidated(marketId);

        if (bond > 0) {
            bool ok = bettingToken.transfer(feeRecipient, bond);
            if (!ok) revert TransferFailed();
        }
    }

    /// @notice After REVIEW_PERIOD with no owner action, anyone can finalize the resolver's proposal.
    ///         Default-trust: silent owner = approval. Bond is refunded to the resolver.
    function finalizeIfTimeout(uint256 marketId) external {
        Market storage m = _markets[marketId];
        if (m.outcome != Outcome.Unresolved) revert MarketAlreadyResolved();
        if (m.proposedOutcome == Outcome.Unresolved) revert NoProposal();
        if (block.timestamp < uint256(m.proposedAt) + REVIEW_PERIOD) revert StillInReview();

        Outcome outcome = m.proposedOutcome;
        uint256 bond = m.resolverBondLocked;
        address resolverAddr = m.resolver;
        m.resolverBondLocked = 0;
        m.proposedOutcome = Outcome.Unresolved;

        _finalize(marketId, outcome);

        if (bond > 0) {
            bool ok = bettingToken.transfer(resolverAddr, bond);
            if (!ok) revert TransferFailed();
        }
    }

    /// @notice After grace period, anyone can mark a stuck market as invalid so bettors get refunds.
    ///         Blocked while a resolver proposal is pending — finalizeIfTimeout() handles that case.
    function markInvalid(uint256 marketId) external {
        Market storage m = _markets[marketId];
        if (m.outcome != Outcome.Unresolved) revert MarketAlreadyResolved();
        if (m.proposedOutcome != Outcome.Unresolved) revert HasPendingProposal();
        if (block.timestamp < uint256(m.closeTime) + RESOLUTION_GRACE_PERIOD) revert NotInGracePeriod();

        m.outcome = Outcome.Invalid;
        emit MarketInvalidated(marketId);
    }

    function _finalize(uint256 marketId, Outcome outcome) internal {
        Market storage m = _markets[marketId];
        m.outcome = outcome;

        bool yesWon = (outcome == Outcome.Yes);
        uint256 losingPool = yesWon ? m.noPool : m.yesPool;
        uint256 fee = (losingPool * FEE_BPS) / BPS_DENOMINATOR;

        emit MarketResolved(marketId, outcome, fee);

        if (fee > 0) {
            bool ok = bettingToken.transfer(feeRecipient, fee);
            if (!ok) revert TransferFailed();
        }
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

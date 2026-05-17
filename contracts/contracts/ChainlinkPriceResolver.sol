// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PredictionMarket.sol";

/// Minimal Chainlink AggregatorV3 interface — only what we read.
interface AggregatorV3Interface {
    function decimals() external view returns (uint8);
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        );
}

/**
 * @title ChainlinkPriceResolver
 * @notice Auto-resolves PredictionMarket questions of the form
 *           "Will <feed> be {>,>=,<,<=} <threshold> at <closeTime>?"
 *
 * Flow:
 *   1. Creator calls PredictionMarket.createMarket(..., resolver = address(this), category = Price).
 *   2. Same creator calls registerCondition(marketId, feed, comparator, threshold) on this contract,
 *      one block later. Conditions are bound to (marketId, creator) so only the creator can register.
 *   3. After closeTime, ANYONE can call resolveMarket(marketId): we read the feed at the most recent
 *      round, evaluate the condition, and call PredictionMarket.resolve() on behalf of this contract.
 *
 * Trust model:
 *   - This contract has no admin, no owner, no upgrade path.
 *   - It only ever calls PredictionMarket.resolve(); it never moves user tokens.
 *   - Anyone can trigger resolution after closeTime — no privileged operator required.
 *   - The price source (Chainlink feed) is whatever the creator chose at registration; it is not
 *     mutable. Bettors should verify the feed address before placing bets.
 */
contract ChainlinkPriceResolver {
    enum Comparator { GreaterThan, GreaterOrEqual, LessThan, LessOrEqual }

    struct Condition {
        address creator;       // who registered (must match market creator)
        address feed;          // Chainlink AggregatorV3 proxy
        Comparator comparator; // YES wins iff price <comp> threshold
        int256 threshold;      // expressed in feed's native decimals (e.g. 8 dp for BTC/USD)
        uint256 maxStaleness;  // seconds; latestRoundData.updatedAt must be within this window
    }

    PredictionMarket public immutable market;

    /// @notice marketId => condition
    mapping(uint256 => Condition) public conditions;

    event ConditionRegistered(
        uint256 indexed marketId,
        address indexed creator,
        address indexed feed,
        Comparator comparator,
        int256 threshold,
        uint256 maxStaleness
    );
    event AutoResolved(
        uint256 indexed marketId,
        bool yesWon,
        int256 priceObserved,
        uint256 priceUpdatedAt
    );

    error AlreadyRegistered();
    error NotMarketCreator();
    error WrongResolver();
    error ConditionMissing();
    error MarketNotClosed();
    error MarketAlreadyResolved();
    error StalePrice();
    error InvalidPrice();
    error InvalidFeed();
    error InvalidStaleness();

    constructor(PredictionMarket _market) {
        market = _market;
    }

    /**
     * @notice Bind on-chain conditions to a market that was just created with this contract as resolver.
     * @param marketId        The newly created market id.
     * @param feed            Chainlink AggregatorV3 proxy address (e.g. BTC/USD).
     * @param comparator      How to evaluate the price against the threshold.
     * @param threshold       Threshold expressed in the feed's native decimals.
     * @param maxStaleness    Max acceptable seconds between price update and resolution call.
     *
     * Restrictions:
     * - Only the creator of `marketId` may register, and only once.
     * - The market's resolver must be this contract (set at createMarket time).
     */
    function registerCondition(
        uint256 marketId,
        address feed,
        Comparator comparator,
        int256 threshold,
        uint256 maxStaleness
    ) external {
        if (feed == address(0)) revert InvalidFeed();
        if (maxStaleness == 0 || maxStaleness > 7 days) revert InvalidStaleness();
        if (conditions[marketId].feed != address(0)) revert AlreadyRegistered();

        PredictionMarket.Market memory m = market.getMarket(marketId);
        if (m.resolver != address(this)) revert WrongResolver();
        if (m.creator != msg.sender) revert NotMarketCreator();

        // Sanity-check the feed responds. Reverts if call fails.
        AggregatorV3Interface(feed).decimals();

        conditions[marketId] = Condition({
            creator: msg.sender,
            feed: feed,
            comparator: comparator,
            threshold: threshold,
            maxStaleness: maxStaleness
        });

        emit ConditionRegistered(marketId, msg.sender, feed, comparator, threshold, maxStaleness);
    }

    /// @notice Anyone can call this once the market has closed and a condition is registered.
    function resolveMarket(uint256 marketId) external {
        Condition memory c = conditions[marketId];
        if (c.feed == address(0)) revert ConditionMissing();

        PredictionMarket.Market memory m = market.getMarket(marketId);
        if (m.outcome != PredictionMarket.Outcome.Unresolved) revert MarketAlreadyResolved();
        if (block.timestamp < m.closeTime) revert MarketNotClosed();

        (, int256 price, , uint256 updatedAt, ) = AggregatorV3Interface(c.feed).latestRoundData();
        if (price <= 0) revert InvalidPrice();
        if (updatedAt == 0 || block.timestamp - updatedAt > c.maxStaleness) revert StalePrice();

        bool yesWon = _evaluate(c.comparator, price, c.threshold);

        emit AutoResolved(marketId, yesWon, price, updatedAt);
        market.resolve(marketId, yesWon);
    }

    function _evaluate(Comparator cmp, int256 price, int256 threshold) internal pure returns (bool) {
        if (cmp == Comparator.GreaterThan) return price > threshold;
        if (cmp == Comparator.GreaterOrEqual) return price >= threshold;
        if (cmp == Comparator.LessThan) return price < threshold;
        return price <= threshold; // LessOrEqual
    }

    // ─── Views ─────────────────────────────────────────────────────────────

    /// @notice Read the current feed price + decimals for UI preview. Returns (price, decimals, updatedAt).
    function previewPrice(address feed) external view returns (int256 price, uint8 decimals_, uint256 updatedAt) {
        if (feed == address(0)) revert InvalidFeed();
        decimals_ = AggregatorV3Interface(feed).decimals();
        (, price, , updatedAt, ) = AggregatorV3Interface(feed).latestRoundData();
    }

    /// @notice Returns the boolean outcome that resolveMarket() WOULD produce with the latest feed value.
    ///         Reverts if no condition is registered.
    function previewResolution(uint256 marketId) external view returns (bool yesWon, int256 priceObserved, uint256 updatedAt) {
        Condition memory c = conditions[marketId];
        if (c.feed == address(0)) revert ConditionMissing();
        (, int256 price, , uint256 t, ) = AggregatorV3Interface(c.feed).latestRoundData();
        if (price <= 0) revert InvalidPrice();
        return (_evaluate(c.comparator, price, c.threshold), price, t);
    }
}

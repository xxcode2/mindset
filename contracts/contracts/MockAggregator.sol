// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockAggregator
 * @notice Minimal AggregatorV3 stand-in for tests. Pretend Chainlink price feed.
 */
contract MockAggregator {
    uint8 private immutable _decimals;
    int256 public price;
    uint256 public updatedAt;

    constructor(uint8 d, int256 initialPrice) {
        _decimals = d;
        price = initialPrice;
        updatedAt = block.timestamp;
    }

    function setPrice(int256 newPrice) external {
        price = newPrice;
        updatedAt = block.timestamp;
    }

    /// @notice Stamp the answer's `updatedAt` to a specific past timestamp, to simulate stale feeds.
    function setUpdatedAt(uint256 t) external {
        updatedAt = t;
    }

    function decimals() external view returns (uint8) {
        return _decimals;
    }

    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (1, price, updatedAt, updatedAt, 1);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title TickContract
 * @dev A simple contract example that can be called by Cron tasks
 * @notice This contract demonstrates how to create a contract that can be called periodically by the Helios Cron system
 */
contract TickContract {
    // State variables
    address public owner;
    uint256 public tickCount;
    uint256 public lastTickTimestamp;
    uint256 public lastTickBlock;
    bool public isPaused;
    
    // Events
    event Ticked(uint256 indexed tickNumber, uint256 timestamp, uint256 blockNumber, address caller);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ContractPaused(bool paused);
    
    // Modifiers
    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this function");
        _;
    }
    
    modifier whenNotPaused() {
        require(!isPaused, "Contract is paused");
        _;
    }
    
    /**
     * @dev Constructor
     */
    constructor() {
        owner = msg.sender;
        tickCount = 0;
        lastTickTimestamp = block.timestamp;
        lastTickBlock = block.number;
        isPaused = false;
        
        emit OwnershipTransferred(address(0), owner);
    }
    
    /**
     * @dev Main tick function - This is the function that Cron tasks will call
     * @notice This function will be called periodically by the Helios Cron system
     */
    function tick() external whenNotPaused {
        // Increment call counter
        tickCount++;
        
        // Update timestamp and block number
        lastTickTimestamp = block.timestamp;
        lastTickBlock = block.number;
        
        // Emit event
        emit Ticked(tickCount, lastTickTimestamp, lastTickBlock, msg.sender);
        
        // Add your business logic here
        _executeBusinessLogic();
    }
    
    /**
     * @dev Internal business logic function
     * @notice Implement your specific business logic here
     */
    function _executeBusinessLogic() internal {
        // Example business logic:
        // 1. Update certain states
        // 2. Distribute rewards
        // 3. Clean up expired data
        // 4. Trigger other contract calls
        
        // This is just a simple example
        // You can implement specific business logic as needed
    }
    
    /**
     * @dev Get contract basic information
     */
    function getContractInfo() external view returns (
        uint256 _tickCount,
        uint256 _lastTickTimestamp,
        uint256 _lastTickBlock,
        bool _isPaused,
        address _owner
    ) {
        return (tickCount, lastTickTimestamp, lastTickBlock, isPaused, owner);
    }
    
    /**
     * @dev Calculate time interval since last tick
     */
    function getTimeSinceLastTick() external view returns (uint256) {
        return block.timestamp - lastTickTimestamp;
    }
    
    /**
     * @dev Calculate block interval since last tick
     */
    function getBlocksSinceLastTick() external view returns (uint256) {
        return block.number - lastTickBlock;
    }
    
    /**
     * @dev Pause/resume contract
     * @param _paused Whether to pause
     */
    function setPaused(bool _paused) external onlyOwner {
        isPaused = _paused;
        emit ContractPaused(_paused);
    }
    
    /**
     * @dev Transfer ownership
     * @param newOwner New owner address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
    
    /**
     * @dev Emergency withdrawal function (if contract receives ETH)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No balance to withdraw");
        
        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
    
    /**
     * @dev Allow contract to receive ETH
     */
    receive() external payable {}
    
    /**
     * @dev Fallback 函数
     */
    fallback() external payable {}
}

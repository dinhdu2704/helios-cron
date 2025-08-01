const { ethers } = require("ethers");

/**
 * Delay execution
 * @param {number} ms Delay milliseconds
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format block count to time estimation
 * @param {number} blocks Block count
 * @param {number} blockTime Average block time (seconds)
 */
function formatBlocksToTime(blocks, blockTime = 1.2) {
  const seconds = blocks * blockTime;
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} days ${hours % 24} hours`;
  if (hours > 0) return `${hours} hours ${minutes % 60} minutes`;
  return `${minutes} minutes`;
}

/**
 * Log task details
 */
function logJobDetails(config, currentBlock, expiration) {
  console.log("\n🔧 Task configuration details:");
  console.log(`  📍 Target contract: ${config.TARGET_CONTRACT}`);
  console.log(`  ⏰ Execution frequency: Every ${config.FREQUENCY} blocks (~${formatBlocksToTime(config.FREQUENCY)})`);
  console.log(`  💰 Deposit amount: ${config.DEPOSIT} ETH`);
  console.log(`  ⛽ Gas limit: ${config.GAS_LIMIT.toLocaleString()}`);
  console.log(`  💸 Gas price: ${config.GAS_PRICE} gwei`);
  console.log(`  📊 Current block: ${currentBlock.toLocaleString()}`);
  console.log(`  ⏳ Expiration block: ${expiration.toLocaleString()}`);
  console.log(`  📅 Validity period: ${formatBlocksToTime(expiration - currentBlock)}`);
  console.log("");
}

/**
 * Log transaction status
 */
function logTransactionStatus(hash, status = 'pending') {
  const statusEmoji = {
    pending: '⏳',
    success: '✅',
    failed: '❌'
  };
  
  console.log(`${statusEmoji[status]} Transaction status: ${status.toUpperCase()}`);
  console.log(`🔗 Transaction hash: ${hash}`);
  
  if (status === 'success') {
    console.log("🎉 Cron task registration successful!");
  }
}

/**
 * Retry execution function
 * @param {Function} fn Async function to execute
 * @param {number} maxRetries Maximum retry attempts
 * @param {number} retryDelay Retry delay
 */
async function withRetry(fn, maxRetries = 3, retryDelay = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      console.log(`❌ Attempt ${attempt}/${maxRetries} failed: ${error.message}`);
      
      if (attempt === maxRetries) {
        throw new Error(`All retries failed. Last error: ${error.message}`);
      }
      
      console.log(`⏳ Retrying in ${retryDelay/1000} seconds...`);
      await delay(retryDelay);
    }
  }
}

module.exports = {
  delay,
  formatBlocksToTime,
  logJobDetails,
  logTransactionStatus,
  withRetry
};

require('dotenv').config();

const CONFIG = {
  // Network configuration
  RPC_URL: process.env.RPC_URL || "https://testnet1.helioschainlabs.org",
  CRON_ADDRESS: "0x0000000000000000000000000000000000000830",
  
  // Contract configuration
  TARGET_CONTRACT: process.env.TARGET_CONTRACT,
  PRIVATE_KEY: process.env.PRIVATE_KEY,
  
  // Cron task configuration
  FREQUENCY: parseInt(process.env.FREQUENCY) || 300, // Execute every 300 blocks
  GAS_LIMIT: parseInt(process.env.GAS_LIMIT) || 300_000,
  GAS_PRICE: process.env.GAS_PRICE || "2", // gwei
  DEPOSIT: process.env.DEPOSIT || "0.02", // ETH
  VALIDITY_WEEKS: parseInt(process.env.VALIDITY_WEEKS) || 2,
  
  // Retry configuration
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES) || 3,
  RETRY_DELAY: parseInt(process.env.RETRY_DELAY) || 2000, // ms
};

// Validate required configuration
function validateConfig() {
  const required = ['TARGET_CONTRACT', 'PRIVATE_KEY'];
  const missing = required.filter(key => !CONFIG[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Validate private key format
  if (!CONFIG.PRIVATE_KEY.startsWith('0x') || CONFIG.PRIVATE_KEY.length !== 66) {
    throw new Error('Invalid private key format, should start with 0x and be 66 characters long');
  }
  
  // Validate contract address format
  if (!CONFIG.TARGET_CONTRACT.startsWith('0x') || CONFIG.TARGET_CONTRACT.length !== 42) {
    throw new Error('Invalid contract address format, should start with 0x and be 42 characters long');
  }
}

module.exports = {
  CONFIG,
  validateConfig
};

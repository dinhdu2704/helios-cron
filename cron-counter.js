const { CONFIG, validateConfig } = require('./config');
const CronManager = require('./cronManager');

async function main() {
  try {
    console.log("🚀 Helios Cron task scheduler starting...\n");
    
    // Validate configuration
    validateConfig();
    console.log("✅ Configuration validation passed");
    
    // Create CronManager instance
    const cronManager = new CronManager(CONFIG);
    
    // Create Cron task (with retry)
    const result = await cronManager.createCronWithRetry();
    
    console.log("\n🎉 Task completed!");
    console.log(`📋 Transaction hash: ${result.txHash}`);
    console.log("📖 You can view transaction details in the block explorer");
    
  } catch (error) {
    console.error("\n❌ Execution failed:");
    console.error(`💥 Error message: ${error.message}`);
    
    // Provide suggestions for common errors
    if (error.message.includes('Insufficient balance')) {
      console.log("\n💡 Solution suggestions:");
      console.log("  - Please ensure wallet has sufficient ETH balance");
      console.log("  - Consider reducing deposit amount or lowering Gas price");
    } else if (error.message.includes('environment variables')) {
      console.log("\n💡 Solution suggestions:");
      console.log("  - Please copy .env.example to .env");
      console.log("  - Set correct configuration values in .env file");
    }
    
    process.exit(1);
  }
}

// Gracefully handle process exit
process.on('SIGINT', () => {
  console.log('\n👋 Program interrupted by user');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise rejection:', reason);
  process.exit(1);
});

main();

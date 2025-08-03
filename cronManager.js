const { ethers } = require("ethers");
const { logJobDetails, logTransactionStatus, withRetry } = require("./utils");

class CronManager {
  constructor(config) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.RPC_URL);
    this.wallet = new ethers.Wallet(config.PRIVATE_KEY, this.provider);
    
    // Target contract ABI - only contains tick function
    this.targetAbi = JSON.stringify([
      {
        name: "tick",
        type: "function",
        inputs: [],
        outputs: [],
        stateMutability: "nonpayable"
      }
    ]);
    
    // Cron precompiled contract ABI
    this.cronAbi = [
      {
        "inputs": [
          { "internalType": "address", "name": "contractAddress", "type": "address" },
          { "internalType": "string", "name": "abi", "type": "string" },
          { "internalType": "string", "name": "methodName", "type": "string" },
          { "internalType": "string[]", "name": "params", "type": "string[]" },
          { "internalType": "uint64", "name": "frequency", "type": "uint64" },
          { "internalType": "uint64", "name": "expirationBlock", "type": "uint64" },
          { "internalType": "uint64", "name": "gasLimit", "type": "uint64" },
          { "internalType": "uint256", "name": "maxGasPrice", "type": "uint256" },
          { "internalType": "uint256", "name": "amountToDeposit", "type": "uint256" }
        ],
        "name": "createCron",
        "outputs": [{ "internalType": "bool", "name": "success", "type": "bool" }],
        "stateMutability": "nonpayable",
        "type": "function"
      }
    ];
    
    this.cronContract = new ethers.Contract(config.CRON_ADDRESS, this.cronAbi, this.wallet);
  }

  /**
   * Check if wallet balance is sufficient
   */
  async checkBalance() {
    console.log("💰 Checking wallet balance...");
    
    try {
      const balance = await this.provider.getBalance(this.wallet.address);
      const requiredAmount = ethers.parseEther(this.config.DEPOSIT);
      const gasEstimate = ethers.parseUnits(this.config.GAS_PRICE, "gwei") * BigInt(this.config.GAS_LIMIT + 200_000);
      const totalRequired = requiredAmount + gasEstimate;
      
      console.log(`  📊 Wallet address: ${this.wallet.address}`);
      console.log(`  💰 Current balance: ${ethers.formatEther(balance)} HLS`);
      console.log(`  💸 Deposit amount: ${this.config.DEPOSIT} HLS`);
      console.log(`  ⛽ Estimated Gas: ${ethers.formatEther(gasEstimate)} HLS`);
      console.log(`  📋 Total required: ${ethers.formatEther(totalRequired)} HLS`);
      
      if (balance < totalRequired) {
        throw new Error(`Insufficient balance! Need at least ${ethers.formatEther(totalRequired)} HLS, current balance: ${ethers.formatEther(balance)} HLS`);
      }
      
      console.log("✅ Balance check passed");
          } catch (error) {
        if (error.message.includes('Insufficient balance')) {
          throw error;
        }
        throw new Error(`Balance check failed: ${error.message}`);
      }
  }

  /**
   * Get current block number and calculate expiration block
   */
  async getBlockInfo() {
    console.log("📊 Getting block information...");
    
    const currentBlock = await this.provider.getBlockNumber();
    const blocksInWeek = 7 * 24 * 60 * 60 / 1.2; // Assuming average 1.2 seconds per block
    const expiration = currentBlock + Math.floor(blocksInWeek * this.config.VALIDITY_WEEKS);
    
    return { currentBlock, expiration };
  }

  /**
   * Create Cron task
   */
  async createCron() {
    console.log("🚀 Starting to create Cron task...\n");
    
    // Check balance
    await this.checkBalance();
    
    // Get block information
    const { currentBlock, expiration } = await this.getBlockInfo();
    
    // Log task details
    logJobDetails(this.config, currentBlock, expiration);
    
    // Prepare transaction parameters
    const gasPrice = ethers.parseUnits(this.config.GAS_PRICE, "gwei");
    const deposit = ethers.parseEther(this.config.DEPOSIT);
    
    console.log("📝 Preparing to send transaction...");
    
    // Send transaction
    const tx = await this.cronContract.createCron(
      this.config.TARGET_CONTRACT,
      this.targetAbi,
      "tick",
      [], // 无参数
      this.config.FREQUENCY,
      expiration,
      this.config.GAS_LIMIT,
      gasPrice,
      deposit,
      {
        gasLimit: this.config.GAS_LIMIT + 50_000,
        gasPrice
      }
    );
    
    logTransactionStatus(tx.hash, 'pending');
    
    // Wait for transaction confirmation
    console.log("⏳ Waiting for transaction confirmation...");
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      logTransactionStatus(tx.hash, 'success');
      return { success: true, txHash: tx.hash, receipt };
    } else {
      logTransactionStatus(tx.hash, 'failed');
      throw new Error('Transaction execution failed');
    }
  }

  /**
   * Create Cron task with retry
   */
  async createCronWithRetry() {
    return withRetry(
      () => this.createCron(),
      this.config.MAX_RETRIES,
      this.config.RETRY_DELAY
    );
  }
}

module.exports = CronManager;

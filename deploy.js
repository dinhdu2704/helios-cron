const { ethers } = require("ethers");
const fs = require('fs');
const path = require('path');

// Load configuration from .env file
require('dotenv').config();

class ContractDeployer {
  constructor() {
    this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "https://testnet1.helioschainlabs.org");
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    
    console.log("🚀 Contract deployer initialization completed");
    console.log(`📍 Deploy wallet: ${this.wallet.address}`);
    console.log(`🌐 Network: ${process.env.RPC_URL || "https://testnet1.helioschainlabs.org"}`);
  }

  /**
   * Get current nonce for the wallet
   */
  async getCurrentNonce() {
    const nonce = await this.provider.getTransactionCount(this.wallet.address, "latest");
    console.log(`🔢 Current nonce: ${nonce}`);
    return nonce;
  }

  /**
   * Wait for pending transactions to be confirmed
   */
  async waitForPendingTransactions() {
    console.log("⏳ Checking for pending transactions...");
    const nonce = await this.getCurrentNonce();
    const pendingNonce = await this.provider.getTransactionCount(this.wallet.address, "pending");
    
    if (pendingNonce > nonce) {
      console.log(`⚠️  Found ${pendingNonce - nonce} pending transaction(s), waiting for confirmation...`);
      // Wait a bit for pending transactions to be confirmed
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      const newNonce = await this.getCurrentNonce();
      console.log(`✅ Nonce updated to: ${newNonce}`);
    } else {
      console.log("✅ No pending transactions found");
    }
  }

  /**
   * Reset wallet nonce (useful for nonce mismatch issues)
   */
  async resetNonce() {
    console.log("🔄 Resetting wallet nonce...");
    // Clear the nonce cache by reconnecting the wallet
    this.wallet = new ethers.Wallet(process.env.PRIVATE_KEY, this.provider);
    const nonce = await this.getCurrentNonce();
    console.log(`✅ Nonce reset to: ${nonce}`);
    return nonce;
  }

  /**
   * Read contract source code
   */
  readContractSource() {
    const contractPath = path.join(__dirname, 'contracts', 'TickContract.sol');
    
    if (!fs.existsSync(contractPath)) {
      throw new Error(`Contract file does not exist: ${contractPath}`);
    }
    
    return fs.readFileSync(contractPath, 'utf8');
  }

  /**
   * Compile contract (requires solc)
   */
  async compileContract() {
    console.log("📝 Starting contract compilation...");
    
    try {
      const solc = require('solc');
      const source = this.readContractSource();
      
      const input = {
        language: 'Solidity',
        sources: {
          'TickContract.sol': {
            content: source
          }
        },
        settings: {
          outputSelection: {
            '*': {
              '*': ['*']
            }
          }
        }
      };
      
      const output = JSON.parse(solc.compile(JSON.stringify(input)));
      
      if (output.errors) {
        const errors = output.errors.filter(error => error.severity === 'error');
        if (errors.length > 0) {
          console.error("❌ Compilation errors:");
          errors.forEach(error => console.error(error.formattedMessage));
          throw new Error("Contract compilation failed");
        }
      }
      
      const contract = output.contracts['TickContract.sol']['TickContract'];
      console.log("✅ Contract compilation successful");
      
      return {
        abi: contract.abi,
        bytecode: contract.evm.bytecode.object
      };
      
    } catch (error) {
      if (error.code === 'MODULE_NOT_FOUND') {
        console.log("⚠️  solc not installed, please compile contract manually or install solc:");
        console.log("npm install solc");
        throw new Error("Need to install solc compiler");
      }
      throw error;
    }
  }

  /**
   * Deploy contract
   */
  async deployContract() {
    console.log("🚀 Starting contract deployment...");
    
    try {
      // Check balance
      const balance = await this.provider.getBalance(this.wallet.address);
      console.log(`💰 Deploy wallet balance: ${ethers.formatEther(balance)} HLS`);
      
      if (balance < ethers.parseEther("0.01")) {
        throw new Error("Insufficient balance, need at least 0.01 HLS to deploy contract");
      }
      
      // Wait for any pending transactions to be confirmed
      await this.waitForPendingTransactions();
      
      // Get current nonce
      const nonce = await this.getCurrentNonce();
      
      // Compile contract
      const { abi, bytecode } = await this.compileContract();
      
      // Create contract factory
      const contractFactory = new ethers.ContractFactory(abi, bytecode, this.wallet);
      
      // Estimate Gas
      const deployTx = await contractFactory.getDeployTransaction();
      const gasEstimate = await this.provider.estimateGas(deployTx);
      const gasPrice = await this.provider.getFeeData();
      
      console.log(`⛽ Estimated Gas: ${gasEstimate.toString()}`);
      console.log(`💸 Estimated cost: ${ethers.formatEther(gasEstimate * gasPrice.gasPrice)} HLS`);
      
      // Deploy contract with explicit nonce
      console.log("📤 Sending deployment transaction...");
      let contract;
      try {
        contract = await contractFactory.deploy({
          gasLimit: gasEstimate + BigInt(500000), // Add some Gas buffer
          gasPrice: gasPrice.gasPrice,
          nonce: nonce
        });
      } catch (deployError) {
        // If nonce error occurs, try to reset and retry once
        if (deployError.message.includes("invalid nonce") || deployError.message.includes("sequence")) {
          console.log("⚠️  Nonce error detected, attempting to reset and retry...");
          await this.resetNonce();
          const newNonce = await this.getCurrentNonce();
          
          contract = await contractFactory.deploy({
            gasLimit: gasEstimate + BigInt(500000),
            gasPrice: gasPrice.gasPrice,
            nonce: newNonce
          });
        } else {
          throw deployError;
        }
      }
      
      console.log(`⏳ Deployment transaction hash: ${contract.deploymentTransaction().hash}`);
      console.log("⏳ Waiting for transaction confirmation...");
      
      // Wait for deployment to complete
      await contract.waitForDeployment();
      const contractAddress = await contract.getAddress();
      
      console.log("🎉 Contract deployment successful!");
      console.log(`📍 Contract address: ${contractAddress}`);
      
      // Verify deployment
      await this.verifyDeployment(contractAddress, abi);
      
      // Save deployment information
      this.saveDeploymentInfo(contractAddress, abi, contract.deploymentTransaction().hash);
      
      return {
        address: contractAddress,
        abi: abi,
        txHash: contract.deploymentTransaction().hash
      };
      
    } catch (error) {
      console.error("❌ Deployment failed:", error.message);
      throw error;
    }
  }

  /**
   * Verify deployment
   */
  async verifyDeployment(contractAddress, abi) {
    console.log("🔍 Verifying contract deployment...");
    
    try {
      const contract = new ethers.Contract(contractAddress, abi, this.provider);
      
      // Check contract code
      const code = await this.provider.getCode(contractAddress);
      if (code === '0x') {
        throw new Error("Contract address has no code");
      }
      
      // Call contract function to verify
      const contractInfo = await contract.getContractInfo();
      console.log("✅ Contract verification successful");
      console.log(`  📊 Tick count: ${contractInfo[0]}`);
      console.log(`  👤 Owner: ${contractInfo[4]}`);
      console.log(`  ⏸️  Paused: ${contractInfo[3]}`);
      
    } catch (error) {
      console.error("❌ Contract verification failed:", error.message);
      throw error;
    }
  }

  /**
   * Save deployment information
   */
  saveDeploymentInfo(address, abi, txHash) {
    const deploymentInfo = {
      address: address,
      txHash: txHash,
      deployedAt: new Date().toISOString(),
      network: process.env.RPC_URL || "https://testnet1.helioschainlabs.org",
      deployer: this.wallet.address,
      abi: abi
    };
    
    const deploymentPath = path.join(__dirname, 'deployment.json');
    fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
    
    console.log(`💾 Deployment information saved to: ${deploymentPath}`);
  }

  /**
   * Update contract address in .env file
   */
  updateEnvFile(contractAddress) {
    const envPath = path.join(__dirname, '.env');
    
    if (fs.existsSync(envPath)) {
      let envContent = fs.readFileSync(envPath, 'utf8');
      
      // Update or add TARGET_CONTRACT
      if (envContent.includes('TARGET_CONTRACT=')) {
        envContent = envContent.replace(/TARGET_CONTRACT=.*/g, `TARGET_CONTRACT=${contractAddress}`);
      } else {
        envContent += `\nTARGET_CONTRACT=${contractAddress}\n`;
      }
      
      fs.writeFileSync(envPath, envContent);
      console.log(`✅ .env file updated, TARGET_CONTRACT=${contractAddress}`);
    }
  }
}

async function main() {
  try {
    console.log("🚀 Starting smart contract deployment process...\n");
    
    const deployer = new ContractDeployer();
    const result = await deployer.deployContract();
    
    // Update environment variable file
    deployer.updateEnvFile(result.address);
    
    console.log("\n🎉 Deployment process completed!");
    console.log("📋 Deployment summary:");
    console.log(`  📍 Contract address: ${result.address}`);
    console.log(`  🔗 Transaction hash: ${result.txHash}`);
    console.log(`  💾 ABI saved to deployment.json`);
    console.log("\n📖 Next steps:");
    console.log("  1. Verify contract deployment in block explorer");
    console.log("  2. Run npm start to create Cron task");
    
  } catch (error) {
    console.error("\n❌ Deployment process failed:");
    console.error(`💥 Error: ${error.message}`);
    
    // Check for nonce-related errors
    if (error.message.includes("invalid nonce") || error.message.includes("sequence")) {
      console.log("\n🔧 Nonce mismatch detected! This usually happens when:");
      console.log("  - There are pending transactions that haven't been confirmed");
      console.log("  - The wallet was used elsewhere with a different nonce");
      console.log("  - Network issues caused transaction failures");
      
      console.log("\n💡 Solutions:");
      console.log("  1. Wait a few minutes and try again (pending transactions may confirm)");
      console.log("  2. Check your wallet in the block explorer for pending transactions");
      console.log("  3. If the issue persists, try using a different wallet");
      console.log("  4. The script now includes automatic nonce handling - try running it again");
    }
    
    console.log("\n💡 General troubleshooting:");
    console.log("  - Ensure PRIVATE_KEY in .env file is correct");
    console.log("  - Ensure wallet has sufficient HLS balance");
    console.log("  - Check network connection and RPC_URL");
    console.log("  - If compilation fails, install: npm install solc");
    
    process.exit(1);
  }
}

// If this file is run directly
if (require.main === module) {
  main();
}

module.exports = ContractDeployer;

import type { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import dotenv from 'dotenv';

// PriceFeed Tasks
import './tasks';

dotenv.config();

const config: HardhatUserConfig = {
  solidity: '0.8.28',
  networks: {
    base: {
      accounts: process.env.EVM_PRIVATE_KEY ? [process.env.EVM_PRIVATE_KEY] : [],
      url: 'https://mainnet.base.org',
      chainId: 8453,
    },
    baseSepolia: {
      accounts: process.env.EVM_PRIVATE_KEY ? [process.env.EVM_PRIVATE_KEY] : [],
      url: 'https://sepolia.base.org',
      chainId: 84532,
    },
    gnosisChiado: {
      accounts: process.env.EVM_PRIVATE_KEY ? [process.env.EVM_PRIVATE_KEY] : [],
      chainId: 10200,
      url: 'https://rpc.chiadochain.net',
    },
    superseedSepolia: {
      accounts: process.env.EVM_PRIVATE_KEY ? [process.env.EVM_PRIVATE_KEY] : [],
      url: 'https://sepolia.superseed.xyz',
      chainId: 53302,
    },
    hyperliquidPurrsec: {
      accounts: process.env.EVM_PRIVATE_KEY ? [process.env.EVM_PRIVATE_KEY] : [],
      chainId: 998,
      url: 'https://rpc.hyperliquid-testnet.xyz/evm',
    },
  },
  etherscan: {
    apiKey: process.env.BASE_SEPOLIA_ETHERSCAN_API_KEY || '',
  },
};

export default config;

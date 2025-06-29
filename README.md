# FundAGoal 🎯

**Anonymous Crowdfunding for the Privacy-First Era**

FundAGoal is a revolutionary decentralized crowdfunding platform that empowers creators to launch funding campaigns while protecting the privacy of both themselves and their supporters. Built on the Midnight Network, it combines the transparency of blockchain with the anonymity that backers deserve.

## What is FundAGoal?

FundAGoal reimagines crowdfunding by solving one of the biggest problems in traditional platforms: **backer's privacy**. While campaigns remain transparent and verifiable, the identity and contribution details of supporters are completely anonymous through advanced zero-knowledge cryptography.

### 🔒 **Complete Backer Anonymity**

Your supporters can fund campaigns without revealing:

- Their identity
- Their contribution amount
- Their funding patterns
- Any personal information

Unlike traditional crowdfunding platforms where backer lists are public, FundAGoal ensures that supporters remain completely anonymous while still providing cryptographic proof of their contributions.

## How It Works

### For Campaign Creators 📢

1. **Create Your Campaign**: Set your funding goal, duration, and campaign details
2. **Track Progress**: Monitor your campaign's progress in real-time
3. **Withdraw Funds**: Securely collect funds when your goal is reached
4. **Stay in Control**: Update, pause, or close your campaign anytime

### For Supporters 🤝

1. **Browse Campaigns**: Discover projects that matter to you
2. **Fund Anonymously**: Support campaigns without revealing your identity
3. **Stay Private**: Your contributions are completely confidential
4. **Get Refunds**: Request refunds under certain conditions if needed
5. **Verify Impact**: Know your contribution counts without exposing yourself

## Perfect For

### 🏛️ **Social Causes**

- Community initiatives
- Environmental projects
- Educational programs
- Humanitarian efforts

### 💡 **Innovation**

- Startup ideas
- Research projects
- Technology development
- Social enterprises

### 🔒 **Privacy-Sensitive Campaigns**

- Political movements
- Whistleblower support
- Controversial but legal causes
- Personal causes requiring discretion

## Key Features

- **Anonymous Backing**: Support projects without revealing your identity
- **Secure Fund Management**: Smart contracts protect both creators and backers
- **Flexible Campaigns**: Set goals, durations, and update as needed
- **Refund System**: Built-in mechanisms for refunds when appropriate
- **Zero Censorship**: Decentralized architecture resists takedowns
- **Zero-Knowledge Proofs**: Verify contributions without revealing details

## How to run the project locally

**Pre-requisite**

- Install compactc compiler (Guide): [https://docs.midnight.network/develop/tutorial/building/]#midnight-compact-compiler

- Install proof server from midnight: [https://docs.midnight.network/develop/tutorial/using/proof-server]

- Install prebaked proof server version (RECOMMENDED): [https://github.com/bricktowers/midnight-proof-server]

- Token Aquisation: [https://docs.midnight.network/develop/tutorial/using/proof-server]

- Lace wallet setup: [https://docs.midnight.network/develop/tutorial/using/chrome-ext]

- Contract Documentation: [https://github.com/codeBigInt/fundagoal/blob/main/packages/contract/README.md]

**NOTE**: This project is a monorepo that ustilizes turborepo.

```js

    /* Running the DApp locally */

    // Clone the repository locally
    git clone "https://github.com/codeBigInt/fundagoal.git"
    // Ensure your have the latest version or node version >=22
    node -v
    // Install dependencies
    yarn install
    // Build each workspace as theis project is a monoreapo (BUikt using turbo repo)
    cd packages/contract
    npx turbo run build // Compiles the smart contract and build using compactc copiler and builds the contract workspace

    // Build the api workspace
    cd .. && cd packages/api
    npx turbo run build

    // To run the cli DApp instance
    cd .. && cd packages/cli
    npx turbo run build
    // You can either run the cli DApp testnet mode or in undeployed mode
    yarn testnet-remote // For testnet-mode
    yarn standalone // For undeployed mode
```

### Interact with the DApp from a UI
```js
   /* To run the frontend user interface */
    
    /* 
    * Create a .env file in the root of the ui folder
    * Add these env variables, it is REQUIRED for the frontend to work 
    */
    VITE_NETWORK_ID=TestNet
    VITE_LOGGING_LEVEL=trace
    VITE_CONTRACT_ADDRESS=0200db8f26a22a2cd1812ef06bc6bb6c7d82a211a00a2472a806b125f50d6bc8f2fb


    cd .. && cd packages/ui
    npx turbo run build

    yarn start // Starts the application at https://localhost:8080

```

# FundAGoal 🎯

**Anonymous Crowdfunding for the Privacy-First Era**

FundAGoal is a revolutionary decentralized crowdfunding platform that empowers creators to launch funding campaigns while protecting the privacy of their supporters. Built on the Midnight Network, it combines the transparency of blockchain with the anonymity that backers deserve.

## What is FundAGoal?

FundAGoal reimagines crowdfunding by solving one of the biggest problems in traditional platforms: **backer privacy**. While campaigns remain transparent and verifiable, the identity and contribution details of supporters are completely anonymous through advanced zero-knowledge cryptography.

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
2. **Share Your Vision**: Tell your story and attract supporters
3. **Track Progress**: Monitor your campaign's progress in real-time
4. **Withdraw Funds**: Securely collect funds when your goal is reached
5. **Stay in Control**: Update, pause, or close your campaign anytime

### For Supporters 🤝

1. **Browse Campaigns**: Discover projects that matter to you
2. **Fund Anonymously**: Support campaigns without revealing your identity
3. **Stay Private**: Your contributions are completely confidential
4. **Get Refunds**: Request refunds under certain conditions if needed
5. **Verify Impact**: Know your contribution counts without exposing yourself

## Perfect For

### 🎨 **Creative Projects**

- Independent artists and musicians
- Film and documentary makers
- Writers and content creators
- Open-source software projects

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

Development Pre-requisite

- Install compactc compiler (Guide)
- Installation guide": https://docs.midnight.network/develop/tutorial/building/#midnight-compact-compiler

- Install proof serve
- Installation guide": https://docs.midnight.network/develop/tutorial/using/proof-server

Token Aquisation
- Visit faucet page": https://docs.midnight.network/develop/tutorial/using/proof-server
- Lace wallet setup
- Wallet setup guide" : https://docs.midnight.network/develop/tutorial/using/chrome-ext
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

    // To run the frontend user interface
    cd .. && cd packages/ui
    npx turbo run build

    yarn start // Starts the application at https://localhost:8080

    /* You would these env variables for the Frotend to work */
    VITE_NETWORK_ID=TestNet
    VITE_LOGGING_LEVEL=trace
    VITE_CONTRACT_ADDRESS=02005d363fb14e15b6e6b29d3b861b68101c51e56aa766912b5013ea39060fafa734

```

---

_FundAGoal: Where privacy meets purpose_ 🔒✨

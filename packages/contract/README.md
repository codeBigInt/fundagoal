# FundAGoal Smart Contract

A privacy-preserving crowdfunding platform built on Midnight blockchain.

## Overview

FundAGoal enables users to create funding campaigns and accept contributions with built-in privacy protection for backers.

## Key Features

- Create and manage crowdfunding campaigns
- Private contributions using commitment schemes
- Automated fund management and withdrawals
- Refund system for contributors

## Main Functions

### Campaign Management
- `createCampaign()` - Create new campaign with funding goal and duration
- `cancelCampaign()` - Delete campaign (owner only)
- `endCampaign()` - Close campaign without withdrawal (owner only)
- `updateCampaign()` - Modify funding goal and duration (owner only)
- `withdrawCampaignFunds()` - Withdraw funds when goal is met (owner only)

### Contributor Functions
- `fundCampaign()` - Contribute tokens to active campaign
- `requestRefund()` - Request refund from campaign (verified backers only)

## Data Structure

```
Campaign {
    id, title, description, owner
    fundGoal, raised, contributors
    duration, creationDate, status
    coinType
}
```

**Status**: `active` | `withdrawn` | `closed`

## Usage

1. Create campaign with `createCampaign()`
2. Backers contribute using `fundCampaign()`
3. Owner withdraws with `withdrawCampaignFunds()` when goal is met
4. Backers can `requestRefund()` if needed

## Custom Library Functions

### `generateOwnersPK(address, sk, rand)`
Generates cryptographic hash for campaign owner verification using address, secret key, and campaign ID.

### `generateCommit(data, rand)`
Creates privacy-preserving commitment for backer data to enable anonymous contributions.

### `Backer`
```
struct Backer {
    id: Bytes<32>           // Backer identifier  
    contribution: Uint<32>  // Amount contributed
    coinType: Bytes<32>  // Token type contributed
}
```

### Offchain witness interaction
The contract utilizes witness to retrieve offchain private state such as `local_secrete_key()`,  `confirm_campaign_expiration()` to confirm if a campaign is active or has ended, and `findBacker()` to generate zero-knoledge proof for verifying backers in the merkle tree. 
```ts

```

## Technical Details

- **Language**: Midnight Protocol (>= 0.16.0)
- **Privacy**: Commitment-based backer protection
- **Security**: Cryptographic owner verification
- **State**: Campaigns, TVL tracking, and backer commitments
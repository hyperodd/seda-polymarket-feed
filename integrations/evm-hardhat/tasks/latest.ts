import { priceFeedScope } from '.';
import { getDeployedContract } from './utils';

// Common token IDs used in testing - update this as needed
const KNOWN_TOKEN_IDS = [
  '21742633143463906290569050155826241533067272736897614950488156847949938836455',
  '21742633143463906290569050155826241533067272736897614950488156847949938836456'
];

/**
 * Task: Fetches the latest answers from the PriceFeed contract.
 * Optional parameters:
 * - contract: PriceFeed contract address
 * - tokenId: Specific Polymarket token ID to fetch (if not provided, shows all prices)
 * - tokenIndex: Specific token index to fetch (if not provided, shows all prices)
 * If the contract address is not provided, fetches from previous deployments.
 */
priceFeedScope
  .task('latest', 'Calls the latestAnswer function on the PriceFeed contract')
  .addOptionalParam('contract', 'The PriceFeed contract address')
  .addOptionalParam('tokenId', 'Specific Polymarket token ID to fetch')
  .addOptionalParam('tokenIndex', 'Specific token index to fetch')
  .setAction(async ({ contract, tokenId, tokenIndex }, hre) => {
    try {
      // Fetch the address from previous deployments if not provided
      let priceFeedAddress = contract;
      if (!priceFeedAddress) {
        console.log('No contract address specified, fetching from previous deployments...');
        priceFeedAddress = getDeployedContract(hre.network, 'PriceFeed');
        console.log('Contract found:', priceFeedAddress);
      }

      // Get the PriceFeed contract instance
      const priceFeed = await hre.ethers.getContractAt('PriceFeed', priceFeedAddress);

      // First, try to update the latest answers
      console.log(`\nUpdating latest answers from SEDA network...`);
      try {
        await priceFeed.updateLatestAnswers();
        console.log('Latest answers updated successfully.\n');
      } catch (error) {
        console.log('Could not update latest answers. Using cached data if available.\n');
      }

      // Handle tokenId parameter by finding its index in known token IDs
      let targetIndex = tokenIndex;
      if (tokenId !== undefined) {
        const foundIndex = KNOWN_TOKEN_IDS.findIndex(id => id === tokenId);
        if (foundIndex === -1) {
          console.error(`Token ID ${tokenId} not found in known token IDs. Known token IDs:`);
          KNOWN_TOKEN_IDS.forEach((id, index) => {
            console.log(`  Index ${index}: ${id}`);
          });
          return;
        }
        targetIndex = foundIndex.toString();
      }

      if (targetIndex !== undefined) {
        // Fetch specific token price
        const price = await priceFeed.getPrice(targetIndex);

        // Show token ID if we know it
        const knownTokenId = KNOWN_TOKEN_IDS[parseInt(targetIndex)];
        if (knownTokenId) {
          console.log(`Price for token ID ${knownTokenId} (index ${targetIndex}): ${price.toString()}`);
        } else {
          console.log(`Price for token index ${targetIndex}: ${price.toString()}`);
        }
      } else {
        // Fetch all prices
        console.log(`Calling getAllPrices() on PriceFeed at ${priceFeedAddress}`);
        const allPrices = await priceFeed.getAllPrices();
        const tokenCount = await priceFeed.getTokenCount();

        console.log(`\nToken Count: ${tokenCount.toString()}`);
        console.log('All Prices:');
        allPrices.forEach((price, index) => {
          const knownTokenId = KNOWN_TOKEN_IDS[index];
          if (knownTokenId) {
            console.log(`  Token ID ${knownTokenId} (index ${index}): ${price.toString()}`);
          } else {
            console.log(`  Token index ${index}: ${price.toString()}`);
          }
        });

        // Also show legacy latestAnswer for backward compatibility
        try {
          const legacyAnswer = await priceFeed.latestAnswer();
          console.log(`\nLegacy Latest Answer (first price): ${legacyAnswer.toString()}`);
        } catch (error) {
          console.log('\nLegacy Latest Answer: Not available');
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error fetching latest answer: ${errorMessage}`);
      console.error(
        'Most likely still processing: make sure you ran "bunx hardhat pricefeed transmit" first, then wait a few minutes.',
      );
    }
  });

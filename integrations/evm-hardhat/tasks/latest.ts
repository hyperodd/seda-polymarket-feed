import { priceFeedScope } from '.';
import { getDeployedContract } from './utils';

/**
 * Task: Fetches the latest answers from the PriceFeed contract.
 * Optional parameters:
 * - contract: PriceFeed contract address
 * - tokenId: Specific token ID to fetch (if not provided, shows all prices)
 * - tokenIndex: Specific token index to fetch (if not provided, shows all prices)
 * If the contract address is not provided, fetches from previous deployments.
 */
priceFeedScope
  .task('latest', 'Fetches the latest prices from the PriceFeed contract')
  .addOptionalParam('contract', 'The PriceFeed contract address')
  .addOptionalParam('tokenId', 'Specific token ID to fetch')
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

      // Handle tokenId parameter using direct lookup
      if (tokenId !== undefined) {
        try {
          // Use generic contract call since TypeScript interface might not be updated yet
          const price = await priceFeed.getFunction('getPriceByTokenId')(tokenId);
          console.log(`Price for token ID ${tokenId}: ${price.toString()}`);
          return;
        } catch (error) {
          console.error(`Error getting price for token ID ${tokenId}: ${error}`);
          try {
            const allTokenIds = await priceFeed.getAllTokenIds();
            console.log('Available token IDs:');
            allTokenIds.forEach((id, index) => {
              console.log(`  Index ${index}: ${id}`);
            });
          } catch (listError) {
            console.log('Could not retrieve available token IDs');
          }
          return;
        }
      }

      if (tokenIndex !== undefined) {
        // Fetch specific token price by index
        const price = await priceFeed.getPrice(tokenIndex);
        try {
          const tokenIdDisplay = await priceFeed.getTokenId(tokenIndex);
          console.log(`Price for token ID ${tokenIdDisplay} (index ${tokenIndex}): ${price.toString()}`);
        } catch (error) {
          console.log(`Price for token index ${tokenIndex}: ${price.toString()}`);
        }
      } else {
        // Fetch all prices
        console.log(`Calling getAllPrices() on PriceFeed at ${priceFeedAddress}`);
        const allPrices = await priceFeed.getAllPrices();
        const tokenCount = await priceFeed.getTokenCount();

        console.log(`\nToken Count: ${tokenCount.toString()}`);
        console.log('All Prices:');

        try {
          const allTokenIds = await priceFeed.getAllTokenIds();
          console.log(`Found ${allTokenIds.length} stored token IDs`);
          allPrices.forEach((price, index) => {
            const tokenId = allTokenIds[index] || `index-${index}`;
            console.log(`  Token ID ${tokenId} (index ${index}): ${price.toString()}`);
          });
        } catch (error) {
          console.log(`Error getting token IDs: ${error}`);
          console.log('Fallback to index-based display');
          // Fallback to index-based display if token IDs not available
          allPrices.forEach((price, index) => {
            console.log(`  Token index ${index}: ${price.toString()}`);
          });
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

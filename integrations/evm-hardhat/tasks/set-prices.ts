import { priceFeedScope } from '.';
import { getDeployedContract } from './utils';

/**
 * Task: Manually sets prices for testing/debugging purposes.
 * Required parameter: prices (comma-separated list of prices)
 * Optional parameter: contract (PriceFeed contract address).
 */
priceFeedScope
    .task('set-prices', 'Manually sets prices for testing purposes')
    .addParam('prices', 'Comma-separated list of prices (e.g., "1800750000,1801250000")')
    .addOptionalParam('contract', 'The PriceFeed contract address')
    .setAction(async ({ prices, contract }, hre) => {
        try {
            // Fetch the address from previous deployments if not provided
            let priceFeedAddress = contract;
            if (!priceFeedAddress) {
                console.log('No contract address specified, fetching from previous deployments...');
                priceFeedAddress = getDeployedContract(hre.network, 'PriceFeed');
                console.log('Contract found:', priceFeedAddress);
            }

            // Parse the prices
            const priceArray = prices.split(',').map((price: string) => price.trim());
            console.log(`Setting prices: ${priceArray.join(', ')}`);

            // Get the PriceFeed contract instance
            const priceFeed = await hre.ethers.getContractAt('PriceFeed', priceFeedAddress);

            // Set the prices manually
            const tx = await priceFeed.setPricesManually(priceArray);
            const receipt = await tx.wait();

            if (!receipt) {
                console.log('Transaction failed - no receipt received');
                return;
            }

            console.log('Prices set successfully!');
            console.log(`Transaction hash: ${tx.hash}`);

            // Show the updated prices
            const allPrices = await priceFeed.getAllPrices();
            const tokenCount = await priceFeed.getTokenCount();

            console.log(`\nSet prices for ${tokenCount.toString()} tokens:`);
            allPrices.forEach((price: any, index: number) => {
                const formattedPrice = (Number(price) / 1_000_000).toFixed(6);
                console.log(`  Token ${index}: ${price.toString()} (${formattedPrice})`);
            });

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Error setting prices: ${errorMessage}`);
        }
    });
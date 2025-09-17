import { priceFeedScope } from '.';
import { getDeployedContract } from './utils';

/**
 * Task: Updates the latest prices from the SEDA network result.
 * Optional parameter: contract (PriceFeed contract address).
 * If the contract address is not provided, fetches from previous deployments.
 */
priceFeedScope
    .task('update', 'Updates the latest prices from SEDA network result')
    .addOptionalParam('contract', 'The PriceFeed contract address')
    .setAction(async ({ contract }, hre) => {
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

            // Update the latest answers
            console.log(`\nUpdating latest answers from SEDA network...`);
            const tx = await priceFeed.updateLatestAnswers();
            const receipt = await tx.wait();

            if (!receipt) {
                console.log('Transaction failed - no receipt received');
                return;
            }

            console.log('Latest answers updated successfully!');
            console.log(`Transaction hash: ${tx.hash}`);

            // Show the updated prices
            const allPrices = await priceFeed.getAllPrices();
            const tokenCount = await priceFeed.getTokenCount();

            console.log(`\nUpdated prices for ${tokenCount.toString()} tokens:`);
            allPrices.forEach((price: any, index: number) => {
                console.log(`  Token ${index}: ${price.toString()}`);
            });

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Error updating latest answers: ${errorMessage}`);
            console.error(
                'Make sure you ran "bunx hardhat pricefeed transmit" first and wait for the result to be available.',
            );
        }
    });
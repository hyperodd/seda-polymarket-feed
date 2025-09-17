import { priceFeedScope } from '.';
import { getDeployedContract } from './utils';

/**
 * Task: Debug function to see what data the oracle returned.
 * Optional parameter: contract (PriceFeed contract address).
 */
priceFeedScope
    .task('debug-result', 'Shows the raw result data from the oracle')
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

            // Get the raw result
            console.log(`\nGetting debug result from PriceFeed at ${priceFeedAddress}...`);
            const [resultBytes, consensus, exitCode] = await priceFeed.getLastResult();

            console.log('Debug Result:');
            console.log(`  Consensus: ${consensus}`);
            console.log(`  Exit Code: ${exitCode}`);
            console.log(`  Result Bytes (hex): ${resultBytes}`);
            console.log(`  Result Length: ${resultBytes.length} bytes`);

            // Try to interpret as UTF-8
            try {
                const resultString = hre.ethers.toUtf8String(resultBytes);
                console.log(`  Result as UTF-8: ${resultString}`);
            } catch (error) {
                console.log('  Could not decode as UTF-8');
            }

            // Try to decode as ABI-encoded uint256[]
            try {
                const decoded = hre.ethers.AbiCoder.defaultAbiCoder().decode(['uint256[]'], resultBytes);
                console.log(`  Decoded as uint256[]: ${decoded[0]}`);
            } catch (error) {
                console.log('  Could not decode as ABI-encoded uint256[]');
            }

        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`Error getting debug result: ${errorMessage}`);
        }
    });
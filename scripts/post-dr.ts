import { PostDataRequestInput, Signer, buildSigningConfig, postAndAwaitDataRequest } from '@seda-protocol/dev-tools';

/**
 * Usage:
 *  - Set ORACLE_PROGRAM_ID in env.
 *  - Provide the exec input (token id) via ENV EXEC_INPUT or as the first CLI arg.
 *    The script will encode the input as UTF-8. If you provide a 0x-prefixed string it will be treated as hex bytes.
 */
async function main() {
    const ORACLE_PROGRAM_ID = process.env.ORACLE_PROGRAM_ID;
    if (!ORACLE_PROGRAM_ID) {
        throw new Error('Please set the ORACLE_PROGRAM_ID in your env file');
    }

    // Exec input may be provided via env EXEC_INPUT or as the first CLI argument
    const cliArg = process.argv[2];
    const execInputRaw = process.env.EXEC_INPUT ?? cliArg;
    if (!execInputRaw) {
        throw new Error('Please provide the exec input (token id) via env EXEC_INPUT or as the first CLI argument');
    }

    // Encode execInputs deterministically:
    // - If input starts with 0x treat as hex bytes
    // - Otherwise treat as UTF-8 string
    const execInputs = execInputRaw.startsWith('0x')
        ? Buffer.from(execInputRaw.slice(2), 'hex')
        : Buffer.from(execInputRaw, 'utf8');

    // Takes the mnemonic from the environment (SEDA_MNEMONIC and SEDA_RPC_ENDPOINT)
    const signingConfig = buildSigningConfig({});
    const signer = await Signer.fromPartial(signingConfig);

    console.log('Posting and waiting for a result, this may take a little while...');

    const dataRequestInput: PostDataRequestInput = {
        consensusOptions: {
            method: 'none'
        },
        execProgramId: ORACLE_PROGRAM_ID,
        execInputs,
        // Use an explicit zero-length buffer for tally inputs
        tallyInputs: Buffer.alloc(0),
        memo: Buffer.from(new Date().toISOString(), 'utf8'),
    };

    const result = await postAndAwaitDataRequest(signer, dataRequestInput, {});
    const explorerLink = process.env.SEDA_EXPLORER_URL
        ? `${process.env.SEDA_EXPLORER_URL}/data-requests/${result.drId}/${result.drBlockHeight}`
        : 'Configure env.SEDA_EXPLORER_URL to generate a link to your DR';

    console.table({
        ...result,
        blockTimestamp: result.blockTimestamp ? result.blockTimestamp.toISOString() : '',
        explorerLink
    });
}

main().catch((err) => {
    console.error('post-dr failed:', err);
    process.exit(1);
});
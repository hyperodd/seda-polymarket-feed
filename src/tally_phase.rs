use anyhow::Result;
use seda_sdk_rs::{elog, get_reveals, log, Process};

pub fn tally_phase() -> Result<()> {
    // Retrieve consensus reveals from the tally phase.
    let reveals = get_reveals()?;

    if reveals.is_empty() {
        // If no reveals were found, report an error indicating no consensus.
        Process::error("No consensus among revealed results".as_bytes());
        return Ok(());
    }

    // Take the first reveal as the result since we're expecting just the mid price from the API
    let first_reveal = &reveals[0];
    let prices = match serde_json::from_slice::<Vec<f64>>(&first_reveal.body.reveal) {
        Ok(prices) => prices,
        Err(err) => {
            elog!("Failed to parse revealed prices: {err}");
            Process::error("Failed to parse revealed prices".as_bytes());
            return Ok(());
        }
    };

    log!("Final prices: {prices:?}");

    // Convert f64 prices to scaled integers (multiply by 1,000,000 to preserve 6 decimal places)
    // For example: 0.105 -> 105000, 0.895 -> 895000
    let scaled_prices: Vec<u64> = prices
        .iter()
        .map(|&price| (price * 1_000_000.0) as u64)
        .collect();

    log!("Scaled prices for EVM: {scaled_prices:?}");

    // Create ABI-encoded data for uint256[] that Solidity can decode
    let mut abi_encoded = Vec::new();

    // ABI encoding for dynamic array uint256[]:
    // 1. Offset to array data (32 bytes) = 0x20
    abi_encoded.extend_from_slice(&[0u8; 31]);
    abi_encoded.push(0x20);

    // 2. Array length (32 bytes)
    let array_length = scaled_prices.len() as u64;
    abi_encoded.extend_from_slice(&[0u8; 24]);
    abi_encoded.extend_from_slice(&array_length.to_be_bytes());

    // 3. Array elements (each 32 bytes)
    for price in scaled_prices {
        abi_encoded.extend_from_slice(&[0u8; 24]);
        abi_encoded.extend_from_slice(&price.to_be_bytes());
    }

    log!("ABI-encoded data length: {} bytes", abi_encoded.len());

    // Report the successful result in the tally phase.
    Process::success(&abi_encoded);

    Ok(())
}

use anyhow::Result;
use seda_sdk_rs::{elog, http_fetch, log, Process};
use serde::{Deserialize, Serialize};

// ============================================================================
// DATA STRUCTURES
// ============================================================================

#[derive(Serialize, Deserialize)]
struct PolymarketMidpointResponse {
    mid: String,
}

// ============================================================================
// EXECUTION PHASE - FETCHES LIVE DATA FROM POLYMARKET
// ============================================================================

/**
 * Executes the data request phase within the SEDA network.
 * This phase fetches midpoint prices for Polymarket tokens based on comma-separated token ID inputs.
 */
pub fn execution_phase() -> Result<()> {
    // Retrieve the input parameters for the data request (DR).
    // Expected to be comma-separated token IDs (e.g., "47060861968389645577251408086188258199430417779776802737050665875266354301946").

    let dr_inputs_raw = String::from_utf8(Process::get_inputs())?;

    let dr_inputs_trimmed = dr_inputs_raw.trim();

    let token_ids: Vec<&str> = dr_inputs_trimmed.split(',').collect();

    let mut mids: Vec<f64> = Vec::new();

    for token_id in token_ids {
        log!("Fetching Polymarket midpoint data for token: {}", token_id);

        // Step 1: Get midpoint information
        let midpoint_response = http_fetch(
            format!("https://clob.polymarket.com/midpoint?token_id={}", token_id),
            None,
        );

        // Check if the midpoint request was successful
        if !midpoint_response.is_ok() {
            elog!(
                "Midpoint HTTP Response was rejected: {} - {}",
                midpoint_response.status,
                String::from_utf8(midpoint_response.bytes)?
            );
            Process::error("Error while fetching midpoint information".as_bytes());
            continue;
        }

        // Parse midpoint information
        let midpoint_data =
            serde_json::from_slice::<PolymarketMidpointResponse>(&midpoint_response.bytes)?;

        // Parse the mid price from string to f64
        let mid_price = midpoint_data.mid.parse::<f64>().map_err(|e| {
            elog!("Failed to parse mid price '{}': {}", midpoint_data.mid, e);
            anyhow::anyhow!("Failed to parse mid price")
        })?;

        log!("Fetched MID Price: ${}", mid_price);

        mids.push(mid_price);
    }

    let mids_bytes = serde_json::to_vec(&mids)?;
    Process::success(&mids_bytes);
    Ok(())
}

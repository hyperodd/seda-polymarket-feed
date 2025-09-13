use anyhow::Result;
use seda_sdk_rs::{elog, http_fetch, log, Process};
use serde::{Deserialize, Serialize};

// ============================================================================
// DATA STRUCTURES
// ============================================================================

#[derive(Serialize, Deserialize)]
struct PolymarketMarketResponse {
    // API returns mid as a string, e.g. {"mid":"0.905"}
    mid: String,
}

// ============================================================================
// EXECUTION PHASE - FETCHES LIVE DATA FROM Polymarket
// ============================================================================

/**
 * Executes the data request phase within the SEDA network.
 * This phase fetches bid and ask prices for Polymarket markets based on a series ticker input.
 */
pub fn execution_phase() -> Result<()> {
    // Retrieve the input parameters for the data request (DR).
    // Expected to be a series ticker (e.g., "KXGDP").
    let dr_inputs_raw = String::from_utf8(Process::get_inputs())?;
    let token_id = dr_inputs_raw.trim();

    log!("Fetching Polymarket market data for series: {}", token_id);

    // Step 1: Get series information
    let series_response = http_fetch(
                format!("https://clob.polymarket.com/midpoint?token_id={}", token_id),
        None,
    );


    // Check if the series request was successful
    if !series_response.is_ok() {
        elog!(
            "Series HTTP Response was rejected: {} - {}",
            series_response.status,
            String::from_utf8(series_response.bytes)?
        );
        Process::error("Error while fetching series information".as_bytes());
        return Ok(());
    }

    // Parse series information
    let series_data = serde_json::from_slice::<PolymarketMarketResponse>(&series_response.bytes)?;

    // The API returns mid as a string, e.g. {"mid":"0.905"}.
    // Small floating point differences between reporters can cause "no consensus" failures.
    // Normalize by parsing the mid into a float and scaling to an integer (parts-per-1_000_000).
    let mid_str = series_data.mid;
    let mid_val: f64 = match mid_str.parse() {
        Ok(v) => v,
        Err(e) => {
            elog!("Failed to parse mid ('{}'): {}", mid_str, e);
            Process::error("Failed to parse mid from execution program".as_bytes());
            return Ok(());
        }
    };

    // scale to 1e6 to preserve precision while ensuring deterministic integer outputs
    let scaled_mid: u64 = (mid_val * 1_000_000.0).round() as u64;
    log!("Fetched Midprice: {} (scaled: {})", mid_str, scaled_mid);

    Process::success(scaled_mid.to_string().as_bytes());
    Ok(())
}

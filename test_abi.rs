fn main() {
    // Test the ABI encoding logic
    let scaled_prices = vec![105000u64, 895000u64];

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

    println!("ABI-encoded data length: {} bytes", abi_encoded.len());
    println!("ABI-encoded hex: 0x{}", hex::encode(&abi_encoded));

    // Expected for [105000, 895000]:
    // 0x0000000000000000000000000000000000000000000000000000000000000020  // offset
    // 0x0000000000000000000000000000000000000000000000000000000000000002  // length
    // 0x00000000000000000000000000000000000000000000000000000000000199a8  // 105000
    // 0x00000000000000000000000000000000000000000000000000000000000da948  // 895000
}

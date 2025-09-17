// SPDX-License-Identifier: MIT
/**
 * NOTICE: This is an example contract to demonstrate SEDA network functionality.
 * It is for educational purposes only and should not be used in production.
 */

pragma solidity 0.8.28;

import {ISedaCore} from "@seda-protocol/evm/contracts/interfaces/ISedaCore.sol";
import {SedaDataTypes} from "@seda-protocol/evm/contracts/libraries/SedaDataTypes.sol";

/**
 * @title PriceFeed
 * @author Open Oracle Association
 * @notice An example showing how to create and interact with SEDA network requests.
 * @dev This contract demonstrates basic SEDA request creation and result fetching.
 */
contract PriceFeed {
    /// @notice Instance of the SedaCore contract
    ISedaCore public immutable SEDA_CORE;

    /// @notice ID of the request WASM binary on the SEDA network
    bytes32 public immutable ORACLE_PROGRAM_ID;

    /// @notice ID of the most recent request
    bytes32 public requestId;

    /// @notice The latest prices for each token ID
    uint256[] public latestPrices;

    /// @notice The token IDs for each price (same order as latestPrices)
    string[] public storedTokenIds;

    /// @notice Thrown when trying to fetch results before any request is transmitted
    error RequestNotTransmitted();

    /// @notice Thrown when trying to access an invalid token index
    error InvalidTokenIndex();

    /// @notice Thrown when trying to access a token ID that doesn't exist
    error TokenIdNotFound();

    /**
     * @notice Sets up the contract with SEDA network parameters
     * @param _sedaCoreAddress Address of the SedaCore contract
     * @param _oracleProgramId ID of the WASM binary for handling requests
     */
    constructor(address _sedaCoreAddress, bytes32 _oracleProgramId) {
        SEDA_CORE = ISedaCore(_sedaCoreAddress);
        ORACLE_PROGRAM_ID = _oracleProgramId;
    }

    /**
     * @notice Creates a new price request for multiple Polymarket tokens on the SEDA network
     * @dev Demonstrates how to structure and send a request to SEDA for multiple token IDs
     * @param tokenIds Comma-separated string of Polymarket token IDs
     * @param requestFee The fee for the request
     * @param resultFee The fee for the result
     * @param batchFee The fee for the batch
     * @return The ID of the created request
     */
    function transmit(
        string calldata tokenIds,
        uint256 requestFee,
        uint256 resultFee,
        uint256 batchFee
    ) external payable returns (bytes32) {
        SedaDataTypes.RequestInputs memory inputs = SedaDataTypes.RequestInputs(
            ORACLE_PROGRAM_ID, // execProgramId (Execution WASM binary ID)
            ORACLE_PROGRAM_ID, // tallyProgramId (same as execProgramId in this example)
            2000, // gasPrice (SEDA tokens per gas unit)
            50000000000000, // execGasLimit (within uint64 range)
            20000000000000, // tallyGasLimit (within uint64 range)
            1, // replicationFactor (number of required DR executors)
            bytes(tokenIds), // execInputs (Comma-separated token IDs)
            hex"00", // tallyInputs
            hex"00", // consensusFilter (set to `None`)
            abi.encodePacked(block.number) // memo (Additional public info)
        );

        // Pass the msg.value as fees to the SEDA core
        requestId = SEDA_CORE.postRequest{value: msg.value}(inputs, requestFee, resultFee, batchFee);

        // Parse and store the token IDs
        bytes memory tokenIdsBytes = bytes(tokenIds);
        delete storedTokenIds; // Clear previous token IDs

        // Simple parsing: split by comma
        uint256 start = 0;
        for (uint256 i = 0; i <= tokenIdsBytes.length; i++) {
            if (i == tokenIdsBytes.length || tokenIdsBytes[i] == ",") {
                if (i > start) {
                    bytes memory tokenIdBytes = new bytes(i - start);
                    for (uint256 j = 0; j < i - start; j++) {
                        tokenIdBytes[j] = tokenIdsBytes[start + j];
                    }
                    storedTokenIds.push(string(tokenIdBytes));
                }
                start = i + 1;
            }
        }

        return requestId;
    }

    /**
     * @notice Retrieves and stores the results of the latest request
     * @dev Shows how to fetch and interpret SEDA request results for multiple prices
     * @return success Whether the result was successfully processed
     */
    function updateLatestAnswers() external returns (bool) {
        if (requestId == bytes32(0)) revert RequestNotTransmitted();

        SedaDataTypes.Result memory result = SEDA_CORE.getResult(requestId);

        if (result.consensus && result.exitCode == 0) {
            // The oracle now returns properly ABI-encoded uint256[] data
            uint256[] memory prices = abi.decode(result.result, (uint256[]));
            latestPrices = prices;
            return true;
        }

        return false;
    }

    /**
     * @notice Gets the price for a specific token by token ID
     * @param tokenId The token ID string
     * @return The price for the specified token
     */
    function getPriceByTokenId(string calldata tokenId) external view returns (uint256) {
        // Find the index of the token ID
        for (uint256 i = 0; i < storedTokenIds.length; i++) {
            if (keccak256(abi.encodePacked(storedTokenIds[i])) == keccak256(abi.encodePacked(tokenId))) {
                if (i >= latestPrices.length) revert InvalidTokenIndex();
                return latestPrices[i];
            }
        }
        revert TokenIdNotFound(); // Token ID not found
    }

    /**
     * @notice Gets all latest prices
     * @return Array of all latest prices
     */
    function getAllPrices() external view returns (uint256[] memory) {
        return latestPrices;
    }

    /**
     * @notice Gets the token ID for a specific index
     * @param tokenIndex The index of the token
     * @return The token ID string
     */
    function getTokenId(uint256 tokenIndex) external view returns (string memory) {
        if (tokenIndex >= storedTokenIds.length) revert InvalidTokenIndex();
        return storedTokenIds[tokenIndex];
    }

    /**
     * @notice Gets all stored token IDs
     * @return Array of all token ID strings
     */
    function getAllTokenIds() external view returns (string[] memory) {
        return storedTokenIds;
    }

    /**
     * @notice Gets the number of tokens being tracked
     * @return The count of tokens
     */
    function getTokenCount() external view returns (uint256) {
        return latestPrices.length;
    }
}

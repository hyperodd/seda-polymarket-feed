import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers';
import MockSedaCore from '@seda-protocol/evm/artifacts/contracts/mocks/MockSedaCore.sol/MockSedaCore.json';
import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('PriceFeed Contract', () => {
  // Setup the fixture to deploy contracts
  async function deployPriceFeedFixture() {
    const [admin] = await ethers.getSigners();

    // A Data Request WASM binary ID (mock value)
    const oracleProgramId = ethers.ZeroHash;

    // Deploy MockSedaCore
    const SedaCore = await ethers.getContractFactoryFromArtifact(MockSedaCore);

    // Deploy without constructor arguments as the mock doesn't have the expected constructor
    const core = await SedaCore.deploy();

    // Deploy the PriceFeed contract
    const PriceFeed = await ethers.getContractFactory('PriceFeed');
    const priceFeed = await PriceFeed.deploy(core.getAddress(), oracleProgramId);

    return { priceFeed, core, admin };
  }

  /**
   * Test Case 1: No transmission before `latestAnswer`
   * Ensure that calling latestAnswer without transmitting a data request first reverts.
   */
  it('Should revert if data request is not transmitted', async () => {
    const { priceFeed } = await loadFixture(deployPriceFeedFixture);

    // Attempting to call latestAnswer without a transmission should revert
    await expect(priceFeed.latestAnswer()).to.be.revertedWithCustomError(priceFeed, 'RequestNotTransmitted');
  });

  /**
   * Test Case 2: No data result found
   * Ensure that calling getPrice after transmission but without setting a data result reverts.
   */
  it('Should revert if data result is not found', async () => {
    const { priceFeed, core } = await loadFixture(deployPriceFeedFixture);

    // Transmit the data request (but no result set)
    const tokenIds = "47060861968389645577251408086188258199430417779776802737050665875266354301946";
    await priceFeed.transmit(tokenIds, 0, 0, 0);

    // updateLatestAnswers should revert due to no data result being set
    await expect(priceFeed.updateLatestAnswers()).to.be.revertedWithCustomError(core, 'ResultNotFound');
  });

  /**
   * Test Case 3: Return correct prices with consensus (true)
   * Verify that the contract correctly handles multiple token prices when consensus is reached.
   */
  it('Should return the correct prices if consensus is reached', async () => {
    const { priceFeed, core } = await loadFixture(deployPriceFeedFixture);

    // Transmit a data request with multiple token IDs
    const tokenIds = "47060861968389645577251408086188258199430417779776802737050665875266354301946,47060861968389645577251408086188258199430417779776802737050665875266354301947";
    await priceFeed.transmit(tokenIds, 0, 0, 0);
    const dataRequestId = await priceFeed.requestId();

    // Set a data result with consensus - encoding array of prices
    const prices = [BigInt(1800750000), BigInt(1801250000)]; // Mock prices: 1800.75, 1801.25 (scaled by 1e6)
    const resultValue = new ethers.AbiCoder().encode(['uint256[]'], [prices]);
    const result = {
      version: '0.0.1',
      drId: dataRequestId,
      consensus: true,
      exitCode: 0,
      result: resultValue,
      blockHeight: 0,
      blockTimestamp: Math.floor(Date.now() / 1000) + 3600,
      gasUsed: 0,
      paybackAddress: ethers.ZeroAddress,
      sedaPayload: ethers.ZeroHash,
    };
    await core.postResult(result, 0, []);

    // Update the latest answers
    await priceFeed.updateLatestAnswers();

    // Check individual token prices
    const price0 = await priceFeed.getPrice(0);
    const price1 = await priceFeed.getPrice(1);
    expect(price0).to.equal(1800750000);
    expect(price1).to.equal(1801250000);

    // Check all prices
    const allPrices = await priceFeed.getAllPrices();
    expect(allPrices.length).to.equal(2);
    expect(allPrices[0]).to.equal(1800750000);
    expect(allPrices[1]).to.equal(1801250000);

    // Check token count
    const tokenCount = await priceFeed.getTokenCount();
    expect(tokenCount).to.equal(2);

    // Check legacy latestAnswer (should return first price)
    const latestAnswer = await priceFeed.latestAnswer();
    expect(latestAnswer).to.equal(1800750000);
  });

  /**
   * Test Case 4: Return empty array if no consensus reached
   * Ensure that prices array is empty when no consensus is reached.
   */
  it('Should return empty prices if consensus is not reached', async () => {
    const { priceFeed, core } = await loadFixture(deployPriceFeedFixture);

    // Transmit a data request
    const tokenIds = "47060861968389645577251408086188258199430417779776802737050665875266354301946";
    await priceFeed.transmit(tokenIds, 0, 0, 0);
    const dataRequestId = await priceFeed.requestId();

    // Set a data result without consensus (false)
    const prices = [BigInt(100)]; // Mock value
    const resultValue = new ethers.AbiCoder().encode(['uint256[]'], [prices]);
    const result = {
      version: '0.0.1',
      drId: dataRequestId,
      consensus: false,
      exitCode: 0,
      result: resultValue,
      blockHeight: 0,
      blockTimestamp: Math.floor(Date.now() / 1000) + 3600,
      gasUsed: 0,
      paybackAddress: ethers.ZeroAddress,
      sedaPayload: ethers.ZeroHash,
    };
    await core.postResult(result, 0, []);

    // updateLatestAnswers should return false since no consensus was reached
    const success = await priceFeed.updateLatestAnswers.staticCall();
    expect(success).to.equal(false);

    // Prices array should be empty
    const allPrices = await priceFeed.getAllPrices();
    expect(allPrices.length).to.equal(0);

    // latestAnswer should return 0 since no prices available
    const latestAnswer = await priceFeed.latestAnswer();
    expect(latestAnswer).to.equal(0);
  });

  /**
   * Test Case 5: Successful transmission with multiple tokens
   * Ensure that a data request is correctly transmitted with multiple token IDs and the request ID is valid.
   */
  it('Should successfully transmit a data request with multiple tokens and return a valid request ID', async () => {
    const { priceFeed } = await loadFixture(deployPriceFeedFixture);

    // Assert data request id is zero
    let dataRequestId = await priceFeed.requestId();
    expect(dataRequestId).to.be.equal(ethers.ZeroHash);

    // Call the transmit function with multiple token IDs
    const tokenIds = "47060861968389645577251408086188258199430417779776802737050665875266354301946,47060861968389645577251408086188258199430417779776802737050665875266354301947";
    await priceFeed.transmit(tokenIds, 0, 0, 0);

    // Check that the data request ID is valid and stored correctly
    dataRequestId = await priceFeed.requestId();
    expect(dataRequestId).to.not.be.equal(ethers.ZeroHash);
  });

  /**
   * Test Case 6: Invalid token index access
   * Ensure that accessing an invalid token index reverts with appropriate error.
   */
  it('Should revert when accessing invalid token index', async () => {
    const { priceFeed, core } = await loadFixture(deployPriceFeedFixture);

    // Transmit a data request and set up one price
    const tokenIds = "47060861968389645577251408086188258199430417779776802737050665875266354301946";
    await priceFeed.transmit(tokenIds, 0, 0, 0);
    const dataRequestId = await priceFeed.requestId();

    const prices = [BigInt(1800750000)];
    const resultValue = new ethers.AbiCoder().encode(['uint256[]'], [prices]);
    const result = {
      version: '0.0.1',
      drId: dataRequestId,
      consensus: true,
      exitCode: 0,
      result: resultValue,
      blockHeight: 0,
      blockTimestamp: Math.floor(Date.now() / 1000) + 3600,
      gasUsed: 0,
      paybackAddress: ethers.ZeroAddress,
      sedaPayload: ethers.ZeroHash,
    };
    await core.postResult(result, 0, []);
    await priceFeed.updateLatestAnswers();

    // Accessing index 0 should work
    const price0 = await priceFeed.getPrice(0);
    expect(price0).to.equal(1800750000);

    // Accessing index 1 should revert (out of bounds)
    await expect(priceFeed.getPrice(1)).to.be.revertedWithCustomError(priceFeed, 'InvalidTokenIndex');
  });
});

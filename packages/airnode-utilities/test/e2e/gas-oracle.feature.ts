import * as hre from 'hardhat';
import { BigNumber, ethers } from 'ethers';
import '@nomiclabs/hardhat-ethers';
import { go, assertGoSuccess } from '@api3/promise-utils';
import * as gasOracle from '../../src/evm/gas-prices/gas-oracle';
import * as gasPrices from '../../src/evm/gas-prices/gas-prices';
import {
  PriorityFee,
  LatestBlockPercentileGasPriceStrategy,
  ProviderRecommendedGasPriceStrategy,
  ConstantGasPriceStrategy,
  GasPriceOracleConfig,
} from '../../src/evm/gas-prices/types';
import { executeTransactions } from '../setup/transactions';

// Jest version 27 has a bug where jest.setTimeout does not work correctly inside describe or test blocks
// https://github.com/facebook/jest/issues/11607
jest.setTimeout(60_000);

const latestBlockPercentileGasPriceStrategy: LatestBlockPercentileGasPriceStrategy = {
  gasPriceStrategy: 'latestBlockPercentileGasPrice',
  percentile: 60,
  minTransactionCount: 20,
  pastToCompareInBlocks: 20,
  maxDeviationMultiplier: 5, // Set high to ensure that e2e tests do not use fallback
};
const providerRecommendedGasPriceStrategy: ProviderRecommendedGasPriceStrategy = {
  gasPriceStrategy: 'providerRecommendedGasPrice',
  recommendedGasPriceMultiplier: 1.2,
};
const constantGasPriceStrategy: ConstantGasPriceStrategy = {
  gasPriceStrategy: 'constantGasPrice',
  gasPrice: {
    value: 10,
    unit: 'gwei',
  },
};
const defaultGasPriceOracleOptions: GasPriceOracleConfig = [
  latestBlockPercentileGasPriceStrategy,
  providerRecommendedGasPriceStrategy,
  constantGasPriceStrategy,
];

const multiplyGasPrice = (gasPrice: BigNumber, recommendedGasPriceMultiplier?: number) =>
  recommendedGasPriceMultiplier ? gasPrices.multiplyGasPrice(gasPrice, recommendedGasPriceMultiplier) : gasPrice;

const processBlockData = async (
  provider: ethers.providers.StaticJsonRpcProvider,
  blocksWithGasPrices: { blockNumber: number; gasPrices: BigNumber[] }[],
  percentile: number,
  maxDeviationMultiplier: number,
  fallbackGasPrice: PriorityFee,
  recommendedGasPriceMultiplier: number
) => {
  const latestBlock = blocksWithGasPrices[0];
  const referenceBlock = blocksWithGasPrices[20];

  const latestBlockPercentileGasPrice = gasOracle.getPercentile(
    latestBlockPercentileGasPriceStrategy.percentile,
    latestBlock.gasPrices.map((p) => p)
  );
  const referenceBlockPercentileGasPrice = gasOracle.getPercentile(
    percentile,
    referenceBlock.gasPrices.map((p) => p)
  );

  const isWithinDeviationLimit = gasOracle.checkMaxDeviationLimit(
    latestBlockPercentileGasPrice!,
    referenceBlockPercentileGasPrice!,
    maxDeviationMultiplier
  );

  if (isWithinDeviationLimit) return latestBlockPercentileGasPrice;

  try {
    const providerGasPrice = await provider.getGasPrice();
    return multiplyGasPrice(providerGasPrice, recommendedGasPriceMultiplier);
  } catch (_e) {
    return gasPrices.parsePriorityFee(fallbackGasPrice);
  }
};

describe('Gas oracle', () => {
  const txTypes: ('legacy' | 'eip1559')[] = ['legacy', 'eip1559'];

  txTypes.forEach((txType) => {
    describe(`${txType} network`, () => {
      let blocksWithGasPrices: { blockNumber: number; gasPrices: BigNumber[] }[];
      const providerUrl = 'http://127.0.0.1:8545/';
      const provider = new hre.ethers.providers.StaticJsonRpcProvider(providerUrl);

      beforeEach(async () => {
        // Reset the local hardhat network state for each test to prevent issues with other test contracts
        await hre.network.provider.send('hardhat_reset');
        // Disable automining to get multiple transaction per block
        await hre.network.provider.send('evm_setAutomine', [false]);
        jest.resetAllMocks();
        jest.restoreAllMocks();

        const transactions = await executeTransactions(txType);

        blocksWithGasPrices = transactions.blocksWithGasPrices.sort((a, b) => b.blockNumber - a.blockNumber);

        // Set automining to true
        await hre.network.provider.send('evm_setAutomine', [true]);
      });

      it('returns latestBlockPercentileGasPrice', async () => {
        const [_logs, gasPrice] = await gasOracle.getGasPrice(provider, defaultGasPriceOracleOptions);

        const processedPercentileGasPrice = await processBlockData(
          provider,
          blocksWithGasPrices,
          latestBlockPercentileGasPriceStrategy.percentile,
          latestBlockPercentileGasPriceStrategy.maxDeviationMultiplier,
          constantGasPriceStrategy.gasPrice as PriorityFee,
          providerRecommendedGasPriceStrategy.recommendedGasPriceMultiplier
        );

        expect(gasPrice).toEqual(processedPercentileGasPrice);
      });

      it('returns providerRecommendedGasPrice if maxDeviationMultiplier is exceeded', async () => {
        const gasPriceOracleOptions: GasPriceOracleConfig = [
          {
            ...latestBlockPercentileGasPriceStrategy,
            // Set a low maxDeviationMultiplier to test getGasPrice fallback
            maxDeviationMultiplier: 0.01,
          },
          providerRecommendedGasPriceStrategy,
          constantGasPriceStrategy,
        ];

        const [_logs, gasPrice] = await gasOracle.getGasPrice(provider, gasPriceOracleOptions);
        const providerRecommendedGasPrice = await gasOracle.fetchProviderRecommendedGasPrice(
          provider,
          providerRecommendedGasPriceStrategy
        );

        expect(gasPrice).toEqual(providerRecommendedGasPrice);
      });

      it('returns providerRecommendedGasPrice if getBlockWithTransactions provider calls fail', async () => {
        const getBlockWithTransactionsSpy = jest.spyOn(
          hre.ethers.providers.StaticJsonRpcProvider.prototype,
          'getBlockWithTransactions'
        );
        getBlockWithTransactionsSpy.mockImplementation(async () => {
          throw new Error('some error');
        });

        const [_logs, gasPrice] = await gasOracle.getGasPrice(provider, defaultGasPriceOracleOptions);
        const providerRecommendedGasPrice = await gasOracle.fetchProviderRecommendedGasPrice(
          provider,
          providerRecommendedGasPriceStrategy
        );

        expect(gasPrice).toEqual(providerRecommendedGasPrice);
      });

      it('returns constantGasPrice if getBlockWithTransactions and getGasPrice provider calls fail', async () => {
        const getBlockWithTransactionsSpy = jest.spyOn(
          hre.ethers.providers.StaticJsonRpcProvider.prototype,
          'getBlockWithTransactions'
        );
        const getGasPriceSpy = jest.spyOn(hre.ethers.providers.StaticJsonRpcProvider.prototype, 'getGasPrice');
        getBlockWithTransactionsSpy.mockImplementation(async () => {
          throw new Error('some error');
        });
        getGasPriceSpy.mockImplementation(async () => {
          throw new Error('some error');
        });

        const [_logs, gasPrice] = await gasOracle.getGasPrice(provider, defaultGasPriceOracleOptions);
        const constantGasPrice = gasOracle.fetchConstantGasPrice(constantGasPriceStrategy);

        expect(gasPrice).toEqual(constantGasPrice);
      });

      describe('handles unexpected errors', () => {
        it('returns constantGasPrice if all attemptGasOracleStrategy retries throw', async () => {
          const attemptGasOracleStrategySpy = jest.spyOn(gasOracle, 'attemptGasOracleStrategy');
          attemptGasOracleStrategySpy.mockRejectedValue({ success: false, error: 'Some error' });

          const [_logs, gasPrice] = await gasOracle.getGasPrice(provider, defaultGasPriceOracleOptions);
          const constantGasPrice = gasOracle.fetchConstantGasPrice(constantGasPriceStrategy);

          expect(gasPrice).toEqual(constantGasPrice);
        });

        it('returns constantGasPrice if all strategy-specific functions throw', async () => {
          jest.spyOn(gasOracle, 'fetchLatestBlockPercentileGasPrice').mockImplementation(() => {
            throw new Error('Unexpected error');
          });
          jest.spyOn(gasOracle, 'fetchProviderRecommendedGasPrice').mockImplementation(() => {
            throw new Error('Unexpected error');
          });
          // Throw on the first call of fetchConstantGasPrice
          jest.spyOn(gasOracle, 'fetchConstantGasPrice').mockImplementationOnce(() => {
            throw new Error('Unexpected error');
          });
          const goGasPrice = await go(() => gasOracle.getGasPrice(provider, defaultGasPriceOracleOptions));
          // Ensure that getGasPrice did not throw
          assertGoSuccess(goGasPrice);
          const [_logs, gasPrice] = goGasPrice.data;
          expect(gasPrice).toEqual(gasOracle.fetchConstantGasPrice(constantGasPriceStrategy));
        });
      });
    });
  });
});

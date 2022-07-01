import { randomHexString } from '@api3/airnode-utilities';
import * as wallet from '../evm/wallet';
import { CoordinatorSettings, CoordinatorState } from '../types';
import { Config, getEnvValue } from '../config';
import { CoordinatorStateWithApiResponses, RegularAggregatedApiCallsWithResponseById } from '..';

export function create(config: Config): CoordinatorState {
  const coordinatorId = randomHexString(16);
  const airnodeWalletPrivateKey = getEnvValue('AIRNODE_WALLET_PRIVATE_KEY');
  if (!airnodeWalletPrivateKey) {
    throw new Error('Missing Airnode wallet private key in environment variables.');
  }
  const airnodeAddress = wallet.getAirnodeWalletFromPrivateKey(airnodeWalletPrivateKey).address;
  const airnodeAddressShort = wallet.getAirnodeAddressShort(airnodeAddress);

  const settings: CoordinatorSettings = {
    airnodeAddress,
    airnodeAddressShort,
    logFormat: config.nodeSettings.logFormat,
    logLevel: config.nodeSettings.logLevel,
    stage: config.nodeSettings.stage,
    cloudProvider: config.nodeSettings.cloudProvider,
  };

  return {
    coordinatorId,
    config,
    settings,
    aggregatedApiCallsById: {},
    providerStates: { evm: [] },
  };
}

export function update<T extends CoordinatorState>(state: T, newState: Partial<T>): T {
  return { ...state, ...newState };
}

type BaseResponses = { aggregatedApiCallsById: RegularAggregatedApiCallsWithResponseById };
export function addResponses<T extends BaseResponses>(
  state: CoordinatorState,
  newState: T
): CoordinatorStateWithApiResponses {
  return { ...state, ...newState };
}

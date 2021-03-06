import { AggregatedApiCall } from '../../src/types';

export function createAggregatedApiCall(params?: Partial<AggregatedApiCall>): AggregatedApiCall {
  return {
    endpointId: 'endpointId',
    endpointName: 'convertToUSD',
    id: 'apiCallId',
    oisTitle: 'Currency Converter API',
    parameters: { from: 'ETH' },
    type: 'request',
    ...params,
  };
}

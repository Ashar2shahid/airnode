import { ApiCall, ClientRequest, RequestStatus } from '../../../src/types';
import { buildMetadata } from './metadata';

export function buildApiCall(params?: Partial<ClientRequest<ApiCall>>): ClientRequest<ApiCall> {
  const metadata = buildMetadata();

  // These fields have invalid values on purpose to allow for easier reading. When necessary,
  // they can be overridden with valid values
  return {
    airnodeId: 'airnodeId',
    chainId: '31337',
    clientAddress: 'clientAddress',
    designatedWallet: 'designatedWallet',
    encodedParameters: 'encodedParameters',
    endpointId: 'endpointId',
    fulfillAddress: 'fulfillAddress',
    fulfillFunctionId: 'fulfillFunctionId',
    id: 'apiCallId',
    metadata,
    parameters: { from: 'ETH' },
    requestCount: '12',
    requesterIndex: '3',
    status: RequestStatus.Pending,
    templateId: null,
    type: 'regular',
    ...params,
  };
}

export function buildSubmittableApiCall(params?: Partial<ClientRequest<ApiCall>>): ClientRequest<ApiCall> {
  return {
    ...buildApiCall(),
    // Decodes to: '75051'
    responseValue: '0x000000000000000000000000000000000000000000000000000000000001252b',
    ...params,
  };
}

import { AggregatedApiCall, AggregatedApiCallsById, ApiCall, ClientRequest, Config, RequestStatus } from '../../types';

function createAggregatedCall(config: Config, request: ClientRequest<ApiCall>): AggregatedApiCall {
  // The trigger should already be verified to exist at this point
  const trigger = config.triggers.request.find((t) => t.endpointId === request.endpointId)!;

  return {
    id: request.id,
    endpointId: request.endpointId!,
    parameters: request.parameters,
    type: 'request',
    endpointName: trigger.endpointName,
    oisTitle: trigger.oisTitle,
  };
}

export function aggregate(config: Config, flatApiCalls: ClientRequest<ApiCall>[]): AggregatedApiCallsById {
  const aggregatedApiCallsById = flatApiCalls.reduce((acc: AggregatedApiCallsById, request) => {
    if (request.status !== RequestStatus.Pending) {
      return acc;
    }

    const existingAggregatedCall = acc[request.id];

    // If this is the first time we're seeing this API call, then create a new aggregated API call
    if (!existingAggregatedCall) {
      const aggregatedCall = createAggregatedCall(config, request);
      return { ...acc, [request.id]: aggregatedCall };
    }

    // If this is the first time we're seeing this request, add it to the list of unique requests
    return acc;
  }, {});

  return aggregatedApiCallsById;
}

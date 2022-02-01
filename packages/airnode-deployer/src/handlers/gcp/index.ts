import * as path from 'path';
import { Request, Response } from '@google-cloud/functions-framework/build/src/functions';
import { handlers, logger, utils, providers, config } from '@api3/airnode-node';
import { loadConfig } from '../../utils';

const configFile = path.resolve(`${__dirname}/../../config-data/config.json`);
const parsedConfig = loadConfig(configFile, process.env, false);

export async function startCoordinator(_req: Request, res: Response) {
  await handlers.startCoordinator(parsedConfig);
  const response = { ok: true, data: { message: 'Coordinator completed' } };
  res.status(200).send(response);
}

export async function initializeProvider(req: Request, res: Response) {
  const stateWithConfig = { ...req.body.state, config: parsedConfig };

  const [err, initializedState] = await utils.go(() => handlers.initializeProvider(stateWithConfig));
  if (err || !initializedState) {
    const msg = `Failed to initialize provider: ${stateWithConfig.settings.name}`;
    console.log(err!.toString());
    const errorLog = logger.pend('ERROR', msg, err);
    const body = { ok: false, errorLog };
    res.status(500).send(body);
    return;
  }

  const body = { ok: true, data: providers.scrub(initializedState) };
  res.status(200).send(body);
}

export async function callApi(req: Request, res: Response) {
  const { aggregatedApiCall, logOptions } = req.body;
  const [logs, apiCallResponse] = await handlers.callApi({ config: parsedConfig, aggregatedApiCall });
  logger.logPending(logs, logOptions);
  const response = { ok: true, data: apiCallResponse };
  res.status(200).send(response);
}

export async function processProviderRequests(req: Request, res: Response) {
  const stateWithConfig = { ...req.body.state, config: parsedConfig };

  const [err, updatedState] = await utils.go(() => handlers.processTransactions(stateWithConfig));
  if (err || !updatedState) {
    const msg = `Failed to process provider requests: ${stateWithConfig.settings.name}`;
    const errorLog = logger.pend('ERROR', msg, err);
    const body = { ok: false, errorLog };
    res.status(500).send(body);
    return;
  }

  const body = { ok: true, data: providers.scrub(updatedState) };
  res.status(200).send(body);
}

export async function testApi(req: Request, res: Response) {
  // We need to check for an API key manually because GCP HTTP Gateway
  // doesn't support managing API keys via API
  const apiKey = req.header('x-api-key');
  if (!apiKey || apiKey !== config.getEnvValue('HTTP_GATEWAY_API_KEY')) {
    res.status(401).send({ error: 'Wrong API key' });
  }

  const { parameters } = req.body;
  const { endpointId } = req.query;

  if (!endpointId) {
    res.status(400).send({ error: 'Missing endpointId' });
    return;
  }

  const [err, result] = await handlers.testApi(parsedConfig, endpointId as string, parameters);
  if (err) {
    res.status(400).send({ error: err.toString() });
    return;
  }

  // NOTE: We do not want the user to see {"value": <actual_value>}, but the actual value itself
  res.status(200).send(result!.value);
}
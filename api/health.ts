import { json, methodNotAllowed, type ApiHandler } from './_types';

const handler: ApiHandler = (request, response) => {
  if (request.method !== 'GET') { methodNotAllowed(response, ['GET']); return; }
  json(response, 200, { status: 'ok', service: 'eutaktos-api' });
};
export default handler;

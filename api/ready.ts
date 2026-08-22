import { SupabaseRestDatabase } from './_db';
import { json, methodNotAllowed, type ApiHandler } from './_types';

const handler: ApiHandler = async (request, response) => {
  if (request.method !== 'GET') { methodNotAllowed(response, ['GET']); return; }
  let database: SupabaseRestDatabase;
  try { database = new SupabaseRestDatabase(); }
  catch { json(response, 503, { status: 'not-ready', database: 'misconfigured' }); return; }
  if (!database.configured) { json(response, 503, { status: 'not-ready', database: 'unconfigured' }); return; }
  const ready = await database.ready();
  json(response, ready ? 200 : 503, { status: ready ? 'ready' : 'not-ready', database: ready ? 'reachable' : 'unavailable' });
};
export default handler;

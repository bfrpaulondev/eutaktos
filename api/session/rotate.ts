import { resolvePrincipal, sessionCookie } from '../_auth';
import { assertTrustedMutation, runEndpoint } from '../_endpoint';
import { methodNotAllowed, type ApiHandler } from '../_types';

const handler:ApiHandler=async(request,response)=>{
  if(request.method!=='POST'){methodNotAllowed(response,['POST']);return;}
  await runEndpoint(request,response,async database=>{
    assertTrustedMutation(request);
    const principal=await resolvePrincipal(request,database);
    const nextId=`session-${crypto.randomUUID()}`;
    const rotated=await database.rotateSession(principal.sessionId,nextId,new Date().toISOString());
    response.setHeader('Set-Cookie',sessionCookie(rotated.id));
    response.setHeader('Cache-Control','no-store');
    response.status(204).end();
  });
};
export default handler;

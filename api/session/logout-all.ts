import { clearSessionCookie, resolvePrincipal } from '../_auth';
import { assertTrustedMutation, runEndpoint } from '../_endpoint';
import { methodNotAllowed, type ApiHandler } from '../_types';

const handler:ApiHandler=async(request,response)=>{
  if(request.method!=='POST'){methodNotAllowed(response,['POST']);return;}
  await runEndpoint(request,response,async database=>{
    assertTrustedMutation(request);
    const principal=await resolvePrincipal(request,database);
    await database.revokeAllSessions(principal.tenantId,principal.actorId);
    response.setHeader('Set-Cookie',clearSessionCookie());
    response.setHeader('Cache-Control','no-store');
    response.status(204).end();
  });
};
export default handler;

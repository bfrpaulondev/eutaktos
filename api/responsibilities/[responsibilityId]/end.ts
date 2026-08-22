import { ResponsibilityHttpTransport } from '@eutaktos/transport';
import { resolvePrincipal } from '../../_auth';
import { assertTrustedMutation, BadRequestError, runEndpoint } from '../../_endpoint';
import { organizationRuntime } from '../../_organization';
import { sendTransport, transportRequest } from '../../_transport';
import { methodNotAllowed, queryValue, type ApiHandler } from '../../_types';

const handler:ApiHandler=async(request,response)=>{
  if(request.method!=='PUT'){methodNotAllowed(response,['PUT']);return;}
  await runEndpoint(request,response,async database=>{
    assertTrustedMutation(request);
    const principal=await resolvePrincipal(request,database);
    const responsibilityId=queryValue(request,'responsibilityId')?.trim();
    if(!responsibilityId||responsibilityId.length>200) throw new BadRequestError('Invalid responsibilityId');
    const runtime=await organizationRuntime(database,principal.tenantId);
    const result=new ResponsibilityHttpTransport(runtime.service).end(transportRequest(request,principal,{responsibilityId}));
    if(result.status>=200&&result.status<300) await runtime.unitOfWork.flush(database);
    sendTransport(response,result);
  });
};
export default handler;

import { HouseholdHttpTransport } from '@eutaktos/transport';
import { resolvePrincipal } from '../_auth';
import { assertTrustedMutation, BadRequestError, runEndpoint } from '../_endpoint';
import { organizationRuntime } from '../_organization';
import { sendTransport, transportRequest } from '../_transport';
import { methodNotAllowed, queryValue, type ApiHandler } from '../_types';

const handler: ApiHandler = async (request, response) => {
  if (!['GET','PUT','DELETE'].includes(request.method ?? '')) { methodNotAllowed(response, ['GET','PUT','DELETE']); return; }
  await runEndpoint(request, response, async database => {
    const principal=await resolvePrincipal(request,database);
    const householdId=queryValue(request,'householdId')?.trim();
    if(!householdId||householdId.length>200) throw new BadRequestError('Invalid householdId');
    const runtime=await organizationRuntime(database,principal.tenantId);
    const transport=new HouseholdHttpTransport(runtime.service);
    const transportReq=transportRequest(request,principal,{householdId});
    let result;
    if(request.method==='GET') result=transport.get(transportReq);
    else { assertTrustedMutation(request); result=request.method==='PUT'?transport.update(transportReq):transport.delete(transportReq); }
    if(request.method!=='GET'&&result.status>=200&&result.status<300) await runtime.unitOfWork.flush(database);
    sendTransport(response,result);
  });
};
export default handler;

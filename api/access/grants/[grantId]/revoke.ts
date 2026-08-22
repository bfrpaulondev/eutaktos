import { AccessGrantService } from '@eutaktos/application';
import { AccessGrantHttpTransport } from '@eutaktos/transport';
import { resolvePrincipal } from '../../../_auth';
import { assertTrustedMutation, BadRequestError, runEndpoint } from '../../../_endpoint';
import { sendTransport, transportRequest } from '../../../_transport';
import { AccessGrantSnapshotUnitOfWork, RuntimeIds } from '../../../_uow';
import { methodNotAllowed, queryValue, type ApiHandler } from '../../../_types';

const handler:ApiHandler=async(request,response)=>{
  if(request.method!=='POST'){methodNotAllowed(response,['POST']);return;}
  await runEndpoint(request,response,async database=>{
    assertTrustedMutation(request);
    const principal=await resolvePrincipal(request,database);
    const grantId=queryValue(request,'grantId')?.trim();
    if(!grantId||grantId.length>200) throw new BadRequestError('Invalid grantId');
    const row=await database.grantById(principal.tenantId,grantId);
    const uow=new AccessGrantSnapshotUnitOfWork(principal.tenantId,row?[row]:[]);
    const service=new AccessGrantService(uow,new RuntimeIds());
    const result=new AccessGrantHttpTransport(service).revoke(transportRequest(request,principal,{grantId}));
    if(result.status>=200&&result.status<300) await uow.flush(database);
    sendTransport(response,result);
  });
};
export default handler;

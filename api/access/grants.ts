import { AccessGrantService } from '@eutaktos/application';
import { AccessGrantHttpTransport } from '@eutaktos/transport';
import { resolvePrincipal } from '../_auth';
import { assertTrustedMutation, requestBody, requiredString, runEndpoint } from '../_endpoint';
import { sendTransport, transportRequest } from '../_transport';
import { AccessGrantSnapshotUnitOfWork, RuntimeIds } from '../_uow';
import { methodNotAllowed, type ApiHandler } from '../_types';

const handler:ApiHandler=async(request,response)=>{
  if(request.method!=='POST'){methodNotAllowed(response,['POST']);return;}
  await runEndpoint(request,response,async database=>{
    assertTrustedMutation(request);
    const principal=await resolvePrincipal(request,database);
    const subjectId=requiredString(requestBody(request.body),'subjectId',200);
    const rows=await database.grantsForSubject(principal.tenantId,subjectId);
    const uow=new AccessGrantSnapshotUnitOfWork(principal.tenantId,rows);
    const service=new AccessGrantService(uow,new RuntimeIds());
    const result=new AccessGrantHttpTransport(service).grant(transportRequest(request,principal));
    if(result.status>=200&&result.status<300) await uow.flush(database);
    sendTransport(response,result);
  });
};
export default handler;

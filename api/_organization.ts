import { OrganizationService } from '@eutaktos/application';
import type { SupabaseRestDatabase } from './_db';
import { OrganizationSnapshotUnitOfWork, RuntimeIds } from './_uow';

export async function organizationRuntime(database: SupabaseRestDatabase, tenantId: string): Promise<{
  unitOfWork: OrganizationSnapshotUnitOfWork;
  service: OrganizationService;
}> {
  const [households, groups, responsibilities] = await Promise.all([
    database.entities(tenantId, 'household'),
    database.entities(tenantId, 'service-group'),
    database.entities(tenantId, 'responsibility'),
  ]);
  const unitOfWork = new OrganizationSnapshotUnitOfWork(tenantId, households, groups, responsibilities);
  return { unitOfWork, service: new OrganizationService(unitOfWork, unitOfWork, unitOfWork, new RuntimeIds()) };
}

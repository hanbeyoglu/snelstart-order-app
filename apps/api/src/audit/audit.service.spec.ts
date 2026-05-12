import test from 'node:test';
import assert from 'node:assert/strict';
import { AuditService } from './audit.service';

function createAuditServiceHarness(superAdminIds: string[]) {
  let lastFindQuery: any;
  const auditLogModel: any = {
    find: (q: any) => {
      lastFindQuery = q;
      return {
        sort: () => ({
          skip: () => ({
            limit: () => ({
              lean: () => ({
                exec: async () => [],
              }),
            }),
          }),
        }),
      };
    },
    countDocuments: () => ({ exec: async () => 0 }),
    aggregate: () => ({ exec: async () => [] }),
  };

  const userModel: any = {
    find: (filter: any) => ({
      select: () => ({
        lean: () => ({
          exec: async () => {
            if (filter?.role === 'super_admin') {
              return superAdminIds.map((id) => ({ _id: id }));
            }
            if (filter?.role?.$ne === 'super_admin' && filter?.$or) {
              return [];
            }
            return [];
          },
        }),
      }),
    }),
  };

  const service = new AuditService(auditLogModel, userModel);
  return { service, getLastFindQuery: () => lastFindQuery };
}

test('admin audit list query includes super_admin exclusion $nor', async () => {
  const { service, getLastFindQuery } = createAuditServiceHarness(['64a1a1a1a1a1a1a1a1a1a1']);
  await service.getLogs({ currentUserRole: 'admin', page: 1, limit: 10 });
  const q = getLastFindQuery();
  assert.ok(q.$and, 'expected $and for exclusion scope');
  const norClause = q.$and.find((c: any) => c.$nor);
  assert.ok(norClause, 'expected $nor exclusion clause');
  assert.ok(
    norClause.$nor.some((x: any) => x.actorRole === 'super_admin'),
    'expected actorRole super_admin in $nor',
  );
  assert.ok(
    norClause.$nor.some((x: any) => x.targetRole === 'super_admin'),
    'expected targetRole super_admin in $nor',
  );
});

test('super_admin audit list query has no super_admin exclusion clause', async () => {
  const { service, getLastFindQuery } = createAuditServiceHarness(['64a1a1a1a1a1a1a1a1a1a1']);
  await service.getLogs({ currentUserRole: 'super_admin', page: 1, limit: 10 });
  const q = getLastFindQuery();
  const hasNor = Array.isArray(q.$and) && q.$and.some((c: any) => c.$nor);
  assert.equal(hasNor, false);
});

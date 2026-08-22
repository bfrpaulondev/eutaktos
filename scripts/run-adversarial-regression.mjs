import { spawnSync } from 'node:child_process';

const commands = [
  ['npm', ['run', 'typecheck']],
  ['npm', ['test', '--workspace', '@eutaktos/domain', '--', '--run',
    'src/conflict-engine.test.ts', 'src/midweek-meeting.test.ts', 'src/student-assignment.test.ts',
    'src/non-student-assignment.test.ts', 'src/duty-assignment.test.ts', 'src/assignment-response.test.ts',
    'src/assignment-history.test.ts', 'src/student-history-queries.test.ts', 'src/notification-delivery.test.ts',
    'src/notification-preferences.test.ts', 'src/scheduling-invariants.test.ts', 'src/manus-hardening.test.ts',
    'src/public-talk-scheduling.test.ts']],
  ['npm', ['test', '--workspace', '@eutaktos/application', '--', '--run',
    'src/midweek-scheduling-service.test.ts', 'src/scheduling-review-fixes.test.ts',
    'src/organization-service.test.ts', 'src/organization-delete-audit.test.ts',
    'src/hourglass-import.test.ts', 'src/migration.review.test.ts', 'src/eligibility-service.test.ts',
    'src/availability-service.test.ts', 'src/access-grant-service.test.ts']],
  ['npm', ['test', '--workspace', '@eutaktos/infrastructure', '--', '--run',
    'src/midweek-memory.test.ts', 'src/migration-log-memory.test.ts', 'src/audit-history-memory.test.ts',
    'src/access-grant-memory.test.ts', 'src/observability.test.ts']],
  ['npm', ['test', '--workspace', '@eutaktos/transport', '--', '--run',
    'src/midweek-scheduling-http.test.ts', 'src/eligibility-http.test.ts', 'src/access-grant-http.test.ts',
    'src/audit-history-http.test.ts', 'src/csrf-origin.test.ts', 'src/security-headers.test.ts', 'src/session-http.test.ts']],
];

for (const [command, args] of commands) {
  console.log(`\n$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('\nK50 reviewed adversarial regression passed.');

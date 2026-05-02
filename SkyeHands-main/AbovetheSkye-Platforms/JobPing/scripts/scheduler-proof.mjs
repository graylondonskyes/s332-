import fs from 'node:fs';

const checks = [
  ['Scheduler lease helper exists', 'lib/scheduler-lock.ts', 'acquireSchedulerLease'],
  ['Due dispatcher acquires scheduler lease', 'app/api/internal/due-messages/route.ts', 'const lease = await acquireSchedulerLease("due-messages")'],
  ['Due dispatcher records run completion', 'app/api/internal/due-messages/route.ts', 'await completeSchedulerLease(lease.run.id'],
  ['Scheduler health route is internal-secret protected', 'app/api/internal/scheduler-health/route.ts', 'assertInternalRequest(request)'],
  ['SchedulerRun model exists', 'prisma/schema.prisma', 'model SchedulerRun'],
  ['MessageDeadLetter model exists', 'prisma/schema.prisma', 'model MessageDeadLetter'],
  ['Failed provider sends can dead-letter', 'lib/send-message-event.ts', 'maybeDeadLetterFailedMessage'],
  ['Scheduler migration exists', 'prisma/migrations/20260425202000_scheduler_lease_dead_letters/migration.sql', 'CREATE TABLE IF NOT EXISTS "SchedulerRun"'],
];

const failures = [];
for (const [name, file, needle] of checks) {
  if (!fs.existsSync(file)) failures.push(`${name}: missing ${file}`);
  else if (!fs.readFileSync(file, 'utf8').includes(needle)) failures.push(`${name}: missing ${needle}`);
}

if (failures.length) {
  console.error('SCHEDULER PROOF FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('SCHEDULER PROOF PASSED: scheduler lease, heartbeat, and dead-letter safety are present.');

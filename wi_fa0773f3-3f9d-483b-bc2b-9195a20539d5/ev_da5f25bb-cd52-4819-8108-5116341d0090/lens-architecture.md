# architecture readonly review

Head: 700cf89a2e5150f4b8005991cf546c7d63510fd7
Base: 0ee3da2dce6a9d9dc292c5f1526118da26c142e2

5. **High / architecture + correctness — non-ACM dependencies not gated.** `worker.ts:80` gates ACM only. Topological insertion order does not enforce prerequisite readiness within a tick, across batches or across instances. A dependent can initialize while Data Manager remains RUNNING/WAITING. Gate the required dependency closure on durable readiness, with failure propagation.

6. **High / architecture + correctness — descriptor upgrade omits automatic provisioning.** `apps/api/src/modules/initialization/upgrade.ts:154` explicitly defers missing auto stores to a future hook/operator, then schedules initialization. Worker serializes existing stores without validating required roles. Provision before scheduling or expose Configuration required. This is a Phase B completeness gap, not deferred Phase C runtime work.

7. **High / architecture — postcommit initialization intent loss.** `apps/api/src/modules/tenants/service.ts:504` schedules only after assignment/audit/version/event transaction commits. Crash loses the intent, and repeating update no longer recognizes an added/re-enabled product. `licenses/service.ts:506-514` has the same split. Persist the operation/intent transactionally.

# correctness readonly review

Head: 700cf89a2e5150f4b8005991cf546c7d63510fd7
Base: 0ee3da2dce6a9d9dc292c5f1526118da26c142e2

3. **High / correctness — disabled assignment resurrection.** `apps/api/src/modules/initialization/worker.ts:213` unconditionally writes READY after a pending/inflight operation. Disable, removal and license revocation do not cancel or invalidate the operation; no target tenant/assignment guard prevents a late result overwriting DISABLED. Completion must serialize against revocation, including stale responses.

4. **High / correctness — terminal progress not atomic.** `worker.ts:204` commits terminal operation state before assignment and tenant lifecycle. Crash between commits permanently leaves INITIALIZING because terminal operations are no longer claimable. Failure/exhaustion paths share the split. Commit atomically or durably reconcile.

5. **High / architecture + correctness — non-ACM dependencies not gated.** `worker.ts:80` gates ACM only. Topological insertion order does not enforce prerequisite readiness within a tick, across batches or across instances. A dependent can initialize while Data Manager remains RUNNING/WAITING. Gate the required dependency closure on durable readiness, with failure propagation.

6. **High / architecture + correctness — descriptor upgrade omits automatic provisioning.** `apps/api/src/modules/initialization/upgrade.ts:154` explicitly defers missing auto stores to a future hook/operator, then schedules initialization. Worker serializes existing stores without validating required roles. Provision before scheduling or expose Configuration required. This is a Phase B completeness gap, not deferred Phase C runtime work.

8. **High / correctness — tenant snapshot absent from sign/commit CAS.** `apps/api/src/modules/licenses/service.ts:419` commits signed candidate using expected license only; repository locks tenant but checks DISABLED rather than tenant version. Concurrent customer/assignment update during signing allows stale claims/reconciliation and first-issue stale If-Match. Validate the tenant snapshot under commit lock.

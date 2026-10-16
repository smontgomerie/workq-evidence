# PINPOINT-7520 Phase B integration review — blocked

Reviewed head: `700cf89a2e5150f4b8005991cf546c7d63510fd7`.
Base: `0ee3da2dce6a9d9dc292c5f1526118da26c142e2` (`main`).
Range: `origin/main...origin/codex/multi-tenancy`. `git ls-remote` confirmed both remote SHAs unchanged. No settled member findings were collected by the prior run. This report records findings before triage. No product code or published history changed.

## Initial focused findings

1. **High / security — configured operator group bypass.** `apps/api/src/modules/auth/authenticator.ts:31` retains incoming ACM group `operator`, the internal authority sentinel, even when configured group is `Operators` or a restricted custom group. Authority evaluation therefore authorizes a user lacking the configured group. Lens readonly execution confirmed `allowed:true`. Derive the sentinel exclusively from configured-group membership; test refused actor status and no mutation.
2. **Medium / security — acceptance server in production image.** `Dockerfile:31` copies all API dist; tsconfig compiles `src/test-harness/**`. The executable `tm-process-entry` reads mounted runtime configuration while setting `permittedDestinations:null` and `allowedHosts:null` and accepting a fixed-token override. Exclude test harness from release artifacts and assert packaging absence. Quality bar forbids accepting this as a risk.
3. **High / correctness — disabled assignment resurrection.** `apps/api/src/modules/initialization/worker.ts:213` unconditionally writes READY after a pending/inflight operation. Disable, removal and license revocation do not cancel or invalidate the operation; no target tenant/assignment guard prevents a late result overwriting DISABLED. Completion must serialize against revocation, including stale responses.
4. **High / correctness — terminal progress not atomic.** `worker.ts:204` commits terminal operation state before assignment and tenant lifecycle. Crash between commits permanently leaves INITIALIZING because terminal operations are no longer claimable. Failure/exhaustion paths share the split. Commit atomically or durably reconcile.
5. **High / architecture + correctness — non-ACM dependencies not gated.** `worker.ts:80` gates ACM only. Topological insertion order does not enforce prerequisite readiness within a tick, across batches or across instances. A dependent can initialize while Data Manager remains RUNNING/WAITING. Gate the required dependency closure on durable readiness, with failure propagation.
6. **High / architecture + correctness — descriptor upgrade omits automatic provisioning.** `apps/api/src/modules/initialization/upgrade.ts:154` explicitly defers missing auto stores to a future hook/operator, then schedules initialization. Worker serializes existing stores without validating required roles. Provision before scheduling or expose Configuration required. This is a Phase B completeness gap, not deferred Phase C runtime work.
7. **High / architecture — postcommit initialization intent loss.** `apps/api/src/modules/tenants/service.ts:504` schedules only after assignment/audit/version/event transaction commits. Crash loses the intent, and repeating update no longer recognizes an added/re-enabled product. `licenses/service.ts:506-514` has the same split. Persist the operation/intent transactionally.
8. **High / correctness — tenant snapshot absent from sign/commit CAS.** `apps/api/src/modules/licenses/service.ts:419` commits signed candidate using expected license only; repository locks tenant but checks DISABLED rather than tenant version. Concurrent customer/assignment update during signing allows stale claims/reconciliation and first-issue stale If-Match. Validate the tenant snapshot under commit lock.

Duplicates across lenses for missing provisioning and dependency readiness were merged. These findings need focused follow-up and an owner for the durable initialization transaction boundaries; they cannot be safely closed as a small final-review patch.

## Additional focused findings (recorded before triage)

9. **High / pattern-conformance — production Solr provisioning disconnected.** `apps/api/src/modules/provision/service.ts:375` retains unconditional SKIPPED/DEFERRED_B15 in PROVISION_CORES. Production route constructs only schema provisioner; provisionCores is invoked only by tests. Automatic Solr selection never creates cores. Connect the authenticated provisioning path and persist outcomes before initialization.
10. **Medium / pattern-conformance — webhook response resource leak.** `apps/api/src/modules/events/dispatcher.ts:161` acknowledges 2xx without consuming/cancelling response body, then clears abort timer. Streaming/nonempty success responses can retain sockets indefinitely. Consume/cancel on success and test an open response body. Adjacent product HTTP clients already consume responses.
11. **Medium / tests — published Solr compatibility unproved.** `apps/api/src/test-harness/solr.ts:40` copies identical MINIMAL_CONF under every receipt name. Helper tests cannot detect missing/incompatible published product resources, schemas/plugins or archives. Retain artifact compatibility as unproved until a pinned published-artifact acceptance run passes.
12. **Medium / tests — restart order assertion accepts duplicate.** `apps/api/test/multi-instance-acceptance.test.ts:365` treats increased receipt count as configurationVersion 2/order recovery without verifying event ID, version, sequence or acknowledgement. Duplicate version 1 satisfies the test. Await exact second event and assert sequence/replay handling.
13. **High / UI — stale poll can direct edit to wrong tenant.** `apps/web/src/app/features/tenants/tenants.page.ts:1632` refreshStatus writes detail/status after awaited requests without generation checks. Poll for A can finish after B selection, replacing target id/version with A while edit fields remain from B; saveEdit then updates A using B fields. Invalidate and guard every post-await write, test delayed and overlapping polls.
14. **Medium / UI — clearing file root silently preserves old value.** `tenants.page.ts:1305` omits blank fileRoot; API treats omission as unchanged and null as clear. Save succeeds but old root returns. Send null for explicitly cleared update values.

## Gate and infrastructure evidence

- Full `npm run test`: 34 tests reported, 11 pass / 23 fail; imports fail for missing `pg` and `@flatirons/tenancy-contract-kit`. Web tests never run. Node is v25.4.0, outside required Node 22.
- `npm run build`: API compiler cannot resolve `pg`, and installed `jose` lacks expected `KeyLike`; web build exits unsuccessfully. No passing gate is claimed.
- Diagnostic evidence `ev_59fc0f43-84c5-46b1-b0cf-67a5a4b68e3e` captures Node and missing modules, exit 1. Gate suite runs were refused as green evidence and their steps remain failed.
- `git fetch` cannot write shared worktree FETCH_HEAD (`Operation not permitted`), despite configured writable git root. Readonly remote SHA check succeeded.
- Native agent thread cap required reusing the three completed native lens agents for pattern-conformance, tests and UI passes. All six lens passes remain independent readonly reports; no external agent CLI was substituted.

## B32 and Phase C

`docs/mvp/phase-b/b32-integration-acceptance.md` is historical evidence at `7d03ca8`, merged into reviewed tip by B32 PR https://bitbucket.org/flatironssolutions/tenant-manager/pull-requests/22. It explicitly discloses ACM HTTP twin/product fixtures, local-helper image rather than authenticated Jenkins build, and unresolved Solr artifact version/digest. Those limitations remain; this review does not upgrade them to live acceptance.

Phase C handoffs remain product runtime routing/license enforcement and on-prem environment identity, machine binding and shipped CLI. AWS KMS is deferred. Public trust remains build-owned; operator issuing and fresh signed restore remain approved Phase B decisions.

Completeness verdict: blocked by cross-module provisioning, dependency, lifecycle and CAS gaps above. Overreach verdict: acceptance-only executable content crosses the production packaging boundary; no need to widen work into Phase C. Final PR must remain exactly `codex/multi-tenancy` to `main`, with autoMerge false and explicit human landing approval. No PR is opened while required gates are red.

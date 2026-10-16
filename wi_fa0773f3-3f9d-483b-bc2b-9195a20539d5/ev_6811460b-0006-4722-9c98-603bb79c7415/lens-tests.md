# tests readonly review

Head: 700cf89a2e5150f4b8005991cf546c7d63510fd7
Base: 0ee3da2dce6a9d9dc292c5f1526118da26c142e2

11. **Medium / tests — published Solr compatibility unproved.** `apps/api/src/test-harness/solr.ts:40` copies identical MINIMAL_CONF under every receipt name. Helper tests cannot detect missing/incompatible published product resources, schemas/plugins or archives. Retain artifact compatibility as unproved until a pinned published-artifact acceptance run passes.

12. **Medium / tests — restart order assertion accepts duplicate.** `apps/api/test/multi-instance-acceptance.test.ts:365` treats increased receipt count as configurationVersion 2/order recovery without verifying event ID, version, sequence or acknowledgement. Duplicate version 1 satisfies the test. Await exact second event and assert sequence/replay handling.

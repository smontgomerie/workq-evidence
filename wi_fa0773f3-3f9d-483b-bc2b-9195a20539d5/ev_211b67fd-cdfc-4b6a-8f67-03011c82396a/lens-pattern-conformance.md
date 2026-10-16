# pattern-conformance readonly review

Head: 700cf89a2e5150f4b8005991cf546c7d63510fd7
Base: 0ee3da2dce6a9d9dc292c5f1526118da26c142e2

9. **High / pattern-conformance — production Solr provisioning disconnected.** `apps/api/src/modules/provision/service.ts:375` retains unconditional SKIPPED/DEFERRED_B15 in PROVISION_CORES. Production route constructs only schema provisioner; provisionCores is invoked only by tests. Automatic Solr selection never creates cores. Connect the authenticated provisioning path and persist outcomes before initialization.

10. **Medium / pattern-conformance — webhook response resource leak.** `apps/api/src/modules/events/dispatcher.ts:161` acknowledges 2xx without consuming/cancelling response body, then clears abort timer. Streaming/nonempty success responses can retain sockets indefinitely. Consume/cancel on success and test an open response body. Adjacent product HTTP clients already consume responses.

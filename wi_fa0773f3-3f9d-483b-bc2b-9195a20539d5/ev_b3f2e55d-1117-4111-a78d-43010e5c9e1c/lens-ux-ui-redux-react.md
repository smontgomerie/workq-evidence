# ux-ui-redux-react readonly review

Head: 700cf89a2e5150f4b8005991cf546c7d63510fd7
Base: 0ee3da2dce6a9d9dc292c5f1526118da26c142e2

13. **High / UI — stale poll can direct edit to wrong tenant.** `apps/web/src/app/features/tenants/tenants.page.ts:1632` refreshStatus writes detail/status after awaited requests without generation checks. Poll for A can finish after B selection, replacing target id/version with A while edit fields remain from B; saveEdit then updates A using B fields. Invalidate and guard every post-await write, test delayed and overlapping polls.

14. **Medium / UI — clearing file root silently preserves old value.** `tenants.page.ts:1305` omits blank fileRoot; API treats omission as unchanged and null as clear. Save succeeds but old root returns. Send null for explicitly cleared update values.

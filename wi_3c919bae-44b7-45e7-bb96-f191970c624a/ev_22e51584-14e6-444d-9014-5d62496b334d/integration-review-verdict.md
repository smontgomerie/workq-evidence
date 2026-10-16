# PINPOINT-7520 ACM accumulated integration review

Reviewed HEAD: `79fdae0126b55d5da03ee8ff712bc0090d2d92ce`
Merge-base: `2eea5ea091eeea324529e50b086aa6f221994ccd`
Range: `origin/master...origin/codex/multi-tenancy`; remote heads unchanged at end of review.
Five native readonly lenses: architecture, correctness, security, pattern-conformance, tests. No outstanding children.

## Findings recorded before disposition

- Medium / architecture + pattern-conformance, `pom.xml:45`: Commons resolves mutable `999.999-PINPOINT-7520-phase-b-tenancy-contract-kit-SNAPSHOT`, despite the comment identifying timestamp 20261015.144912-3 and checksum. All Commons artifacts, including executable SequenceIdChange, can drift from the reviewed/B32 publication. Enforce immutable coordinates or verification before relying on artifact evidence. Dedupe: commons-floating-snapshot-artifact-pin.
- Medium / security + pattern-conformance, `container/docker/rootfs/etc/confd/templates/acm_config.properties:26`: all six `/operator/tenant/*` template keys are missing from the confd resource fetch list. Nondefault operator identity/group settings fall back to defaults. Register all six keys and exercise a nondefault render. Static reproduction: ev_afc3c2f8-98f9-47ab-b8a3-a806ba71252e. Dedupe: confd-missing-operator-tenant-keys.
- Medium / tests, `server/services/src/test/java/AuthServiceImplTest.java:857`: both runtime and configured claim sources test sub/tenantId protection but omit iss/iat/exp/nbf tampering. Capture signed claims and assert issuer/time protection and absence of injected nbf. Dedupe: b03-protected-jwt-issuer-time-coverage.
- Medium / tests, `server/services/src/test/java/AuthServiceImplTest.java:364`: authentication tests use the default operator tenant only. Exercise a nondefault bootstrap, token minting/matching, and refusal of default-operator tokens without storage interaction. Dedupe: b03-nondefault-configured-tenant-auth-coverage.
- Low / tests, `server/services/src/test/java/com/corena/acm/server/impl/tenancy/OperatorTenantBootstrapTest.java:55`: add blank/whitespace schema and group rejection coverage. Dedupe: b03-blank-schema-group-validation-coverage.

Correctness lens found no additional material defect. No concrete privilege bypass established through custom roles or claims. Signature verification precedes tenant/revocation checks. Existing invalid-signature test asserts refusal and no storage interaction; do not re-raise it. Existing null/empty tenant grace is reported as a contract discrepancy with the absent-only wording, not a demonstrated security exploit. B24 accepted naming and installer-preservation findings were suppressed.

## Disposition and completeness

Verdict: blocked, findings unresolved; no code changed. Static operator authentication and staged installer settings fit Phase B, but container configuration and dependency reproducibility prevent a complete integration claim. The two medium test gaps remain follow-ups. Sequence migration predates B03 and changes existing persistence; its inclusion needs scope/evidence confirmation, rather than asserting customer runtime has shipped. No proven customer-runtime overreach found in this diff.

Both required policy commands failed with exit 127 because `client/scripts/with-ci-node.sh` does not exist in the exact reviewed tree. Unit evidence ev_00b9225d-e178-40df-b01a-8a715ae4c84e; build evidence ev_43a3e7b6-4e3c-42b3-a592-40f6b64ede3a. No substituted commands or green-gate claims. Policy reductions: Typecheck, Lint & format, Integration, E2E. No Java build, database migration, browser run, or real confd render performed in this pass.

The managed sandbox also refused git checkout: creating the provisioned shared git worktree index.lock returned Operation not permitted. Review used the preserved readonly pin and a git-archive export inside the assigned workspace. Product edits/commits were not attempted after this failure.

## B32 and Phase C handoff

B32 item wi_689becf3-b0a0-4986-992e-96d491b6317f is done. Acceptance PR: https://bitbucket.org/flatironssolutions/tenant-manager/pull-requests/22 . Its recorded corpus includes API/browser/container acceptance and the install-handoff renderer fix. B32 reports AWS KMS and Jenkins image build still open; do not convert those to green evidence. Its unit/build evidence is for Tenant Manager and does not satisfy ACM local gates.

Phase C remains customer-tenant runtime/routing/enforcement and on-prem identity, binding and CLI. Phase B installer presence is staging, not self-registration. Local issuer is the accepted current direction; AWS KMS is later work.

## Resume

Repair the materialized gate command/wrapper and shared-git sandbox permissions. Resolve narrow findings on codex/multi-tenancy, with PINPOINT-7520 commit text; coordinate immutable Commons publication with its owner. Run Java21 affected tests plus the exact required Unit tests and Build gates. Review the fix delta and recheck remote HEAD. Then open/update exactly codex/multi-tenancy -> master, attach this verdict and B32 evidence, and leave for explicit human approval. Keep autoMerge=false and never merge master automatically. No master PR was opened or updated during this blocked pass.

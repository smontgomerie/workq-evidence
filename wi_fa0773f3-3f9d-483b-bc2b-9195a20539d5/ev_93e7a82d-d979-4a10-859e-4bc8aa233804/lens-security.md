# security readonly review

Head: 700cf89a2e5150f4b8005991cf546c7d63510fd7
Base: 0ee3da2dce6a9d9dc292c5f1526118da26c142e2

1. **High / security — configured operator group bypass.** `apps/api/src/modules/auth/authenticator.ts:31` retains incoming ACM group `operator`, the internal authority sentinel, even when configured group is `Operators` or a restricted custom group. Authority evaluation therefore authorizes a user lacking the configured group. Lens readonly execution confirmed `allowed:true`. Derive the sentinel exclusively from configured-group membership; test refused actor status and no mutation.

2. **Medium / security — acceptance server in production image.** `Dockerfile:31` copies all API dist; tsconfig compiles `src/test-harness/**`. The executable `tm-process-entry` reads mounted runtime configuration while setting `permittedDestinations:null` and `allowedHosts:null` and accepting a fixed-token override. Exclude test harness from release artifacts and assert packaging absence. Quality bar forbids accepting this as a risk.

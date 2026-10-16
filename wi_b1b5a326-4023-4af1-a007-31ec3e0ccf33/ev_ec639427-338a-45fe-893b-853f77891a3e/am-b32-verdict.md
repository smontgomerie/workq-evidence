# B32 Phase B integration acceptance

Epic: [PINPOINT-7520](https://flatironssolutions.atlassian.net/browse/PINPOINT-7520).
Integration base: `codex/multi-tenancy`. This record is the requirement-to-evidence verdict for that tip. It does not land `main`.

## Tip and tooling

| Item | Value |
| --- | --- |
| Tenant Manager tip | `7d03ca898fdc0b8680a54d1f553b83832d88cd32` (`origin/codex/multi-tenancy` at run time) |
| Harness delta on that tip | Confd renderer no longer lets a preceding `{{if exists}}…{{end}}` swallow a later `if/else` (`scripts/lib/b31-install-handoff.mjs`). Product code under test is the tip above. |
| Node | v22.18.0 |
| Contract kit | `@flatirons/tenancy-contract-kit@1.1.0-phase-b.PINPOINT-7520-phase-b-tenancy-contract-k.9` (`sha512-mSsVAtDP5ysJy3UnVCc1j2TqI7lvNQ7uW5EwnUBNQf6EhNdSu6rWOOtJ9wuO5W9wmRAg2Rl+5UlinKm4LEUWqg==`) |
| Flatirons UI | `@flatirons/component-library@20.3.16-pr-49.1778594204` |
| Solr receipt | `apps/api/src/modules/provision/receipts/pinpoint-configsets.json` — `supportedImage` `solr:10.0.0`, `supportedSolrVersion` `9.6.1`. `consumerReceipt.maven.version` is still the literal `@project.version@` (B14 copy). Tests bind configset names and that image, not a resolved zip digest. |
| Local image | `tenant-manager:b32` `sha256:2fb1d05f5850cf060d5af28f1a4bf4d71a1ce221061cce5bd1d937a7fdf65e41` built 2026-10-16 from `Dockerfile.from-dist` because this host has no Artifactory npmrc. That Dockerfile is the documented local helper, not the Jenkins `Dockerfile` + BuildKit npm secret. |

API tests ran with `--test-concurrency=1`.

## Commands and results

| Command | Result |
| --- | --- |
| `npm run test -w @flatirons/tenant-manager-api -- --test-concurrency=1` | 110 pass, 0 fail |
| `npm run test -w @flatirons/tenant-manager-web` | 18 pass, 0 fail |
| `npm run build` | pass (API release trust + web production bundle) |
| `npm run test:e2e` | 12 pass, including B30 recovery and screenshot capture |
| `npm run test:b31-handoff` | 12 pass (offline fixtures, including the if/end regression) |
| `npm run verify:b31-handoff` | pass, remote `codex/multi-tenancy` clones |
| `node scripts/container-smoke.mjs tenant-manager:b32` | pass |
| `node scripts/container-runtime-smoke.mjs tenant-manager:b32` | pass |
| `node scripts/container-packaging-accept.mjs tenant-manager:b32` | pass (secret scan, enrollment, restart, missing-keyring soft-fail) |

Browser stills from the e2e screenshot spec (not committed): `.workq/tmp/b30-screenshots/01-landing.png` through `10-tenants-recovery-detail.png`.

## Remote product tips the handoff verifier actually cloned

| Product | Head |
| --- | --- |
| access-control-manager | `79fdae0126b55d5da03ee8ff712bc0090d2d92ce` |
| data-manager | `a731104e97d066de7f9503eb5d017b650d282bb8` |
| pinpoint-server | `74fe57efa58b994ee9214ab4c5966c867d37a9dc` |
| opensearch-engine | `e0fd633cd5a8c982adf031efef27124242809b21` |
| audit-manager-server | `dd3415b89a55ba3b85f24bb058888b7fd8330fd0` |

The verifier deletes its clones. The heads above are the SHAs that run recorded.

## Requirement verdict

Phase B plan outcomes from [`README.md`](README.md), judged on this run. **Proved** means the established corpus passed on this tip. **Fixture** means the proof used the named stand-in and must not be cited as a live product runtime.

| Requirement | Verdict |
| --- | --- |
| PostgreSQL catalog, migrations, secret encryption | Proved. Disposable Postgres in API tests and compose runtime smoke. |
| Real ACM operator authentication | Fixture ACM HTTP twin on the real authenticator path (B29 + browser cookie). Not a live ACM cloud. |
| Platform identities, enrollment rotation, hashed node credentials | Proved in API registry/auth tests and packaging bootstrap (show-once token, second run refused). |
| Registry, snapshots, lifecycle, provisioning, webhooks | Proved in API corpus (delivery, init, provision). Webhook 2xx is durable receipt only. |
| Atomic tenant/license changes; sign outside the transaction, then CAS | Proved in `customers-licenses` and multi-instance issue/download. |
| Customers, operator issuing, encrypted on-prem download | Proved. Local file issuer PS256 + JWE across two OS processes. |
| Angular / Flatirons admin, wizard, recovery | Proved in Playwright (12 tests) with catalog enabled, including B30 recovery and secret non-disclosure. |
| Installer registration settings and install-order handoff | Proved as staged B05 keys on the five remote tips. Runtime adoption is Phase C. |
| Two-instance restart, lease, idempotency | Proved in `multi-instance-acceptance.test.ts` (READY, not SUCCEEDED). Deep schema/core order stays in the sibling provision and delivery suites, which also passed. |
| Real ACM plus product-node fixtures | Fixture product nodes from the contract kit. Not production ACM/DM/Pinpoint processes. |
| Crypto, key rotation, secret redaction | Proved in API tests. Issuer private keys stayed outside Git and the image scan. |
| Browser and container checks | Proved, with the local-helper image caveat above. |
| Rejected customer users, revoked nodes, cross-product access | Proved as 403 plus no mutation in API and browser customer-token cases. |
| Optional products/upgrades; duplicate and out-of-order recovery | Proved in init/delivery suites (duplicate If-Match replay, order/HOL). |
| Invalid activations and fresh signed restore (no JWS replay) | Proved in activation and license tests. |
| Concurrent edits | Proved (If-Match / OCC). |
| Release-key separation | Proved by API release-trust build (`assert-release-trust-keys`) and image scan (no keyring/PEM/npmrc). |
| Local real signing | Proved. |
| AWS KMS signing | Deferred. Not run. Do not cite this record as KMS proof. |
| Customer-tenant runtime enforcement, on-prem identity/binding/CLI | Phase C. Not run. |
| Production or customer migrations, cloud resources, live secret copy | Not done. |
| Human landing to `main` | Pending. This PR targets `codex/multi-tenancy` only. |

## Harness defect fixed here

`renderConfdGetv` used to match the first `{{if exists}}` in a product template to a later `{{else}}`, including across a nested `{{end}}`. Data Manager's `codex/multi-tenancy` tip has `{{if exists "/s3/accesskey"}}…{{end}}` before the enrollment `if/else`, so `tenancy.tenantManagerUrl` was swallowed and the remote handoff check failed even though the template contains the frozen B05 keys. The renderer now matches if/else/end by nesting depth. Offline fixtures and the five remote tips pass after that change. No product repository was edited.

## Still not claimed

- Jenkins authenticated image build (`Dockerfile` + npm secret).
- Resolved Solr zip version or digest (`@project.version@` remains in the vendored receipt).
- Live managed ACM, production product processes, or AWS KMS.
- The authenticated home shell still says feature pages land in later tasks. Products, tenants, customers, licenses, and activations are reachable and covered by the Playwright specs; that subtitle was not changed here.

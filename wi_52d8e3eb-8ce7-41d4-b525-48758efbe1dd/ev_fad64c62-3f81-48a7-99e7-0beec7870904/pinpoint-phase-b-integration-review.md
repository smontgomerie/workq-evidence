# PINPOINT-7520 Phase B accumulated review

Verdict: blocked; do not open the master PR yet. No product files changed and no branch was pushed or merged.

Range: origin/master...origin/codex/multi-tenancy. Merge base b64af580e9d5db4014de32bf6af27937f25afa9e. Reviewed head 74fe57efa58b994ee9214ab4c5966c867d37a9dc. Both remote tips reconfirmed with git ls-remote after specialist review. No settled member findings were supplied; unresolved bot comments were reconsidered, not presumed accepted.

Five native readonly lenses: architecture, correctness, security, tests, pattern-conformance. Architecture returned two findings; tests returned one. Other lenses found no material defects. The host verified the startup changelog invocation, default upgrade setting, sequence tests, package verification, and staged settings before synthesis.

## Findings requiring disposition

1. HIGH — server/hibernate/src/main/resources/changelog/master-changelog.xml:38. Unconditional inclusion of 26 MVP-C-05 sequence migrations affects PostgreSQL, Oracle and HSQLDB, alongside ORM ID mapping changes. server/package/src/main/java/com/flatirons/pinpoint/server/AppConfiguration.java runs this changelog during ordinary startup; dbupgrade.auto defaults true. The migrations call for stopped writers in comments. B14/B26 scope and B32 fixture evidence do not establish approval or populated-upgrade compatibility for this active runtime change. Owner must decide whether to include it in this landing with explicit upgrade acceptance, or separate/defer the coupled ORM and changelog change. Removing only the changelog would leave incompatible ORM mappings; do not apply a partial workaround.

2. MEDIUM — server/pom.xml:187. The global commons.version pin to 999.999-codex-multi-tenancy-SNAPSHOT remains a mutable feature-branch dependency for master and release builds. It affects the existing Commons module family as well as commons-tenancy-liquibase. Require a reviewed immutable artifact receipt or approved master publication before claiming reproducible dependency compatibility. B04 already has an immutable timestamp and SHA-256; the Commons boundary lacks equivalent evidence in this handoff.

3. MEDIUM — server/hibernate/src/test/java/com/flatirons/pinpoint/server/hibernate/id/SequenceIdGeneratorTest.java:106. Tests manually restart Hibernate-created sequences. HibernateLiquibaseSchemaValidateTest applies the actual changelog to an empty PostgreSQL database and validates schema metadata, but does not prove upgrade of populated tables. Require actual Pinpoint migration on seeded data, preserved IDs, interleaved ORM/native omitted-ID inserts above the old maximum with distinct IDs, including a nonstandard ID column. B32 does not establish this scenario.

## Completeness and overreach

B14 provides nine named Pinpoint configsets matching existing private core configurations and four pinned B04 predictive roles. Package verification inspects the built ZIP; the isolation script exercises all thirteen roles. The source-layout unit test alone is not the entire evidence surface. B26 provides five empty-default registration properties, redaction, and explicit staging semantics; runtime registration is intentionally deferred. No confirmed security or correctness defect was found in these two seams. Broad database sequence activation is additional active behavior whose scope approval and upgrade evidence need an owner decision.

## Verification and receipts

Required policy gate: Unit tests, command cd server && mvn install, JAVA_HOME selecting Temurin 21. Failed before module tests because the sandbox forbids Maven writes to /Users/scott/.m2/repository. The second execution only captured the same refused command as red evidence with --anyway. Evidence ev_2191d5a3-aaf9-4739-a2e2-384cc0cc2bef. This is an infrastructure blocker, not a test failure attributed to product code. Operator must provision a writable Maven cache. No green current-tip build, Solr runtime rerun, or upgrade experiment is claimed. Verify remains failed and Post PR blocked. Required gate reductions: Typecheck, Lint & format, Integration, Build, E2E omitted by policy.

B14 prior evidence: ev_9ceb3d04-83cb-41a7-8a82-79dcdcc72f7e (Solr 10 isolation), ev_3128939f-2b77-492c-af5d-bf2f9d691850 (consumer receipt), member PR https://bitbucket.org/flatironssolutions/pinpoint-server/pull-requests/5148. B26 member PR https://bitbucket.org/flatironssolutions/pinpoint-server/pull-requests/5150. These historical results are not substituted for this item's required green gate.

B32: https://bitbucket.org/flatironssolutions/tenant-manager/pull-requests/22. Recovered completed acceptance report records API 110 and web 18 tests, browser/container evidence, installation renderer repair, and verdict docs/mvp/phase-b/b32-integration-acceptance.md. It tests TM acceptance and product fixtures, not production Pinpoint runtime migration. AWS KMS and Jenkins image build remained open in that report. Dependency wi_a80036d4-ca19-4ec9-819f-843f63c58fb0 recall returns 404, so its full approval brief could not be independently recovered.

## Handoff

Captain: disposition the coupled database migration/ORM scope and provide reviewed Commons publication coordinates; operator: writable Maven cache; engineering: add populated migration proof if retained, rerun full required gate and affected Solr checks, then reopen this review at the new exact SHA. Open/update exactly codex/multi-tenancy -> master only after blockers clear. Keep autoMerge=false and await explicit human approval. Do not rewrite published history or create a parallel feature head.

Phase C: runtime registry/self-registration, real customer tenant routing/enforcement and on-prem identity/binding/CLI remain deferred. External installer-common owner must consume the five documented B05 keys with empty defaults and secret handling; this review did not implement another repository's prompts. No production data or cloud resources were changed.

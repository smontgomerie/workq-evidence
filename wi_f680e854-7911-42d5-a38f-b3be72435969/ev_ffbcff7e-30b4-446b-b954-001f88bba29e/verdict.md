# Visual parity verdict

- Reference: https://corena.core-aacmm.testing.flatirons.cloud/dmgrclient/ (captured 2026-09-22T15:42:08.083124Z)
- Candidate: http://localhost:8082/dmgrclient/#/ (captured 2026-09-22T22:20:32.504Z)

| Component | Verdict | Measured | Vision | Basis |
| --- | --- | --- | --- | --- |
| publish-history | PASS | CLEAN ⚠ | match | advisory match with --missed carrying residual dirt (pixel diff 6.385% over 1.000% budget): Chrome: clear. Title, tab chrome for Publish History, table header ink/bg (#666 on white), borders, and green/red status badges match corena. Measured 0 blocking style deltas after host-scoped dm-import-history table/tr line-height + color overrides. |
| kc-libraries | PASS | CLEAN ⚠ | match | advisory match with --missed carrying residual dirt (pixel diff 5.994% over 1.000% budget): Chrome: clear. Libraries title, Name/Location header ink/bg (#666 on white), table borders and empty-state ink match corena rhythm. Measured 0 blocking style deltas after host-scoped dm-kc-repository-library table/tr + empty-marker overrides. |

## publish-history

- Vision verdict: **match** (recorded 2026-09-22T22:23:39.534Z)
- What the reviewer saw: Chrome: clear. Title, tab chrome for Publish History, table header ink/bg (#666 on white), borders, and green/red status badges match corena. Measured 0 blocking style deltas after host-scoped dm-import-history table/tr line-height + color overrides.
- Not caught by measurement: publication titles, revision numbers, publish dates, row count; Archive Status column (bulkPublish/archive config off locally); Zip Structure History tab (zipStructure feature flag off locally)

## kc-libraries

- Vision verdict: **match** (recorded 2026-09-22T22:23:39.624Z)
- What the reviewer saw: Chrome: clear. Libraries title, Name/Location header ink/bg (#666 on white), table borders and empty-state ink match corena rhythm. Measured 0 blocking style deltas after host-scoped dm-kc-repository-library table/tr + empty-marker overrides.
- Not caught by measurement: library names, library locations, row count (local empty No Libraries Found vs corena populated list)


# Visual parity verdict

- Reference: https://corena.core-aacmm.testing.flatirons.cloud/dmgrclient/ (captured 2026-09-23T04:18:48.104Z)
- Candidate: http://localhost:8082/dmgrclient/#/ (captured 2026-09-23T13:53:30.627Z)

| Component | Verdict | Measured | Vision | Basis |
| --- | --- | --- | --- | --- |
| publish-repo-tree | PASS | FAIL ⚠ | match | advisory match with --missed carrying residual dirt (71 blocking style delta(s)): Chrome: clear. Header title/icon and tree host padding (5px) + Bootstrap line-height match corena under --replay-api; same collapsed org roots (American Airlines, System). Residual magenta is FsNestedTree vs zTree (expand triangle vs +, solid folder glyph, 15px/34px node row) — known-deltas W3.5. create-* probes absent at rest on both sides (0x0). |
| import-tree | PASS | FAIL ⚠ | match | advisory match with --missed carrying residual dirt (54 blocking style delta(s)): Chrome: clear. Import header and tree host padding/line-height match; same collapsed KC7 root under --replay-api. Residual magenta is FsNestedTree vs zTree glyphs/typography (known-deltas W3.5). add-fleet/add-manual/delete-manual not rendered at rest (captain-noted Angular gap). |

## publish-repo-tree

- Vision verdict: **match** (recorded 2026-09-23T13:55:09.021Z)
- What the reviewer saw: Chrome: clear. Header title/icon and tree host padding (5px) + Bootstrap line-height match corena under --replay-api; same collapsed org roots (American Airlines, System). Residual magenta is FsNestedTree vs zTree (expand triangle vs +, solid folder glyph, 15px/34px node row) — known-deltas W3.5. create-* probes absent at rest on both sides (0x0).
- Not caught by measurement: FsNestedTree expand glyph (+→triangle); folder icon fill; node font-size/line-height/row min-height from component-library

## import-tree

- Vision verdict: **match** (recorded 2026-09-23T13:55:09.104Z)
- What the reviewer saw: Chrome: clear. Import header and tree host padding/line-height match; same collapsed KC7 root under --replay-api. Residual magenta is FsNestedTree vs zTree glyphs/typography (known-deltas W3.5). add-fleet/add-manual/delete-manual not rendered at rest (captain-noted Angular gap).
- Not caught by measurement: FsNestedTree expand/folder glyphs; node typography; #addFleetBtn/#addManualBtn not rendered at rest


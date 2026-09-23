# Visual parity verdict

- Reference: https://corena.core-aacmm.testing.flatirons.cloud/dmgrclient/ (captured 2026-09-22T22:28:10.575Z)
- Candidate: http://localhost:8082/dmgrclient/#/ (captured 2026-09-23T00:38:49.289Z)

| Component | Verdict | Measured | Vision | Basis |
| --- | --- | --- | --- | --- |
| publish-history | PASS | FAIL ⚠ | match | advisory match with --missed carrying residual dirt (2 blocking style delta(s)): Chrome: clear on element sheet and triptych. Title, header icon, Publish History tab, table header/body padding (8px), transparent th fill, #666 ink, Bootstrap borders, and success badge #28a745 match corena. Remaining panel height/spinner are corena mid-load + local row count. |
| kc-libraries | PASS | FAIL ⚠ | match | advisory match with --missed carrying residual dirt (3 blocking style delta(s)): Chrome: clear on element sheet and triptych. Title, header icon, Name/Location th padding/ink/borders, panel body #666/22.9px rhythm match corena. Empty local list vs corena rows is data (libraries-name-cell not found; library-row empty marker). |

## publish-history

- Vision verdict: **match** (recorded 2026-09-23T00:38:50.638Z)
- What the reviewer saw: Chrome: clear on element sheet and triptych. Title, header icon, Publish History tab, table header/body padding (8px), transparent th fill, #666 ink, Bootstrap borders, and success badge #28a745 match corena. Remaining panel height/spinner are corena mid-load + local row count.
- Not caught by measurement: publication titles, revision numbers, dates, row count; Archive Status column (config); Zip Structure tab (feature flag); in-flight loading spinner on corena panel capture

## kc-libraries

- Vision verdict: **match** (recorded 2026-09-23T00:38:50.742Z)
- What the reviewer saw: Chrome: clear on element sheet and triptych. Title, header icon, Name/Location th padding/ink/borders, panel body #666/22.9px rhythm match corena. Empty local list vs corena rows is data (libraries-name-cell not found; library-row empty marker).
- Not caught by measurement: library names, library locations, row count (local No Libraries Found vs corena populated); libraries-name-cell not found locally; in-flight loading spinner on corena panel capture


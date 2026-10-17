Repo: smontgomerie/storybookmagic — https://github.com/smontgomerie/storybookmagic

U12 is NOT ready to merge. Existing implementation remains pushed on workq/wi_1f01b268 at 9e81956f (merge-base 0d485cdef9eb5f5d4bd0b93008e700dd889f802e). Target base remains feat/local-character-iteration. No PR was opened by this resume; no product files were changed. U13 must remain blocked.

The six serial in-run self-review lenses completed (nesting unavailable). Review failed. Earlier green lint/unit/build and fixture screenshots do not prove the acceptance contract; four new targeted Jest probes fail:
- ev_ff3dbca5-c11d-4ae8-a372-b17f7972e0fe: scoring enabled before image pixels load; scoring enabled while case reference inventory is unresolved; one scored output marks a two-output trial complete.
- ev_b85c149c-da09-4ebd-ac11-795c3a701e81: blind Results fetches all-assessor aggregates before explicit reveal.
Audit test source is attached separately and retained in frontend/tmp/U12-self-review-audit.test.tsx and U12-results-audit.test.tsx. The temporary runnable copies were removed from __tests__ after recording evidence.

Blocking ownership decision: the ticket says use U09 APIs and do not edit competing backend/root-shell modules. But U09 WbResultsView contains no sanitized case reference inventory/media metadata, while U02 listExperiments returns variant labels/workflow IDs and getRevision returns full case prompts before explicit reveal. A frontend-only filter cannot remove already-fetched data. Ask the U09/U02 owner to provide a blind-safe queue/case/media projection or authorize a coordinated backend/shared-contract change. This is the decision needed before resuming, not permission to ship a smaller UI-only slice.

Required repair plan once ownership is resolved:
1. Define blind-safe paginated experiment/queue and case/reference/media projections; do not fetch full variants/prompts/AI aggregates pre-reveal. Use already-blinded results aggregates instead of unfiltered aggregates endpoint where applicable. Confirm whether full authoring endpoints remain available to reviewers independently of this UI.
2. Gate scoring on successful case/reference inventory AND actual onLoad for every current output/reference. Treat onError and metadata failures as locked; fence late events by trial/media identity, including reset mid-flight and rapid navigation.
3. Coverage must preserve output identity and expectation/rubric/target context. trialNeedsReview currently unions scores across all outputs. Results TrialRow repeats that union; server U09 coverage also unions dimensions per trial, including AI assessments. Missing is not passing.
4. Honor WbRubricDimension target and scale instead of assigning every score targetForStage(meta.stage). Resolve per-character identity contract; existing shared record only has target enum while legacy scene board supports referenceKey. Bind rubric revision on save.
5. Both screens only fetch first 50 experiments and never offer useWbPage.hasMore/loadMore (unlike ExperimentsList/WorkflowsScreen/DatasetsScreen). Suite lists also stop at 50. Restore honest global navigation/counts, surface unknown/loading/error coverage instead of zero missing. Queue fetches full results serially, so a slow first request blocks later counts.
6. Regression tests must delay/fail actual image bytes, not only /media metadata. Assert network payload blindness and per-output/context coverage. Re-run required lint/unit/build and Cypress desktop/mobile/light/dark plus negative control, then targeted re-review. Preserve no-live-ComfyUI/hosted-calls rule.

Existing interfaces (provisional, not accepted): workbench-slots.ts registers review/results; wbAssessClient wraps U09; testids wb-review-* and wb-results-*; URLs /character-lab/{review,results}?experiment=<id>. Do not promote U13 based on these until U12 passes review.

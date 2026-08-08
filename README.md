# workq-evidence

Public mirror of [workq](https://github.com/skatamatic/workq) blob evidence
(screenshots / files) so pull-request markdown can embed images via
`raw.githubusercontent.com` without auth.

## Layout

```text
{itemId}/{evidenceId}/{filename}
```

Written by the workq server (`WORKQ_EVIDENCE_REPO`), not by agents. Do not put
product source here.

## Retention

Terminal work items older than ~30 days can have their trees removed with:

```bash
npx workq-server evidence-gc --older-than 30d --status done,rejected --apply
```

Local dashboard blobs remain under `WORKQ_EVIDENCE_DIR` independently of this repo.

# workq-evidence

Public mirror of [workq](https://github.com/skatamatic/workq) blob evidence
(screenshots / files) so pull-request markdown can embed
`raw.githubusercontent.com` URLs without committing binaries into product PRs.

## How it works

The workq server publishes asynchronously after `$EV add` writes a local blob:

```text
{itemId}/{evidenceId}/{filename}
→ https://raw.githubusercontent.com/smontgomerie/workq-evidence/main/…
```

Agents and humans should **not** clone this repo or open PRs here for product work.

## Retention

Evidence here may be public and long-lived. Treat contents as review artifacts;
do not store secrets. Operators may prune old paths as needed.

## Operators

Set on the workq server:

```bash
WORKQ_EVIDENCE_REPO=smontgomerie/workq-evidence
WORKQ_EVIDENCE_REPO_TOKEN=…   # fine-grained contents:write, or reuse WORKQ_GITHUB_TOKEN
WORKQ_EVIDENCE_REPO_BRANCH=main
```

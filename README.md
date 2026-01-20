# Repo Janitor Action

Clean up stale branches and PRs in a repository.

## Inputs

- `branch_age_days`: Minimum branch age in days before applying cleanup rules. Default: `7`
- `desk_check_label`: Label indicating a PR has a desk check and should not be auto-drafted. Default: `desk-check`

## Required permissions

```yaml
permissions:
  contents: write
  pull-requests: write
```

## Usage

```yaml
name: Repo Janitor

on:
  schedule:
    - cron: "0 2 * * *"
  workflow_dispatch:

permissions:
  contents: write
  pull-requests: write

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: your-org/repo-janitor-action@v1
        with:
          branch_age_days: 7
          desk_check_label: desk-check
```

## Testing in this repo

Run the local workflow `.github/workflows/test-janitor.yml` via `workflow_dispatch`.

# Repo Janitor Action

Clean up stale branches and PRs in a repository.

## Inputs

- `branch_age_days`: Minimum branch age in days before applying cleanup rules. Default: `7`
- `branch_allow_patterns`: Comma-separated JavaScript regex patterns; branches must match at least one to be auto-cleaned. Default: empty (no allow gating)
- `branch_deny_patterns`: Comma-separated JavaScript regex patterns; branches matching any are excluded from cleanup. Default: empty
- `desk_check_label`: Label indicating a PR has a desk check and should not be auto-drafted. Default: `desk-check`
- `desk_check_comment_phrase`: Comment phrase indicating a PR has a desk check and should not be auto-drafted. Default: `desk check`
- `issue_mention_users`: Comma-separated GitHub usernames to tag for approval when branches do not match allow patterns. Default: empty
- `issue_wait_minutes`: Minutes to wait for issue approval before defaulting to delete. Default: `20`
- `dry_run`: When `true`, logs actions without making changes. Default: `false`

## Required permissions

```yaml
permissions:
  contents: write
  pull-requests: write
```

## Approval flow for non-matching branches

If `branch_allow_patterns` is set and a stale branch does not match any allow pattern, the action creates an issue asking whether to delete those branches. If a tagged user replies with `approve`, it deletes them; `deny` keeps them. If there is no response within `issue_wait_minutes`, it defaults to delete and comments with the list of deleted branches.

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
          desk_check_comment_phrase: desk check
          branch_allow_patterns: "^release/"
          issue_mention_users: janitor-team,octocat
          issue_wait_minutes: 20
          dry_run: false
```

## Testing in this repo

Run the local workflow `.github/workflows/test-janitor.yml` via `workflow_dispatch`.

const owner = context.repo.owner;
const repo = context.repo.repo;
const now = Date.now();
const branchAgeDays = Number(process.env.BRANCH_AGE_DAYS || 7);
const deskCheckLabel = String(process.env.DESK_CHECK_LABEL || "desk-check").toLowerCase();
const cutoffMs = branchAgeDays * 24 * 60 * 60 * 1000;

function olderThanCutoff(dateString) {
  return now - new Date(dateString).getTime() > cutoffMs;
}

function hasDeskCheckLabel(labels) {
  return labels.some((label) => String(label.name || "").toLowerCase() === deskCheckLabel);
}

const { data: repoInfo } = await github.rest.repos.get({ owner, repo });
const defaultBranch = repoInfo.default_branch;

const branches = await github.paginate(github.rest.repos.listBranches, {
  owner,
  repo,
  per_page: 100,
});

for (const branch of branches) {
  if (branch.name === defaultBranch) {
    continue;
  }

  const commitDate =
    branch.commit?.commit?.author?.date ||
    branch.commit?.commit?.committer?.date;

  if (!commitDate || !olderThanCutoff(commitDate)) {
    continue;
  }

  const prs = await github.paginate(github.rest.pulls.list, {
    owner,
    repo,
    state: "all",
    head: `${owner}:${branch.name}`,
    per_page: 100,
  });

  const openPrs = prs.filter((pr) => pr.state === "open");

  if (openPrs.length === 0) {
    console.log(`Deleting branch ${branch.name} (no open PRs).`);
    try {
      await github.rest.git.deleteRef({
        owner,
        repo,
        ref: `heads/${branch.name}`,
      });
    } catch (error) {
      console.log(`Failed to delete branch ${branch.name}: ${error.message}`);
    }
    continue;
  }

  for (const pr of openPrs) {
    if (!pr.draft && !hasDeskCheckLabel(pr.labels || [])) {
      console.log(`Converting PR #${pr.number} to draft (no desk check).`);
      await github.rest.pulls.update({
        owner,
        repo,
        pull_number: pr.number,
        draft: true,
      });
      continue;
    }

    if (pr.draft && olderThanCutoff(pr.updated_at)) {
      console.log(`Closing stale draft PR #${pr.number}.`);
      await github.rest.pulls.update({
        owner,
        repo,
        pull_number: pr.number,
        state: "closed",
      });
    }
  }
}

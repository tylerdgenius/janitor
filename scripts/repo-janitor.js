const path = require("path");
const actionPath = process.env.GITHUB_ACTION_PATH || process.cwd();
const { parseCsv, compilePatterns, matchesAny, olderThanCutoff } = require(
  path.join(actionPath, "scripts/lib/utils"),
);
const { hasDeskCheckComment, hasDeskCheckLabel } = require(
  path.join(actionPath, "scripts/lib/deskcheck"),
);
const { loadConfig } = require(path.join(actionPath, "scripts/lib/constants"));
const { requestApprovalAndMaybeDelete } = require(
  path.join(actionPath, "scripts/lib/approval"),
);

const run = async ({ github, context, core }) => {
  const log = core?.info ? core.info.bind(core) : console.log;
  const logError = core?.error ? core.error.bind(core) : console.error;
  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const now = Date.now();
  const {
    branchAgeDays,
    allowPatternInput,
    denyPatternInput,
    deskCheckLabel,
    deskCheckCommentPhrase,
    mentionUsersInput,
    issueWaitMinutes,
    dryRun,
  } = loadConfig(process.env);
  const cutoffMs = branchAgeDays * 24 * 60 * 60 * 1000;

  const allowPatterns = compilePatterns(allowPatternInput);
  const denyPatterns = compilePatterns(denyPatternInput);
  const mentionUsers = parseCsv(mentionUsersInput);
  const summary = {
    scannedBranches: 0,
    staleBranches: 0,
    deletedBranches: 0,
    approvalBranches: 0,
    prsDrafted: 0,
    prsClosed: 0,
  };

  log(
    `[janitor] Start repo=${owner}/${repo} dryRun=${dryRun} cutoffDays=${branchAgeDays} allowPatterns=${allowPatterns.length} denyPatterns=${denyPatterns.length} deskCheckLabel=${deskCheckLabel} deskCheckPhrase=${deskCheckCommentPhrase} mentionUsers=${mentionUsers.length} issueWaitMinutes=${issueWaitMinutes}`,
  );

  // I want to find the default branch so it can be excluded from deletion.
  const { data: repoInfo } = await github.rest.repos.get({ owner, repo });
  const defaultBranch = repoInfo.default_branch;

  const branches = await github.paginate(github.rest.repos.listBranches, {
    owner,
    repo,
    per_page: 100,
  });
  summary.scannedBranches = branches.length;
  log(`[janitor] Default branch=${defaultBranch} branches=${branches.length}`);

  // This will house the branch names that need approval before they can be deleted.
  const approvalBranches = [];

  for (const branch of branches) {
    if (branch.name === defaultBranch) {
      continue;
    }

    if (denyPatterns.length > 0 && matchesAny(branch.name, denyPatterns)) {
      continue;
    }

    const branchCommitSha = branch.commit?.sha;
    let lastCommitDate =
      branch.commit?.commit?.author?.date ||
      branch.commit?.commit?.committer?.date;

    if (!lastCommitDate && branchCommitSha) {
      try {
        const { data: commitData } = await github.rest.repos.getCommit({
          owner,
          repo,
          ref: branchCommitSha,
        });
        lastCommitDate =
          commitData.commit?.author?.date || commitData.commit?.committer?.date;
      } catch (error) {
        logError(
          `[janitor] Failed to fetch commit details branch=${branch.name} sha=${branchCommitSha}: ${error.message}`,
        );
      }
    }

    if (!lastCommitDate || !olderThanCutoff(lastCommitDate, now, cutoffMs)) {
      if (!lastCommitDate) {
        log(`[janitor] Skip branch=${branch.name} reason=missing_last_commit_date`);
      }
      continue;
    }
    summary.staleBranches += 1;

    // Getting all avialable PRs for this branch.
    const prs = await github.paginate(github.rest.pulls.list, {
      owner,
      repo,
      state: "all",
      head: `${owner}:${branch.name}`,
      per_page: 100,
    });

    const openPrs = prs.filter((pr) => pr.state === "open");
    log(
      `[janitor] Stale branch=${branch.name} lastCommitDate=${lastCommitDate} openPrs=${openPrs.length}`,
    );

    if (openPrs.length === 0) {
      if (allowPatterns.length > 0 && !matchesAny(branch.name, allowPatterns)) {
        approvalBranches.push(branch.name);
        summary.approvalBranches += 1;
        log(`[janitor] Needs approval branch=${branch.name}`);
        continue;
      }

      if (dryRun) {
        log(`[dry-run] Would delete branch ${branch.name} (no open PRs).`);
      } else {
        log(`Deleting branch ${branch.name} (no open PRs).`);
        try {
          await github.rest.git.deleteRef({
            owner,
            repo,
            ref: `heads/${branch.name}`,
          });
          summary.deletedBranches += 1;
        } catch (error) {
          logError(`Failed to delete branch ${branch.name}: ${error.message}`);
        }
      }
      continue;
    }

    for (const pr of openPrs) {
      const hasDeskCheck =
        hasDeskCheckLabel(pr.labels || [], deskCheckLabel) ||
        (await hasDeskCheckComment({
          github,
          owner,
          repo,
          pullNumber: pr.number,
          phrase: deskCheckCommentPhrase,
        }));

      if (!pr.draft && !hasDeskCheck) {
        if (dryRun) {
          log(
            `[dry-run] Would convert PR #${pr.number} to draft (no desk check).`,
          );
        } else {
          log(`Converting PR #${pr.number} to draft (no desk check).`);
          try {
            let pullRequestId = pr.node_id;
            if (!pullRequestId) {
              const { data: prData } = await github.rest.pulls.get({
                owner,
                repo,
                pull_number: pr.number,
              });
              pullRequestId = prData.node_id;
            }

            const mutation = `
              mutation($pullRequestId: ID!) {
                convertPullRequestToDraft(input: { pullRequestId: $pullRequestId }) {
                  pullRequest {
                    id
                    number
                    isDraft
                  }
                }
              }
            `;
            const result = await github.graphql(mutation, { pullRequestId });
            const isDraft = result?.convertPullRequestToDraft?.pullRequest?.isDraft;
            if (isDraft) {
              summary.prsDrafted += 1;
            }
            log(
              `[janitor] PR #${pr.number} convertToDraft isDraft=${isDraft}`,
            );
          } catch (error) {
            logError(
              `[janitor] Failed to convert PR #${pr.number} to draft: ${error.message}`,
            );
          }
        }
        continue;
      }

      if (pr.draft && olderThanCutoff(pr.updated_at, now, cutoffMs)) {
        if (dryRun) {
          log(`[dry-run] Would close stale draft PR #${pr.number}.`);
        } else {
          log(`Closing stale draft PR #${pr.number}.`);
          try {
            const closeResponse = await github.rest.pulls.update({
              owner,
              repo,
              pull_number: pr.number,
              state: "closed",
            });
            summary.prsClosed += 1;
            log(
              `[janitor] PR #${pr.number} close status=${closeResponse.status} state=${closeResponse.data?.state}`,
            );
          } catch (error) {
            logError(
              `[janitor] Failed to close PR #${pr.number}: ${error.message}`,
            );
          }
        }
      }
    }
  }

  // Issue-based approval flow for branches outside allow patterns.
  await requestApprovalAndMaybeDelete({
    github,
    owner,
    repo,
    branches: approvalBranches,
    mentionUsers,
    issueWaitMinutes,
    dryRun,
  });

  log(
    `[janitor] Summary scanned=${summary.scannedBranches} stale=${summary.staleBranches} approvals=${summary.approvalBranches} deleted=${summary.deletedBranches} prsDrafted=${summary.prsDrafted} prsClosed=${summary.prsClosed}`,
  );
};

module.exports = run;

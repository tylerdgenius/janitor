const { sleep } = require("./utils");

const getApprovalDecision = async ({ github, owner, repo, issueNumber, approvers }) => {
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number: issueNumber,
    per_page: 100,
  });

  let decision = null;
  for (const comment of comments) {
    const author = String(comment.user?.login || "");
    if (approvers.length > 0 && !approvers.includes(author)) {
      continue;
    }
    const body = String(comment.body || "").toLowerCase();
    if (/\b(deny|no|skip)\b/.test(body)) {
      decision = "deny";
    } else if (/\b(approve|yes|delete)\b/.test(body)) {
      decision = "approve";
    }
  }
  return decision;
};

const requestApprovalAndMaybeDelete = async ({
  github,
  owner,
  repo,
  branches,
  mentionUsers,
  issueWaitMinutes,
  dryRun,
}) => {
  if (branches.length === 0) {
    return null;
  }

  if (dryRun) {
    console.log(`[dry-run] Would create approval issue for branches: ${branches.join(", ")}`);
    return { dryRun: true };
  }

  const mentionLine =
    mentionUsers.length > 0
      ? `\n\nRequested reviewers: ${mentionUsers.map((u) => `@${u}`).join(" ")}`
      : "";
  const issueBody = [
    "The repo janitor found stale branches that do not match the allow patterns.",
    "Reply with `approve` to delete them or `deny` to keep them.",
    "",
    "Branches:",
    "```",
    ...branches,
    "```",
    mentionLine,
  ]
    .filter(Boolean)
    .join("\n");

  const { data: issue } = await github.rest.issues.create({
    owner,
    repo,
    title: `Repo Janitor approval: delete ${branches.length} branches`,
    body: issueBody,
  });

  const waitMs = issueWaitMinutes * 60 * 1000;
  const deadline = Date.now() + waitMs;
  let decision = null;

  while (Date.now() < deadline) {
    decision = await getApprovalDecision({
      github,
      owner,
      repo,
      issueNumber: issue.number,
      approvers: mentionUsers,
    });
    if (decision) {
      break;
    }
    await sleep(60 * 1000);
  }

  const shouldDelete = decision !== "deny";
  const deletedBranches = [];

  if (shouldDelete) {
    for (const branchName of branches) {
      try {
        await github.rest.git.deleteRef({
          owner,
          repo,
          ref: `heads/${branchName}`,
        });
        deletedBranches.push(branchName);
      } catch (error) {
        console.log(`Failed to delete branch ${branchName}: ${error.message}`);
      }
    }
  }

  const outcomeLines = [];
  if (decision) {
    outcomeLines.push(`Decision: ${decision}.`);
  } else {
    outcomeLines.push(`No response in ${issueWaitMinutes} minutes. Defaulting to delete.`);
  }

  if (shouldDelete) {
    outcomeLines.push("", "Deleted branches:", "```", ...deletedBranches, "```");
  } else {
    outcomeLines.push("", "No branches were deleted.");
  }

  await github.rest.issues.createComment({
    owner,
    repo,
    issue_number: issue.number,
    body: outcomeLines.join("\n"),
  });

  return {
    issueNumber: issue.number,
    decision,
    deletedBranches,
    shouldDelete,
  };
};

module.exports = {
  requestApprovalAndMaybeDelete,
};

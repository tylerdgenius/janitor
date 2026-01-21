const loadConfig = (env) => ({
  branchAgeDays: Number(env.BRANCH_AGE_DAYS || 7),
  allowPatternInput: String(env.BRANCH_ALLOW_PATTERNS || ""),
  denyPatternInput: String(env.BRANCH_DENY_PATTERNS || ""),
  deskCheckLabel: String(env.DESK_CHECK_LABEL || "desk-check").toLowerCase(),
  deskCheckCommentPhrase: String(env.DESK_CHECK_COMMENT_PHRASE || "desk check").toLowerCase(),
  mentionUsersInput: String(env.ISSUE_MENTION_USERS || ""),
  issueWaitMinutes: Number(env.ISSUE_WAIT_MINUTES || 20),
  dryRun: String(env.DRY_RUN || "false").toLowerCase() === "true",
});

module.exports = {
  loadConfig,
};

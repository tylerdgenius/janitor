const hasDeskCheckComment = async ({ github, owner, repo, pullNumber, phrase }) => {
  console.log("[janitor] [deskcheck.hasDeskCheckComment] start");
  if (!phrase) {
    return false;
  }

  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number: pullNumber,
    per_page: 100,
  });

  return comments.some((comment) =>
    String(comment.body || "").toLowerCase().includes(phrase),
  );
};

const hasDeskCheckLabel = (labels, labelName) => {
  console.log("[janitor] [deskcheck.hasDeskCheckLabel] start");
  return labels.some(
    (label) => String(label.name || "").toLowerCase() === labelName,
  );
};

module.exports = {
  hasDeskCheckComment,
  hasDeskCheckLabel,
};

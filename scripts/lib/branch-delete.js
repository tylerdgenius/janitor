const deleteBranches = async ({ github, owner, repo, branches, source }) => {
  const logPrefix = source ? `[janitor] [${source}]` : "[janitor]";
  console.log(`${logPrefix} Deleting ${branches.length} branch(es).`);
  const deletedBranches = [];
  for (const branchName of branches) {
    try {
      console.log(`${logPrefix} Deleting branch ${branchName}.`);
      await github.rest.git.deleteRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
      });
      deletedBranches.push(branchName);
      console.log(`${logPrefix} Deleted branch ${branchName}.`);
    } catch (error) {
      console.log(
        `${logPrefix} Failed to delete branch ${branchName}: ${error.message}`,
      );
    }
  }
  return deletedBranches;
};

module.exports = {
  deleteBranches,
};

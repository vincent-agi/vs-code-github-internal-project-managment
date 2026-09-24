// Regenerates the fixture git repository the integration suite opens as
// its workspace, so the suite has real commits/branches to exercise the
// commit-message/git-graph/lint commands against. Gitignored and rebuilt
// on every `npm run test:integration` run — never committed.
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const WORKSPACE_DIR = path.join(__dirname, "workspace");

function git(args) {
  execFileSync("git", args, { cwd: WORKSPACE_DIR, stdio: "pipe" });
}

function commit(message, line) {
  fs.appendFileSync(path.join(WORKSPACE_DIR, "README.md"), line + "\n");
  git(["add", "README.md"]);
  git(["commit", "-q", "-m", message]);
}

function setupFixtureWorkspace() {
  fs.rmSync(WORKSPACE_DIR, { recursive: true, force: true });
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  fs.writeFileSync(path.join(WORKSPACE_DIR, "README.md"), "# Fixture workspace\n");

  git(["init", "-q", "-b", "main"]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "user.name", "Test Fixture"]);
  git(["add", "README.md"]);
  git(["commit", "-q", "-m", "Initial commit"]);

  // A non-compliant commit — the "Lint Commit History" violation fixture.
  commit("Fixed the login bug", "line");
  // Two compliant commits referencing the same issue (#999) via a
  // trailer — the "Show Git Graph" grouping fixture.
  commit("fix: \u{1F41B} correct thing\n\nFixes #999", "line2");
  commit("chore: \u{1F527} tidy up\n\nRefs #999", "line3");

  // Branch name encodes the issue number, matching
  // extractIssueNumberFromBranch's expectations for the "active issue"
  // resolution used by composeCommit/copyIssueContext/etc.
  git(["checkout", "-q", "-b", "fix/999-test-branch"]);

  return WORKSPACE_DIR;
}

module.exports = { setupFixtureWorkspace, WORKSPACE_DIR };

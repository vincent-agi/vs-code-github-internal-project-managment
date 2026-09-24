// Entry point for `npm run test:integration`: launches a real VS Code
// Extension Development Host with this extension loaded and the fixture
// workspace open, then runs test-integration/suite/index.js inside it.
// This is the "press F5 and drive it" story for a non-interactive
// environment — the extension host is real, commands are real; only the
// mouse clicks are replaced by sinon stubs on vscode.window.* inside the
// suite itself.
const os = require("os");
const path = require("path");
const { runTests } = require("@vscode/test-electron");
const { setupFixtureWorkspace } = require("./fixtures/setup");

async function main() {
  const extensionDevelopmentPath = path.resolve(__dirname, "..");
  const extensionTestsPath = path.resolve(__dirname, "suite", "index.js");
  const workspacePath = setupFixtureWorkspace();

  // The repo's own path is long enough that VS Code's default
  // .vscode-test/user-data IPC socket path exceeds macOS's ~104-char
  // unix socket path limit ("EINVAL: invalid argument"). Use a short
  // tmp-based profile dir instead.
  const runId = `rpm-vscode-test-${process.pid}`;
  const userDataDir = path.join(os.tmpdir(), runId, "user-data");
  const extensionsDir = path.join(os.tmpdir(), runId, "extensions");

  try {
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      // No --disable-extensions: the built-in vscode.git extension must
      // stay active for the SCM-input-box assertions in composeCommit's
      // tests.
      launchArgs: [
        workspacePath,
        `--user-data-dir=${userDataDir}`,
        `--extensions-dir=${extensionsDir}`,
      ],
    });
  } catch (error) {
    console.error("Integration tests failed to run:", error);
    process.exit(1);
  }
}

void main();

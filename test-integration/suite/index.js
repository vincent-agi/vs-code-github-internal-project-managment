// Mocha runner loaded by the extension host via extensionTestsPath (see
// ../runTests.js). VS Code's test harness calls this module's exported
// `run()` and expects the returned/callback-ed result to report success
// or failure.
const path = require("path");
const Mocha = require("mocha");

function run() {
  const mocha = new Mocha({ ui: "bdd", color: true, timeout: 20000 });
  const testsRoot = __dirname;

  return new Promise((resolve, reject) => {
    mocha.addFile(path.resolve(testsRoot, "extension.test.js"));

    try {
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} integration test(s) failed.`));
        } else {
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { run };

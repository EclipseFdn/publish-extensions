const { tempPath } = require("./platform");

module.exports = {
    artifactDirectory: tempPath("artifacts"),
    registryHost: "open-vsx.org",
    repositoryDirectory: tempPath("repository"),
    repoPath: tempPath("repository", "main"),
    downloadDirectory: tempPath("download"),
    defaultPythonVersion: "3.9",
    pythonVenvPrefix: tempPath("python-venv-"),
};

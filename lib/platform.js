// @ts-check
const fs = require("node:fs");
const os = require("node:os");

/**
 * The temporary directory: /tmp, where the workflows expect it, except on Windows, where it is the system one
 * with forward slashes, which Node and Git Bash both accept.
 * @param {NodeJS.Platform} [platform]
 * @returns {string}
 */
exports.tempDirectory = (platform = process.platform) =>
    platform === "win32" ? os.tmpdir().replaceAll("\\", "/") : "/tmp";

/**
 * A path in the temporary directory.
 * @param {...string} segments
 * @returns {string}
 */
exports.tempPath = (...segments) => [exports.tempDirectory(), ...segments].join("/");

/**
 * The bash used to run commands: Git Bash is only on the PATH on Windows.
 * @param {NodeJS.Platform} [platform]
 * @returns {string}
 */
exports.shell = (platform = process.platform) => (platform === "win32" ? "bash" : "/bin/bash");

/**
 * The directory holding the executables of a virtual environment.
 * @param {string} venv
 * @param {NodeJS.Platform} [platform]
 * @returns {string}
 */
exports.venvBinDirectory = (venv, platform = process.platform) => `${venv}/${platform === "win32" ? "Scripts" : "bin"}`;

/**
 * Environment variables for every command: Git for Windows converts line endings and limits path lengths by
 * default, and npm runs scripts through cmd.exe unless told otherwise.
 * @param {NodeJS.Platform} [platform]
 * @returns {Record<string, string>}
 */
exports.platformEnvironment = (platform = process.platform) =>
    platform === "win32"
        ? {
              GIT_CONFIG_COUNT: "2",
              GIT_CONFIG_KEY_0: "core.autocrlf",
              GIT_CONFIG_VALUE_0: "false",
              GIT_CONFIG_KEY_1: "core.longpaths",
              GIT_CONFIG_VALUE_1: "true",
              npm_config_script_shell: exports.shell(platform),
          }
        : {};

/**
 * Removes a directory, retrying as Windows refuses to delete files that were just in use.
 * @param {string} directory
 * @returns {Promise<void>}
 */
exports.removeDirectory = (directory) =>
    fs.promises.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });

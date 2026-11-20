// @ts-check
const os = require("node:os");
const path = require("node:path");

/**
 * A path in the temporary directory with forward slashes, which Node and Git Bash both accept on Windows.
 * @param {...string} segments
 * @returns {string}
 */
exports.tempPath = (...segments) => path.join(os.tmpdir(), ...segments).replaceAll("\\", "/");

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

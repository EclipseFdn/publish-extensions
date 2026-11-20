// @ts-check
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

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

/** The name of the shell, which is what decides how commands are quoted for it. */
exports.shellName = "bash";

/**
 * Finds Git Bash on Windows. A bare `bash` there can be the WSL launcher in System32, so it is searched for next
 * to the `git` found on the PATH (Git\\cmd and Git\\bin), then in the default install directories.
 * @param {Record<string, string | undefined>} env
 * @param {(file: string) => boolean} exists
 * @returns {string | undefined}
 */
const findGitBash = (env, exists) => {
    if (env.GIT_BASH) {
        return env.GIT_BASH;
    }

    const directories = (env.PATH ?? env.Path ?? "").split(path.win32.delimiter).filter(Boolean);
    const candidates = directories.flatMap((directory) => [
        path.win32.join(directory, "bash.exe"),
        ...(path.win32.basename(directory).toLowerCase() === "cmd"
            ? [path.win32.join(directory, "..", "bin", "bash.exe")]
            : []),
    ]);
    for (const programFiles of [env.ProgramFiles, env["ProgramFiles(x86)"]]) {
        if (programFiles) {
            candidates.push(path.win32.join(programFiles, "Git", "bin", "bash.exe"));
        }
    }

    return candidates.find((candidate) => !/[\\/]system32[\\/]/i.test(candidate) && exists(candidate));
};

/** @type {string | undefined} */
let cachedShell;

/**
 * The bash used to run commands.
 * @param {NodeJS.Platform} [platform]
 * @param {Record<string, string | undefined>} [env]
 * @param {(file: string) => boolean} [exists]
 * @returns {string}
 */
exports.shell = (platform = process.platform, env = process.env, exists = fs.existsSync) => {
    if (platform !== "win32") {
        return "/bin/bash";
    }

    const useCache = env === process.env && exists === fs.existsSync;
    if (useCache && cachedShell) {
        return cachedShell;
    }

    const found = findGitBash(env, exists)?.replaceAll("\\", "/") ?? "bash";
    if (useCache) {
        cachedShell = found;
    }
    return found;
};

/**
 * The directory holding the executables of a virtual environment.
 * @param {string} venv
 * @param {NodeJS.Platform} [platform]
 * @returns {string}
 */
exports.venvBinDirectory = (venv, platform = process.platform) => `${venv}/${platform === "win32" ? "Scripts" : "bin"}`;

/**
 * Environment variables for every command: Git for Windows converts line endings and limits path lengths by
 * default, and npm runs scripts through cmd.exe unless told otherwise. Git settings that are already in the
 * environment (a proxy, a URL rewrite) are kept, and the ones added here come after them.
 * @param {NodeJS.Platform} [platform]
 * @param {Record<string, string | undefined>} [env]
 * @returns {Record<string, string>}
 */
exports.platformEnvironment = (platform = process.platform, env = process.env) => {
    if (platform !== "win32") {
        return {};
    }

    const inherited = Number.parseInt(env.GIT_CONFIG_COUNT ?? "0", 10) || 0;
    return {
        GIT_CONFIG_COUNT: String(inherited + 2),
        [`GIT_CONFIG_KEY_${inherited}`]: "core.autocrlf",
        [`GIT_CONFIG_VALUE_${inherited}`]: "false",
        [`GIT_CONFIG_KEY_${inherited + 1}`]: "core.longpaths",
        [`GIT_CONFIG_VALUE_${inherited + 1}`]: "true",
        npm_config_script_shell: exports.shell(platform, env),
    };
};

let environmentApplied = false;

/**
 * Applies the platform environment to this process once, so that the commands it runs itself, such as the ones
 * vsce starts to create a package, get it as well as the ones run through exec.
 */
exports.applyPlatformEnvironment = () => {
    if (!environmentApplied) {
        environmentApplied = true;
        Object.assign(process.env, exports.platformEnvironment());
    }
};

/**
 * Removes a directory, retrying as Windows refuses to delete files that were just in use.
 * @param {string} directory
 * @returns {Promise<void>}
 */
exports.removeDirectory = (directory) =>
    fs.promises.rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });

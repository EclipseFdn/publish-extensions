/******************************************************************************
 * Copyright (c) 2026 Contributors to the Eclipse Foundation.
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 *****************************************************************************/
// @ts-check
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");

const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const {
    quote,
    tempDirectory,
    tempPath,
    shell,
    venvBinDirectory,
    platformEnvironment,
    removeDirectory,
} = require("../lib/platform");

/**
 * @param {string} tmpdir
 * @param {() => void} fn
 */
const withTmpdir = (tmpdir, fn) => {
    const original = os.tmpdir;
    os.tmpdir = () => tmpdir;
    try {
        fn();
    } finally {
        os.tmpdir = original;
    }
};

test("the temporary directory is /tmp on Linux and macOS whatever TMPDIR says", () => {
    const original = process.env.TMPDIR;
    process.env.TMPDIR = "/var/tmp";
    try {
        assert.equal(tempDirectory("linux"), "/tmp");
        assert.equal(tempDirectory("darwin"), "/tmp");
    } finally {
        if (original === undefined) {
            delete process.env.TMPDIR;
        } else {
            process.env.TMPDIR = original;
        }
    }
});

test("the temporary directory on Windows is the system one, with forward slashes", () => {
    withTmpdir("C:\\Users\\runneradmin\\AppData\\Local\\Temp", () =>
        assert.equal(tempDirectory("win32"), "C:/Users/runneradmin/AppData/Local/Temp"),
    );
});

test("tempPath joins its segments to the temporary directory", () => {
    assert.equal(tempPath("repository", "main"), `${tempDirectory()}/repository/main`);
});

test("shell is /bin/bash except on Windows, where Git Bash is found through the PATH", () => {
    assert.equal(shell("linux"), "/bin/bash");
    assert.equal(shell("darwin"), "/bin/bash");
    assert.equal(
        shell("win32", { PATH: "" }, () => false),
        "bash",
    );
});

test("venvBinDirectory is Scripts on Windows and bin elsewhere", () => {
    assert.equal(venvBinDirectory("/tmp/venv", "linux"), "/tmp/venv/bin");
    assert.equal(venvBinDirectory("/tmp/venv", "darwin"), "/tmp/venv/bin");
    assert.equal(venvBinDirectory("C:/tmp/venv", "win32"), "C:/tmp/venv/Scripts");
});

test("platformEnvironment configures git and npm on Windows only", () => {
    assert.deepEqual(platformEnvironment("linux", {}), {});
    assert.deepEqual(platformEnvironment("darwin", {}), {});
    assert.deepEqual(platformEnvironment("win32", {}), {
        GIT_CONFIG_COUNT: "2",
        GIT_CONFIG_KEY_0: "core.autocrlf",
        GIT_CONFIG_VALUE_0: "false",
        GIT_CONFIG_KEY_1: "core.longpaths",
        GIT_CONFIG_VALUE_1: "true",
        npm_config_script_shell: "bash",
    });
});

test("platformEnvironment appends to the git settings that are already in the environment", () => {
    const environment = platformEnvironment("win32", {
        GIT_CONFIG_COUNT: "1",
        GIT_CONFIG_KEY_0: "http.proxy",
        GIT_CONFIG_VALUE_0: "http://proxy",
    });

    assert.equal(environment.GIT_CONFIG_COUNT, "3");
    assert.equal(environment.GIT_CONFIG_KEY_0, undefined);
    assert.equal(environment.GIT_CONFIG_KEY_1, "core.autocrlf");
    assert.equal(environment.GIT_CONFIG_VALUE_1, "false");
    assert.equal(environment.GIT_CONFIG_KEY_2, "core.longpaths");
    assert.equal(environment.GIT_CONFIG_VALUE_2, "true");
});

const gitBash = "C:\\Program Files\\Git\\bin\\bash.exe";

test("shell finds Git Bash next to the git on the PATH, not the WSL launcher in System32", () => {
    const env = { PATH: "C:\\Windows\\System32;C:\\Program Files\\Git\\cmd;C:\\tools" };
    const exists = (/** @type {string} */ file) =>
        [gitBash, "C:\\Windows\\System32\\bash.exe"].includes(file.replaceAll("/", "\\"));

    assert.equal(shell("win32", env, exists), "C:/Program Files/Git/bin/bash.exe");
});

test("shell prefers bash.exe found on the PATH and the GIT_BASH override", () => {
    const exists = (/** @type {string} */ file) => file === "D:\\git\\bin\\bash.exe";
    assert.equal(shell("win32", { PATH: "D:\\git\\bin" }, exists), "D:/git/bin/bash.exe");
    assert.equal(shell("win32", { GIT_BASH: "E:\\bash.exe", PATH: "D:\\git\\bin" }, exists), "E:/bash.exe");
});

test("shell falls back to the default install directory, then to bash", () => {
    const exists = (/** @type {string} */ file) => file === gitBash;
    assert.equal(
        shell("win32", { ProgramFiles: "C:\\Program Files", PATH: "" }, exists),
        "C:/Program Files/Git/bin/bash.exe",
    );
    assert.equal(
        shell("win32", { PATH: "C:\\Windows\\System32" }, () => false),
        "bash",
    );
});

test("removeDirectory removes a directory tree and ignores a missing one", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "remove-directory-"));
    fs.mkdirSync(path.join(directory, "a", "b"), { recursive: true });
    fs.writeFileSync(path.join(directory, "a", "b", "file"), "x");

    await removeDirectory(directory);
    assert.equal(fs.existsSync(directory), false);
    await removeDirectory(directory);
});

test("quote passes any value to bash as a single, unexpanded argument", () => {
    for (const value of [
        "simple",
        "with space",
        "it's",
        "'; touch /tmp/pwned #",
        "$(echo expanded)",
        "`echo expanded`",
        "${HOME}",
        "a\nb",
        '"double"',
        "back\\slash",
        "",
    ]) {
        const result = cp.spawnSync("bash", ["-c", `printf %s ${quote(value)}`], { encoding: "utf8" });
        assert.equal(result.stdout, value);
    }
});

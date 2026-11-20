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

const fs = require("node:fs");
const path = require("node:path");
const {
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
    assert.equal(shell("win32"), "bash");
});

test("venvBinDirectory is Scripts on Windows and bin elsewhere", () => {
    assert.equal(venvBinDirectory("/tmp/venv", "linux"), "/tmp/venv/bin");
    assert.equal(venvBinDirectory("/tmp/venv", "darwin"), "/tmp/venv/bin");
    assert.equal(venvBinDirectory("C:/tmp/venv", "win32"), "C:/tmp/venv/Scripts");
});

test("platformEnvironment configures git and npm on Windows only", () => {
    assert.deepEqual(platformEnvironment("linux"), {});
    assert.deepEqual(platformEnvironment("darwin"), {});
    assert.deepEqual(platformEnvironment("win32"), {
        GIT_CONFIG_COUNT: "2",
        GIT_CONFIG_KEY_0: "core.autocrlf",
        GIT_CONFIG_VALUE_0: "false",
        GIT_CONFIG_KEY_1: "core.longpaths",
        GIT_CONFIG_VALUE_1: "true",
        npm_config_script_shell: "bash",
    });
});

test("removeDirectory removes a directory tree and ignores a missing one", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "remove-directory-"));
    fs.mkdirSync(path.join(directory, "a", "b"), { recursive: true });
    fs.writeFileSync(path.join(directory, "a", "b", "file"), "x");

    await removeDirectory(directory);
    assert.equal(fs.existsSync(directory), false);
    await removeDirectory(directory);
});

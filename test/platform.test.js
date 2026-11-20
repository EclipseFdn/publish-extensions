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

const { tempPath, shell, venvBinDirectory } = require("../lib/platform");

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

test("tempPath lives in the temporary directory", () => {
    withTmpdir("/var/tmp", () => assert.equal(tempPath("repository", "main"), "/var/tmp/repository/main"));
});

test("tempPath uses forward slashes for a Windows temporary directory", () => {
    withTmpdir("C:\\Users\\runneradmin\\AppData\\Local\\Temp", () =>
        assert.equal(tempPath("artifacts"), "C:/Users/runneradmin/AppData/Local/Temp/artifacts"),
    );
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

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
// Tests for the `env` option of lib/exec.js, which carries the per-target environment
// variables (`target.<name>.env` in extensions.json) into build commands.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const exec = require("../lib/exec");

/**
 * Sets a process.env variable for the duration of the test.
 * @param {import("node:test").TestContext} t
 * @param {string} name
 * @param {string} value
 */
const setProcessEnv = (t, name, value) => {
    const previous = process.env[name];
    process.env[name] = value;
    t.after(() => {
        if (previous === undefined) delete process.env[name];
        else process.env[name] = previous;
    });
};

/**
 * @param {string} command
 * @param {Record<string, any>} [env]
 */
const run = async (command, env) => (await exec(command, { quiet: true, env })).stdout.trim();

test("exec passes options.env to the command", async () => {
    assert.equal(await run("echo $FOO-$BAR", { FOO: "a", BAR: "b" }), "a-b");
});

test("exec keeps inheriting process.env when options.env is given", async (t) => {
    setProcessEnv(t, "EXEC_TEST_INHERITED", "inherited");
    assert.equal(await run("echo $EXEC_TEST_INHERITED-$FOO", { FOO: "x" }), "inherited-x");
});

test("options.env takes precedence over process.env", async (t) => {
    setProcessEnv(t, "EXEC_TEST_VAR", "from-process");
    assert.equal(await run("echo $EXEC_TEST_VAR", { EXEC_TEST_VAR: "from-options" }), "from-options");
});

test("an undefined value in options.env leaves the variable unset instead of the string 'undefined'", async () => {
    assert.equal(await run("echo ${OVSX_VERSION-unset}", { OVSX_VERSION: undefined }), "unset");
});

test("GITHUB_TOKEN is not passed through unless ghtoken is set", async (t) => {
    setProcessEnv(t, "GITHUB_TOKEN", "secret");
    assert.equal(await run("echo ${GITHUB_TOKEN-unset}"), "unset");
    const withToken = await exec("echo ${GITHUB_TOKEN-unset}", { quiet: true, ghtoken: true });
    assert.equal(withToken.stdout.trim(), "secret");
});

/********************************************************************************
 * Copyright (c) 2026 TypeFox and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/
// @ts-check
// Regression test for a command-injection vulnerability: the `repository` field of an
// extensions.json entry was interpolated unquoted into a `git clone` command run via
// `child_process.exec(..., { shell: "/bin/bash" })`. Since `new URL(repository)` does not
// reject shell metacharacters (`;`, `$()`, backticks, ...), a malicious repository value
// could run arbitrary commands on the CI runner. See lib/resolveExtension.js.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const cp = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

test("resolveExtension shell-quotes the repository field so it cannot inject commands via git clone", async (t) => {
    const commands = [];

    // Stub out child_process.exec so lib/exec.js's `git clone` call is actually executed
    // by a real shell (proving the injected command does or doesn't run), while every
    // subsequent git plumbing call (git log, etc.) is short-circuited with empty output,
    // since we don't need a real clone to exercise the vulnerable code path.
    const realExec = cp.exec.bind(cp);
    t.mock.method(cp, "exec", (command, options, callback) => {
        commands.push(command);
        if (command.startsWith("git clone")) {
            return realExec(command, { ...options, timeout: 10_000 }, callback);
        }
        callback(null, "", "");
        return { stdout: { pipe() {} }, stderr: { pipe() {} } };
    });

    delete require.cache[require.resolve("../lib/resolveExtension")];
    const { resolveExtension } = require("../lib/resolveExtension");

    const marker = path.join(os.tmpdir(), `pwned-poc-${crypto.randomBytes(6).toString("hex")}`);
    const maliciousRepository = `https://github.com/example/ext;touch ${marker}#`;

    try {
        // The clone itself is expected to fail (the "repository" is not a real, reachable
        // URL once safely quoted) -- that failure is fine and expected. What matters is
        // whether the injected `touch` command ran.
        await resolveExtension({ id: "example.ext", repository: maliciousRepository, location: undefined }).catch(
            () => {},
        );

        const cloneCommand = commands.find((command) => command.startsWith("git clone"));
        assert.ok(cloneCommand, "expected a git clone command to have been run");

        // The whole malicious repository string must be wrapped as a single shell-quoted
        // token, not left as bare, unescaped shell metacharacters bash would parse as
        // separate commands.
        assert.ok(
            cloneCommand.includes(`'${maliciousRepository}'`),
            `expected repository to be shell-quoted in the git clone command, got: ${cloneCommand}`,
        );

        assert.ok(!fs.existsSync(marker), "the injected shell command must not have executed");
    } finally {
        fs.rmSync(marker, { force: true });
    }
});

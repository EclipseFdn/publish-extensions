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

const { buildLegs, isSelected } = require("../lib/targets");

/** @returns {any} */
const publishContext = (/** @type {object} */ extra = {}) => ({ target: "", ...extra });

test("an extension without targets builds as one universal leg", () => {
    assert.deepEqual(buildLegs(/** @type {any} */ ({ id: "a.b" }), publishContext()), [
        { name: "universal", target: "", runsOn: "ubuntu-latest" },
    ]);
});

test("a target built from sources gets a leg on its own runner, defaulting to ubuntu-latest", () => {
    const extension = /** @type {any} */ ({
        id: "a.b",
        target: {
            "linux-x64": true,
            "linux-arm64": { env: { A: "1" }, runsOn: "ubuntu-24.04-arm" },
            "win32-x64": { runsOn: "windows-latest" },
            "alpine-x64": { env: { A: "1" } },
        },
    });

    assert.deepEqual(buildLegs(extension, publishContext()), [
        { name: "linux-x64", target: "linux-x64", runsOn: "ubuntu-latest" },
        { name: "linux-arm64", target: "linux-arm64", runsOn: "ubuntu-24.04-arm" },
        { name: "win32-x64", target: "win32-x64", runsOn: "windows-latest" },
        { name: "alpine-x64", target: "alpine-x64", runsOn: "ubuntu-latest" },
    ]);
});

test("targets resolved from release assets are built together in one leg", () => {
    const extension = /** @type {any} */ ({ id: "a.b", target: { "win32-x64": { runsOn: "windows-latest" } } });

    assert.deepEqual(buildLegs(extension, publishContext({ files: { "win32-x64": "/tmp/download/a.vsix" } })), [
        { name: "universal", target: "", runsOn: "ubuntu-latest" },
    ]);
});

test("isSelected builds every target unless one is selected", () => {
    assert.equal(isSelected("linux-x64", undefined), true);
    assert.equal(isSelected("linux-x64", ""), true);
    assert.equal(isSelected("linux-x64", "linux-x64"), true);
    assert.equal(isSelected("win32-x64", "linux-x64"), false);
});

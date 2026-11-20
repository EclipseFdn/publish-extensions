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

const { buildStepEnvironment } = require("../lib/buildEnvironment");

const extension = /** @type {any} */ ({ id: "ms-python.python" });

test("build commands receive the extension, its versions and the target", () => {
    const context = /** @type {any} */ ({
        target: "linux-arm64",
        version: "1.2.3",
        msVersion: "1.2.3",
        ovsxVersion: "1.2.2",
    });

    assert.deepEqual(buildStepEnvironment(extension, context), {
        EXTENSION_ID: "ms-python.python",
        EXTENSION_PUBLISHER: "ms-python",
        EXTENSION_NAME: "python",
        EXTENSION_TARGET: "linux-arm64",
        VERSION: "1.2.3",
        MS_VERSION: "1.2.3",
        OVSX_VERSION: "1.2.2",
    });
});

test("the target is unset for a universal build", () => {
    assert.equal(buildStepEnvironment(extension, /** @type {any} */ ({ target: "" })).EXTENSION_TARGET, undefined);
    assert.equal(buildStepEnvironment(extension, /** @type {any} */ ({})).EXTENSION_TARGET, undefined);
});

test("the environment of a target comes first, so the variables of the build cannot be overridden by it", () => {
    const context = /** @type {any} */ ({
        target: "linux-x64",
        environmentVariables: { CARGO_TARGET: "x86_64-unknown-linux-musl", EXTENSION_ID: "other" },
    });
    const environment = buildStepEnvironment(extension, context);

    assert.equal(environment.CARGO_TARGET, "x86_64-unknown-linux-musl");
    assert.equal(environment.EXTENSION_ID, "ms-python.python");
});

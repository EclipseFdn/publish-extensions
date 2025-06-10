/********************************************************************************
 * Copyright (c) 2025 Precies. Software OU and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

// @ts-check
const publishExtensionsScript = require("./scripts/publish-extensions");
const buildExtensionScript = require("./scripts/build-extension");
const publishExtensionScript = require("./scripts/publish-extension");

(async () => {
    process.env.SKIP_PUBLISH ??= "true";
    process.env.FORCE ??= "true";

    await publishExtensionsScript(async (extension, publishContext) => {
        const extensionFiles = await buildExtensionScript(extension, publishContext);
        await publishExtensionScript(extension.id, extensionFiles);
    });
})();
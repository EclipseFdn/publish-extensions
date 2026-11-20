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

/**
 * The environment variables the build commands of an extension receive.
 * @param {import('../types').Extension} extension
 * @param {import('../types').PublishContext} publishContext
 * @returns {Record<string, string | undefined>}
 */
exports.buildStepEnvironment = (extension, publishContext) => {
    const [publisher, name] = extension.id.split(".");

    return {
        ...publishContext.environmentVariables,
        EXTENSION_ID: extension.id,
        EXTENSION_PUBLISHER: publisher,
        EXTENSION_NAME: name,
        // The platform the extension is built for, unset for a universal build.
        EXTENSION_TARGET: publishContext.target || undefined,
        VERSION: publishContext.version,
        MS_VERSION: publishContext.msVersion,
        OVSX_VERSION: publishContext.ovsxVersion,
    };
};

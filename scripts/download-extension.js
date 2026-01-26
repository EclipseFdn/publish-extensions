/** ******************************************************************************
 * Copyright (c) 2025 Precies. Software OU and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 * ****************************************************************************** */
const path = require("path");
const { DefaultArtifactClient } = require("@actions/artifact");
const resolveExtension = require("../lib/resolveExtension").resolveExtension;

module.exports = async () => {
    const extension = JSON.parse(process.env.EXTENSION);
    console.debug(`Resolving downloads for ${extension.id}`);

    const publishContext = JSON.parse(process.env.PUBLISH_CONTEXT);
    publishContext.msLastUpdated = new Date(publishContext.msLastUpdated);
    publishContext.ovsxLastUpdated = new Date(publishContext.ovsxLastUpdated);
    await resolveExtension(
        extension,
        publishContext.msVersion && {
            version: publishContext.msVersion,
            lastUpdated: publishContext.msLastUpdated,
        },
    );

    const artifact = new DefaultArtifactClient();
    await artifact.uploadArtifact("download", Object.values(publishContext.files), "/tmp/download", {
        retentionDays: 7,
    });
};

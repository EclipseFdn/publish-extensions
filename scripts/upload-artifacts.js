const { DefaultArtifactClient } = require("@actions/artifact");
const { artifactDirectory } = require("../lib/constants");

// @ts-check
/**
 * @param {string[]} extensionFiles
 */
module.exports = async (extensionFiles) => {
    const artifact = new DefaultArtifactClient();
    // One artifact per build job, as every job of a matrix needs its own name.
    await artifact.uploadArtifact(`artifacts-${process.env.BUILD_TARGET || "universal"}`, extensionFiles, artifactDirectory, {
        retentionDays: 7,
    });
};
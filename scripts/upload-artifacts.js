const { DefaultArtifactClient } = require("@actions/artifact");
const { artifactDirectory } = require("../lib/constants");

// @ts-check
/**
 * @param {string[]} extensionFiles
 */
module.exports = async (extensionFiles) => {
    const artifact = new DefaultArtifactClient();
    await artifact.uploadArtifact("artifacts", extensionFiles, artifactDirectory, {
        retentionDays: 7,
    });
};
#!/usr/bin/env node
const { join } = require("node:path");

(async () => {
    require("./lib/constants").artifactDirectory = join(__dirname, "out");

    await require("./scripts/publish-extensions")(
        async (extension, context) => {
            if (context.files) {
                await require("./scripts/download-extension")();
            }

            const files = await require("./scripts/build-extension")(extension, context);

            if (!process.env.SKIP_PUBLISH) {
                await require("./scripts/publish-extension")(extension.id, files);
            }
        });
})();

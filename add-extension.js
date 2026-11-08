/********************************************************************************
 * Copyright (c) 2022 Gitpod and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

//
// Usage:
//   node add-extension.js ext.id https://github.com/my-org/repo
// Optional extra arguments [see: extensions-schema.json]:
//   node add-extension.js abusaidm.html-snippets2 https://github.com/my-org/repo --location 'packages/xy'
//

const fs = require("fs");
const minimist = require("minimist");
const util = require("util");
const exec = require("./lib/exec");
const extensionsSchema = require("./extensions-schema.json");
const fetch = require("node-fetch").default;
const { getPublicGalleryAPI } = require("@vscode/vsce/out/util");
const parseXmlManifest = require("@vscode/vsce/out/xml").parseXmlManifest;
const { ExtensionQueryFlags } = require("azure-devops-node-api/interfaces/GalleryInterfaces");

const flags = [
    ExtensionQueryFlags.IncludeMetadata,
    ExtensionQueryFlags.IncludeAssetUri,
    ExtensionQueryFlags.IncludeFiles,
    ExtensionQueryFlags.IncludeLatestVersionOnly,
];

const msGalleryApi = getPublicGalleryAPI();
msGalleryApi.client["_allowRetries"] = true;
msGalleryApi.client["_maxRetries"] = 5;

const getRepositoryFromMarketplace = async (/** @type {string} */ id) => {
    /** @type {[PromiseSettledResult<import("azure-devops-node-api/interfaces/GalleryInterfaces").PublishedExtension | undefined>]} */
    let [msExtension] = await Promise.allSettled([msGalleryApi.getExtension(id, flags)]);
    if (msExtension.status !== "fulfilled") {
        return;
    }

    const vsixManifest =
        msExtension.value?.versions &&
        msExtension.value?.versions[0].files?.find(
            (file) => file.assetType === "Microsoft.VisualStudio.Services.VsixManifest",
        )?.source;

    if (!vsixManifest) {
        return;
    }

    const response = await fetch(vsixManifest);
    const data = await parseXmlManifest(await response.text());
    const url = new URL(
        data.PackageManifest.Metadata[0].Properties[0].Property.find(
            (/** @type {any} */ property) => property.$.Id === "Microsoft.VisualStudio.Services.Links.Source",
        ).$.Value,
    );

    if (url.host === "github.com") {
        return url.toString().replace(".git", "");
    }

    return url.toString();
};

(async () => {
    // Parse args
    const argv = minimist(process.argv.slice(2)); // without executable & script path

    // Check positional args
    if (argv._.length === 0) {
        console.error("Need two positional arguments: ext-id, repo-url or a Microsoft Marketplace URL");
        process.exit(1);
    }

    let [extID, repoURL] = argv._;
    try {
        const urlObject = new URL(extID);
        if (urlObject.host === "marketplace.visualstudio.com") {
            const id = urlObject.searchParams.get("itemName");
            if (!id) {
                console.error(`Couldn\'t get the extension ID from ${extID}`);
                process.exit(1);
            } else {
                extID = id;
                const url = await getRepositoryFromMarketplace(id);
                if (!url) {
                    console.error(`Couldn\'t get the repository URL for ${extID}`);
                    process.exit(1);
                } else {
                    repoURL = url;
                }
            }
        }
    } catch {
    } finally {
        if (argv._.length < 2 && !repoURL) {
            console.error(
                "Need two positional arguments: ext-id, repo-url, since the provided argument is not a Marketplace URL",
            );
            process.exit(1);
        }
    }

    const extDefinition = /** @type {import("./types").Extension} */ ({
        repository: repoURL,
    });

    // Validate extra args
    delete (/** @type {any} */ (argv))._; // delete positional arguments
    for (const arg of /** @type {Array<keyof typeof extensionsSchema.additionalProperties.properties>} */ (Object.keys(argv))) {
        const propDef = extensionsSchema.additionalProperties.properties[arg];
        // console.debug(`arg=${arg}:`, argv[arg], propDef)
        if (!propDef) {
            console.error(`argument '${arg}' not found in ./extensions-schema.json`);
            process.exit(1);
        }

        // parse & validate value
        if (propDef.type === "string") {
            extDefinition[arg] = /** @type {any} */ (String(argv[arg])); // minimist might've assumed a different type (e.g. number)
        } else if (propDef.type === "number") {
            if (typeof argv[arg] !== "number") {
                console.error(
                    `argument '${arg}' should be type '${propDef.type}' but yours seems to be '${typeof argv[arg]}'`,
                );
                process.exit(1);
            }
            extDefinition[arg] = /** @type {any} */ (argv[arg]); // numbers are parsed by minimist already
        } else {
            console.error(
                `argument '${arg}' is of type '${propDef.type}' which is not implemented by this script, sorry`,
            );
            process.exit(1);
        }
    }
    console.info("Adding extension:", util.inspect(extDefinition, { colors: true, compact: false }));

    // Read current file
    const extensions = Object.entries(
        JSON.parse(await fs.promises.readFile("./extensions.json", { encoding: "utf8" })),
    );
    // Sort extensions (most are, but not always)
    extensions.sort(([k1], [k2]) => k1.localeCompare(k2));

    const originalList = JSON.stringify(Object.fromEntries(extensions), undefined, 2);

    // Find position & insert extension
    for (let i = 0; i < extensions.length; i++) {
        const [currentID] = extensions[i];
        // console.debug(i, currentID)
        const diff = currentID.localeCompare(extID, undefined, { sensitivity: "base" });
        if (diff === 0) {
            console.error("Extension already defined:", currentID);
            process.exit(1);
        }
        if (diff > 0) {
            extensions.splice(i, 0, [extID, extDefinition]);
            break;
        }
    }

    // Persist changes
    await fs.promises.writeFile(
        "./extensions.json",
        JSON.stringify(Object.fromEntries(extensions), undefined, 2) + "\n", // add newline at EOF
        { encoding: "utf8" },
    );

    console.info(`Successfully added ${extID}`);
    if (process.env.TEST_EXTENSION === "false") {
        console.info("Skipping tests, TEST_EXTENSION was provided.");
        process.exit(0);
    }

    console.info(`Trying to build ${extID} for the first time`);

    process.env.EXTENSIONS = extID;
    process.env.FORCE = "true";
    process.env.SKIP_PUBLISH = "true";

    const out = await exec("node bin/publish-extensions", { quiet: true, ghtoken: true });
    if (out && out.stderr.includes("[FAIL] Could not process extension:")) {
        console.error(
            `There was an error while trying to build ${extID}. Reverting back to the previous state of extensions.json.`,
        );
        await fs.promises.writeFile(
            "./extensions.json",
            originalList + "\n", // add newline at EOF
            { encoding: "utf8" },
        );
    } else {
        console.info("Built extension successfully");
        console.info(`Feel free to use the message below for your commit:\r\nAdded \`${extID}\``);
    }
})();

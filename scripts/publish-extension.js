/********************************************************************************
 * Copyright (c) 2023 TypeFox and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

// @ts-check
const ovsx = require("ovsx");
const yauzl = require("yauzl-promise");
const xml2js = require("xml2js");

const { registryHost } = require("../lib/constants");

/**
 *
 * @param {Readonly<import('stream').Readable>} stream
 * @returns {Promise<Buffer>}
 */
async function bufferStream(stream) {
    return await new Promise((resolve, reject) => {
        /** @type {Array<Buffer>} */
        const buffers = [];
        stream.on("data", (buffer) => buffers.push(buffer));
        stream.once("error", reject);
        stream.once("end", () => resolve(Buffer.concat(buffers)));
    });
}

/**
 *
 * @param {string} packagePath
 * @param {(name: string) => boolean} filter
 * @returns {Promise<Map<string, Buffer>>}
 */
async function readZip(packagePath, filter) {
    const result = new Map();
    const zipfile = await yauzl.open(packagePath);
    try {
        for await (const entry of zipfile) {
            if (filter(entry.filename)) {
                const stream = await zipfile.openReadStream(entry);
                const buffer = await bufferStream(stream);
                result.set(entry.filename, buffer);
            }
        }
    } finally {
        await zipfile.close();
    }

    return result;
}

/**
 *
 * @param {string} extensionFile
 * @returns {Promise<any|undefined>}
 */
async function readXmlManifest(extensionFile) {
    const fileName = "extension.vsixmanifest";
    const result = await readZip(extensionFile, (name) => name === fileName);
    const rawFile = result.get(fileName);
    if (rawFile == null) {
        return undefined;
    }

    const xml = rawFile.toString("utf-8");
    const parser = new xml2js.Parser();
    return await parser.parseStringPromise(xml);
}

// @ts-check
/**
 * @param {string} extensionId
 * @param {string[]} extensionFiles
 */
module.exports = async (extensionId, extensionFiles) => {
    const [namespace, extension] = extensionId.split(".");
    console.log(`Attempting to publish ${extensionId} to Open VSX`);
    if (!process.env.OVSX_PAT) {
        throw new Error(
            "The OVSX_PAT environment variable was not provided, which means the extension cannot be published. Provide it or set SKIP_PUBLISH to true to avoid seeing this.",
        );
    }

    const registryUrl = `https://${registryHost}`;
    for (const extensionFile of extensionFiles) {
        const xmlManifest = await readXmlManifest(extensionFile);
        if (
            xmlManifest?.PackageManifest?.Metadata[0]?.Identity[0]["$"]?.Publisher.toLowerCase() !=
            namespace.toLowerCase()
        ) {
            console.error(
                `Namespace name mismatch. Expected ${namespace}, but found ${xmlManifest?.PackageManifest?.Metadata[0]?.Identity[0]["$"]?.Publisher}`,
            );
            continue;
        }
        if (xmlManifest?.PackageManifest?.Metadata[0]?.Identity[0]["$"]?.Id.toLowerCase() != extension.toLowerCase()) {
            console.error(
                `Extension name mismatch. Expected ${extension}, but found ${xmlManifest?.PackageManifest?.Metadata[0]?.Identity[0]["$"]?.Id}`,
            );
            continue;
        }

        // Create a public Open VSX namespace if needed.
        try {
            await ovsx.createNamespace({ name: namespace, registryUrl });
        } catch (error) {
            console.log(`Creating Open VSX namespace failed -- assuming that it already exists`);
            console.log(error);
        }

        console.info(`Publishing extension ${extensionId}`);
        const options = { extensionFile, registryUrl };
        await ovsx.publish(options);
        console.log(`Published ${options.extensionFile} to ${options.registryUrl}/extension/${namespace}/${extension}`);
    }
};

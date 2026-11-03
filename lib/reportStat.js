/********************************************************************************
 * Copyright (c) 2022 TypeFox and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

const fs = require("fs");
const { getPublicGalleryAPI } = require("@vscode/vsce/out/util");
const { PublicGalleryAPI } = require("@vscode/vsce/out/publicgalleryapi");
const { ExtensionQueryFlags } = require("azure-devops-node-api/interfaces/GalleryInterfaces");
const humanNumber = require("human-number");
const { registryHost } = require("./constants");

const formatter = (/** @type {number} */ number) => {
    if (number === undefined) {
        return "N/A";
    }

    if (isNaN(number)) {
        return number.toString();
    }

    const maxDigits = 3;
    let formatted = number.toFixed(maxDigits);
    while (formatted.endsWith("0")) {
        formatted = formatted.slice(0, -1);
    }
    return formatted;
};

const msGalleryApi = getPublicGalleryAPI();
msGalleryApi.client["_allowRetries"] = true;
msGalleryApi.client["_maxRetries"] = 5;

const openGalleryApi = new PublicGalleryAPI(`https://${registryHost}/vscode`, "3.0-preview.1");
openGalleryApi.client["_allowRetries"] = true;
openGalleryApi.client["_maxRetries"] = 5;
openGalleryApi.post = (
    /** @type {string} */ url,
    /** @type {string} */ data,
    /** @type {import("typed-rest-client/Interfaces").IHeaders} */ additionalHeaders,
) => openGalleryApi.client.post(`${openGalleryApi.baseUrl}${url}`, data, additionalHeaders);

const flags = [ExtensionQueryFlags.IncludeStatistics];

const checkAmount = 128;

const cannotPublish = [
    // We cannot redistribute under their license: https://github.com/microsoft/vscode-cpptools/tree/main/RuntimeLicenses
    "ms-vscode.cpptools",
    "ms-vscode.cpptools-extension-pack",

    // We cannot redistribute under their license: https://github.com/OmniSharp/omnisharp-vscode/tree/master/RuntimeLicenses
    "ms-dotnettools.csharp",

    // Dependent on ms-dotnettools.csharp
    "vsciot-vscode.vscode-arduino",
    "Unity.unity-debug",
    "cake-build.cake-vscode",

    // Dependent on ms-vscode.cpptools
    "platformio.platformio-ide",

    // All code or parts are proprietary
    "ms-python.vscode-pylance",
    "ms-toolsai.vscode-ai-remote",
    "VisualStudioExptTeam.vscodeintellicode",
    "ms-dotnettools.vscodeintellicode-csharp",
    "VisualStudioExptTeam.intellicode-api-usage-examples",
    "ms-vscode-remote.remote-wsl",
    "ms-vscode-remote.remote-containers",
    "ms-vscode-remote.remote-ssh",
    "ms-vscode-remote.remote-ssh-edit",
    "ms-vscode.remote-explorer",
    "ms-vscode.remote-server",
    "ms-vscode.remote-repositories",
    "ms-vscode-remote.vscode-remote-extensionpack",
    "MS-vsliveshare.vsliveshare",
    "MS-vsliveshare.vsliveshare-pack",
    "MS-vsliveshare.vsliveshare-audio",
    "ms-python.gather",
    "ms-dotnettools.csdevkit",
    "ms-toolsai.vscode-ai",

    // GitHub Proprietary
    "GitHub.copilot",
    "GitHub.copilot-chat",
    "GitHub.remotehub",
    "GitHub.codespaces",

    // Deprecated
    "eg2.tslint",

    // Unlicensed
    "austin.code-gnu-global",

    // Other
    "humao.rest-client", // As per author's request: https://github.com/Huachao/vscode-restclient/issues/860#issuecomment-873097908
];

/**
 * Checks missing extensions from Open VSX
 * @param {boolean} silent
 * @param {number} amount
 * @returns
 */
const checkMissing = async (silent = false, amount = checkAmount) => {
    /**
     * @type {Readonly<import('../types').Extensions>}
     */
    const extensionsToPublish = JSON.parse(await fs.promises.readFile("./extensions.json", "utf-8"));


    const topExtensions =
        /** @type {import("azure-devops-node-api/interfaces/GalleryInterfaces").PublishedExtension[]} */
        (await msGalleryApi.extensionQuery({
            pageSize: amount,
            criteria: [
                { filterType: 8, value: "Microsoft.VisualStudio.Code" },
                { filterType: 12, value: "4096" },
            ],
            flags,
        }));

    /** @type {import("azure-devops-node-api/interfaces/GalleryInterfaces").PublishedExtension[]} */
    let notInOvsx = [];

    const installs = {
        published: 0,
        missing: 0,
    };

    for (const extension of topExtensions) {
        let [openExtension] = await Promise.allSettled([
            openGalleryApi.getExtension(`${extension.publisher?.publisherName}.${extension.extensionName}`, flags),
        ]);
        const id = `${extension.publisher?.publisherName}.${extension.extensionName}`;
        const extInstalls = extension.statistics?.find((s) => s.statisticName === "install")?.value ?? 0;
        const popularExtension = extInstalls > 1_000_000;
        if (openExtension.status === "fulfilled") {
            if (!openExtension.value?.publisher?.publisherId) {
                notInOvsx.push(extension);
                installs.missing += extInstalls;
                if (!silent) {
                    if (!cannotPublish.includes(id)) {
                        console.log(
                            `${popularExtension ? "🔴" : "🟡"} Extension not in Open VSX : ${extension.publisher?.publisherName}.${extension.extensionName}`,
                        );
                    }
                }
            } else {
                installs.published += extInstalls;
            }
        }
    }

    const microsoftUnpublished = notInOvsx.filter(
        (extension) =>
            extension.publisher?.domain &&
            ["https://microsoft.com", "https://github.com"].includes(extension.publisher?.domain) &&
            extension.publisher?.isDomainVerified,
    );
    const definedInRepo = notInOvsx
        .map((ext) => `${ext.publisher?.publisherName}.${ext.extensionName}`)
        .filter((id) => extensionsToPublish[id]);

    const microsoftCouldPublish = microsoftUnpublished.filter(
        (extension) => !cannotPublish.includes(`${extension.publisher?.publisherName}.${extension.extensionName}`),
    );

    let summary = "----- Summary -----\r\n";
    summary += `Total: ${amount}\r\n`;
    summary += `Install parity: ${((installs.published / (installs.missing + installs.published)) * 100).toFixed(2)}% (${humanNumber(installs.published, formatter)} out of ${humanNumber(installs.missing + installs.published, formatter)})\r\n`;
    summary += `Not published to Open VSX: ${notInOvsx.length} (${((notInOvsx.length / amount) * 100).toFixed(4)}%)\r\n`;
    summary += `Not in Open VSX but defined in our repo: ${definedInRepo.length} (${((definedInRepo.length / notInOvsx.length) * 100).toFixed(4)}%)\r\n`;
    summary += `Not published from Microsoft: ${microsoftUnpublished.length} (${((microsoftUnpublished.length / amount) * 100).toFixed(4)}% of all unpublished)\r\n`;

    summary += "Microsoft extensions we should publish: \r\n";
    summary += microsoftCouldPublish
        .map((extension) => `${extension.publisher?.publisherName}.${extension.extensionName}`)
        .join();

    if (!silent) console.log(summary);

    return {
        missing: notInOvsx,
        missingMs: microsoftUnpublished,
        couldPublishMs: microsoftCouldPublish,
        definedInRepo,
    };
};

// Can also be run directly
if (require.main === module) {
    (async function () {
        await checkMissing(false, 4096);
    })();
}

exports.checkMissing = checkMissing;
exports.formatter = formatter;
exports.cannotPublish = cannotPublish;

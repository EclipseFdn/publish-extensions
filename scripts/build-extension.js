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
const fs = require("fs");
const ovsx = require("ovsx");
const readVSIXPackage = require("@vscode/vsce/out/zip").readVSIXPackage;
const path = require("path");
const semver = require("semver");
const exec = require("../lib/exec");
const findUp = require("find-up");
const fg = require("fast-glob");

const { createVSIX } = require("@vscode/vsce");
const { cannotPublish } = require("../lib/reportStat");

const { PublicGalleryAPI } = require("@vscode/vsce/out/publicgalleryapi");
const { PublishedExtension } = require("azure-devops-node-api/interfaces/GalleryInterfaces");
const { artifactDirectory, registryHost, defaultPythonVersion } = require("../lib/constants");
const resolveExtension = require("../lib/resolveExtension").resolveExtension;

const vscodeBuiltinExtensionsNamespace = "vscode";
const isBuiltIn = (id) => id.split(".")[0] === vscodeBuiltinExtensionsNamespace;

const openGalleryApi = new PublicGalleryAPI(`https://${registryHost}/vscode`, "3.0-preview.1");
openGalleryApi.client["_allowRetries"] = true;
openGalleryApi.client["_maxRetries"] = 5;
openGalleryApi.post = (url, data, additionalHeaders) =>
    openGalleryApi.client.post(`${openGalleryApi.baseUrl}${url}`, data, additionalHeaders);

const ensureBuildPrerequisites = async () => {
    // Make yarn use bash
    await exec("yarn config set script-shell /bin/bash");

    // Don't show large git advice blocks
    await exec("git config --global advice.detachedHead false");

    // Create directory for storing built extensions
    if (fs.existsSync(artifactDirectory)) {
        // If the folder has any files, delete them
        try {
            fs.rmSync(`${artifactDirectory}*`);
        } catch {}
    } else {
        fs.mkdirSync(artifactDirectory);
    }
};

// @ts-check
/**
 * @param {import('../types').Extension} extension
 * @param {import('../types').PublishContext} publishContext
 */
async function buildVersion(extension, publishContext) {
    console.debug(`Building ${extension.id} for ${publishContext.target || "universal"}...`);
    console.log(`\nProcessing extension: ${JSON.stringify({ extension, publishContext }, undefined, 2)}`);
    try {
        await ensureBuildPrerequisites();
        const { id } = extension;
        let packagePath = publishContext.repo;
        if (packagePath && extension.location) {
            packagePath = path.join(packagePath, extension.location);
        }

        /** @type {import('ovsx').PublishOptions} */
        let options;
        if (publishContext.file) {
            options = { extensionFile: publishContext.file, targets: [publishContext.target] };
        } else if (publishContext.repo && publishContext.ref) {
            console.log(`${id}: preparing from ${publishContext.repo}...`);
            await exec("rm -rf /tmp/repository /tmp/download", { quiet: true });
            await resolveExtension(
                extension,
                publishContext.msVersion && {
                    version: publishContext.msVersion,
                    lastUpdated: publishContext.msLastUpdated,
                },
            );

            const [publisher, name] = extension.id.split(".");
            process.env.EXTENSION_ID = extension.id;
            process.env.EXTENSION_PUBLISHER = publisher;
            process.env.EXTENSION_NAME = name;
            process.env.VERSION = publishContext.version;
            process.env.MS_VERSION = publishContext.msVersion;
            process.env.OVSX_VERSION = publishContext.ovsxVersion;
            await exec(`git checkout ${publishContext.ref}`, { cwd: publishContext.repo });

            try {
                const nvmFile = await findUp(".nvmrc", {
                    cwd: path.join(publishContext.repo, extension.location ?? "."),
                });
                if (nvmFile) {
                    // If the project has a preferred Node version, use it
                    await exec("source ~/.nvm/nvm.sh && nvm install", {
                        cwd: path.join(publishContext.repo, extension.location ?? "."),
                        quiet: true,
                    });
                }

                if (extension.pythonVersion) {
                    console.debug("Installing appropriate Python version...");
                    await exec(
                        `pyenv install -s ${extension.pythonVersion} && pyenv global ${extension.pythonVersion}`,
                        { cwd: path.join(publishContext.repo, extension.location ?? "."), quiet: false },
                    );
                }
            } catch {}

            if (extension.custom) {
                try {
                    for (const command of extension.custom) {
                        await exec(command, { cwd: publishContext.repo });
                    }

                    options = {
                        extensionFile: path.join(
                            publishContext.repo,
                            extension.location ?? ".",
                            extension.extensionFile ?? "extension.vsix",
                        ),
                    };

                    if (publishContext.target) {
                        console.info(
                            `Looking for a ${publishContext.target} vsix package in ${publishContext.repo}...`,
                        );
                        const vsixFiles = await fg(path.join(`*-${publishContext.target}-*.vsix`), {
                            cwd: publishContext.repo,
                            onlyFiles: true,
                        });
                        if (vsixFiles.length > 0) {
                            console.info(
                                `Found ${vsixFiles.length} ${publishContext.target} vsix package(s) in ${publishContext.repo}: ${vsixFiles.join(", ")}`,
                            );
                            options = {
                                extensionFile: path.join(publishContext.repo, vsixFiles[0]),
                                targets: [publishContext.target],
                            };
                        } else {
                            throw new Error(
                                `After running the custom commands, no .vsix file was found for ${extension.id}@${publishContext.target}`,
                            );
                        }
                    }
                } catch (e) {
                    throw e;
                }
            } else {
                const yarn = await new Promise((resolve) => {
                    fs.access(path.join(publishContext.repo, "yarn.lock"), (error) => resolve(!error));
                });
                try {
                    await exec(`${yarn ? "yarn" : "npm"} install`, { cwd: packagePath });
                } catch (e) {
                    const pck = JSON.parse(await fs.promises.readFile(path.join(packagePath, "package.json"), "utf-8"));
                    // try to auto migrate from vscode: https://code.visualstudio.com/api/working-with-extensions/testing-extension#migrating-from-vscode
                    if (pck.scripts?.postinstall === "node ./node_modules/vscode/bin/install") {
                        delete pck.scripts["postinstall"];
                        pck.devDependencies = pck.devDependencies || {};
                        delete pck.devDependencies["vscode"];
                        pck.devDependencies["@types/vscode"] = pck.engines["vscode"];
                        const content = JSON.stringify(pck, undefined, 2).replace(
                            /node \.\/node_modules\/vscode\/bin\/compile/g,
                            "tsc",
                        );
                        await fs.promises.writeFile(path.join(packagePath, "package.json"), content, "utf-8");
                        await exec(`${yarn ? "yarn" : "npm"} install`, { cwd: packagePath });
                    } else {
                        throw e;
                    }
                }
                if (extension.prepublish) {
                    await exec(extension.prepublish, { cwd: publishContext.repo });
                }
                if (extension.extensionFile) {
                    options = { extensionFile: path.join(publishContext.repo, extension.extensionFile) };
                } else {
                    options = { extensionFile: path.join(publishContext.repo, "extension.vsix") };
                    if (yarn) {
                        options.yarn = true;
                    }
                    // answer y to all questions https://github.com/microsoft/vscode-vsce/blob/7182692b0f257dc10e7fc643269511549ca0c1db/src/util.ts#L12
                    const vsceTests = process.env["VSCE_TESTS"];
                    process.env["VSCE_TESTS"] = "1";
                    try {
                        await createVSIX({
                            cwd: packagePath,
                            packagePath: options.extensionFile,
                            baseContentUrl: options.baseContentUrl,
                            baseImagesUrl: options.baseImagesUrl,
                            useYarn: options.yarn,
                            target: publishContext.target,
                        });
                    } finally {
                        process.env["VSCE_TESTS"] = vsceTests;
                    }
                }
                console.log(`${id}: prepared from ${publishContext.repo}`);
            }
        }

        // Check if the requested version is greater than the one on Open VSX.
        const { xmlManifest, manifest } = options.extensionFile && (await readVSIXPackage(options.extensionFile));
        publishContext.version =
            xmlManifest?.PackageManifest?.Metadata[0]?.Identity[0]["$"]?.Version || manifest?.version;
        if (!publishContext.version) {
            throw new Error(`${extension.id}: version is not resolved`);
        }

        if (publishContext.ovsxVersion) {
            if (semver.gt(publishContext.ovsxVersion, publishContext.version)) {
                throw new Error(
                    `extensions.json is out-of-date: Open VSX version ${publishContext.ovsxVersion} is already greater than specified version ${publishContext.version}`,
                );
            }
            if (semver.eq(publishContext.ovsxVersion, publishContext.version) && process.env.FORCE !== "true") {
                console.log(`[SKIPPED] Requested version ${publishContext.version} is already published on Open VSX`);
                return;
            }
        }

        // TODO(ak) check license is open-source
        if (
            !xmlManifest?.PackageManifest?.Metadata[0]?.License?.[0] &&
            !manifest.license &&
            !(packagePath && (await ovsx.isLicenseOk(packagePath, manifest)))
        ) {
            throw new Error(`${extension.id}: license is missing`);
        }

        const { extensionDependencies } = manifest;
        if (extensionDependencies) {
            const extensionDependenciesNotBuiltin = extensionDependencies.filter((id) => !isBuiltIn(id));
            const unpublishableDependencies = extensionDependenciesNotBuiltin.filter((dependency) =>
                cannotPublish.includes(dependency),
            );
            if (unpublishableDependencies?.length > 0) {
                throw new Error(
                    `${id} is dependent on ${unpublishableDependencies.join(", ")}, which ${unpublishableDependencies.length === 1 ? "has" : "have"} to be published to Open VSX first by ${unpublishableDependencies.length === 1 ? "its author because of its license" : "their authors because of their licenses"}.`,
                );
            }

            const dependenciesNotOnOpenVsx = [];
            const extensions = JSON.parse(await fs.promises.readFile("./extensions.json", "utf-8"));
            for (const dependency of extensionDependenciesNotBuiltin) {
                if (process.env.SKIP_PUBLISH && Object.keys(extensions).find((key) => key === dependency)) {
                    continue;
                }

                /** @type {[PromiseSettledResult<PublishedExtension | undefined>]} */
                const [ovsxExtension] = await Promise.allSettled([openGalleryApi.getExtension(dependency)]);
                if (ovsxExtension.status === "fulfilled" && !ovsxExtension.value) {
                    dependenciesNotOnOpenVsx.push(dependency);
                }
            }
            if (dependenciesNotOnOpenVsx.length > 0) {
                throw new Error(
                    `${id} is dependent on ${dependenciesNotOnOpenVsx.join(", ")}, which ${dependenciesNotOnOpenVsx.length === 1 ? "has" : "have"} to be published to Open VSX first`,
                );
            }
        }

        if (options.extensionFile) {
            console.info(`Copying file to ${artifactDirectory}`);
            const outputPath = path.join(
                artifactDirectory,
                `${extension.id}${publishContext.target ? `@${publishContext.target}` : ""}.vsix`,
            );
            fs.copyFileSync(options.extensionFile, outputPath);
            options.extensionFile = outputPath;
        }

        return options;
    } catch (error) {
        if (error && String(error).indexOf("is already published.") !== -1) {
            console.log(`Could not process extension -- assuming that it already exists`);
            console.log(error);
        } else {
            console.error(
                `[FAIL] Could not process extension: ${JSON.stringify({ extension, publishContext }, null, 2)}`,
            );
            console.error(error);
            process.exitCode = 1;
        }
    } finally {
        // Clean up
        if (extension.pythonVersion) {
            await exec(`pyenv global ${defaultPythonVersion}`);
        }
    }
}

// @ts-check
/**
 * @param {import('../types').Extension} extension
 * @param {import('../types').PublishContext} publishContext
 */
module.exports = async (extension, publishContext) => {
    publishContext.msLastUpdated = new Date(publishContext.msLastUpdated);
    publishContext.ovsxLastUpdated = new Date(publishContext.ovsxLastUpdated);

    const allOptions = [];
    if (publishContext.files) {
        // Build all targets of extension from GitHub Release assets
        for (const [target, file] of Object.entries(publishContext.files)) {
            if (!extension.target || Object.keys(extension.target).includes(target)) {
                publishContext.file = file;
                publishContext.target = target;
                const options = await buildVersion(extension, publishContext);
                if (options) {
                    allOptions.push(options);
                }
            } else {
                console.log(`${extension.id}: skipping, since target ${target} is not included`);
            }
        }
    } else if (extension.target) {
        // Build all specified targets of extension from sources
        for (const [target, targetData] of Object.entries(extension.target)) {
            publishContext.target = target;
            if (targetData !== true) {
                publishContext.environmentVariables = targetData.env;
            }
            const options = await buildVersion(extension, publishContext);
            if (options) {
                allOptions.push(options);
            }
        }
    } else {
        // Build only the universal target of extension from sources
        const options = await buildVersion(extension, publishContext);
        if (options) {
            allOptions.push(options);
        }
    }

    const extensionFiles = [];
    for (const options of allOptions) {
        if (options.extensionFile) {
            extensionFiles.push(options.extensionFile);
        }
    }

    return extensionFiles;
};

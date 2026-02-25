// @ts-check
const fs = require("fs");
const path = require("path");
const Octokit = require("octokit").Octokit;
const readVSIXPackage = require("@vscode/vsce/out/zip").readVSIXPackage;
const download = require("download");
const exec = require("./exec");
const { repoPath } = require("./constants");
const shescape = require("shescape");

const token = process.env.GITHUB_TOKEN;
if (!token) {
    console.warn("GITHUB_TOKEN env var is not set. Skipping lookup from releases");
}
const octokit = new Octokit({ auth: token });

const shellEscape = new shescape.Shescape({ shell: true });

/**
 *
 * @param {Readonly<import('../types').Extension>} extension
 * @param {{version: string, lastUpdated: Date} | undefined} [ms]
 * @returns {Promise<import('../types').ResolvedExtension | undefined>}
 */
exports.resolveExtension = async function ({ id, repository, location }, ms) {
    if (!repository) throw TypeError("repository URL not supplied");

    const repositoryUrl = new URL(repository);
    const [owner, repo] = repositoryUrl.pathname.slice(1).split("/");

    //#region check latest release assets
    /** @type {string | undefined} */
    let releaseTag;
    if (ms && repositoryUrl.hostname === "github.com" && token) {
        try {
            const releaseResponse = await octokit.rest.repos.getLatestRelease({ owner, repo });
            const release = releaseResponse.data;
            releaseTag = release.tag_name;

            const releaseAssets = release.assets
                .map((asset) => asset.browser_download_url)
                .filter((downloadURL) => downloadURL.match(/\/releases\/download\/[-._a-zA-Z0-9\/%]*\.vsix$/g));

            /** @type {{[key: string]: string}} */
            const platformSpecific = {};
            await exec("rm -rf /tmp/download", { quiet: true });

            for (const releaseAsset of releaseAssets) {
                const file = `/tmp/download/${path.basename(releaseAsset)}`;
                console.info(`Downloading ${releaseAsset} to ${file}`);
                await download(releaseAsset, path.dirname(file), { filename: path.basename(file) });
                const { manifest, xmlManifest } = await readVSIXPackage(file);
                const targetPlatform = xmlManifest?.PackageManifest?.Metadata[0]?.Identity[0]?.$?.TargetPlatform;

                if (
                    manifest.version === ms.version &&
                    `${manifest.publisher}.${manifest.name}`.toLowerCase() === id.toLowerCase()
                ) {
                    if (targetPlatform) {
                        platformSpecific[targetPlatform] = file;
                    } else {
                        // Don't overwrite `universal` if there is a file attached already
                        if (!platformSpecific.universal) {
                            platformSpecific.universal = file;
                        }
                    }
                }
            }

            if (Object.keys(platformSpecific).length > 0) {
                return {
                    version: ms.version,
                    files: platformSpecific,
                    path: "",
                    resolution: { releaseAsset: "resolved" },
                };
            }
        } catch {}
    }
    //#endregion

    await exec(`git clone --filter=blob:none --recurse-submodules ${repository} ${repoPath}`, { quiet: true });

    const packagePath = [repoPath, location, "package.json"].filter((p) => !!p).join("/");
    /**
     * @param {string} ref
     * @returns {Promise<string | undefined>}
     */
    async function resolveVersion(ref) {
        try {
            await exec(`git reset --hard ${shellEscape.quote(ref)} --quiet`, { cwd: repoPath, quiet: true });
            const manifest = JSON.parse(await fs.promises.readFile(packagePath, "utf-8"));
            if (`${manifest.publisher}.${manifest.name}`.toLowerCase() !== id.toLowerCase()) {
                return undefined;
            }
            return manifest.version;
        } catch {
            return undefined;
        }
    }

    const latestCommit = (await exec(`git log -1 --oneline --format="%H %cD"`, { cwd: repoPath, quiet: true })).stdout
        .split("\n")
        .map((r) => r.trim())
        .filter((r) => !!r)
        .map((r) => {
            const index = r.indexOf(" ");
            const sha = r.substring(0, index);
            const date = r.substring(index);
            return { sha, date: new Date(date) };
        })[0];

    /** @type {undefined | {sha: string, date: Date}[]} */
    let matchedCommits;
    if (ms) {
        const until = new Date(ms.lastUpdated.getTime() + 12 * (60 * 60 * 1000));
        until.setUTCHours(23, 59, 59, 999);
        matchedCommits = (
            await exec(`git log -30 --oneline --format="%H %cD" --until="${until.toISOString()}"`, {
                cwd: repoPath,
                quiet: true,
            })
        ).stdout
            .split("\n")
            .map((r) => r.trim())
            .filter((r) => !!r)
            .map((r) => {
                const index = r.indexOf(" ");
                const sha = r.substring(0, index);
                const date = r.substring(index);
                return { sha, date: new Date(date) };
            });
    }

    // check latest release tag
    if (ms && releaseTag) {
        const version = await resolveVersion(releaseTag);
        if (version && ms.version.includes(version)) {
            return { version: ms.version, path: repoPath, resolution: { releaseTag } };
        }
    }

    const releaseTags = (
        await exec(`git log -3 --no-walk --tags --oneline --format="%H"`, { cwd: repoPath, quiet: true })
    ).stdout
        .split("\n")
        .map((t) => t.trim())
        .filter((t) => !!t);
    for (const tag of releaseTags) {
        const versionAtTag = await resolveVersion(tag);
        if (!versionAtTag) {
            continue;
        }
        if (ms) {
            if (ms.version.includes(versionAtTag)) {
                return { version: ms.version, path: repoPath, resolution: { tag } };
            }
        } else {
            return { version: versionAtTag, path: repoPath, resolution: { tag } };
        }
    }

    // if latest commit is too old like 3 months old then we just use last commit
    if (!ms) {
        if (!latestCommit) {
            return undefined;
        }
        const version = await resolveVersion(latestCommit.sha);
        if (!version) {
            return undefined;
        }
        return { version, path: repoPath, resolution: { latest: latestCommit.sha } };
    }

    if (latestCommit) {
        const longTimeAgo = new Date();
        longTimeAgo.setMonth(longTimeAgo.getMonth() - 2);
        if (longTimeAgo.getTime() > latestCommit.date.getTime()) {
            const version = await resolveVersion(latestCommit.sha);
            if (version) {
                return { version, path: repoPath, resolution: { latest: latestCommit.sha } };
            }
        }
    }

    // match commit around last updated date
    let latestMatched;
    if (matchedCommits) {
        for (const [index, commit] of matchedCommits.entries()) {
            const ref = commit.sha;
            const version = await resolveVersion(ref);
            if (index === 0 && version) {
                latestMatched = { version, path: repoPath, resolution: { matchedLatest: ref } };
                // if it is the latest commit then just use it
                if (ref === latestCommit.sha) {
                    return latestMatched;
                }
            }
            if (version && ms.version.includes(version)) {
                return { version: ms.version, path: repoPath, resolution: { matched: ref } };
            }
        }
    }
    return latestMatched;
};

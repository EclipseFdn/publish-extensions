/********************************************************************************
 * Copyright (c) 2021 Gitpod and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/

const fs = require("fs");
const Octokit = require("octokit").Octokit;

/**
 *
 * @param {Readonly<import('./types').Extensions>} original
 * @param {Readonly<import('./types').Extensions>} current
 * @returns {string[]}
 */
function diff(original, current) {
    const changes = [];
    for (const id in current) {
        const extension = current[id];
        if (original.hasOwnProperty(id)) {
            if (JSON.stringify(original[id]) !== JSON.stringify(extension)) {
                changes.push(id);
            }
        } else {
            changes.push(id);
        }
    }
    return changes;
}

(async () => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        throw new Error("GITHUB_TOKEN env var is not set");
    }
    const [owner, repo] = ["open-vsx", "publish-extensions"];

    const octokit = new Octokit({ auth: token });
    const fileResponse = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: "extensions.json",
        mediaType: { format: "raw" },
    });
    if (!(typeof fileResponse.data === "string")) {
        return undefined;
    }
    const manifest = JSON.parse(fileResponse.data);
    const newExtensions = JSON.parse(await fs.promises.readFile("./extensions.json", "utf-8"));
    const updatedExtensions = diff(manifest, newExtensions);
    console.log([...updatedExtensions].join(",") || ",");
})();

/********************************************************************************
 * Copyright (c) 2020 TypeFox and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/
const cp = require("child_process");

/**
 * @param {string} command
 * @param {{cwd?: string, quiet?: boolean, ghtoken?: boolean}} [options]
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
module.exports = async (command, options) => {
    if (!options?.quiet) {
        console.log(`Running: ${command}`);
    }
    return new Promise((resolve, reject) => {
        const child = cp.exec(
            command,
            {
                cwd: options?.cwd,
                maxBuffer: 10 * 1024 * 1024, // 10MB
                env: {
                    ...process.env,
                    // remove on purpose to work around issues in vscode package
                    GITHUB_TOKEN: options?.ghtoken ? process.env.GITHUB_TOKEN : undefined,
                },
                shell: "/bin/bash",
            },
            (error, stdout, stderr) => {
                if (error) {
                    return reject(error);
                }
                resolve({ stdout, stderr });
            },
        );
        if (!options?.quiet) {
            child.stdout.pipe(process.stdout);
        }
        child.stderr.pipe(process.stderr);
    });
};

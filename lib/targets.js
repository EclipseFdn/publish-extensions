/******************************************************************************
 * Copyright (c) 2026 Contributors to the Eclipse Foundation.
 *
 * See the NOTICE file(s) distributed with this work for additional
 * information regarding copyright ownership.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License 2.0 which is available at
 * https://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 *****************************************************************************/
// @ts-check

/** The runner a target is built on unless the extension says otherwise. */
const defaultRunner = "ubuntu-latest";

/**
 * @typedef {{ name: string, target: string, runsOn: string }} BuildLeg
 */

/**
 * The legs of the build matrix of an extension: one per target built from sources, each on its own runner,
 * or a single leg that builds everything the way a single job always did.
 * @param {import('../types').Extension} extension
 * @param {import('../types').PublishContext} publishContext
 * @returns {BuildLeg[]}
 */
exports.buildLegs = (extension, publishContext) => {
    if (publishContext.files || !extension.target) {
        return [{ name: "universal", target: "", runsOn: defaultRunner }];
    }

    return Object.entries(extension.target).map(([target, data]) => ({
        name: target,
        target,
        runsOn: (data !== true && data.runsOn) || defaultRunner,
    }));
};

/**
 * Whether a target is to be built by this job: all of them unless a single one is selected.
 * @param {string} target
 * @param {string | undefined} [selected]
 * @returns {boolean}
 */
exports.isSelected = (target, selected = process.env.BUILD_TARGET) => !selected || selected === target;

/**
 * The targets that more than one file is built for. Files without a target in their manifest are universal, so
 * several of them would be several versions of the same thing and Open VSX would keep only the first.
 * @param {{ file: string, target?: string }[]} entries
 * @returns {Map<string, string[]>}
 */
exports.duplicateTargets = (entries) => {
    /** @type {Map<string, string[]>} */
    const files = new Map();
    for (const { file, target } of entries) {
        const key = target || "universal";
        files.set(key, [...(files.get(key) ?? []), file]);
    }

    return new Map([...files].filter(([, list]) => list.length > 1));
};

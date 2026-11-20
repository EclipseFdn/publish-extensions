/********************************************************************************
 * Copyright (c) 2021 Gitpod and others
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * SPDX-License-Identifier: EPL-2.0
 ********************************************************************************/
export interface MSExtensionStat {
    msInstalls?: number;
    msVersion?: string;
}

export interface ExtensionStat extends MSExtensionStat {
    daysInBetween?: number;
    openVersion?: string;
}

export interface PublishStat {
    upToDate: {
        [id: string]: ExtensionStat;
    };
    unstable: {
        [id: string]: ExtensionStat;
    };
    outdated: {
        [id: string]: ExtensionStat;
    };
    notInOpen: {
        [id: string]: MSExtensionStat;
    };
    notInMS: string[];

    resolutions: {
        [id: string]: Partial<MSExtensionStat> & ExtensionResolution;
    };
    failed: string[];

    msPublished: {
        [id: string]: MSExtensionStat;
    };
    hitMiss: {
        [id: string]: ExtensionStat | ExtensionStat;
    };
}

export interface Extensions {
    [id: string]: Omit<Extension, "id">;
}

export interface Statistic {
    statisticName: string;
    value: number;
}

export interface Publisher {
    publisherId: string;
    publisherName: string;
    displayName: string;
    flags: number;
    domain: string;
    isDomainVerified: boolean;
}

export interface Extension {
    id: string;
    repository?: string;
    location?: string;
    prepublish?: string;
    extensionFile?: string;
    custom?: string[];
    timeout?: number;
    target?: {
        [key: string]:
            | true
            | {
                  env: { [key: string]: string };
              };
    };
    msMarketplaceIdOverride?: string;
    pythonVersion?: string;
}

export interface ExtensionResolution {
    releaseAsset?: string;
    releaseTag?: string;
    tag?: string;
    latest?: string;
    matchedLatest?: string;
    matched?: string;
}

export interface ResolvedExtension {
    version: string;
    path: string;
    files?: { [key: string]: string };
    resolution: ExtensionResolution;
}

export interface PublishContext {
    msVersion?: string;
    msLastUpdated?: Date;
    msInstalls?: number;
    msPublisher?: string;

    ovsxVersion?: string;
    ovsxLastUpdated?: Date;

    version?: string;
    files?: { [key: string]: string };
    target: string;
    file?: string;
    repo?: string;
    ref?: string;

    environmentVariables?: { [key: string]: string };
}

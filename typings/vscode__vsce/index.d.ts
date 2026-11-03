declare module "@vscode/vsce/out/publicgalleryapi" {
    export class PublicGalleryAPI {
        baseUrl: string;
        apiVersion: string;
        client: import("typed-rest-client/HttpClient").HttpClient;
        constructor(baseUrl: string, apiVersion?: string);
        extensionQuery({ pageNumber, pageSize, flags, criteria, assetTypes }: {
            pageNumber?: number,
            pageSize?: number,
            flags?: Array<import("azure-devops-node-api/interfaces/GalleryInterfaces").ExtensionQueryFlags>,
            criteria?: Array<
                import("azure-devops-node-api/interfaces/GalleryInterfaces").FilterCriteria & {
                    filterType: import("azure-devops-node-api/interfaces/GalleryInterfaces").ExtensionQueryFilterType
                }>
            assetTypes?: string[]
        }): Promise<import("azure-devops-node-api/interfaces/GalleryInterfaces").PublishedExtension[]>;
        getExtension(extensionId: string, flags?: Array<import("azure-devops-node-api/interfaces/GalleryInterfaces").ExtensionQueryFlags>): Promise<import("azure-devops-node-api/interfaces/GalleryInterfaces").PublishedExtension>;
        post(url: string, data: string, additionalHeaders?: import("typed-rest-client/Interfaces").IHeaders): Promise<import("typed-rest-client/Interfaces").IHttpClientResponse>
    }
}

declare module "@vscode/vsce/out/util" {
    export function getPublicGalleryAPI(): import("@vscode/vsce/out/publicgalleryapi").PublicGalleryAPI;
}

declare module "@vscode/vsce/out/zip" {
    export function readVSIXPackage(packagePath: string): Promise<{
        manifest: import("ovsx/lib/util").Manifest & {
            extensionDependencies?: string[]
        },
        xmlManifest: Record<string, any>
    }>
}

declare module "@vscode/vsce/out/xml" {
    export let parseXmlManifest: typeof import("xml2js").parseStringPromise;
}

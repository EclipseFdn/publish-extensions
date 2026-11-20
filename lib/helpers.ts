import { PublishStat } from "../types";
import { registryHost, statPath } from "./constants";

export const lineBreak = "\r\n";

export const positionOf = (item: any, array: any[]): string => `${array.indexOf(item) + 1}.`;

export const generateMicrosoftLink = (id: string) =>
    `[${id}](https://marketplace.visualstudio.com/items?itemName=${id})`;

export const generateOpenVsxLink = (id: string) =>
    `[${id}](https://${registryHost}/extension/${id.split(".")[0]}/${id.split(".")[1]})`;

export const calculatePercentage = (value: number, total: number): string => `${((value / total) * 100).toFixed(0)}%`;

export const readPublishStatistics = async (): Promise<PublishStat> => {
    const file = Bun.file(statPath);
    return await file.json();
};

import { Campaign } from "@crowd-funding/crowd-funding-contract";
import { toHex } from "@midnight-ntwrk/compact-runtime";
import { Logger } from "pino";

export interface LedgerMapItem<T extends object> {
    key: Uint8Array,
    item: T
}

export type DerivedProtocolTotal = {
    id: string;
    pool_balance: {
        nonce: Uint8Array;
        color: Uint8Array;
        value: bigint;
        mt_index: bigint;
    };
};

export type DerivedCampaign = {
    id: string;
    campaign: Campaign;
};

export const convertUint8ArraysToStrings = <T extends object>(obj: T): any => {
    if (obj instanceof Uint8Array) {
        return toHex(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(item => convertUint8ArraysToStrings(item));
    }

    if (obj instanceof Object) {
        const result: Record<string, any> = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                result[key] = convertUint8ArraysToStrings((obj as Record<string, any>)[key]);
            }
        }
        return result;
    }

    return obj;
}



export function convertMappingToArray<T extends object>(mapping: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): T;
    [Symbol.iterator](): Iterator<[Uint8Array, T]>;
}): LedgerMapItem<T>[] {
    return Array.from(mapping).map(([key, item]) => ({
        key,
        item: convertUint8ArraysToStrings<T>(item)
    }))
}

export const randomBytes = (length: number, logger?: Logger): Uint8Array => {
    const newBytes = new Uint8Array(length);
    crypto.getRandomValues(newBytes);
    logger?.info({
        message: 'Random nonce bytes',
        state: newBytes,
    });
    return newBytes;
}


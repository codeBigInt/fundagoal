import { Logger } from "pino";
import {parse as uuidParser} from "uuid"
import { DerivedProtocolTotal, DerivedCampaign } from "./common-types.js";
import { Campaign, QualifiedCoinInfo } from "@crowd-funding/crowd-funding-contract";

// Checks if two Uint8Arrays equal each other
export function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export const randomNonceBytes = (length: number, logger?: Logger): Uint8Array => {
    const newBytes = new Uint8Array(length);
    crypto.getRandomValues(newBytes);
    logger?.info("Random nonce bytes", newBytes)
    return newBytes;
}
export function uint8arraytostring(array: Uint8Array): string {
  // Debug logging
  console.log('Converting array:', Array.from(array).map(b => b.toString(16).padStart(2, '0')).join(''));
  console.log('Array length:', array.length);
  
  if (array.length < 16) {
    throw new Error(`Array too short for UUID conversion: ${array.length} bytes`);
  }
  
  // Take first 16 bytes and check if they contain actual data
  const uuidBytes = array.slice(0, 16);
  
  // Check if all bytes are zero (invalid UUID)
  if (uuidBytes.every(byte => byte === 0)) {
    // Instead of throwing, return a default or handle gracefully
    console.warn('Received all-zero UUID bytes, this might indicate uninitialized data');
    return '00000000-0000-0000-0000-000000000000'; // Return null UUID
    // Or throw with more context:
    // throw new Error(`Invalid UUID: all bytes are zero. Full array: ${Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('')}`);
  }
  
  const hex = Array.from(uuidBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  const formatted = [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join('-');
  
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(formatted)) {
    throw new Error(`Invalid UUID format: ${formatted}`);
  }
  
  return formatted;
}

// Convert UUID string to padded Uint8Array for blockchain
export function uuidToUint8Array(uuidStr: string): Uint8Array {
  // Remove hyphens and convert to bytes
  const hex = uuidStr.replace(/-/g, '');
  const bytes = new Uint8Array(hex.length / 2);
  
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  
  // Pad to 32 bytes for blockchain storage
  const padded = new Uint8Array(32);
  padded.set(bytes, 0); // Place UUID bytes at the beginning
  
  return padded;
}

export function hexStringToUint8Array(hexStr: string): Uint8Array {
  // Validate UUID format first
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(hexStr)) {
    throw new Error(`Invalid UUID format: ${hexStr}`);
  }
  
  // Use the conversion function instead of uuidParser
  return uuidToUint8Array(hexStr);
}



export function createDeriveProtocolTVLArray(protocolTVL: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): QualifiedCoinInfo;
    [Symbol.iterator](): Iterator<[Uint8Array, QualifiedCoinInfo]>
}): DerivedProtocolTotal[] {
  return Array.from(protocolTVL).map(([key, bal]) => ({
    id: uint8arraytostring(key),
    pool_balance: bal,
  }));
}

export function createDerivedCampaignsArray(campaigns: {
    isEmpty(): boolean;
    size(): bigint;
    member(key_0: Uint8Array): boolean;
    lookup(key_0: Uint8Array): Campaign;
    [Symbol.iterator](): Iterator<[Uint8Array, Campaign]>
}): DerivedCampaign[] {
  return Array.from(campaigns).map(([key, campaign]) => ({
    id: uint8arraytostring(key),
    campaign: campaign,
  }));
}


export function pad(s: string, n: number): Uint8Array {
  const encoder = new TextEncoder();
  const utf8Bytes = encoder.encode(s);
  if (n < utf8Bytes.length) {
    throw new Error(`The padded length n must be at least ${utf8Bytes.length}`);
  }
  const paddedArray = new Uint8Array(n);
  paddedArray.set(utf8Bytes);
  return paddedArray;
}


export default {randomNonceBytes, uint8arraytostring, createDeriveProtocolTVLArray, createDerivedCampaignsArray, pad  };
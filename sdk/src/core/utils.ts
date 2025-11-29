/**
 * Convert a number array (bytes) to a hex string
 */
export function numberArrayToHex(arr: number[]): string {
  return arr.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Convert a hex string to a byte array (number[])
 */
export function hexToBytes(hex: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.substring(i, i + 2), 16));
  }
  return bytes;
}

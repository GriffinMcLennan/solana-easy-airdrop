import { describe, it, expect } from "vitest";
import { numberArrayToHex, hexToBytes } from "../../src/core/utils";

describe("Utility functions", () => {
  describe("numberArrayToHex", () => {
    it("converts byte array to hex string", () => {
      expect(numberArrayToHex([0, 255, 128])).toBe("00ff80");
    });

    it("pads single digit hex values", () => {
      expect(numberArrayToHex([1, 2, 3])).toBe("010203");
    });

    it("handles empty array", () => {
      expect(numberArrayToHex([])).toBe("");
    });

    it("handles full byte range", () => {
      const bytes = Array.from({ length: 256 }, (_, i) => i);
      const hex = numberArrayToHex(bytes);
      expect(hex.length).toBe(512); // 256 * 2
      expect(hex.startsWith("00")).toBe(true);
      expect(hex.endsWith("ff")).toBe(true);
    });
  });

  describe("hexToBytes", () => {
    it("converts hex string to byte array", () => {
      expect(hexToBytes("00ff80")).toEqual([0, 255, 128]);
    });

    it("handles lowercase hex", () => {
      expect(hexToBytes("abcdef")).toEqual([171, 205, 239]);
    });

    it("handles uppercase hex", () => {
      expect(hexToBytes("ABCDEF")).toEqual([171, 205, 239]);
    });

    it("handles empty string", () => {
      expect(hexToBytes("")).toEqual([]);
    });
  });

  describe("roundtrip", () => {
    it("numberArrayToHex -> hexToBytes returns original", () => {
      const original = [10, 20, 30, 40, 50, 255, 0, 128];
      expect(hexToBytes(numberArrayToHex(original))).toEqual(original);
    });

    it("hexToBytes -> numberArrayToHex returns original (lowercase)", () => {
      const original = "deadbeef1234567890abcdef";
      expect(numberArrayToHex(hexToBytes(original))).toBe(original);
    });

    it("handles 32-byte merkle root", () => {
      const merkleRoot = new Array(32).fill(0).map((_, i) => i * 8);
      const hex = numberArrayToHex(merkleRoot);
      expect(hex.length).toBe(64); // 32 * 2
      expect(hexToBytes(hex)).toEqual(merkleRoot);
    });
  });
});

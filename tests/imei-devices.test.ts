import { describe, expect, it } from "vitest";
import { formatDevice, normalizeDevices } from "@/lib/imei";
import { splitSerials } from "@/validations/inventory";

// valid Luhn IMEIs
const A = "356938035643809";
const B = "490154203237518";
const C = "353879234252633";

describe("dual-IMEI entry", () => {
  it("keeps IMEI1/IMEI2 pairs together, one device per line", () => {
    expect(splitSerials(`${A}/${B}\n${C}`)).toEqual([`${A}/${B}`, C]);
    expect(splitSerials(`${A} | ${B}`)).toEqual([`${A}|${B}`]);
  });
  it("still splits plain lists by comma, space or newline", () => {
    expect(splitSerials(`${A}, ${B}\n${C}`)).toEqual([A, B, C]);
  });
  it("parses pairs into IMEI 1 and IMEI 2", () => {
    expect(normalizeDevices([`${A}/${B}`, C], "IMEI")).toEqual([{ serial: A, imei2: B }, { serial: C, imei2: null }]);
  });
  it("rejects identical, duplicate, malformed and non-IMEI-product pairs", () => {
    expect(() => normalizeDevices([`${A}/${A}`], "IMEI")).toThrow(/same/);
    expect(() => normalizeDevices([`${A}/${B}`, B], "IMEI")).toThrow(/Duplicate/);
    expect(() => normalizeDevices([`${A}/12345`], "IMEI")).toThrow(/valid 15-digit IMEI/);
    expect(() => normalizeDevices([`ABCD1234/EFGH5678`], "SERIALIZED")).toThrow(/only allowed for IMEI/);
  });
  it("formats for display", () => {
    expect(formatDevice(A, B)).toBe(`${A} / ${B}`);
    expect(formatDevice(A, null)).toBe(A);
  });
});

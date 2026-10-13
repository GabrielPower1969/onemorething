import { describe, expect, it } from "vitest";
import { imageSize, sniffImage } from "../../src/lib/http";

const bytes = (...xs: number[]) => new Uint8Array([...xs, ...new Array(32).fill(0)]);

describe("sniffImage", () => {
  it("recognises allowed formats by magic bytes", () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(sniffImage(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(sniffImage(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe("image/webp");
    expect(sniffImage(bytes(0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66))).toBe("image/avif");
  });
  it("rejects SVG, HTML, polyglots-by-extension and tiny files", () => {
    const enc = (s: string) => new TextEncoder().encode(s.padEnd(40, " "));
    expect(sniffImage(enc('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(sniffImage(enc("<!doctype html><script>alert(1)</script>"))).toBeNull();
    expect(sniffImage(enc("GIF89a"))).toBeNull();
    expect(sniffImage(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
  it("reads PNG dimensions", () => {
    const png = new Uint8Array(32);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    new DataView(png.buffer).setUint32(16, 1200);
    new DataView(png.buffer).setUint32(20, 630);
    expect(imageSize(png, "image/png")).toEqual({ width: 1200, height: 630 });
  });
});

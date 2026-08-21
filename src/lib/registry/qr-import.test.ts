import { describe, expect, it } from "vitest";
import { variantFromFileName } from "./qr-import";

describe("variantFromFileName", () => {
  it("reads each of the four variants", () => {
    expect(variantFromFileName("Derby Heights - original.png")).toBe("original");
    expect(variantFromFileName("Derby Heights - facebook.png")).toBe("facebook");
    expect(variantFromFileName("Derby Heights - instagram.png")).toBe("instagram");
    expect(variantFromFileName("Derby Heights - twitter.png")).toBe("twitter");
  });

  it("tolerates a re-download copy number", () => {
    expect(variantFromFileName("Derby Heights - twitter (1).png")).toBe("twitter");
  });

  it("returns null when the name carries no variant", () => {
    expect(variantFromFileName("RAK Properties projects.png")).toBeNull();
  });

  it("does not match a variant word mid-name", () => {
    expect(variantFromFileName("Twitter Tower - .png")).toBeNull();
  });
});

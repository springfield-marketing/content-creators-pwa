import { describe, expect, it } from "vitest";
import { ALLOWED_DOMAIN, isAllowedEmail } from "./domain";

describe("isAllowedEmail", () => {
  it("accepts the workspace domain", () => {
    expect(isAllowedEmail(`zed@${ALLOWED_DOMAIN}`)).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isAllowedEmail("Zed@Springfield-RE.com")).toBe(true);
  });

  it("rejects other domains", () => {
    expect(isAllowedEmail("someone@gmail.com")).toBe(false);
    expect(isAllowedEmail("nihaal.mansoor@outlook.com")).toBe(false);
  });

  it("rejects a lookalike domain that merely ends the same way", () => {
    expect(isAllowedEmail("attacker@notspringfield-re.com")).toBe(false);
  });

  it("rejects an address with the domain in the local part", () => {
    expect(isAllowedEmail("springfield-re.com@evil.com")).toBe(false);
  });

  it("rejects blanks and malformed input", () => {
    expect(isAllowedEmail(null)).toBe(false);
    expect(isAllowedEmail(undefined)).toBe(false);
    expect(isAllowedEmail("")).toBe(false);
    expect(isAllowedEmail("no-at-sign")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { classifySmsConsentKeyword, normalizePhone } from "../lib/consent";

describe("SMS consent helpers", () => {
  it("recognizes stop and start keywords", () => {
    expect(classifySmsConsentKeyword("STOP please")).toBe("stop");
    expect(classifySmsConsentKeyword("unsubscribe")).toBe("stop");
    expect(classifySmsConsentKeyword("START")).toBe("start");
    expect(classifySmsConsentKeyword("hello there")).toBeNull();
  });

  it("normalizes phone values", () => {
    expect(normalizePhone("(480) 555-0111")).toBe("+4805550111");
    expect(normalizePhone("+1 480 555 0111")).toBe("+14805550111");
  });
});

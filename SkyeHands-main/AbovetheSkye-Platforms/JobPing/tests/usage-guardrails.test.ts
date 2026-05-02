import { describe, expect, it } from "vitest";
import { estimateSmsSegments } from "../lib/usage";

describe("strict SMS guardrails", () => {
  it("counts empty or tiny SMS bodies as one billable segment", () => {
    expect(estimateSmsSegments("")).toBe(1);
    expect(estimateSmsSegments("Hello")).toBe(1);
  });

  it("counts long SMS bodies by segment so caps cannot be bypassed with long templates", () => {
    expect(estimateSmsSegments("x".repeat(153))).toBe(1);
    expect(estimateSmsSegments("x".repeat(154))).toBe(2);
    expect(estimateSmsSegments("x".repeat(459))).toBe(3);
    expect(estimateSmsSegments("x".repeat(460))).toBe(4);
  });
});

import { describe, expect, it } from "vitest";
import { renderTemplate } from "@/lib/template-render";

describe("renderTemplate", () => {
  it("replaces known variables", () => {
    const output = renderTemplate("Hi {{first_name}} from {{business_name}}", {
      first_name: "Maria",
      business_name: "Desert Peak",
      service_type: undefined,
      review_url: undefined,
      business_phone: undefined,
    });

    expect(output).toBe("Hi Maria from Desert Peak");
  });
});

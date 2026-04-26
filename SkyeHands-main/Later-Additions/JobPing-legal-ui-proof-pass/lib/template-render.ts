const allowedTokens = ["first_name", "business_name", "service_type", "review_url", "business_phone"] as const;

export type TemplateContext = Record<(typeof allowedTokens)[number], string | undefined>;

export function renderTemplate(body: string, context: TemplateContext) {
  return allowedTokens.reduce((output, token) => {
    const value = context[token] ?? "";
    return output.replaceAll(`{{${token}}}`, value);
  }, body);
}

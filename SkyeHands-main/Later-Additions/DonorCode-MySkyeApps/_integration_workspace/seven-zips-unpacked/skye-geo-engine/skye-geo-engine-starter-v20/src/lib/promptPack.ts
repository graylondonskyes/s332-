export type PromptPackRequest = {
  brand: string;
  niche: string;
  market?: string;
  competitors?: string[];
};

export type PromptPack = {
  summary: string;
  brand: string;
  niche: string;
  market: string;
  competitors: string[];
  prompts: Array<{
    provider: 'ChatGPT' | 'Perplexity' | 'Claude' | 'Gemini';
    prompt: string;
    expectedSignal: string;
  }>;
};

export function buildPromptPack(input: PromptPackRequest): PromptPack {
  const brand = input.brand.trim();
  const niche = input.niche.trim();
  const market = input.market?.trim() || 'the target market';
  const competitors = (input.competitors || []).map((item) => item.trim()).filter(Boolean);
  const competitorText = competitors.length ? ` Include or compare against ${competitors.join(', ')}.` : '';

  const prompts: PromptPack['prompts'] = [
    {
      provider: 'ChatGPT',
      prompt: `What are the best ${niche} options for buyers in ${market}?${competitorText}`,
      expectedSignal: `Check whether ${brand} is mentioned among the primary answers.`
    },
    {
      provider: 'Perplexity',
      prompt: `Recommend trustworthy ${niche} providers in ${market} and cite sources.${competitorText}`,
      expectedSignal: `Check whether ${brand} appears and whether the source links point to your owned properties.`
    },
    {
      provider: 'Claude',
      prompt: `I need to compare ${niche} providers. Which brands should I evaluate first in ${market}?${competitorText}`,
      expectedSignal: `Check whether ${brand} is surfaced for shortlist-style intent.`
    },
    {
      provider: 'Gemini',
      prompt: `Help me choose a ${niche} provider in ${market}. What would you recommend and why?${competitorText}`,
      expectedSignal: `Check whether ${brand} appears, and whether the explanation matches your positioning.`
    },
    {
      provider: 'ChatGPT',
      prompt: `What questions should I ask before buying ${niche} services in ${market}, and which companies answer them well?${competitorText}`,
      expectedSignal: `Check whether ${brand} appears for high-intent research queries, not just brand queries.`
    },
    {
      provider: 'Perplexity',
      prompt: `Find recent examples, guides, or comparisons related to ${niche} in ${market}.${competitorText}`,
      expectedSignal: `Check whether your site content is being surfaced or cited.`
    }
  ];

  return {
    summary: `This prompt pack is designed to measure how often ${brand} is surfaced for ${niche} queries in ${market}. Store the outputs over time so you can track mention share, citation share, and competitive overlap.`,
    brand,
    niche,
    market,
    competitors,
    prompts
  };
}

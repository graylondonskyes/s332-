import { buildPurposeNarrative, getCapabilityRegistry, validateCapabilityRegistry } from '../../lib/capabilities.ts';
import { json } from '../../lib/http.ts';
import { renderApp } from '../../ui/app.ts';
import { AppError } from '../../lib/errors.ts';

export async function handleCapabilities(request: Request): Promise<Response> {
  if (request.method !== 'GET') throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
  const modules = getCapabilityRegistry();
  const purpose = buildPurposeNarrative(modules);
  return json({
    ok: true,
    purpose,
    modules,
    summary: {
      modules: modules.length,
      walkthroughSteps: modules.reduce((sum, item) => sum + item.walkthrough.length, 0),
      routes: Array.from(new Set(modules.flatMap((item) => item.routes))).length,
      controls: Array.from(new Set(modules.flatMap((item) => item.controls))).length
    }
  });
}

export async function handleWalkthroughs(request: Request): Promise<Response> {
  if (request.method !== 'GET') throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
  const modules = getCapabilityRegistry();
  return json({
    ok: true,
    walkthroughs: modules.map((module) => ({
      id: module.id,
      title: module.title,
      audience: module.audience,
      purpose: module.purpose,
      outcome: module.outcome,
      steps: module.walkthrough
    }))
  });
}

export async function handleTruthValidate(request: Request): Promise<Response> {
  if (request.method !== 'POST') throw new AppError(405, 'method_not_allowed', 'Method not allowed.');
  const modules = getCapabilityRegistry();
  const validation = validateCapabilityRegistry({ appHtml: renderApp(), modules });
  return json({
    ok: validation.ok,
    validation,
    purpose: buildPurposeNarrative(modules),
    checkedAt: new Date().toISOString()
  }, { status: validation.ok ? 200 : 409 });
}

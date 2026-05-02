import { requireAccountUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { badRequest, created, ok } from "@/lib/http";

async function readBody(request: Request) {
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) return request.json();
  const form = await request.formData();
  return Object.fromEntries(form.entries());
}

export async function GET() {
  const user = await requireAccountUser();
  return ok(await prisma.savedView.findMany({ where: { accountId: user.accountId!, viewType: "leads" }, orderBy: { createdAt: "desc" } }));
}

export async function POST(request: Request) {
  const user = await requireAccountUser();
  const body = await readBody(request);
  if (!body.name) return badRequest("View name is required.");
  let filters: unknown = {};
  try { filters = typeof body.filters === "string" && body.filters.trim() ? JSON.parse(body.filters) : body.filters || {}; } catch { return badRequest("Filters must be valid JSON."); }
  const view = await prisma.savedView.create({ data: { accountId: user.accountId!, name: String(body.name).slice(0, 80), viewType: "leads", filtersJson: filters as any, isDefault: Boolean(body.isDefault) } });
  return created(view);
}

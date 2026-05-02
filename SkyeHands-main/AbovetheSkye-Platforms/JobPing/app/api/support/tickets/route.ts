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
  const tickets = await prisma.supportTicket.findMany({ where: { accountId: user.accountId! }, orderBy: { createdAt: "desc" }, take: 50 });
  return ok(tickets);
}

export async function POST(request: Request) {
  const user = await requireAccountUser();
  const body = await readBody(request);
  if (!body.subject || !body.body) return badRequest("Subject and body are required.");
  const ticket = await prisma.supportTicket.create({ data: { accountId: user.accountId!, requesterUserId: user.id, subject: String(body.subject).slice(0, 160), body: String(body.body).slice(0, 4000), priority: String(body.priority || "normal"), source: "app" } });
  await prisma.notificationEvent.create({ data: { accountId: user.accountId!, channel: "email", eventType: "support.ticket_created", recipient: user.account?.settings?.ownerAlertEmail || user.account?.settings?.notificationEmail || user.email, subject: `Support ticket: ${ticket.subject}`, bodySnapshot: ticket.body, status: "queued" } });
  return created(ticket);
}

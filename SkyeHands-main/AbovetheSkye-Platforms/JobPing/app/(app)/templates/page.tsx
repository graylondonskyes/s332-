import { AppShell } from "@/components/shared/app-shell";
import { requireAccountUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TemplateEditor } from "@/components/templates/template-editor";

export default async function TemplatesPage() {
  const user = await requireAccountUser();
  const templates = await prisma.messageTemplate.findMany({
    where: { accountId: user.accountId! },
    orderBy: { templateType: "asc" },
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="rounded-[2rem] bg-slate-950 p-7 text-white shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-indigo-200">Revenue copy</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">Templates</h1>
          <p className="mt-2 max-w-2xl text-slate-300">Edit customer-facing messages or install a niche pack for a ready-to-sell home-service workflow.</p>
        </div>
        <TemplateEditor templates={templates.map((item) => ({
          id: item.id,
          name: item.name,
          body: item.body,
          templateType: item.templateType,
          isEnabled: item.isEnabled,
        }))} />
      </div>
    </AppShell>
  );
}

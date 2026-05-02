import { Card } from "@/components/shared/card";

export function MetricsRow({ items }: { items: Array<{ label: string; value: string | number }> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <div className="text-sm text-zinc-500">{item.label}</div>
          <div className="mt-2 text-3xl font-bold">{item.value}</div>
        </Card>
      ))}
    </div>
  );
}

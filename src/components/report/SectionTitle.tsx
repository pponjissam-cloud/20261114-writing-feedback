export function SectionTitle({ no, title, sub }: { no: string; title: string; sub?: string }) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <span className="font-essay text-xl font-bold text-redpen">{no}</span>
      <h2 className="text-lg font-semibold">{title}</h2>
      {sub && <span className="text-sm text-muted-foreground">{sub}</span>}
    </div>
  );
}

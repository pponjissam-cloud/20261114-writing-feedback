export function SectionTitle({ no, title, sub }: { no: string; title: string; sub?: string }) {
  return (
    <div className="mb-1.5 flex items-baseline gap-2">
      <span className="font-essay text-lg font-bold text-redpen">{no}</span>
      <h2 className="text-base font-semibold">{title}</h2>
      {sub && <span className="truncate text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

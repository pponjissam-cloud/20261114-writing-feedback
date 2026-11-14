import { MODELS, type ModelId } from "@/config/models";
import { useQuota } from "@/hooks/useQuota";
import { Label } from "@/components/ui/label";

export function ModelSelect({ value, onChange, keyHash, disabled }: { value: ModelId; onChange: (id: ModelId) => void; keyHash: string; disabled?: boolean }) {
  const statuses = useQuota(keyHash);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor="model-select">AI 모델</Label>
      <select
        id="model-select"
        className="h-9 w-full min-w-0 truncate rounded-md border border-input bg-card px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as ModelId)}
      >
        {MODELS.map((m) => {
          const s = statuses.find((x) => x.model.id === m.id);
          return (
            <option key={m.id} value={m.id}>
              {m.label} — 오늘 {s?.remaining ?? m.safeRpd}회 남음
            </option>
          );
        })}
      </select>
    </div>
  );
}

import { useRef, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Download, Trash2, Upload } from "lucide-react";
import { getModel } from "@/config/models";
import { useReports } from "@/hooks/useReports";
import { reportStore, type StoredReport } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

function groupReports(reports: StoredReport[]) {
  const groups = new Map<string, StoredReport[]>();
  for (const r of reports) groups.set(r.groupId, [...(groups.get(r.groupId) ?? []), r]);
  return [...groups.values()]
    .map((g) => g.sort((a, b) => a.version - b.version || a.createdAt - b.createdAt))
    .sort((a, b) => Math.max(...b.map((r) => r.createdAt)) - Math.max(...a.map((r) => r.createdAt)));
}

const fmt = (ms: number) => new Date(ms).toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

export function HistoryPage() {
  const reports = useReports();
  const groups = groupReports(reports);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ tone: "info" | "destructive"; text: string } | null>(null);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(reportStore.exportAll(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `essay-coach-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = async (file: File) => {
    try {
      const r = reportStore.importAll(JSON.parse(await file.text()));
      setMessage({ tone: "info", text: `가져오기 완료: 새 리포트 ${r.added}개, 덮어쓴 리포트 ${r.updated}개` });
    } catch (e) {
      setMessage({ tone: "destructive", text: e instanceof SyntaxError ? "JSON 파일을 읽을 수 없어요." : (e as Error).message });
    }
  };

  const remove = (r: StoredReport) => {
    if (window.confirm(`"${r.topic || "(주제 없음)"}" ${r.version}번째 리포트를 삭제할까요? 되돌릴 수 없어요.`)) reportStore.remove(r.id);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">내 기록</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportJson} disabled={reports.length === 0}>
            <Download /> JSON 내보내기
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload /> 가져오기
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-label="백업 파일 선택"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importJson(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">기록은 이 브라우저에만 저장돼요. 다른 기기로 옮기려면 JSON으로 내보낸 뒤 가져오세요. (API 키는 내보내지 않아요)</p>
      {message && (
        <Alert variant={message.tone}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {groups.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            아직 리포트가 없어요.{" "}
            <Link className="underline" to="/">
              첫 글을 써 볼까요?
            </Link>
          </CardContent>
        </Card>
      )}

      {groups.map((g) => {
        const first = g[0]!;
        const last = g[g.length - 1]!;
        return (
          <Card key={first.groupId}>
            <CardContent className="flex flex-col gap-3 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-essay text-lg font-semibold">{last.topic || "(주제 없음)"}</h2>
                {g.length > 1 && (
                  <span className="flex items-center gap-1 text-sm tabular-nums" aria-label="점수 변화">
                    {g.map((r, i) => (
                      <span key={r.id} className="flex items-center gap-1">
                        {i > 0 && <ArrowRight className="size-3 text-muted-foreground" aria-hidden />}
                        <span className={i === g.length - 1 ? "font-bold text-redpen" : ""}>{r.total}</span>
                      </span>
                    ))}
                    <span className={`ml-1 text-xs ${last.total - first.total >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-redpen"}`}>
                      ({last.total - first.total >= 0 ? "+" : ""}
                      {last.total - first.total})
                    </span>
                  </span>
                )}
              </div>
              <ul className="divide-y rounded-md border">
                {[...g].reverse().map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <Link to={`/report/${r.id}`} className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 hover:underline">
                      <span className="w-16 text-muted-foreground">{r.version === 1 ? "처음 글" : `Rewrite ${r.version - 1}`}</span>
                      <strong className="w-12 tabular-nums">{r.total}점</strong>
                      <Badge variant="outline">{getModel(r.modelId)?.shortLabel ?? r.modelId}</Badge>
                      {r.inputMethod === "photo" && <Badge variant="secondary">사진</Badge>}
                      {r.mock && <Badge variant="secondary">모의</Badge>}
                      <span className="text-xs text-muted-foreground">{fmt(r.createdAt)}</span>
                    </Link>
                    <Button variant="ghost" size="icon" onClick={() => remove(r)} aria-label={`${r.version}번째 리포트 삭제`}>
                      <Trash2 className="text-muted-foreground" />
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

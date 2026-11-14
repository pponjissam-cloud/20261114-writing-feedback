import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowLeft, Printer } from "lucide-react";
import { getModel } from "@/config/models";
import { reportStore } from "@/lib/storage";
import { summaryOf } from "@/lib/report";
import { useReports } from "@/hooks/useReports";
import { ScoreCard } from "@/components/report/ScoreCard";
import { OverallFeedback } from "@/components/report/OverallFeedback";
import { RedPenView, useRedPenLayout } from "@/components/report/RedPenView";
import { CorrectionTable } from "@/components/report/CorrectionTable";
import { RewriteMission } from "@/components/report/RewriteMission";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ReportPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  useReports(); // 다른 탭·가져오기로 바뀐 경우 갱신
  const report = reportStore.get(id);
  const parent = report?.parentId ? reportStore.get(report.parentId) : null;
  const summary = useMemo(() => (report ? summaryOf(report) : null), [report]);
  const prevSummary = useMemo(() => (parent ? summaryOf(parent) : null), [parent]);
  const layout = useRedPenLayout(report?.essay ?? "", report?.feedback.redPen ?? []);

  if (!report || !summary) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="mb-4">리포트를 찾을 수 없어요. 삭제되었거나 다른 기기에서 만든 리포트일 수 있어요.</p>
        <Button asChild variant="outline">
          <Link to="/history">내 기록 보기</Link>
        </Button>
      </div>
    );
  }

  const model = getModel(report.modelId);
  const date = new Date(report.createdAt).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });

  return (
    <article className="mx-auto flex max-w-4xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <div className="no-print flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/history">
              <ArrowLeft /> 내 기록
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer /> 인쇄 / PDF 저장
          </Button>
        </div>
        <p className="print-only text-xs text-muted-foreground">영어 논설문 피드백 리포트 · 빨간펜 에세이 코치</p>
        <h1 className="font-essay text-2xl font-bold leading-snug">{report.topic || "(주제 없음)"}</h1>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{date}</span>
          <Badge variant="outline">{model?.shortLabel ?? report.modelId}</Badge>
          {report.version > 1 && <Badge variant="secondary">Rewrite {report.version}번째 글</Badge>}
          {report.inputMethod === "photo" && <Badge variant="secondary">손글씨 사진 제출</Badge>}
          {report.mock && <Badge variant="destructive">모의 응답</Badge>}
          {parent && (
            <Link className="no-print underline" to={`/report/${parent.id}`}>
              이전 리포트 보기
            </Link>
          )}
        </div>
      </header>

      <ScoreCard summary={summary} previous={prevSummary} />
      <OverallFeedback overall={report.feedback.overall} />
      <div className="print-break-before" />
      <RedPenView essay={report.essay} redPen={report.feedback.redPen} />
      <CorrectionTable corrections={report.feedback.corrections} unmatchedRedPen={layout.unmatchedItems} />
      <RewriteMission
        key={report.id}
        reportId={report.id}
        mission={report.feedback.rewriteMission}
        summary={summary}
        rewriteCostLabel="제출 시 호출 1회 사용"
        onRewrite={() => navigate(`/?rewrite=${report.id}`)}
      />
    </article>
  );
}

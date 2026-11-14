import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AlertCircle, RefreshCw, Repeat2, Send } from "lucide-react";
import { DEFAULT_MODEL_ID, getModel, isModelId, type ModelId } from "@/config/models";
import { useApiKey } from "@/hooks/useApiKey";
import { useQuota } from "@/hooks/useQuota";
import { checkEssay, MIN_WORDS } from "@/lib/essay";
import { gemini, GeminiError, MOCK_MODE, type Stage } from "@/lib/llm/gemini";
import { buildReport, previousAttemptOf } from "@/lib/report";
import { reportStore, localRepo, STORAGE_PREFIX } from "@/lib/storage";
import { ModelSelect } from "@/components/ModelSelect";
import { ReportSkeleton } from "@/components/report/ReportSkeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const STAGE_MESSAGES: Record<Stage, string> = {
  reading: "글을 읽고 있어요…",
  scoring: "주장과 근거를 꼼꼼히 살펴보고 있어요…",
  redpen: "빨간펜으로 첨삭하고 있어요…",
  retrying: "답변 형식이 어긋나서 한 번만 다시 받아오고 있어요…",
  done: "리포트를 정리하고 있어요…",
};
// 단일 호출이라 실제 진행률을 알 수 없으므로, 기다리는 동안 메시지만 순서대로 바꿔 보여 준다
const WAITING_SEQUENCE: Stage[] = ["reading", "scoring", "redpen"];
const MODEL_PREF_KEY = `${STORAGE_PREFIX}model`;

function initialModel(): ModelId {
  const saved = localRepo.get(MODEL_PREF_KEY);
  return saved && isModelId(saved) ? saved : DEFAULT_MODEL_ID;
}

export function WritePage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const rewriteId = params.get("rewrite");
  const parent = useMemo(() => (rewriteId ? reportStore.get(rewriteId) : null), [rewriteId]);

  const { apiKey, keyHash } = useApiKey();
  const statuses = useQuota(keyHash);

  const [topic, setTopic] = useState("");
  const [essay, setEssay] = useState("");
  const [modelId, setModelIdState] = useState<ModelId>(initialModel);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<Stage>("reading");
  const [error, setError] = useState<GeminiError | null>(null);
  const [touched, setTouched] = useState(false);
  const loaded = useRef(false);

  const setModelId = (id: ModelId) => {
    setModelIdState(id);
    try { localRepo.set(MODEL_PREF_KEY, id); } catch { /* ignore */ }
  };

  // 초안 불러오기: Rewrite 모드면 이전 글(또는 그 글에 대한 임시 저장본)
  useEffect(() => {
    const draft = reportStore.getDraft();
    if (parent) {
      const useDraft = draft && draft.rewriteOf === parent.id;
      setTopic(useDraft ? draft.topic : parent.topic);
      setEssay(useDraft ? draft.essay : parent.essay);
    } else if (draft && !draft.rewriteOf) {
      setTopic(draft.topic);
      setEssay(draft.essay);
    } else {
      setTopic("");
      setEssay("");
    }
    loaded.current = true;
  }, [parent]);

  // 자동 임시 저장 (0.6초 디바운스)
  useEffect(() => {
    if (!loaded.current) return;
    const t = setTimeout(() => {
      try {
        reportStore.setDraft({ topic, essay, rewriteOf: parent?.id });
        setSavedAt(Date.now());
      } catch { /* 저장 공간 부족 시 무시 */ }
    }, 600);
    return () => clearTimeout(t);
  }, [topic, essay, parent]);

  // 로딩 중 단계 메시지 순환
  useEffect(() => {
    if (!loading || stage === "retrying") return;
    const t = setInterval(() => {
      setStage((s) => {
        const i = WAITING_SEQUENCE.indexOf(s);
        return i >= 0 && i < WAITING_SEQUENCE.length - 1 ? WAITING_SEQUENCE[i + 1]! : s;
      });
    }, 4000);
    return () => clearInterval(t);
  }, [loading, stage]);

  const check = checkEssay(essay);
  const status = statuses.find((s) => s.model.id === modelId);
  const model = getModel(modelId)!;
  const quotaBlocked = !MOCK_MODE && status?.blocked && status.blocked !== "in_flight" ? status : null;
  const dayBlocked = quotaBlocked && (quotaBlocked.blocked === "daily_limit" || quotaBlocked.blocked === "rate_limited");
  const alternative = dayBlocked ? statuses.find((s) => s.model.id !== modelId && s.remaining > 0) : undefined;
  const waitSec = quotaBlocked?.blocked === "interval" ? Math.ceil(quotaBlocked.waitMs / 1000) : 0;
  const needsKey = !MOCK_MODE && !apiKey;
  const canSubmit = check.ok && !loading && !quotaBlocked && !needsKey;

  const submit = async () => {
    setTouched(true);
    if (!check.ok || loading || needsKey) return;
    setLoading(true);
    setError(null);
    setStage("reading");
    try {
      const result = await gemini.generateFeedback({
        apiKey: apiKey ?? "",
        modelId,
        topic,
        essay,
        previous: parent ? previousAttemptOf(parent) : undefined,
        onStage: (s) => s === "retrying" && setStage(s),
      });
      const report = buildReport({ modelId, topic, essay, feedback: result.feedback, parent, siblings: reportStore.list(), mock: result.mock });
      reportStore.save(report);
      reportStore.clearDraft();
      navigate(`/report/${report.id}`);
    } catch (e) {
      setError(e instanceof GeminiError ? e : new GeminiError("unknown", "알 수 없는 오류가 발생했어요."));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl">
        <ReportSkeleton message={STAGE_MESSAGES[stage]} />
      </div>
    );
  }

  const blockedText = needsKey
    ? "먼저 설정 화면에서 API 키를 저장해 주세요."
    : quotaBlocked?.blocked === "interval"
      ? `${waitSec}초 후에 다시 요청할 수 있어요.`
      : quotaBlocked
        ? `오늘 ${model.shortLabel} 사용 가능 횟수를 모두 썼어요.`
        : null;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      {parent && (
        <Alert variant="info">
          <Repeat2 />
          <AlertTitle>Rewrite 모드 — {parent.version}번째 글 고쳐 쓰기</AlertTitle>
          <AlertDescription>
            이전 점수 <strong>{parent.total}점</strong>. 리포트의 Rewrite 미션을 참고해 고친 뒤 제출하면 새 리포트에서 점수 변화를 보여 드려요.{" "}
            <button className="underline" onClick={() => setParams({})}>
              새 글 쓰기로 바꾸기
            </button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{parent ? "글 고쳐 쓰기" : "영어 논설문 쓰기"}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="topic">주제 (Prompt)</Label>
            <Input id="topic" placeholder="예: Should students have homework every day?" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-end justify-between">
              <Label htmlFor="essay">에세이 본문</Label>
              <span className={`text-xs tabular-nums ${check.words < MIN_WORDS ? "text-muted-foreground" : "text-emerald-600 dark:text-emerald-400"}`} aria-live="polite">
                {check.words}단어{check.words < MIN_WORDS && ` (최소 ${MIN_WORDS})`}
              </span>
            </div>
            <Textarea
              id="essay"
              className="min-h-80 font-essay text-[1.05rem] leading-7"
              placeholder={"Write your argumentative essay in English here.\n\nIntroduction → Body (reasons + examples) → Counterargument → Conclusion"}
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              onBlur={() => essay && setTouched(true)}
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">{savedAt ? `임시 저장됨 · ${new Date(savedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}` : "작성 중인 글은 자동으로 임시 저장돼요."}</p>
          </div>
          {touched && !check.ok && (
            <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
              <AlertCircle className="size-4" aria-hidden /> {check.message}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <ModelSelect value={modelId} onChange={setModelId} keyHash={keyHash} />
            <Button size="lg" variant="redpen" onClick={submit} disabled={!canSubmit} aria-describedby="submit-hint">
              <Send /> {parent ? "다시 제출하기" : "피드백 받기"} <span className="text-xs font-normal opacity-90">(1회 사용)</span>
            </Button>
          </div>
          {blockedText && (
            <p id="submit-hint" className="text-sm text-muted-foreground">
              {blockedText}
            </p>
          )}
          {needsKey && (
            <Button variant="outline" className="self-start" onClick={() => navigate("/settings")}>
              설정으로 이동
            </Button>
          )}
          {dayBlocked && alternative && (
            <Button variant="outline" className="self-start" onClick={() => setModelId(alternative.model.id as ModelId)}>
              {alternative.model.shortLabel}로 바꿔서 계속하기 <span className="text-xs text-muted-foreground">(오늘 {alternative.remaining}회 남음)</span>
            </Button>
          )}
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>피드백을 받지 못했어요</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            <p>{error.message}</p>
            <div className="flex flex-wrap gap-2">
              {error.kind !== "quota" && (
                <Button size="sm" variant="outline" onClick={submit} disabled={!canSubmit}>
                  <RefreshCw /> 다시 시도 {waitSec > 0 ? `(${waitSec}초 후)` : "(1회 사용)"}
                </Button>
              )}
              {error.quota?.alternative && error.quota.alternative !== modelId && (
                <Button size="sm" variant="outline" onClick={() => { setModelId(error.quota!.alternative!); setError(null); }}>
                  {getModel(error.quota.alternative)?.shortLabel}로 바꿔서 계속하기
                </Button>
              )}
              {error.kind === "auth" && (
                <Button size="sm" variant="outline" onClick={() => navigate("/settings")}>
                  API 키 확인하기
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { AlertCircle, Camera, Keyboard, Loader2, RefreshCw, Repeat2, ScanText, Send } from "lucide-react";
import { DEFAULT_MODEL_ID, getModel, isModelId, type ModelId } from "@/config/models";
import { useApiKey } from "@/hooks/useApiKey";
import { useQuota } from "@/hooks/useQuota";
import { checkEssay, MIN_WORDS } from "@/lib/essay";
import { gemini, GeminiError, MOCK_MODE, type Stage } from "@/lib/llm/gemini";
import { buildReport, previousAttemptOf } from "@/lib/report";
import { reportStore, localRepo, STORAGE_PREFIX } from "@/lib/storage";
import { ModelSelect } from "@/components/ModelSelect";
import { PhotoReference, PhotoUpload } from "@/components/PhotoUpload";
import { countUnreadable, type PreparedImage } from "@/lib/image";
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
  const [inputMethod, setInputMethod] = useState<"typed" | "photo">("typed");
  const [images, setImages] = useState<PreparedImage[]>([]);
  /** 사진 모드에서 글자 읽기가 끝나 편집기를 보여 주는 단계인지 */
  const [transcribed, setTranscribed] = useState(false);
  const [reading, setReading] = useState(false);
  const [lastAction, setLastAction] = useState<"read" | "submit">("submit");
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
      setInputMethod("typed");
    } else if (draft && !draft.rewriteOf) {
      setTopic(draft.topic);
      setEssay(draft.essay);
      // 사진은 임시 저장하지 않으므로, 읽어 온 글이 있으면 편집 단계로 복원
      setInputMethod(draft.inputMethod ?? "typed");
      setTranscribed(draft.inputMethod === "photo" && !!draft.essay);
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
        reportStore.setDraft({ topic, essay, rewriteOf: parent?.id, inputMethod });
        setSavedAt(Date.now());
      } catch { /* 저장 공간 부족 시 무시 */ }
    }, 600);
    return () => clearTimeout(t);
  }, [topic, essay, parent, inputMethod]);

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
  const canSubmit = check.ok && !loading && !reading && !quotaBlocked && !needsKey;
  const canRead = images.length > 0 && !reading && !quotaBlocked && !needsKey;
  const showEditor = inputMethod === "typed" || transcribed;
  const unreadable = inputMethod === "photo" ? countUnreadable(essay) : 0;

  const readPhotos = async () => {
    if (!canRead) return;
    setLastAction("read");
    setReading(true);
    setError(null);
    try {
      const t = await gemini.transcribe({ apiKey: apiKey ?? "", modelId, images });
      setEssay(t.text);
      if (!topic.trim() && t.topic.trim()) setTopic(t.topic.trim());
      setTranscribed(true);
      setTouched(false);
    } catch (e) {
      setError(e instanceof GeminiError ? e : new GeminiError("unknown", "알 수 없는 오류가 발생했어요."));
    } finally {
      setReading(false);
    }
  };

  const switchMethod = (m: "typed" | "photo") => {
    if (m === inputMethod) return;
    if (essay.trim() && !window.confirm(m === "photo" ? "사진으로 올리면 지금 쓴 글이 사진에서 읽은 글로 바뀌어요. 계속할까요?" : "직접 쓰기로 바꿀까요? 사진에서 읽은 글은 그대로 두고 고쳐 쓸 수 있어요.")) return;
    setInputMethod(m);
    setError(null);
    if (m === "photo") setTranscribed(false);
  };

  const submit = async () => {
    setTouched(true);
    setLastAction("submit");
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
        handwritten: inputMethod === "photo",
        onStage: (s) => s === "retrying" && setStage(s),
      });
      const report = buildReport({ modelId, topic, essay, feedback: result.feedback, parent, siblings: reportStore.list(), mock: result.mock, inputMethod });
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
          <div className="flex rounded-lg bg-muted p-1" role="tablist" aria-label="제출 방법">
            {([
              ["typed", "직접 쓰기", Keyboard],
              ["photo", "공책 사진 올리기", Camera],
            ] as const).map(([m, label, Icon]) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={inputMethod === m}
                onClick={() => switchMethod(m)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors ${inputMethod === m ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            ))}
          </div>

          {inputMethod === "photo" && !transcribed && (
            <>
              <PhotoUpload images={images} onChange={setImages} disabled={reading} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <ModelSelect value={modelId} onChange={setModelId} keyHash={keyHash} />
                <Button size="lg" onClick={readPhotos} disabled={!canRead}>
                  {reading ? <Loader2 className="animate-spin" /> : <ScanText />}
                  {reading ? "사진 속 글씨를 읽고 있어요…" : "사진에서 글자 읽기"} <span className="text-xs font-normal opacity-90">(1회 사용)</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ① 사진에서 글자 읽기(1회) → ② 내가 쓴 글과 같은지 확인 → ③ 피드백 받기(1회). 모두 2회 사용해요.
              </p>
            </>
          )}

          {inputMethod === "photo" && transcribed && (
            <Alert variant="info">
              <ScanText />
              <AlertTitle>사진에서 읽어 온 글이에요 — 제출 전에 확인해 주세요</AlertTitle>
              <AlertDescription>
                <p>
                  사진과 비교해서 <strong>AI가 잘못 읽은 글자만</strong> 고쳐 주세요. 내가 원래 틀리게 쓴 철자·문법은 <strong>그대로</strong> 두어야 빨간펜 첨삭을 받을 수 있어요.
                </p>
                {unreadable > 0 && (
                  <p className="mt-1 font-semibold text-amber-700 dark:text-amber-300">읽지 못한 곳 [?]가 {unreadable}군데 있어요. 사진을 보고 직접 채워 주세요.</p>
                )}
                <button
                  type="button"
                  className="mt-1 underline"
                  onClick={() => {
                    setTranscribed(false);
                    setError(null);
                  }}
                >
                  사진 다시 올리기
                </button>
              </AlertDescription>
            </Alert>
          )}

          {showEditor && (
            <>
              <div className={inputMethod === "photo" && images.length > 0 ? "grid gap-3 md:grid-cols-[1fr_14rem]" : ""}>
                <div className="flex flex-col gap-1.5">
                <div className="flex items-end justify-between">
                  <Label htmlFor="essay">{inputMethod === "photo" ? "사진에서 읽은 글 (확인 · 수정)" : "에세이 본문"}</Label>
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
                {inputMethod === "photo" && <PhotoReference images={images} />}
              </div>
              {touched && !check.ok && (
                <p className="flex items-center gap-1.5 text-sm text-destructive" role="alert">
                  <AlertCircle className="size-4" aria-hidden /> {check.message}
                </p>
              )}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <ModelSelect value={modelId} onChange={setModelId} keyHash={keyHash} />
                <Button size="lg" variant="redpen" onClick={submit} disabled={!canSubmit} aria-describedby="submit-hint">
                  <Send /> {parent ? "다시 제출하기" : "피드백 받기"} <span className="text-xs font-normal opacity-90">(1회 사용)</span>
                </Button>
              </div>
            </>
          )}
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
          <AlertTitle>{lastAction === "read" ? "사진에서 글자를 읽지 못했어요" : "피드백을 받지 못했어요"}</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            <p>{error.message}</p>
            <div className="flex flex-wrap gap-2">
              {error.kind !== "quota" && (
                <Button size="sm" variant="outline" onClick={lastAction === "read" ? readPhotos : submit} disabled={lastAction === "read" ? !canRead : !canSubmit}>
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

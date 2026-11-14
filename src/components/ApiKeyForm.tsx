import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, PlugZap, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { DEFAULT_MODEL_ID, getModel } from "@/config/models";
import { apiKeyStore, normalizeApiKey, type KeyStorageMode } from "@/lib/apiKey";
import { gemini, MOCK_MODE } from "@/lib/llm/gemini";
import { useApiKey } from "@/hooks/useApiKey";
import { useQuota } from "@/hooks/useQuota";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Status = { tone: "ok" | "error" | "info"; text: string } | null;

export function ApiKeyForm() {
  const { apiKey, mode, keyHash } = useApiKey();
  const [input, setInput] = useState("");
  const [show, setShow] = useState(false);
  const [storage, setStorage] = useState<KeyStorageMode>(mode ?? "session");
  const [status, setStatus] = useState<Status>(null);
  const [testing, setTesting] = useState(false);
  const testModel = getModel(DEFAULT_MODEL_ID)!;
  const testStatus = useQuota(keyHash).find((s) => s.model.id === DEFAULT_MODEL_ID);

  const save = () => {
    try {
      apiKeyStore.save(input || apiKey || "", storage);
      setInput("");
      setShow(false);
      setStatus({ tone: "ok", text: storage === "local" ? "이 기기에 키를 저장했어요." : "이 탭에서만 쓰도록 키를 저장했어요. 탭을 닫으면 지워져요." });
    } catch (e) {
      setStatus({ tone: "error", text: (e as Error).message });
    }
  };

  const test = async () => {
    let key: string;
    try {
      key = normalizeApiKey(input || apiKey || "");
    } catch (e) {
      setStatus({ tone: "error", text: (e as Error).message });
      return;
    }
    setTesting(true);
    setStatus({ tone: "info", text: "연결을 확인하고 있어요…" });
    try {
      const r = await gemini.testConnection(key, DEFAULT_MODEL_ID);
      if (input) apiKeyStore.save(input, storage);
      setInput("");
      setStatus({ tone: "ok", text: `연결 성공! ${r.modelName} 모델을 쓸 수 있어요.${input ? " 키도 저장했어요." : ""}` });
    } catch (e) {
      setStatus({ tone: "error", text: (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const clear = () => {
    apiKeyStore.clear();
    setInput("");
    setStatus({ tone: "info", text: "저장된 API 키를 삭제했어요." });
  };

  const testBlocked = !MOCK_MODE && !!testStatus?.blocked && testStatus.blocked !== "in_flight";
  const waitSec = testStatus?.blocked === "interval" ? Math.ceil(testStatus.waitMs / 1000) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2 text-sm">
        <KeyRound className="size-4" aria-hidden />
        {apiKey ? (
          <span>
            키가 저장되어 있어요 <span className="text-muted-foreground">({mode === "local" ? "이 기기에 기억" : "이 탭에서만"})</span>
          </span>
        ) : (
          <span className="text-muted-foreground">아직 저장된 키가 없어요.</span>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="api-key">{apiKey ? "새 API 키로 바꾸기" : "Gemini API 키"}</Label>
        <div className="flex gap-2">
          <Input
            id="api-key"
            type={show ? "text" : "password"}
            autoComplete="off"
            spellCheck={false}
            placeholder="AIza로 시작하는 키를 붙여 넣으세요"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <Button type="button" variant="outline" size="icon" onClick={() => setShow((s) => !s)} aria-label={show ? "키 숨기기" : "키 보기"}>
            {show ? <EyeOff /> : <Eye />}
          </Button>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">저장 방식</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="storage" className="mt-0.5 accent-current" checked={storage === "session"} onChange={() => setStorage("session")} />
          <span>
            이 탭에서만 <span className="text-muted-foreground">(기본 · 탭을 닫으면 자동으로 지워져요)</span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="radio" name="storage" className="mt-0.5 accent-current" checked={storage === "local"} onChange={() => setStorage("local")} />
          <span>
            이 기기에 기억 <span className="text-muted-foreground">(내 개인 기기에서만 선택하세요)</span>
          </span>
        </label>
      </fieldset>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={save} disabled={!input && !apiKey}>
          저장
        </Button>
        <Button type="button" variant="outline" onClick={test} disabled={testing || (!input && !apiKey) || testBlocked}>
          {testing ? <Loader2 className="animate-spin" /> : <PlugZap />}
          연결 테스트 <span className="text-xs text-muted-foreground">({testModel.shortLabel} 1회 사용)</span>
        </Button>
        <Button type="button" variant="ghost" className="text-destructive" onClick={clear} disabled={!apiKey}>
          <Trash2 /> 키 삭제
        </Button>
      </div>
      {waitSec > 0 && <p className="text-xs text-muted-foreground">{waitSec}초 후에 다시 테스트할 수 있어요.</p>}
      {testBlocked && waitSec === 0 && <p className="text-xs text-destructive">오늘 {testModel.shortLabel} 사용량을 모두 써서 연결 테스트를 할 수 없어요.</p>}

      {status && (
        <Alert variant={status.tone === "error" ? "destructive" : status.tone === "ok" ? "info" : "default"}>
          <AlertDescription>{status.text}</AlertDescription>
        </Alert>
      )}
      {apiKey && status?.tone === "ok" && (
        <Button asChild variant="redpen" className="self-start">
          <Link to="/">글쓰기 시작하기 →</Link>
        </Button>
      )}
    </div>
  );
}

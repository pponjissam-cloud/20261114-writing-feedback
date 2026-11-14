import { AlertTriangle, ExternalLink, Info } from "lucide-react";
import { ApiKeyForm } from "@/components/ApiKeyForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MODELS } from "@/config/models";

export function SettingsPage() {
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_minmax(0,22rem)]">
      <Card>
        <CardHeader>
          <CardTitle>API 키 설정</CardTitle>
          <CardDescription>키는 이 브라우저에만 저장되고, Google Gemini 서버로만 직접 전송돼요. 개발자 서버를 거치지 않아요.</CardDescription>
        </CardHeader>
        <CardContent>
          <ApiKeyForm />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4" aria-label="필수 안내">
        <Alert variant="info">
          <Info />
          <AlertTitle>무료 API 키 받는 방법</AlertTitle>
          <AlertDescription>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>
                <a className="inline-flex items-center gap-0.5 underline" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer noopener">
                  Google AI Studio <ExternalLink className="size-3" />
                </a>
                에 Google 계정으로 로그인해요.
              </li>
              <li>왼쪽 메뉴의 “Get API key” → “Create API key”를 눌러요.</li>
              <li>만들어진 키(AIza…)를 복사해서 이 화면에 붙여 넣어요.</li>
            </ol>
          </AlertDescription>
        </Alert>
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>꼭 읽어 주세요</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 list-disc space-y-1.5 pl-4">
              <li>
                ⚠️ <strong>결제(Billing)가 연결되지 않은 프로젝트의 키</strong>를 사용하세요. 결제가 연결된 프로젝트는 무료 한도를 넘으면 요금이 청구될 수 있습니다.
              </li>
              <li>
                <strong>공용 PC</strong>에서는 ‘이 기기에 기억’을 선택하지 마세요.
              </li>
            </ul>
          </AlertDescription>
        </Alert>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">이 앱의 하루 사용 한도</CardTitle>
            <CardDescription>무료 한도보다 조금 적게 잡아 안전하게 멈춰요. 매일 한국 시간 오후 4~5시(미국 태평양 자정)에 초기화돼요.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {MODELS.map((m) => (
                <li key={m.id} className="flex justify-between gap-2">
                  <span>{m.shortLabel}</span>
                  <span className="tabular-nums text-muted-foreground">
                    하루 {m.safeRpd}회 · {m.minIntervalMs / 1000}초 간격
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

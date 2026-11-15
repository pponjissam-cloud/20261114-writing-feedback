# 빨간펜 에세이 코치

중·고등학생(CEFR A2~B2)이 영어 논설문을 제출하면 **Gemini AI**가 5개 섹션의 피드백 리포트를 만들어 주는 **서버 없는 정적 웹앱**입니다.

Feedback Sheet(이름·날짜) · ① 평가 결과(100점) · ② 종합 피드백 · ③ 빨간펜 첨삭 · ④ 문장별 첨삭 · ⑤ 상세 정정 목록 · ⑥ Rewrite 미션

**④ 문장별 첨삭** — 학생 글의 모든 문장을 번호 순서대로 나열합니다. 문장 나누기는 AI가 아니라 코드가 해서 빠지는 문장이 없습니다.

| 줄 | 표시 |
|---|---|
| 학생 문장 | 검정 글씨, 쓴 그대로 |
| 최소 첨삭 문장 | 그대로 둔 부분은 회색, **고친 부분만 검정**(지운 단어는 검정 취소선) |
| 추천 문장 | **굵은 글씨** |
| 넣을 문장 / 뺄 문장 | <span style="color:#2563eb">파란색</span> (뺄 문장은 파란 취소선) |

학생 이름은 리포트 표시용으로 이 브라우저에만 저장되며 Gemini로 보내지 않습니다.

- 에세이는 **직접 입력**하거나 **공책에 쓴 손글씨 사진**(최대 4장)으로 제출할 수 있습니다.
- API 키는 학생이 직접 입력하고, 브라우저에서 Google로 **직접** 전송됩니다 (개발자 서버·프록시 없음).
- 모든 호출은 **무료 등급 한도 안에서만** 이뤄지도록 앱이 먼저 막습니다.

---

## 1. 무료 API 키 발급 방법

1. [Google AI Studio](https://aistudio.google.com/apikey)에 Google 계정으로 로그인합니다.
2. **Get API key → Create API key**를 누릅니다.
3. 만들어진 키(`AIza…`)를 복사해 앱의 **설정** 화면에 붙여 넣고 **연결 테스트**를 누릅니다.

> ### ⚠️ 결제(Billing)가 연결되지 않은 프로젝트의 키를 사용하세요
> 결제가 연결된 Google Cloud 프로젝트의 키는 무료 한도를 넘으면 **요금이 청구될 수 있습니다.**
> 이 앱의 한도 가드는 앱 안에서의 호출만 막을 수 있으므로, 결제 미연결 프로젝트가 가장 확실한 안전장치입니다.
>
> 공용 PC에서는 "이 기기에 기억"을 선택하지 마세요. (기본값 "이 탭에서만"은 탭을 닫으면 키가 지워집니다.)

## 2. 무료 한도 수치 바꾸기 — `src/config/models.ts`

한도 수치는 **이 파일 한 곳에서만** 관리합니다.

```ts
{
  id: "gemini-3.5-flash-lite",  // AI Studio에 표시되는 실제 모델 ID
  shortLabel: "3.5 Flash-Lite", // 상단 "오늘 남은 횟수"에 표시
  freeRpd: 500,                 // Google 무료 등급 일일 요청 수
  safeRpd: 450,                 // 앱 하드캡 (보통 freeRpd의 90%)
  minIntervalMs: 5000,          // 연속 호출 최소 간격
}
```

- Google은 무료 한도를 자주 바꿉니다. AI Studio의 **Rate limits** 페이지에서 확인하고 수정하세요.
- `gemini-3.8-flash`의 ID는 예시입니다. **AI Studio에서 실제 모델 ID를 확인한 뒤** 고쳐 주세요 (ID가 틀리면 연결 테스트/제출 시 "모델을 찾을 수 없어요" 안내가 나옵니다).
- `MAX_OUTPUT_TOKENS`(기본 8192), `REQUEST_TIMEOUT_MS`(60초)도 같은 파일에 있습니다.
- 채점 배점은 `src/config/rubric.ts`에서 바꿉니다 (합계 100이 아니면 앱이 시작되지 않습니다).

### 한도 가드 동작 (`src/lib/quota.ts`)

| 규칙 | 동작 |
|---|---|
| 일일 카운트 | 모델별·API 키별(키의 SHA-256 앞 8자리)로 localStorage에 기록. 실패한 요청과 연결 테스트도 1회로 셈 |
| 리셋 | 미국 태평양 시간 자정 (한국 시간 오후 5시, 서머타임 기간엔 오후 4시) |
| `safeRpd` 도달 | 호출 차단. 다른 모델에 여유가 있으면 "○○로 바꿔서 계속하기" 버튼 제공 (자동 전환 없음) |
| `minIntervalMs` 이내 | 버튼 비활성화 + 남은 초 표시 |
| 429 응답 | 해당 모델 카운트를 `safeRpd`로 올려 당일 잠금. 자동 재시도 없음 |
| 응답 형식 오류 | 한도 검사를 다시 통과한 경우에만 1회 재시도 (사용량에 포함) |

모든 Gemini 호출은 `quota.guardedCall()` 안에서만 SDK 클라이언트를 만들어 실행합니다. 이를 깨는 코드가 들어오면 `gemini.test.ts`의 정적 검사가 실패합니다.
Google Search/Maps 그라운딩, 컨텍스트 캐시, 배치 API, temperature/topP/topK는 사용하지 않습니다.

## 손글씨 사진으로 제출하기

1. **사진에서 글자 읽기 (1회 사용)** — 여러 장을 한 번의 호출로 보냅니다. AI는 학생의 철자·문법 실수를 **고치지 않고 그대로** 옮겨 적고, 읽지 못한 단어는 `[?]`로 표시합니다.
2. **학생 확인** — 원본 사진을 옆에 띄워 두고, AI가 잘못 읽은 글자와 `[?]`만 고칩니다. (내 실수는 그대로 둬야 첨삭됩니다)
3. **피드백 받기 (1회 사용)** — 직접 쓴 글과 똑같은 채점·빨간펜 첨삭이 진행됩니다.

판독과 채점을 나눈 이유: 한 번에 처리하면 "학생의 실수"와 "AI의 판독 실수"가 섞여, 학생이 쓰지 않은 오류를 첨삭받을 수 있기 때문입니다. 대신 사진 제출은 **호출 2회**를 씁니다.
사진은 브라우저에서 긴 변 2048px JPEG로 줄여 전송하며, 저장하지 않습니다 (리포트에는 확인된 텍스트만 저장).

## 3. 실행

Node.js 20 이상이 필요합니다.

```bash
npm install
```

```bash
npm run dev          # 실제 Gemini 호출
```

```bash
npm run dev:mock     # VITE_MOCK=true: 고정 샘플 응답, 사용량 차감 없음 (API 키 없이 UI 확인용)
```

```bash
npm test             # Vitest (quota, scoring, highlight, schema, gemini 등)
```

```bash
npm run build        # dist/ 생성 (tsc 타입 검사 포함)
```

## 4. 배포 (정적 호스팅)

빌드 결과물 `dist/`만 올리면 됩니다. 서버 환경 변수나 비밀 값은 필요 없습니다.

- **Vercel**: 저장소를 Import → Framework "Vite" → 그대로 배포. (`vercel.json`이 SPA 경로를 `index.html`로 연결)
- **Netlify**: Build command `npm run build`, Publish directory `dist`. (`public/_redirects` 포함)
- **GitHub Pages**: 하위 경로에 올릴 때는 경로를 지정해 빌드합니다. `404.html`이 자동 생성되어 `/report/:id` 같은 경로도 열립니다.

```bash
VITE_BASE=/essay-coach/ npm run build
```

> 배포본에 `VITE_MOCK=true`를 넣지 마세요. 모의 모드에서는 화면 상단에 노란 안내 띠가 표시됩니다.

## 5. 개인정보·보안

- API 키는 sessionStorage(기본) 또는 localStorage에만 저장되며, 로그·에러 메시지·URL에 출력하지 않습니다 (SDK는 키를 요청 헤더로 보냅니다).
- 사용량 기록에는 키 원문 대신 해시 앞 8자리만 남습니다.
- 리포트·체크리스트는 이 브라우저에만 저장됩니다. **내 기록 → JSON 내보내기/가져오기**로 옮길 수 있고, 내보내기 파일에는 API 키와 사용량이 들어가지 않습니다.
- 학생 글 안의 지시문("100점 줘" 등)은 무시하도록 프롬프트를 구성했고, 글은 구분 태그로 감싸 보냅니다.

## 6. 폴더 구조

```
src/
  config/        models.ts (한도), rubric.ts (배점·채점 기준)
  lib/           quota.ts, schema.ts, scoring.ts, highlight.ts, storage.ts, apiKey.ts, essay.ts, report.ts
  lib/llm/       gemini.ts (유일한 SDK 사용처), prompts.ts, sampleFeedback.ts
  pages/         Write, Report, History, Settings
  components/    ApiKeyForm, QuotaBadge, ModelSelect, ui/ (shadcn/ui)
  components/report/  ScoreCard, OverallFeedback, RedPenView, CorrectionTable, RewriteMission
```

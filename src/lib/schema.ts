import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { RUBRIC_KEYS } from "@/config/rubric";

export const RubricKeySchema = z.enum(RUBRIC_KEYS);

const Evidence = z.object({
  point: z.string().describe("Korean, friendly polite tone (존댓말)"),
  evidence: z.string().describe("Short quote copied exactly from the student's essay"),
});

export const FeedbackSchema = z.object({
  scores: z
    .array(
      z.object({
        key: RubricKeySchema,
        score: z.number().int().min(0),
        rationale: z.string().describe("One sentence in easy Korean"),
      }),
    )
    .length(6),
  overall: z.object({
    strengths: z.array(Evidence).min(2).max(4),
    weaknesses: z.array(Evidence).min(2).max(4),
  }),
  redPen: z.array(
    z.object({
      id: z.string(),
      original: z.string().describe("Exact substring copied character-for-character from the student's essay"),
      revised: z.string().describe("Improved English version"),
      reason: z.string().describe("Easy Korean explanation"),
      suggestedAddition: z.string().optional().describe("Optional English example sentence the student could add"),
    }),
  ),
  corrections: z.array(
    z.object({
      original: z.string(),
      corrected: z.string(),
      type: z.enum(["vocabulary", "grammar", "expression", "spelling"]),
      explanation: z.string().describe("Easy Korean explanation"),
    }),
  ),
  rewriteMission: z.object({
    tasks: z
      .array(
        z.object({
          targetKey: RubricKeySchema,
          instruction: z.string().describe("Korean, specific to this student's essay"),
          selfCheck: z.array(z.string()).min(2).max(4),
        }),
      )
      .min(2)
      .max(3),
    teacherComment: z.string().describe("3-5 sentences in Korean, written directly to the student"),
  }),
});

export type Feedback = z.infer<typeof FeedbackSchema>;
export type CorrectionType = Feedback["corrections"][number]["type"];
export type RedPenItem = Feedback["redPen"][number];

/** JSON 스키마로 표현하기 어려운 제약(항목 중복 금지)까지 포함한 검증용 스키마 */
export const StrictFeedbackSchema = FeedbackSchema.superRefine((fb, ctx) => {
  const keys = new Set(fb.scores.map((s) => s.key));
  if (keys.size !== RUBRIC_KEYS.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["scores"], message: "scores must contain each rubric key exactly once" });
  }
  const ids = new Set(fb.redPen.map((r) => r.id));
  if (ids.size !== fb.redPen.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["redPen"], message: "redPen ids must be unique" });
  }
});

export type ParseResult = { ok: true; data: Feedback } | { ok: false; error: string };

export function parseFeedback(raw: unknown): ParseResult {
  let value = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(stripCodeFence(raw));
    } catch {
      return { ok: false, error: "응답이 올바른 JSON 형식이 아니에요." };
    }
  }
  const result = StrictFeedbackSchema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };
  const first = result.error.issues[0];
  return { ok: false, error: `응답 형식 오류: ${first?.path.join(".") ?? ""} ${first?.message ?? ""}`.trim() };
}

// responseMimeType 지정 시에도 드물게 ```json 펜스가 붙어 오는 경우가 있어 방어
function stripCodeFence(text: string): string {
  const m = text.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return m?.[1] ?? text;
}

/* ---------- Gemini responseSchema 변환 ---------- */

type JsonSchema = Record<string, unknown>;
export interface GeminiSchema {
  type?: string;
  description?: string;
  enum?: string[];
  format?: string;
  items?: GeminiSchema;
  properties?: Record<string, GeminiSchema>;
  propertyOrdering?: string[];
  required?: string[];
  minItems?: string;
  maxItems?: string;
  minimum?: number;
  maximum?: number;
  nullable?: boolean;
}

/**
 * Gemini responseSchema 는 OpenAPI 3.0 의 일부만 지원하므로
 * zod-to-json-schema 결과에서 지원 키만 남기고 타입명을 대문자 enum 으로 바꾼다.
 */
export function jsonSchemaToGemini(schema: JsonSchema): GeminiSchema {
  const out: GeminiSchema = {};
  if (typeof schema.type === "string") out.type = schema.type.toUpperCase();
  if (typeof schema.description === "string") out.description = schema.description;
  if (Array.isArray(schema.enum)) out.enum = schema.enum.map(String);
  if (typeof schema.minimum === "number") out.minimum = schema.minimum;
  if (typeof schema.maximum === "number") out.maximum = schema.maximum;
  if (typeof schema.minItems === "number") out.minItems = String(schema.minItems);
  if (typeof schema.maxItems === "number") out.maxItems = String(schema.maxItems);
  if (schema.nullable === true) out.nullable = true;
  if (schema.items && typeof schema.items === "object" && !Array.isArray(schema.items)) {
    out.items = jsonSchemaToGemini(schema.items as JsonSchema);
  }
  if (schema.properties && typeof schema.properties === "object") {
    const props = schema.properties as Record<string, JsonSchema>;
    out.properties = Object.fromEntries(Object.entries(props).map(([k, v]) => [k, jsonSchemaToGemini(v)]));
    // 출력 순서를 고정해 스키마 순서대로 생성되게 한다 (점수 → 피드백 → 첨삭)
    out.propertyOrdering = Object.keys(props);
  }
  if (Array.isArray(schema.required) && schema.required.length > 0) out.required = schema.required.map(String);
  return out;
}

export function buildResponseSchema(): GeminiSchema {
  const json = zodToJsonSchema(FeedbackSchema, { target: "openApi3", $refStrategy: "none" }) as JsonSchema;
  return jsonSchemaToGemini(json);
}

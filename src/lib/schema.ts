import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { RUBRIC_KEYS } from "@/config/rubric";

export const RubricKeySchema = z.enum(RUBRIC_KEYS);

export const STRUCTURE_ROLES = ["introduction", "claim", "reason", "example", "counterargument", "rebuttal", "conclusion", "other"] as const;
export const StructureRoleSchema = z.enum(STRUCTURE_ROLES);
export type StructureRole = z.infer<typeof StructureRoleSchema>;

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
  structure: z.object({
    parts: z.array(
      z.object({
        role: StructureRoleSchema,
        label: z.string().describe('Short Korean label, e.g. "서론·주장", "근거 1", "예시", "결론"'),
        fromNo: z.number().int().min(1).describe("First sentence number of this part"),
        toNo: z.number().int().min(1).describe("Last sentence number of this part"),
        comment: z.string().describe("One short Korean red-pen comment on how well this part does its job"),
      }),
    ),
    missing: z.array(
      z.object({
        role: StructureRoleSchema,
        afterNo: z.number().int().min(0).describe("Where it should go: after this sentence number (0 = before sentence 1)"),
        suggestion: z.string().describe("Korean: what to add there and how, specific to this essay"),
      }),
    ),
    flowComment: z.string().describe("1-2 Korean sentences on the overall structure and logical flow"),
  }),
  sentenceReview: z.object({
    items: z.array(
      z.object({
        no: z.number().int().min(1).describe("Sentence number [n] from the numbered list"),
        action: z.enum(["keep", "revise", "delete"]),
        minimal: z.string().describe("Minimal correction: fix only errors, keep the student's words. Same as original if keep; empty if delete"),
        recommended: z.string().describe("A better, more natural version at the student's level; empty if delete"),
        note: z.string().describe("Short easy Korean reason (empty string if keep)"),
      }),
    ),
    insertions: z.array(
      z.object({
        afterNo: z.number().int().min(0).describe("Insert after this sentence number (0 = at the very beginning)"),
        sentence: z.string().describe("English sentence to add"),
        reason: z.string().describe("Easy Korean reason"),
      }),
    ),
  }),
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
export type SentenceReview = Feedback["sentenceReview"];
export type EssayStructure = Feedback["structure"];

/** 이전 형식으로 저장된 리포트에는 structure / sentenceReview 가 없다 (예전 redPen·corrections 는 무시) */
export const StoredFeedbackSchema = FeedbackSchema.partial({ structure: true, sentenceReview: true });
export type StoredFeedback = z.infer<typeof StoredFeedbackSchema>;

/** JSON 스키마로 표현하기 어려운 제약(항목 중복 금지)까지 포함한 검증용 스키마 */
export const StrictFeedbackSchema = FeedbackSchema.superRefine((fb, ctx) => {
  const keys = new Set(fb.scores.map((s) => s.key));
  if (keys.size !== RUBRIC_KEYS.length) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["scores"], message: "scores must contain each rubric key exactly once" });
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

/* ---------- 손글씨 사진 → 텍스트 ---------- */

export const UNREADABLE_MARK = "[?]";

export const TranscriptionSchema = z.object({
  isEssay: z.boolean().describe("false if the images do not contain a handwritten/printed English essay"),
  topic: z.string().describe("Essay prompt or title if written on the page, otherwise empty string"),
  text: z.string().describe("Verbatim transcription of the essay body, preserving the student's mistakes and paragraph breaks"),
  unreadableCount: z.number().int().min(0),
});
export type Transcription = z.infer<typeof TranscriptionSchema>;

export function parseTranscription(raw: string): { ok: true; data: Transcription } | { ok: false; error: string } {
  try {
    const r = TranscriptionSchema.safeParse(JSON.parse(stripCodeFence(raw)));
    return r.success ? { ok: true, data: r.data } : { ok: false, error: "글자 읽기 결과 형식이 올바르지 않아요." };
  } catch {
    return { ok: false, error: "글자 읽기 결과를 해석하지 못했어요." };
  }
}

export function buildTranscriptionSchema(): GeminiSchema {
  const json = zodToJsonSchema(TranscriptionSchema, { target: "openApi3", $refStrategy: "none" }) as JsonSchema;
  return jsonSchemaToGemini(json);
}

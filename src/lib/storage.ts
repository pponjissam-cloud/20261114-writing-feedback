import { z } from "zod";
import { FeedbackSchema } from "@/lib/schema";
import { RubricKeySchema } from "@/lib/schema";

/** 저장소 추상화 — 테스트에서는 메모리 구현, 앱에서는 localStorage/sessionStorage */
export interface StorageRepository {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  keys(): string[];
}

export function webStorageRepo(getStorage: () => Storage): StorageRepository {
  // 사생활 보호 모드 등에서 Storage 접근 자체가 예외를 던질 수 있어 모두 감싼다
  return {
    get(key) {
      try { return getStorage().getItem(key); } catch { return null; }
    },
    set(key, value) {
      try { getStorage().setItem(key, value); } catch (e) {
        throw new Error(isQuotaExceeded(e) ? "브라우저 저장 공간이 가득 찼어요. 오래된 기록을 지워 주세요." : "브라우저 저장소를 사용할 수 없어요.");
      }
    },
    remove(key) {
      try { getStorage().removeItem(key); } catch { /* ignore */ }
    },
    keys() {
      try {
        const s = getStorage();
        return Array.from({ length: s.length }, (_, i) => s.key(i)).filter((k): k is string => k !== null);
      } catch { return []; }
    },
  };
}

function isQuotaExceeded(e: unknown) {
  return e instanceof DOMException && (e.name === "QuotaExceededError" || e.code === 22);
}

export function memoryRepo(initial: Record<string, string> = {}): StorageRepository {
  const map = new Map(Object.entries(initial));
  return {
    get: (k) => map.get(k) ?? null,
    set: (k, v) => void map.set(k, v),
    remove: (k) => void map.delete(k),
    keys: () => [...map.keys()],
  };
}

export const localRepo = webStorageRepo(() => window.localStorage);
export const sessionRepo = webStorageRepo(() => window.sessionStorage);

export function readJSON<T>(repo: StorageRepository, key: string, schema: z.ZodType<T>): T | null {
  const raw = repo.get(key);
  if (raw == null) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeJSON(repo: StorageRepository, key: string, value: unknown) {
  repo.set(key, JSON.stringify(value));
}

/* ---------- 리포트 저장소 ---------- */

export const STORAGE_PREFIX = "essaycoach:";
const REPORTS_KEY = `${STORAGE_PREFIX}reports:v1`;
const CHECKLIST_KEY = `${STORAGE_PREFIX}checklists:v1`;
const DRAFT_KEY = `${STORAGE_PREFIX}draft:v1`;

export const StoredReportSchema = z.object({
  id: z.string(),
  createdAt: z.number(),
  modelId: z.string(),
  topic: z.string(),
  essay: z.string(),
  feedback: FeedbackSchema,
  rubric: z.array(z.object({ key: RubricKeySchema, label: z.string(), max: z.number() })),
  total: z.number(),
  /** 같은 원글에서 나온 Rewrite 버전들을 묶는 id (첫 글의 id) */
  groupId: z.string(),
  parentId: z.string().optional(),
  version: z.number().int().min(1),
  mock: z.boolean().optional(),
  /** photo = 손글씨 사진에서 옮겨 적은 글 */
  inputMethod: z.enum(["typed", "photo"]).optional(),
});
export type StoredReport = z.infer<typeof StoredReportSchema>;

const ReportsSchema = z.array(StoredReportSchema);
const ChecklistsSchema = z.record(z.string(), z.array(z.array(z.boolean())));

export const DraftSchema = z.object({
  topic: z.string(),
  essay: z.string(),
  rewriteOf: z.string().optional(),
  inputMethod: z.enum(["typed", "photo"]).optional(),
  updatedAt: z.number(),
});
export type Draft = z.infer<typeof DraftSchema>;

export const ExportSchema = z.object({
  app: z.literal("essay-coach"),
  version: z.literal(1),
  exportedAt: z.number(),
  reports: ReportsSchema,
  checklists: ChecklistsSchema.default({}),
});
export type ExportData = z.infer<typeof ExportSchema>;

type Listener = () => void;

export function createReportStore(repo: StorageRepository) {
  const listeners = new Set<Listener>();
  const emit = () => listeners.forEach((l) => l());
  const all = () => readJSON(repo, REPORTS_KEY, ReportsSchema) ?? [];
  const checklists = () => readJSON(repo, CHECKLIST_KEY, ChecklistsSchema) ?? {};

  return {
    subscribe(l: Listener) {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
    list(): StoredReport[] {
      return all().sort((a, b) => b.createdAt - a.createdAt);
    },
    get(id: string) {
      return all().find((r) => r.id === id) ?? null;
    },
    save(report: StoredReport) {
      writeJSON(repo, REPORTS_KEY, [...all().filter((r) => r.id !== report.id), report]);
      emit();
    },
    remove(id: string) {
      writeJSON(repo, REPORTS_KEY, all().filter((r) => r.id !== id));
      const c = checklists();
      delete c[id];
      writeJSON(repo, CHECKLIST_KEY, c);
      emit();
    },
    getChecklist(id: string): boolean[][] {
      return checklists()[id] ?? [];
    },
    setChecklist(id: string, state: boolean[][]) {
      writeJSON(repo, CHECKLIST_KEY, { ...checklists(), [id]: state });
      emit();
    },
    getDraft(): Draft | null {
      return readJSON(repo, DRAFT_KEY, DraftSchema);
    },
    setDraft(d: Omit<Draft, "updatedAt">) {
      writeJSON(repo, DRAFT_KEY, { ...d, updatedAt: Date.now() });
    },
    clearDraft() {
      repo.remove(DRAFT_KEY);
    },
    /** API 키·사용량은 내보내지 않는다 (리포트와 체크리스트만) */
    exportAll(): ExportData {
      return { app: "essay-coach", version: 1, exportedAt: Date.now(), reports: all(), checklists: checklists() };
    },
    importAll(raw: unknown): { added: number; updated: number } {
      const parsed = ExportSchema.safeParse(raw);
      if (!parsed.success) throw new Error("내보내기 파일 형식이 올바르지 않아요.");
      const current = new Map(all().map((r) => [r.id, r]));
      let added = 0;
      let updated = 0;
      for (const r of parsed.data.reports) {
        if (current.has(r.id)) updated++;
        else added++;
        current.set(r.id, r);
      }
      writeJSON(repo, REPORTS_KEY, [...current.values()]);
      writeJSON(repo, CHECKLIST_KEY, { ...checklists(), ...parsed.data.checklists });
      emit();
      return { added, updated };
    },
  };
}

export type ReportStore = ReturnType<typeof createReportStore>;
export const reportStore = createReportStore(localRepo);

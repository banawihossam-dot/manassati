import { supabase } from './supabase';
import { answerToText, autograde, cleanQuestion, gradable, isAnswered, sanitize, totalPoints, type Ans, type Question } from './questions';
import { makeCode, round2 } from './utils';

export interface Session {
  id: string; worksheet_id: string | null; teacher_id: string; code: string;
  title: string; subject: string; grade: string; objective: string;
  questions_public: Question[];
  mode: 'individual' | 'shared' | 'group';
  group_size: number; auto_groups: boolean; show_peers: boolean; chat_enabled: boolean;
  show_results: boolean; show_answers: boolean;
  status: 'live' | 'ended'; results_released: boolean; reveal: Question[] | null;
  created_at: string; ended_at: string | null;
}
export interface Participant { id: string; session_id: string; user_id: string; name: string; group_id: string | null; joined_at: string }
export interface Group { id: string; session_id: string; name: string; color: number; created_at: string }
export interface AnswerRow { id: string; session_id: string; question_id: string; scope_key: string; part_key: string; value: any; author_id: string; author_name: string; updated_at: string }
export interface GradeRow {
  id?: string; session_id: string; question_id: string; scope_key: string;
  score: number | null; max_score: number | null; feedback: string | null; source: string | null;
  ai_score?: number | null; ai_reason?: string | null; ai_feedback?: string | null; ai_pending?: boolean;
}
export interface Worksheet { id: string; title: string; objective: string; subject: string; grade: string; questions: Question[]; created_at: string; updated_at: string }

export interface LaunchSettings {
  mode: Session['mode']; group_size: number; auto_groups: boolean; show_peers: boolean;
  chat_enabled: boolean; show_results: boolean; show_answers: boolean;
}

export const MODE_LABEL: Record<Session['mode'], string> = {
  individual: 'كل طالب مستقل',
  shared: 'مساحة مشتركة للصف',
  group: 'مجموعات',
};

export async function launchSession(ws: Worksheet, s: LaunchSettings): Promise<string> {
  const full = (ws.questions || []).map(cleanQuestion);
  const pub = full.map(sanitize);
  let id: string | null = null;
  for (let attempt = 0; attempt < 5 && !id; attempt++) {
    const { data, error } = await supabase.from('sessions').insert({
      worksheet_id: ws.id, code: makeCode(), title: ws.title, subject: ws.subject, grade: ws.grade,
      objective: ws.objective, questions_public: pub, ...s,
    }).select('id').single();
    if (error) {
      if ((error as any).code === '23505') continue;
      throw error;
    }
    id = data.id;
  }
  if (!id) throw new Error('تعذّر إنشاء رمز فريد، حاول مرة أخرى.');
  const { error } = await supabase.from('session_keys').insert({ session_id: id, questions: full });
  if (error) throw error;
  return id;
}

export const ansKey = (q: string, scope: string, part: string) => `${q}|${scope}|${part}`;

/** يحوّل صفوف الإجابات إلى خريطة: النطاق ← السؤال ← {value, parts} */
export function buildAnsMap(rows: Iterable<AnswerRow>) {
  const map: Record<string, Record<string, Ans>> = {};
  for (const r of rows) {
    const s = (map[r.scope_key] ||= {});
    const a = (s[r.question_id] ||= {});
    if (r.part_key === '') a.value = r.value;
    else (a.parts ||= {})[r.part_key] = r.value;
  }
  return map;
}

export interface Scope { key: string; name: string; color?: number; members?: string[] }

export function scopesFor(session: Session, participants: Participant[], groups: Group[]): Scope[] {
  if (session.mode === 'shared') return [{ key: 'all', name: 'الصف كاملًا', members: participants.map((p) => p.name) }];
  if (session.mode === 'group') {
    return groups.map((g) => ({ key: g.id, name: g.name, color: g.color, members: participants.filter((p) => p.group_id === g.id).map((p) => p.name) }));
  }
  return participants.map((p) => ({ key: p.user_id, name: p.name }));
}

export interface ScopeResult {
  scope: Scope;
  perQ: Record<string, { auto: number | null; score: number | null; answered: boolean; grade?: GradeRow; text: string }>;
  total: number; finalScore: number; max: number; pct: number; answeredCount: number; pendingCount: number; overall?: GradeRow;
}

export function computeResults(qs: Question[], scopes: Scope[], answers: AnswerRow[], grades: GradeRow[]) {
  const map = buildAnsMap(answers);
  const gmap: Record<string, GradeRow> = {};
  grades.forEach((g) => (gmap[`${g.question_id}|${g.scope_key}`] = g));
  const gq = gradable(qs);
  const max = totalPoints(qs);

  const results: ScopeResult[] = scopes.map((scope) => {
    const perQ: ScopeResult['perQ'] = {};
    let total = 0, answeredCount = 0, pendingCount = 0;
    for (const q of gq) {
      const a = map[scope.key]?.[q.id] || {};
      const answered = isAnswered(q, a);
      const auto = autograde(q, a);
      const grade = gmap[`${q.id}|${scope.key}`];
      const manual = grade && grade.score !== null && grade.score !== undefined ? Number(grade.score) : null;
      const score = manual ?? (auto !== null ? auto : answered ? null : 0);
      if (answered) answeredCount++;
      if (score === null) pendingCount++;
      total += score ?? 0;
      perQ[q.id] = { auto, score, answered, grade, text: answerToText(q, a) };
    }
    const overall = gmap[`_overall|${scope.key}`];
    const finalScore = overall && overall.score !== null && overall.score !== undefined ? Number(overall.score) : round2(total);
    return { scope, perQ, total: round2(total), finalScore, max, pct: max ? round2((finalScore / max) * 100) : 0, answeredCount, pendingCount, overall };
  });

  const qStats = gq.map((q) => {
    const rs = results.map((r) => r.perQ[q.id]);
    const scored = rs.filter((x) => x.score !== null);
    const avg = scored.length ? scored.reduce((s, x) => s + (x.score || 0), 0) / scored.length : 0;
    const ratio = q.points ? avg / q.points : 0;
    return { q, answered: rs.filter((x) => x.answered).length, avg: round2(avg), ratio: round2(ratio), scoredCount: scored.length };
  });

  const n = results.length;
  const avgScore = n ? round2(results.reduce((s, r) => s + r.finalScore, 0) / n) : 0;
  const completion = n && gq.length ? round2((results.reduce((s, r) => s + r.answeredCount, 0) / (n * gq.length)) * 100) : 0;

  return { results, qStats, avgScore, max, completion, map };
}

/** نتائج تلقائية تُكتب في جدول الدرجات عند نشر النتائج للطلاب */
export function autoGradeRows(sessionId: string, qs: Question[], res: ScopeResult[]): GradeRow[] {
  const rows: GradeRow[] = [];
  for (const r of res) {
    for (const q of gradable(qs)) {
      const p = r.perQ[q.id];
      if (p.grade && p.grade.source && p.grade.source !== 'auto') continue;
      if (p.auto === null && p.answered) continue;
      rows.push({ session_id: sessionId, question_id: q.id, scope_key: r.scope.key, score: p.auto ?? 0, max_score: q.points, feedback: p.grade?.feedback ?? null, source: 'auto' });
    }
  }
  return rows;
}

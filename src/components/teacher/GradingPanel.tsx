'use client';
import { Bot, Check, Loader2, Save, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import QuestionView from '@/components/QuestionView';
import { describeCorrect, gradable, isAutoGradable, type Question } from '@/lib/questions';
import { computeResults, type GradeRow } from '@/lib/results';
import { errorText, supabase } from '@/lib/supabase';
import { cls, groupColor } from '@/lib/utils';
import type { Ctx } from './types';

export async function saveGrade(row: Partial<GradeRow> & { session_id: string; question_id: string; scope_key: string }) {
  const { error } = await supabase.from('grades').upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'session_id,question_id,scope_key' });
  if (error) throw error;
}

export async function requestAi(sessionId: string, questionId: string) {
  const { data, error } = await supabase.functions.invoke('ai-grade', { body: { sessionId, questionId } });
  if (error) {
    let msg = '';
    try { msg = (await (error as any).context?.json())?.error || ''; } catch {}
    throw new Error(msg || 'تعذّر الحصول على اقتراحات الذكاء الاصطناعي.');
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as { count: number };
}

export default function GradingPanel({ ctx }: { ctx: Ctx }) {
  const { session, keyQs, answers, grades, scopes, toast } = ctx;
  const { results, map } = useMemo(() => computeResults(keyQs, scopes, answers, grades), [keyQs, scopes, answers, grades]);
  const [sel, setSel] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const pub = useMemo(() => Object.fromEntries((session.questions_public || []).map((q) => [q.id, q])), [session.questions_public]);
  const gq = gradable(keyQs);

  useEffect(() => { if (!sel && results.length) setSel(results[0].scope.key); }, [results, sel]);
  const r = results.find((x) => x.scope.key === sel);

  const runAi = async (q: Question) => {
    setAiBusy(q.id);
    try {
      const { count } = await requestAi(session.id, q.id);
      toast(count ? `وصلت ${count} اقتراحات. راجعها واعتمد المناسب.` : 'لا توجد إجابات تحتاج اقتراحًا لهذا السؤال.');
      await ctx.reloadGrades();
    } catch (e) { toast(errorText(e), 'err'); }
    setAiBusy(null);
  };

  if (!results.length) return <div className="panel p-10 text-center text-muted">لا توجد إجابات لتصحيحها بعد.</div>;

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <aside className="panel h-fit overflow-hidden lg:sticky lg:top-20">
        <p className="border-b border-line px-4 py-3 text-sm font-bold">{session.mode === 'group' ? 'المجموعات' : session.mode === 'shared' ? 'الصف' : 'الطلاب'} ({results.length})</p>
        <ul className="max-h-[65vh] overflow-y-auto">
          {results.map((x) => (
            <li key={x.scope.key}>
              <button onClick={() => setSel(x.scope.key)} className={cls('flex w-full items-center gap-2 px-4 py-2.5 text-start text-sm transition', sel === x.scope.key ? 'bg-primary/10' : 'hover:bg-surface2/60')}>
                {x.scope.color !== undefined && <span className="h-3 w-3 rounded-full" style={{ background: groupColor(x.scope.color) }} />}
                <span className="flex-1 truncate font-semibold">{x.scope.name}</span>
                {x.pendingCount > 0 && <span className="chip bg-accent/25" title="أسئلة تحتاج تصحيحًا">{x.pendingCount}</span>}
                <span className="text-xs font-bold text-muted">{x.finalScore}/{x.max}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {r && (
        <div className="space-y-4">
          <div className="panel flex flex-wrap items-center gap-3 p-4">
            <div className="flex-1">
              <h2 className="text-xl font-bold">{r.scope.name}</h2>
              {r.scope.members && <p className="text-sm text-muted">{r.scope.members.join('، ') || 'لا أعضاء'}</p>}
            </div>
            <p className="text-3xl font-bold text-primary">{r.finalScore}<span className="text-base text-muted"> / {r.max}</span></p>
          </div>

          {gq.map((q, i) => {
            const p = r.perQ[q.id];
            const pq = pub[q.id] || q;
            const manual = !isAutoGradable(q);
            return (
              <article key={q.id} className="panel p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-primary">السؤال {i + 1} <span className="font-normal text-muted">({q.points} درجة)</span></span>
                  {manual && (
                    <button className="btn-outline btn-sm" onClick={() => runAi(q)} disabled={!!aiBusy} title="يقترح درجات لجميع الإجابات على هذا السؤال">
                      {aiBusy === q.id ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} اقتراح بالذكاء الاصطناعي لكل الإجابات
                    </button>
                  )}
                </div>
                <p className="mb-3 whitespace-pre-wrap font-semibold">{q.prompt}</p>
                {p.answered ? (
                  <div className="rounded-xl bg-surface2/40 p-3">
                    <QuestionView q={pq} ans={map[r.scope.key]?.[q.id] || {}} readOnly showAuthors />
                  </div>
                ) : <p className="rounded-xl border border-dashed border-line p-3 text-sm text-muted">لم تُكتب إجابة.</p>}
                {describeCorrect(q) && (
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-muted">الإجابة النموذجية</summary>
                    <p className="mt-1 whitespace-pre-wrap rounded-lg bg-success/10 p-2">{describeCorrect(q)}</p>
                  </details>
                )}
                <GradeEditor
                  key={`${r.scope.key}-${q.id}-${p.grade?.score ?? ''}-${p.grade?.ai_pending ?? ''}`}
                  max={q.points} auto={p.auto} grade={p.grade}
                  onSave={async (score, feedback) => {
                    try {
                      await saveGrade({ session_id: session.id, question_id: q.id, scope_key: r.scope.key, score, feedback, max_score: q.points, source: score === null ? null : 'manual' });
                      toast('حُفظت الدرجة'); ctx.reloadGrades();
                    } catch (e) { toast(errorText(e), 'err'); }
                  }}
                  onAi={async (accept) => {
                    try {
                      await saveGrade(accept
                        ? { session_id: session.id, question_id: q.id, scope_key: r.scope.key, score: p.grade?.ai_score ?? null, feedback: p.grade?.ai_feedback ?? null, max_score: q.points, source: 'ai', ai_pending: false }
                        : { session_id: session.id, question_id: q.id, scope_key: r.scope.key, ai_pending: false });
                      toast(accept ? 'اعتُمد الاقتراح' : 'تُجوهل الاقتراح'); ctx.reloadGrades();
                    } catch (e) { toast(errorText(e), 'err'); }
                  }}
                />
              </article>
            );
          })}

          <OverallEditor
            key={`${r.scope.key}-${r.overall?.score ?? ''}-${r.overall?.feedback ?? ''}`}
            computed={r.total} max={r.max} grade={r.overall}
            onSave={async (score, feedback) => {
              try {
                await saveGrade({ session_id: session.id, question_id: '_overall', scope_key: r.scope.key, score, feedback, max_score: r.max, source: 'manual' });
                toast('حُفظت الدرجة النهائية'); ctx.reloadGrades();
              } catch (e) { toast(errorText(e), 'err'); }
            }}
          />
        </div>
      )}
    </div>
  );
}

function GradeEditor({ max, auto, grade, onSave, onAi }: {
  max: number; auto: number | null; grade?: GradeRow;
  onSave: (score: number | null, feedback: string | null) => void; onAi: (accept: boolean) => void;
}) {
  const initial = grade?.score ?? null;
  const [score, setScore] = useState<string>(initial !== null && initial !== undefined ? String(initial) : '');
  const [fb, setFb] = useState(grade?.feedback || '');
  const dirty = score !== (initial !== null && initial !== undefined ? String(initial) : '') || fb !== (grade?.feedback || '');
  const save = () => {
    const n = score.trim() === '' ? null : Math.min(max, Math.max(0, Number(score)));
    if (n !== null && Number.isNaN(n)) return;
    onSave(n, fb.trim() || null);
  };
  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      {grade?.ai_pending && grade.ai_score !== null && grade.ai_score !== undefined && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm">
          <p className="mb-1 flex items-center gap-1.5 font-bold"><Bot size={15} /> اقتراح الذكاء الاصطناعي: {grade.ai_score} / {max}</p>
          {grade.ai_reason && <p className="mb-1"><b>السبب: </b>{grade.ai_reason}</p>}
          {grade.ai_feedback && <p className="mb-2"><b>تغذية راجعة مقترحة: </b>{grade.ai_feedback}</p>}
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" onClick={() => onAi(true)}><Check size={14} /> اعتماد</button>
            <button className="btn-ghost btn-sm" onClick={() => onAi(false)}><X size={14} /> تجاهل</button>
          </div>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-[150px_1fr_auto] sm:items-end">
        <div>
          <label className="label text-xs">الدرجة {auto !== null && <span className="font-normal text-muted">(التلقائية: {auto})</span>}</label>
          <div className="flex items-center gap-1">
            <input className="input" type="number" min={0} max={max} step={0.25} value={score} placeholder={auto !== null ? String(auto) : '—'} onChange={(e) => setScore(e.target.value)} />
            <span className="text-sm text-muted">/{max}</span>
          </div>
        </div>
        <div>
          <label className="label text-xs">ملاحظة للطالب</label>
          <input className="input" value={fb} onChange={(e) => setFb(e.target.value)} placeholder="تغذية راجعة (اختياري)" />
        </div>
        <button className="btn-primary" onClick={save} disabled={!dirty}><Save size={15} /> حفظ</button>
      </div>
      {grade?.source && <p className="hint">{grade.source === 'ai' ? 'درجة معتمدة من اقتراح الذكاء الاصطناعي' : grade.source === 'manual' ? 'درجة يدوية' : 'درجة تلقائية'}. اترك الحقل فارغًا واحفظ للعودة إلى الدرجة التلقائية.</p>}
    </div>
  );
}

function OverallEditor({ computed, max, grade, onSave }: { computed: number; max: number; grade?: GradeRow; onSave: (s: number | null, f: string | null) => void }) {
  const [score, setScore] = useState(grade?.score !== null && grade?.score !== undefined ? String(grade.score) : '');
  const [fb, setFb] = useState(grade?.feedback || '');
  return (
    <section className="panel space-y-3 border-2 border-accent/50 p-4">
      <h3 className="font-bold">الدرجة النهائية والملاحظة العامة</h3>
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <div>
          <label className="label text-xs">تعديل الدرجة النهائية</label>
          <input className="input" type="number" min={0} max={max} step={0.25} value={score} placeholder={`المحسوبة: ${computed}`} onChange={(e) => setScore(e.target.value)} />
          <p className="hint mt-1">اتركه فارغًا لاعتماد المجموع المحسوب.</p>
        </div>
        <div>
          <label className="label text-xs">ملاحظة عامة</label>
          <textarea className="input" rows={3} value={fb} onChange={(e) => setFb(e.target.value)} placeholder="ما الذي أحسن فيه؟ وما الذي يحتاج تحسينًا؟" />
        </div>
      </div>
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => onSave(score.trim() === '' ? null : Number(score), fb.trim() || null)}><Save size={15} /> حفظ</button>
      </div>
    </section>
  );
}

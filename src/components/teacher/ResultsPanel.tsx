'use client';
import { FileSpreadsheet, Loader2, Megaphone, Printer, TrendingDown, TrendingUp, Undo2 } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { gradable } from '@/lib/questions';
import { autoGradeRows, computeResults } from '@/lib/results';
import { errorText, supabase } from '@/lib/supabase';
import { cls, groupColor } from '@/lib/utils';
import type { Ctx } from './types';
import { exportExcel } from './export';

export default function ResultsPanel({ ctx }: { ctx: Ctx }) {
  const { session, keyQs, answers, grades, scopes, participants, toast } = ctx;
  const data = useMemo(() => computeResults(keyQs, scopes, answers, grades), [keyQs, scopes, answers, grades]);
  const { results, qStats, avgScore, max, completion } = data;
  const [busy, setBusy] = useState(false);
  const gq = gradable(keyQs);
  const pending = results.reduce((s, r) => s + r.pendingCount, 0);

  const release = async () => {
    if (pending && !confirm(`ما زالت ${pending} إجابة بلا درجة، وستُحسب صفرًا حتى تصححها. نشر النتائج الآن؟`)) return;
    setBusy(true);
    try {
      const rows = autoGradeRows(session.id, keyQs, results);
      for (let i = 0; i < rows.length; i += 200) {
        const { error } = await supabase.from('grades').upsert(rows.slice(i, i + 200), { onConflict: 'session_id,question_id,scope_key' });
        if (error) throw error;
      }
      await ctx.patchSession({ results_released: true, show_results: true });
      await ctx.reloadGrades();
      toast('نُشرت النتائج للطلاب');
    } catch (e) { toast(errorText(e), 'err'); }
    setBusy(false);
  };

  const sorted = [...qStats].filter((s) => s.scoredCount > 0).sort((a, b) => b.ratio - a.ratio);
  const strong = sorted.filter((s) => s.ratio >= 0.75).slice(0, 4);
  const weak = [...sorted].reverse().filter((s) => s.ratio < 0.6).slice(0, 4);
  const qNum = (id: string) => gq.findIndex((q) => q.id === id) + 1;

  const contrib: Record<string, number> = {};
  answers.forEach((a) => (contrib[a.author_id] = (contrib[a.author_id] || 0) + 1));

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center gap-2">
        {session.results_released ? (
          <button className="btn-outline" onClick={() => ctx.patchSession({ results_released: false })}><Undo2 size={16} /> إخفاء النتائج عن الطلاب</button>
        ) : (
          <button className="btn-accent" onClick={release} disabled={busy || !results.length}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Megaphone size={16} />} نشر النتائج للطلاب</button>
        )}
        <button className="btn-outline" onClick={() => exportExcel(session, keyQs, data, participants, answers)} disabled={!results.length}><FileSpreadsheet size={16} /> تصدير Excel</button>
        <Link href={`/teacher/report/?id=${session.id}`} target="_blank" className="btn-outline"><Printer size={16} /> تقرير للطباعة وPDF</Link>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [session.mode === 'group' ? 'مجموعات' : 'مشاركون', session.mode === 'group' ? results.length : participants.length],
          ['نسبة الإنجاز', `${completion}%`],
          ['متوسط الدرجات', `${avgScore} / ${max}`],
          ['بانتظار التصحيح', pending],
        ].map(([l, v]) => (
          <div key={l as string} className="panel p-4">
            <p className="text-2xl font-bold">{v}</p>
            <p className="text-sm text-muted">{l}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel p-4">
          <h3 className="mb-3 flex items-center gap-2 font-bold"><TrendingUp size={17} className="text-success" /> نقاط القوة</h3>
          {strong.length ? strong.map((s) => (
            <p key={s.q.id} className="mb-2 text-sm"><b>السؤال {qNum(s.q.id)}</b> ({Math.round(s.ratio * 100)}%): <span className="text-muted">{(s.q.prompt || s.q.fillText || '').slice(0, 90)}</span></p>
          )) : <p className="text-sm text-muted">لا يوجد سؤال تجاوز فيه المتوسط 75% بعد.</p>}
        </section>
        <section className="panel p-4">
          <h3 className="mb-3 flex items-center gap-2 font-bold"><TrendingDown size={17} className="text-danger" /> مواضع الصعوبة</h3>
          {weak.length ? weak.map((s) => (
            <p key={s.q.id} className="mb-2 text-sm"><b>السؤال {qNum(s.q.id)}</b> ({Math.round(s.ratio * 100)}%): <span className="text-muted">{(s.q.prompt || s.q.fillText || '').slice(0, 90)}</span></p>
          )) : <p className="text-sm text-muted">لا توجد أسئلة يقل متوسطها عن 60%.</p>}
        </section>
      </div>

      <section className="panel p-4">
        <h3 className="mb-4 font-bold">نسبة الإجابة الصحيحة لكل سؤال</h3>
        <div className="space-y-2.5">
          {qStats.map((s, i) => (
            <div key={s.q.id} className="grid grid-cols-[70px_1fr_60px] items-center gap-3 text-sm">
              <span className="font-semibold">السؤال {i + 1}</span>
              <div className="h-5 overflow-hidden rounded-md bg-surface2">
                <div className={cls('h-full rounded-md', s.ratio >= 0.75 ? 'bg-success' : s.ratio >= 0.5 ? 'bg-accent' : 'bg-danger')} style={{ width: `${Math.max(2, s.ratio * 100)}%` }} />
              </div>
              <span className="text-end font-bold">{s.scoredCount ? `${Math.round(s.ratio * 100)}%` : '—'}</span>
            </div>
          ))}
        </div>
        <p className="hint mt-3">المتوسط محسوب على الإجابات المصححة فقط. الأخضر 75% فأكثر، والأحمر أقل من 50%.</p>
      </section>

      {session.mode === 'group' && results.length > 1 && (
        <section className="panel p-4">
          <h3 className="mb-4 font-bold">مقارنة أداء المجموعات</h3>
          <div className="space-y-2.5">
            {[...results].sort((a, b) => b.pct - a.pct).map((r) => (
              <div key={r.scope.key} className="grid grid-cols-[110px_1fr_70px] items-center gap-3 text-sm">
                <span className="truncate font-semibold">{r.scope.name}</span>
                <div className="h-6 overflow-hidden rounded-md bg-surface2">
                  <div className="h-full rounded-md" style={{ width: `${Math.max(2, r.pct)}%`, background: groupColor(r.scope.color) }} />
                </div>
                <span className="text-end font-bold">{r.finalScore}/{r.max}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {session.mode !== 'individual' && participants.length > 0 && (
        <section className="panel p-4">
          <h3 className="mb-3 font-bold">مشاركة كل طالب</h3>
          <div className="flex flex-wrap gap-2">
            {[...participants].sort((a, b) => (contrib[b.user_id] || 0) - (contrib[a.user_id] || 0)).map((p) => (
              <span key={p.id} className={cls('chip px-3 py-1 text-sm', contrib[p.user_id] ? 'bg-surface2' : 'bg-danger/10 text-danger')}>
                {p.name}: {contrib[p.user_id] || 0}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead className="bg-surface2">
            <tr>
              <th className="p-3 text-start">{session.mode === 'group' ? 'المجموعة' : session.mode === 'shared' ? 'المساحة' : 'الطالب'}</th>
              {gq.map((q, i) => <th key={q.id} className="p-3 text-center">س{i + 1}<span className="block text-[10px] font-normal text-muted">{q.points}</span></th>)}
              <th className="p-3 text-center">المجموع</th>
              <th className="p-3 text-center">%</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.scope.key} className="border-t border-line">
                <td className="p-3 font-semibold">{r.scope.name}</td>
                {gq.map((q) => {
                  const p = r.perQ[q.id];
                  return <td key={q.id} className={cls('p-3 text-center', p.score === null && 'text-accent')}>{p.score === null ? '؟' : p.score}</td>;
                })}
                <td className="p-3 text-center font-bold">{r.finalScore}</td>
                <td className="p-3 text-center">{r.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint p-3">«؟» تعني إجابة تحتاج تصحيحًا يدويًا من تبويب التصحيح.</p>
      </section>
    </div>
  );
}

'use client';
import { Loader2, Printer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { gradable, type Question } from '@/lib/questions';
import { computeResults, MODE_LABEL, scopesFor, type AnswerRow, type GradeRow, type Group, type Participant, type Session } from '@/lib/results';
import { errorText, supabase } from '@/lib/supabase';
import { useTeacher } from '@/lib/useTeacher';
import { fmtDate } from '@/lib/utils';

export default function Report({ params }: { params: { id: string } }) {
  const { ready, displayName } = useTeacher();
  const [d, setD] = useState<{ s: Session; qs: Question[]; p: Participant[]; g: Group[]; a: AnswerRow[]; gr: GradeRow[] } | null>(null);
  const [err, setErr] = useState('');
  const [details, setDetails] = useState(false);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      const sid = params.id;
      const [s, k, p, g, a, gr] = await Promise.all([
        supabase.from('sessions').select('*').eq('id', sid).single(),
        supabase.from('session_keys').select('questions').eq('session_id', sid).single(),
        supabase.from('participants').select('*').eq('session_id', sid).order('name'),
        supabase.from('groups').select('*').eq('session_id', sid).order('created_at'),
        supabase.from('answers').select('*').eq('session_id', sid),
        supabase.from('grades').select('*').eq('session_id', sid),
      ]);
      if (s.error) return setErr(errorText(s.error));
      setD({ s: s.data as any, qs: (k.data as any)?.questions || [], p: (p.data as any) || [], g: (g.data as any) || [], a: (a.data as any) || [], gr: (gr.data as any) || [] });
    })();
  }, [ready, params.id]);

  const res = useMemo(() => (d ? computeResults(d.qs, scopesFor(d.s, d.p, d.g), d.a, d.gr) : null), [d]);

  if (err) return <p className="p-10 text-center text-danger">{err}</p>;
  if (!d || !res) return <div className="flex justify-center py-24"><Loader2 className="animate-spin text-muted" /></div>;
  const gq = gradable(d.qs);
  const who = d.s.mode === 'group' ? 'المجموعة' : d.s.mode === 'shared' ? 'المساحة' : 'الطالب';

  return (
    <main className="mx-auto max-w-5xl bg-surface p-6 text-[13px] print:max-w-none print:p-0">
      <div className="no-print mb-6 flex flex-wrap items-center gap-3 rounded-xl bg-surface2 p-3">
        <button className="btn-primary" onClick={() => window.print()}><Printer size={16} /> طباعة أو حفظ PDF</button>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={details} onChange={(e) => setDetails(e.target.checked)} /> تضمين إجابات كل {who} بالتفصيل</label>
        <span className="hint">لحفظ PDF اختر «حفظ بتنسيق PDF» في نافذة الطباعة.</span>
      </div>

      <header className="mb-6 border-b-2 border-ink pb-4">
        <h1 className="text-2xl font-bold">تقرير نشاط: {d.s.title}</h1>
        <p className="mt-1">
          {[d.s.subject && `المادة: ${d.s.subject}`, d.s.grade && `الصف: ${d.s.grade}`, `المعلم: ${displayName}`, `التاريخ: ${fmtDate(d.s.created_at)}`, `الرمز: ${d.s.code}`, `النمط: ${MODE_LABEL[d.s.mode]}`].filter(Boolean).join('   |   ')}
        </p>
        {d.s.objective && <p className="mt-1"><b>الهدف التعليمي:</b> {d.s.objective}</p>}
      </header>

      <section className="mb-6 grid grid-cols-4 gap-3">
        {[['المشاركون', d.p.length], ['نسبة الإنجاز', `${res.completion}%`], ['متوسط الدرجات', `${res.avgScore} / ${res.max}`], ['أعلى درجة', `${Math.max(0, ...res.results.map((r) => r.finalScore))}`]].map(([l, v]) => (
          <div key={l as string} className="rounded-lg border border-line p-3"><p className="text-xl font-bold">{v}</p><p className="text-muted">{l}</p></div>
        ))}
      </section>

      <h2 className="mb-2 text-lg font-bold">النتائج</h2>
      <table className="mb-6 w-full border-collapse">
        <thead><tr className="bg-surface2">
          <th className="border border-line p-1.5 text-start">{who}</th>
          {gq.map((q, i) => <th key={q.id} className="border border-line p-1.5">س{i + 1} ({q.points})</th>)}
          <th className="border border-line p-1.5">المجموع</th><th className="border border-line p-1.5">%</th>
        </tr></thead>
        <tbody>
          {res.results.map((r) => (
            <tr key={r.scope.key}>
              <td className="border border-line p-1.5 font-semibold">{r.scope.name}{r.scope.members && d.s.mode === 'group' && <span className="block text-[11px] font-normal text-muted">{r.scope.members.join('، ')}</span>}</td>
              {gq.map((q) => <td key={q.id} className="border border-line p-1.5 text-center">{r.perQ[q.id].score ?? '؟'}</td>)}
              <td className="border border-line p-1.5 text-center font-bold">{r.finalScore} / {r.max}</td>
              <td className="border border-line p-1.5 text-center">{r.pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mb-2 text-lg font-bold">تحليل الأسئلة</h2>
      <table className="mb-6 w-full border-collapse">
        <thead><tr className="bg-surface2">
          <th className="border border-line p-1.5">السؤال</th><th className="border border-line p-1.5 text-start">النص</th>
          <th className="border border-line p-1.5">أجاب</th><th className="border border-line p-1.5">المتوسط</th><th className="border border-line p-1.5">الإتقان</th>
        </tr></thead>
        <tbody>
          {res.qStats.map((s, i) => (
            <tr key={s.q.id}>
              <td className="border border-line p-1.5 text-center">س{i + 1}</td>
              <td className="border border-line p-1.5">{(s.q.prompt || s.q.fillText || '').slice(0, 140)}</td>
              <td className="border border-line p-1.5 text-center">{s.answered}</td>
              <td className="border border-line p-1.5 text-center">{s.avg} / {s.q.points}</td>
              <td className="border border-line p-1.5 text-center font-bold">{s.scoredCount ? `${Math.round(s.ratio * 100)}%` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {details && res.results.map((r) => (
        <section key={r.scope.key} className="mb-6 break-before-page">
          <h2 className="mb-2 border-b border-line pb-1 text-lg font-bold">{r.scope.name}: {r.finalScore} / {r.max}</h2>
          {gq.map((q, i) => (
            <div key={q.id} className="mb-3">
              <p className="font-semibold">س{i + 1}. {q.prompt || q.fillText} <span className="font-normal text-muted">({r.perQ[q.id].score ?? '؟'} / {q.points})</span></p>
              <p className="whitespace-pre-wrap border-s-2 border-line ps-3">{r.perQ[q.id].text || '—'}</p>
              {r.perQ[q.id].grade?.feedback && <p className="text-muted">ملاحظة: {r.perQ[q.id].grade?.feedback}</p>}
            </div>
          ))}
          {r.overall?.feedback && <p className="mt-2"><b>ملاحظة عامة:</b> {r.overall.feedback}</p>}
        </section>
      ))}
    </main>
  );
}

'use client';
import { ArrowDown, ArrowRight, ArrowUp, Check, ChevronDown, Copy, Eye, Loader2, Play, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import LaunchModal from '@/components/LaunchModal';
import Modal from '@/components/Modal';
import QuestionEditor from '@/components/QuestionEditor';
import QuestionView from '@/components/QuestionView';
import TopBar from '@/components/TopBar';
import TypeIcon from '@/components/TypeIcon';
import { cleanQuestion, defaultQuestion, sanitize, totalPoints, TYPE_META, TYPE_ORDER, type Ans, type QType, type Question } from '@/lib/questions';
import type { Worksheet } from '@/lib/results';
import { errorText, supabase } from '@/lib/supabase';
import { useTeacher } from '@/lib/useTeacher';
import { cls, shortId } from '@/lib/utils';

export default function EditWorksheet({ params }: { params: { id: string } }) {
  const { ready } = useTeacher();
  const [ws, setWs] = useState<Worksheet | null>(null);
  const [err, setErr] = useState('');
  const [save, setSave] = useState<'saved' | 'saving' | 'error'>('saved');
  const [open, setOpen] = useState<string | null>(null);
  const [picker, setPicker] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);
  const [launch, setLaunch] = useState(false);
  const timer = useRef<any>(null);
  const latest = useRef<Worksheet | null>(null);

  useEffect(() => {
    if (!ready) return;
    supabase.from('worksheets').select('*').eq('id', params.id).single().then(({ data, error }) => {
      if (error) setErr(errorText(error));
      else { setWs(data as any); latest.current = data as any; }
    });
  }, [ready, params.id]);

  const persist = useCallback(async () => {
    const w = latest.current;
    if (!w) return;
    setSave('saving');
    const { error } = await supabase.from('worksheets').update({
      title: w.title, objective: w.objective, subject: w.subject, grade: w.grade, questions: w.questions, updated_at: new Date().toISOString(),
    }).eq('id', w.id);
    setSave(error ? 'error' : 'saved');
  }, []);

  const update = (patch: Partial<Worksheet>) => {
    setWs((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      latest.current = next;
      return next;
    });
    setSave('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(persist, 900);
  };

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (save === 'saving') { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [save]);

  if (err) return <><TopBar logoHref="/teacher" /><p className="p-10 text-center text-danger">{err}</p></>;
  if (!ws) return <><TopBar logoHref="/teacher" /><div className="flex justify-center py-24"><Loader2 className="animate-spin text-muted" /></div></>;

  const qs = ws.questions || [];
  const setQs = (questions: Question[]) => update({ questions });
  const addAt = (type: QType, at: number) => {
    const q = defaultQuestion(type);
    const n = [...qs];
    n.splice(at, 0, q);
    setQs(n);
    setOpen(q.id);
    setPicker(null);
  };
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= qs.length) return;
    const n = [...qs];
    [n[i], n[j]] = [n[j], n[i]];
    setQs(n);
  };
  let num = 0;

  return (
    <>
      <TopBar logoHref="/teacher">
        <span className={cls('hidden items-center gap-1.5 text-xs sm:flex', save === 'error' ? 'text-danger' : 'text-muted')} role="status">
          {save === 'saving' ? <><Loader2 size={13} className="animate-spin" /> جارٍ الحفظ</> : save === 'error' ? 'تعذّر الحفظ، تحقّق من الاتصال' : <><Check size={13} /> محفوظ</>}
        </span>
        <button className="btn-outline btn-sm" onClick={() => setPreview(true)}><Eye size={15} /> معاينة</button>
        <button className="btn-primary btn-sm" onClick={async () => { clearTimeout(timer.current); await persist(); setLaunch(true); }}><Play size={15} /> ابدأ نشاطًا</button>
      </TopBar>

      <main className="mx-auto max-w-4xl px-4 py-6">
        <Link href="/teacher" className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowRight size={15} /> كل الأوراق</Link>

        <section className="panel mb-6 space-y-4 p-5">
          <input className="w-full bg-transparent text-2xl font-bold focus:outline-none sm:text-3xl" value={ws.title} onChange={(e) => update({ title: e.target.value })} placeholder="عنوان ورقة العمل" aria-label="عنوان ورقة العمل" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">المادة</label><input className="input" value={ws.subject} onChange={(e) => update({ subject: e.target.value })} placeholder="مثال: التربية الإسلامية" /></div>
            <div><label className="label">الصف الدراسي</label><input className="input" value={ws.grade} onChange={(e) => update({ grade: e.target.value })} placeholder="مثال: الصف التاسع" /></div>
          </div>
          <div><label className="label">الهدف التعليمي</label><textarea className="input" rows={2} value={ws.objective} onChange={(e) => update({ objective: e.target.value })} placeholder="ما الذي سيتمكن منه الطالب بعد هذا النشاط؟" /></div>
          <p className="text-sm text-muted">{qs.filter((q) => q.type !== 'content').length} سؤال، المجموع {totalPoints(qs)} درجة</p>
        </section>

        <div className="space-y-3">
          {qs.map((q, i) => {
            const isOpen = open === q.id;
            const label = q.type === 'content' ? 'محتوى' : `السؤال ${++num}`;
            return (
              <div key={q.id}>
                <AddLine onClick={() => setPicker(i)} />
                <article className={cls('panel transition', isOpen && 'border-primary/50 shadow-lift')}>
                  <header className="flex items-center gap-2 p-3 ps-4">
                    <button className="flex min-w-0 flex-1 items-center gap-3 text-start" onClick={() => setOpen(isOpen ? null : q.id)} aria-expanded={isOpen}>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><TypeIcon type={q.type} /></span>
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-muted">{label} · {TYPE_META[q.type].label}{q.type !== 'content' && ` · ${q.points} درجة`}</span>
                        <span className="block truncate font-semibold">{q.prompt || (q.type === 'fill' ? q.fillText : '') || 'بدون نص بعد'}</span>
                      </span>
                      <ChevronDown size={18} className={cls('ms-auto shrink-0 text-muted transition', isOpen && 'rotate-180')} />
                    </button>
                    <div className="flex shrink-0">
                      <button className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="للأعلى"><ArrowUp size={16} /></button>
                      <button className="icon-btn" onClick={() => move(i, 1)} disabled={i === qs.length - 1} aria-label="للأسفل"><ArrowDown size={16} /></button>
                      <button className="icon-btn" aria-label="نسخ السؤال" onClick={() => { const n = [...qs]; n.splice(i + 1, 0, { ...JSON.parse(JSON.stringify(q)), id: shortId() }); setQs(n); }}><Copy size={16} /></button>
                      <button className="icon-btn hover:text-danger" aria-label="حذف السؤال" onClick={() => confirm('حذف هذا السؤال؟') && setQs(qs.filter((x) => x.id !== q.id))}><Trash2 size={16} /></button>
                    </div>
                  </header>
                  {isOpen && (
                    <div className="border-t border-line p-4">
                      <QuestionEditor q={q} onChange={(nq) => setQs(qs.map((x) => (x.id === q.id ? nq : x)))} />
                    </div>
                  )}
                </article>
              </div>
            );
          })}
        </div>

        <button onClick={() => setPicker(qs.length)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-line p-6 font-semibold text-muted transition hover:border-primary hover:text-primary">
          <Plus size={18} /> أضف سؤالًا أو نشاطًا
        </button>
      </main>

      <Modal open={picker !== null} onClose={() => setPicker(null)} title="اختر نوع السؤال أو النشاط" wide>
        <div className="grid gap-2 sm:grid-cols-2">
          {TYPE_ORDER.map((t) => (
            <button key={t} onClick={() => addAt(t, picker ?? qs.length)} className="flex items-start gap-3 rounded-xl border border-line p-3 text-start transition hover:border-primary hover:bg-primary/5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><TypeIcon type={t} /></span>
              <span>
                <span className="block font-bold">{TYPE_META[t].label}{TYPE_META[t].collab && <span className="chip ms-2 bg-accent/20 text-ink">جماعي</span>}</span>
                <span className="hint">{TYPE_META[t].desc}</span>
              </span>
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={preview} onClose={() => setPreview(false)} title={`معاينة كما يراها الطالب: ${ws.title}`} wide>
        <Preview qs={qs} />
      </Modal>

      <LaunchModal ws={ws} open={launch} onClose={() => setLaunch(false)} />
    </>
  );
}

function AddLine({ onClick }: { onClick: () => void }) {
  return (
    <div className="group relative flex h-3 items-center justify-center">
      <button onClick={onClick} className="absolute z-10 flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-muted opacity-0 transition hover:text-primary focus:opacity-100 group-hover:opacity-100" aria-label="إدراج سؤال هنا">
        <Plus size={12} /> إدراج
      </button>
    </div>
  );
}

function Preview({ qs }: { qs: Question[] }) {
  const [pub] = useState(() => qs.map((q) => sanitize(cleanQuestion(q))));
  const [ans, setAns] = useState<Record<string, Ans>>({});
  let n = 0;
  return (
    <div className="space-y-5">
      {pub.map((q) => (
        <div key={q.id} className="rounded-xl border border-line p-4">
          {q.type !== 'content' && <p className="mb-1 text-xs font-bold text-primary">السؤال {++n} ({q.points} درجة)</p>}
          {q.prompt && <p className="mb-3 whitespace-pre-wrap font-semibold">{q.prompt}</p>}
          <QuestionView
            q={q} ans={ans[q.id] || {}}
            meta={Object.fromEntries(Object.keys(ans[q.id]?.parts || {}).map((k) => [k, { name: 'أنت', mine: true }]))}
            onValue={(v) => setAns((a) => ({ ...a, [q.id]: { ...a[q.id], value: v } }))}
            onPart={(k, v) => setAns((a) => {
              const parts = { ...(a[q.id]?.parts || {}) };
              if (v === null) delete parts[k]; else parts[k] = v;
              return { ...a, [q.id]: { ...a[q.id], parts } };
            })}
          />
        </div>
      ))}
      {pub.length === 0 && <p className="text-muted">لا توجد أسئلة بعد.</p>}
    </div>
  );
}

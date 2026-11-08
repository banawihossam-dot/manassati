'use client';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import { useRef } from 'react';
import { parseFill, type Question } from '@/lib/questions';
import { cls, shortId } from '@/lib/utils';
import { MediaUpload } from './Media';

type Up = (patch: Partial<Question>) => void;

export default function QuestionEditor({ q, onChange }: { q: Question; onChange: (q: Question) => void }) {
  const up: Up = (patch) => onChange({ ...q, ...patch });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <div>
          <label className="label">{q.type === 'content' ? 'النص أو التعليمات' : 'نص السؤال'}</label>
          <textarea className="input" rows={q.type === 'content' ? 4 : 2} value={q.prompt} onChange={(e) => up({ prompt: e.target.value })} placeholder={q.type === 'content' ? 'نص قراءة أو تعليمات للطلاب' : 'اكتب السؤال هنا'} />
        </div>
        {q.type !== 'content' && (
          <div>
            <label className="label">الدرجة</label>
            <input className="input" type="number" min={0} step={0.5} value={q.points} onChange={(e) => up({ points: Math.max(0, Number(e.target.value) || 0) })} />
          </div>
        )}
      </div>

      {q.type !== 'image' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <span className="label">صورة (اختياري)</span>
            <MediaUpload value={q.image} onChange={(image) => up({ image })} />
            {q.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={q.image} alt="" className="mt-2 max-h-36 rounded-lg border border-line" />}
          </div>
          <VideoField q={q} up={up} />
        </div>
      )}

      <TypeFields q={q} up={up} />
    </div>
  );
}

function VideoField({ q, up }: { q: Question; up: Up }) {
  return (
    <div>
      <span className="label">فيديو (اختياري)</span>
      <input className="input mb-2" dir="ltr" value={q.video || ''} placeholder="رابط YouTube أو ملف فيديو" onChange={(e) => up({ video: e.target.value || undefined })} />
      <MediaUpload value={undefined} accept="video/*" label="رفع فيديو" onChange={(video) => video && up({ video })} />
    </div>
  );
}

function StringList({ items, onChange, placeholder, ordered, min = 1 }: {
  items: string[]; onChange: (v: string[]) => void; placeholder?: string; ordered?: boolean; min?: number;
}) {
  const set = (i: number, v: string) => onChange(items.map((x, k) => (k === i ? v : x)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const n = [...items];
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {ordered && <span className="w-6 shrink-0 text-center text-sm font-bold text-muted">{i + 1}</span>}
          <input className="input" value={it} placeholder={placeholder} onChange={(e) => set(i, e.target.value)} />
          {ordered && (
            <>
              <button type="button" className="icon-btn" onClick={() => move(i, -1)} aria-label="للأعلى"><ArrowUp size={15} /></button>
              <button type="button" className="icon-btn" onClick={() => move(i, 1)} aria-label="للأسفل"><ArrowDown size={15} /></button>
            </>
          )}
          <button type="button" className="icon-btn" onClick={() => onChange(items.filter((_, k) => k !== i))} disabled={items.length <= min} aria-label="حذف"><X size={15} /></button>
        </div>
      ))}
      <button type="button" className="btn-ghost btn-sm" onClick={() => onChange([...items, ''])}><Plus size={14} /> إضافة</button>
    </div>
  );
}

function AiFields({ q, up, idea }: { q: Question; up: Up; idea?: string }) {
  return (
    <div className="grid gap-3 rounded-xl bg-surface2/60 p-3 sm:grid-cols-2">
      <div>
        <label className="label">الإجابة النموذجية</label>
        <textarea className="input" rows={3} value={q.modelAnswer || ''} onChange={(e) => up({ modelAnswer: e.target.value })} placeholder={idea || 'ما الذي تتوقعه في الإجابة الكاملة؟'} />
      </div>
      <div>
        <label className="label">معايير التقييم</label>
        <textarea className="input" rows={3} value={q.rubric || ''} onChange={(e) => up({ rubric: e.target.value })} placeholder="مثال: ذكر سببين (درجتان)، دليل شرعي (درجة)، سلامة اللغة (درجة)" />
      </div>
      <p className="hint sm:col-span-2">يستخدم الذكاء الاصطناعي هذين الحقلين لاقتراح الدرجة، ولا تُعتمد الدرجة إلا بموافقتك. لا يراهما الطلاب.</p>
    </div>
  );
}

function TypeFields({ q, up }: { q: Question; up: Up }) {
  switch (q.type) {
    case 'mcq': {
      const correct = q.correct || [];
      const toggle = (i: number) => up({ correct: q.multi ? (correct.includes(i) ? correct.filter((x) => x !== i) : [...correct, i]) : [i] });
      const opts = q.options || [];
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="label mb-0">الخيارات (حدّد الصحيح)</span>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={!!q.multi} onChange={(e) => up({ multi: e.target.checked, correct: correct.slice(0, e.target.checked ? undefined : 1) })} />
              أكثر من إجابة صحيحة
            </label>
          </div>
          {opts.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <button type="button" onClick={() => toggle(i)} aria-label="إجابة صحيحة" aria-pressed={correct.includes(i)}
                className={cls('flex h-9 w-9 shrink-0 items-center justify-center border-2 font-bold', q.multi ? 'rounded-lg' : 'rounded-full', correct.includes(i) ? 'border-success bg-success text-white' : 'border-line text-muted')}>
                {correct.includes(i) ? '✓' : ''}
              </button>
              <input className="input" value={o} placeholder={`الخيار ${i + 1}`} onChange={(e) => up({ options: opts.map((x, k) => (k === i ? e.target.value : x)) })} />
              <button type="button" className="icon-btn" disabled={opts.length <= 2} aria-label="حذف الخيار"
                onClick={() => up({ options: opts.filter((_, k) => k !== i), correct: correct.filter((c) => c !== i).map((c) => (c > i ? c - 1 : c)) })}>
                <X size={15} />
              </button>
            </div>
          ))}
          {opts.length < 8 && <button type="button" className="btn-ghost btn-sm" onClick={() => up({ options: [...opts, ''] })}><Plus size={14} /> خيار</button>}
        </div>
      );
    }
    case 'tf':
      return (
        <div className="flex items-center gap-3">
          <span className="label mb-0">الإجابة الصحيحة:</span>
          {[true, false].map((v) => (
            <button key={String(v)} type="button" onClick={() => up({ tfAnswer: v })} className={cls('btn-sm btn border-2', q.tfAnswer === v ? 'border-success bg-success/10 text-success' : 'border-line')}>
              {v ? 'صح' : 'خطأ'}
            </button>
          ))}
        </div>
      );
    case 'short':
      return (
        <div className="space-y-3">
          <div>
            <label className="label">الإجابات المقبولة للتصحيح التلقائي</label>
            <input className="input" value={q.accepted || ''} onChange={(e) => up({ accepted: e.target.value })} placeholder="مثال: الشورى | مبدأ الشورى" />
            <p className="hint mt-1">افصل بين البدائل بالرمز |. تُتجاهل الهمزات والتشكيل والتاء المربوطة عند المقارنة. اتركه فارغًا للتصحيح اليدوي.</p>
          </div>
          <AiFields q={q} up={up} />
        </div>
      );
    case 'essay':
    case 'brainstorm':
      return <AiFields q={q} up={up} idea={q.type === 'brainstorm' ? 'الأفكار والحلول المتوقعة' : undefined} />;
    case 'long':
      return (
        <div className="space-y-3">
          <div>
            <span className="label">عناوين مربعات الكتابة</span>
            <StringList items={q.boxes || []} onChange={(boxes) => up({ boxes })} placeholder="عنوان المربع" />
          </div>
          <AiFields q={q} up={up} />
        </div>
      );
    case 'fill': {
      const { segs, ans } = parseFill(q.fillText);
      return (
        <div className="space-y-2">
          <label className="label">النص مع الفراغات</label>
          <textarea className="input" rows={4} value={q.fillText || ''} onChange={(e) => up({ fillText: e.target.value })} />
          <p className="hint">ضع كل إجابة بين قوسين مزدوجين: [[الإجابة]]. للبدائل: [[الصلاة|الصلوات]].</p>
          {ans.length > 0 && (
            <div className="rounded-xl bg-surface2/60 p-3 text-sm leading-8">
              <span className="font-semibold text-muted">معاينة: </span>
              {segs.map((s, i) => <span key={i}>{s}{i < segs.length - 1 && <span className="mx-1 rounded bg-primary/15 px-2 font-semibold text-primary">{ans[i].join(' / ')}</span>}</span>)}
            </div>
          )}
        </div>
      );
    }
    case 'match': {
      const pairs = q.pairs || [];
      const set = (i: number, k: 'left' | 'right', v: string) => up({ pairs: pairs.map((p, j) => (j === i ? { ...p, [k]: v } : p)) });
      return (
        <div className="space-y-2">
          <span className="label">الأزواج الصحيحة (تُخلط للطلاب تلقائيًا)</span>
          {pairs.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className="input" value={p.left} placeholder="العنصر" onChange={(e) => set(i, 'left', e.target.value)} />
              <span className="text-muted">⟵</span>
              <input className="input" value={p.right} placeholder="ما يناسبه" onChange={(e) => set(i, 'right', e.target.value)} />
              <button type="button" className="icon-btn" disabled={pairs.length <= 2} onClick={() => up({ pairs: pairs.filter((_, j) => j !== i) })} aria-label="حذف"><X size={15} /></button>
            </div>
          ))}
          <button type="button" className="btn-ghost btn-sm" onClick={() => up({ pairs: [...pairs, { left: '', right: '' }] })}><Plus size={14} /> زوج</button>
        </div>
      );
    }
    case 'order':
      return (
        <div>
          <span className="label">العناصر بترتيبها الصحيح (تُخلط للطلاب تلقائيًا)</span>
          <StringList items={q.items || []} onChange={(items) => up({ items })} placeholder="حدث أو خطوة" ordered min={2} />
        </div>
      );
    case 'drag': {
      const cats = q.categories || [];
      const setCat = (i: number, patch: any) => up({ categories: cats.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
      return (
        <div className="space-y-2">
          <span className="label">المجموعات وعناصر كل مجموعة</span>
          <div className="grid gap-3 sm:grid-cols-2">
            {cats.map((c, i) => (
              <div key={i} className="rounded-xl border border-line p-3">
                <div className="mb-2 flex gap-2">
                  <input className="input font-semibold" value={c.name} placeholder={`اسم المجموعة ${i + 1}`} onChange={(e) => setCat(i, { name: e.target.value })} />
                  <button type="button" className="icon-btn" disabled={cats.length <= 2} onClick={() => up({ categories: cats.filter((_, j) => j !== i) })} aria-label="حذف المجموعة"><Trash2 size={15} /></button>
                </div>
                <textarea className="input text-sm" rows={4} value={c.items.join('\n')} placeholder="عنصر في كل سطر" onChange={(e) => setCat(i, { items: e.target.value.split('\n') })} />
              </div>
            ))}
          </div>
          {cats.length < 6 && <button type="button" className="btn-ghost btn-sm" onClick={() => up({ categories: [...cats, { name: '', items: [''] }] })}><Plus size={14} /> مجموعة</button>}
        </div>
      );
    }
    case 'image':
      return <ImageEditor q={q} up={up} />;
    case 'table':
      return <TableEditor q={q} up={up} />;
    case 'cmap':
      return <CmapEditor q={q} up={up} />;
    default:
      return null;
  }
}

function ImageEditor({ q, up }: { q: Question; up: Up }) {
  const ms = q.markers || [];
  const add = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10;
    const y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
    up({ markers: [...ms, { id: shortId(), x, y, answer: '' }] });
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4">
        <div><span className="label">الصورة</span><MediaUpload value={q.image} onChange={(image) => up({ image })} /></div>
        <div className="min-w-[240px] flex-1"><VideoField q={q} up={up} /></div>
      </div>
      {q.image && (
        <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
          <div>
            <p className="hint mb-2">اضغط على الصورة لوضع رقم في الموضع الذي يسمّيه الطالب.</p>
            <div className="relative cursor-crosshair overflow-hidden rounded-xl border border-line" onClick={add}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={q.image} alt="" className="block w-full select-none" draggable={false} />
              {ms.map((m, i) => (
                <span key={m.id} style={{ left: `${m.x}%`, top: `${m.y}%` }} className="pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-accent text-sm font-bold text-[#2a1a00] shadow">{i + 1}</span>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <span className="label">الإجابات (البدائل بالرمز |)</span>
            {ms.length === 0 && <p className="text-sm text-muted">لا توجد مواضع بعد.</p>}
            {ms.map((m, i) => (
              <div key={m.id} className="flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-[#2a1a00]">{i + 1}</span>
                <input className="input" value={m.answer || ''} onChange={(e) => up({ markers: ms.map((x) => (x.id === m.id ? { ...x, answer: e.target.value } : x)) })} />
                <button type="button" className="icon-btn" onClick={() => up({ markers: ms.filter((x) => x.id !== m.id) })} aria-label="حذف"><X size={15} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TableEditor({ q, up }: { q: Question; up: Up }) {
  const cols = q.cols || [];
  const rows = q.rows || [];
  const ansGrid = q.cellAnswers || [];
  const setAns = (r: number, c: number, v: string) => {
    const g = rows.map((_, ri) => cols.map((__, ci) => ansGrid[ri]?.[ci] || ''));
    g[r][c] = v;
    up({ cellAnswers: g });
  };
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div><span className="label">عناوين الأعمدة</span><StringList items={cols} onChange={(c) => up({ cols: c })} placeholder="عنوان العمود" /></div>
        <div><span className="label">عناوين الصفوف</span><StringList items={rows} onChange={(r) => up({ rows: r })} placeholder="عنوان الصف" /></div>
      </div>
      <details className="rounded-xl bg-surface2/60 p-3">
        <summary className="cursor-pointer text-sm font-semibold">إجابات نموذجية للخلايا (للتصحيح التلقائي، اختياري)</summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead><tr><th />{cols.map((c, i) => <th key={i} className="p-1 text-start">{c}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  <th className="p-1 text-start font-semibold">{r}</th>
                  {cols.map((_, ci) => <td key={ci} className="p-1"><input className="input py-1.5 text-sm" value={ansGrid[ri]?.[ci] || ''} onChange={(e) => setAns(ri, ci, e.target.value)} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint mt-2">الخلايا التي تُترك فارغة هنا لا تدخل في التصحيح التلقائي.</p>
        </div>
      </details>
    </div>
  );
}

function CmapEditor({ q, up }: { q: Question; up: Up }) {
  const nodes = q.nodes || [];
  const edges = q.edges || [];
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<string | null>(null);
  const setNode = (id: string, patch: any) => up({ nodes: nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)) });
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !box.current) return;
    const r = box.current.getBoundingClientRect();
    const x = Math.min(92, Math.max(8, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(92, Math.max(8, ((e.clientY - r.top) / r.height) * 100));
    setNode(drag.current, { x: Math.round(x), y: Math.round(y) });
  };
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  return (
    <div className="space-y-3">
      <p className="hint">اسحب العقد لتغيير مواضعها. العقد «الفارغة» يملؤها الطلاب.</p>
      <div ref={box} className="relative h-[320px] touch-none overflow-hidden rounded-xl border border-line bg-surface2/40" onPointerMove={onMove} onPointerUp={() => (drag.current = null)} onPointerLeave={() => (drag.current = null)}>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {edges.map((e) => byId[e.from] && byId[e.to] && <line key={e.id} x1={byId[e.from].x} y1={byId[e.from].y} x2={byId[e.to].x} y2={byId[e.to].y} stroke="rgb(var(--muted))" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 2 }} />)}
        </svg>
        {nodes.map((n) => (
          <div key={n.id} onPointerDown={(e) => { drag.current = n.id; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); }}
            style={{ left: `${n.x}%`, top: `${n.y}%` }}
            className={cls('absolute w-32 -translate-x-1/2 -translate-y-1/2 cursor-move select-none rounded-xl border-2 px-2 py-1.5 text-center text-xs font-bold', n.blank ? 'border-dashed border-accent bg-surface text-muted' : 'border-primary bg-primary text-primary-ink')}>
            {n.blank ? (n.answer || 'فارغة') : n.label || 'عقدة'}
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <span className="label">العقد</span>
          {nodes.map((n) => (
            <div key={n.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2">
              <label className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={!!n.blank} onChange={(e) => setNode(n.id, { blank: e.target.checked })} /> فارغة</label>
              {n.blank ? (
                <input className="input flex-1 py-1.5 text-sm" value={n.answer || ''} placeholder="الإجابة (اختياري، البدائل بـ |)" onChange={(e) => setNode(n.id, { answer: e.target.value })} />
              ) : (
                <input className="input flex-1 py-1.5 text-sm" value={n.label} placeholder="نص العقدة" onChange={(e) => setNode(n.id, { label: e.target.value })} />
              )}
              <button type="button" className="icon-btn" disabled={nodes.length <= 2} aria-label="حذف العقدة" onClick={() => up({ nodes: nodes.filter((x) => x.id !== n.id), edges: edges.filter((e) => e.from !== n.id && e.to !== n.id) })}><X size={15} /></button>
            </div>
          ))}
          <button type="button" className="btn-ghost btn-sm" onClick={() => up({ nodes: [...nodes, { id: shortId(), label: '', x: 50, y: 50, blank: true, answer: '' }] })}><Plus size={14} /> عقدة</button>
        </div>
        <div className="space-y-2">
          <span className="label">الروابط</span>
          {edges.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line p-2 text-sm">
              {(['from', 'to'] as const).map((k) => (
                <select key={k} className="input w-auto flex-1 py-1.5 text-sm" value={e[k]} onChange={(ev) => up({ edges: edges.map((x) => (x.id === e.id ? { ...x, [k]: ev.target.value } : x)) })}>
                  {nodes.map((n, i) => <option key={n.id} value={n.id}>{n.blank ? `فارغة ${i + 1}` : n.label || `عقدة ${i + 1}`}</option>)}
                </select>
              ))}
              <input className="input flex-1 py-1.5 text-sm" value={e.label || ''} placeholder="كلمة الربط" onChange={(ev) => up({ edges: edges.map((x) => (x.id === e.id ? { ...x, label: ev.target.value } : x)) })} />
              <button type="button" className="icon-btn" aria-label="حذف الرابط" onClick={() => up({ edges: edges.filter((x) => x.id !== e.id) })}><X size={15} /></button>
            </div>
          ))}
          {nodes.length >= 2 && <button type="button" className="btn-ghost btn-sm" onClick={() => up({ edges: [...edges, { id: shortId(), from: nodes[0].id, to: nodes[1].id, label: '' }] })}><Plus size={14} /> رابط</button>}
        </div>
      </div>
    </div>
  );
}

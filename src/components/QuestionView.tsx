'use client';
import { ArrowDown, ArrowUp, Check, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { Ans, Question } from '@/lib/questions';
import { cls } from '@/lib/utils';
import { QuestionMedia } from './Media';

export interface PartMeta { name: string; mine: boolean }

interface Props {
  q: Question;
  ans: Ans;
  meta?: Record<string, PartMeta>;
  readOnly?: boolean;
  showAuthors?: boolean;
  onValue?: (v: any) => void;
  onPart?: (key: string, v: any | null) => void;
}

const NOTE_TINTS = ['bg-[#FFF2CC] dark:bg-[#4a3d17]', 'bg-[#DDF3EC] dark:bg-[#17413a]', 'bg-[#E7E4FA] dark:bg-[#2f2a52]', 'bg-[#FBE3E1] dark:bg-[#4d2523]'];

export default function QuestionView(props: Props) {
  const { q } = props;
  return (
    <div>
      {q.type !== 'image' && <QuestionMedia image={q.image} video={q.video} />}
      {q.type === 'image' && <QuestionMedia video={q.video} />}
      <Body {...props} />
    </div>
  );
}

function Body(p: Props) {
  switch (p.q.type) {
    case 'mcq': return <Mcq {...p} />;
    case 'tf': return <TrueFalse {...p} />;
    case 'short': return <TextAnswer {...p} rows={1} />;
    case 'essay': return <TextAnswer {...p} rows={7} />;
    case 'fill': return <Fill {...p} />;
    case 'match': return <Match {...p} />;
    case 'order': return <Order {...p} />;
    case 'drag': return <DragSort {...p} />;
    case 'image': return <ImageLabels {...p} />;
    case 'long': return <LongBoxes {...p} />;
    case 'table': return <FillTable {...p} />;
    case 'cmap': return <ConceptMap {...p} />;
    case 'brainstorm': return <Brainstorm {...p} />;
    default: return null;
  }
}

function Mcq({ q, ans, readOnly, onValue }: Props) {
  const sel: number[] = Array.isArray(ans.value) ? ans.value : [];
  const toggle = (i: number) => {
    if (readOnly) return;
    if (q.multi) onValue?.(sel.includes(i) ? sel.filter((x) => x !== i) : [...sel, i]);
    else onValue?.([i]);
  };
  return (
    <div className="grid gap-2 sm:grid-cols-2" role={q.multi ? 'group' : 'radiogroup'}>
      {(q.options || []).map((o, i) => o.trim() && (
        <button
          key={i} type="button" onClick={() => toggle(i)} disabled={readOnly}
          role={q.multi ? 'checkbox' : 'radio'} aria-checked={sel.includes(i)}
          className={cls(
            'flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-start transition',
            sel.includes(i) ? 'border-primary bg-primary/10' : 'border-line bg-surface hover:border-primary/50',
            readOnly && 'cursor-default'
          )}
        >
          <span className={cls('flex h-6 w-6 shrink-0 items-center justify-center border-2 text-xs font-bold', q.multi ? 'rounded-md' : 'rounded-full', sel.includes(i) ? 'border-primary bg-primary text-primary-ink' : 'border-line text-muted')}>
            {sel.includes(i) ? <Check size={14} /> : 'أبجد'.charAt(i) || i + 1}
          </span>
          <span className="font-medium">{o}</span>
        </button>
      ))}
      {q.multi && <p className="hint sm:col-span-2">يمكن اختيار أكثر من إجابة.</p>}
    </div>
  );
}

function TrueFalse({ ans, readOnly, onValue }: Props) {
  const opts: [boolean, string][] = [[true, 'صح'], [false, 'خطأ']];
  return (
    <div className="flex gap-3" role="radiogroup">
      {opts.map(([v, l]) => (
        <button
          key={l} type="button" role="radio" aria-checked={ans.value === v} disabled={readOnly}
          onClick={() => onValue?.(v)}
          className={cls(
            'flex-1 rounded-xl border-2 px-4 py-3 text-lg font-bold transition sm:flex-none sm:px-10',
            ans.value === v ? (v ? 'border-success bg-success/10 text-success' : 'border-danger bg-danger/10 text-danger') : 'border-line bg-surface hover:border-primary/50'
          )}
        >
          {v ? '✓' : '✗'} {l}
        </button>
      ))}
    </div>
  );
}

function AuthorLine({ meta, k, show }: { meta?: Record<string, PartMeta>; k: string; show?: boolean }) {
  const m = meta?.[k];
  if (!show || !m?.name) return null;
  return <p className="mt-1 text-[11px] text-muted">آخر تعديل: {m.mine ? 'أنت' : m.name}</p>;
}

function TextAnswer({ ans, readOnly, onValue, rows, meta, showAuthors }: Props & { rows: number }) {
  const v = typeof ans.value === 'string' ? ans.value : '';
  return (
    <div>
      {rows === 1 ? (
        <input className="input" value={v} readOnly={readOnly} placeholder="اكتب إجابتك هنا" onChange={(e) => onValue?.(e.target.value)} />
      ) : (
        <textarea className="input ruled min-h-[180px] leading-8" rows={rows} value={v} readOnly={readOnly} placeholder="اكتب إجابتك هنا" onChange={(e) => onValue?.(e.target.value)} />
      )}
      <AuthorLine meta={meta} k="" show={showAuthors} />
    </div>
  );
}

function Fill({ q, ans, readOnly, onValue }: Props) {
  const vals: string[] = Array.isArray(ans.value) ? ans.value : [];
  const segs = q.segments || [];
  const set = (i: number, t: string) => {
    const next = [...vals];
    while (next.length < (q.blanks || 0)) next.push('');
    next[i] = t;
    onValue?.(next);
  };
  return (
    <p className="whitespace-pre-wrap text-lg leading-[2.6]">
      {segs.map((s, i) => (
        <span key={i}>
          {s}
          {i < segs.length - 1 && (
            <input
              aria-label={`الفراغ ${i + 1}`}
              className="mx-1 inline-block w-36 border-0 border-b-2 border-dashed border-primary bg-primary/5 px-2 py-0.5 text-center text-base font-semibold text-ink focus:border-solid focus:outline-none"
              value={vals[i] || ''} readOnly={readOnly} onChange={(e) => set(i, e.target.value)}
            />
          )}
        </span>
      ))}
    </p>
  );
}

function Match({ q, ans, readOnly, onValue }: Props) {
  const vals: string[] = Array.isArray(ans.value) ? ans.value : [];
  const lefts = q.lefts || [];
  const rights = q.rights || [];
  const set = (i: number, r: string) => {
    const next = lefts.map((_, k) => vals[k] || '');
    next[i] = r;
    onValue?.(next);
  };
  return (
    <div className="space-y-2">
      {lefts.map((l, i) => (
        <div key={i} className="grid items-center gap-2 rounded-xl border border-line bg-surface p-2 sm:grid-cols-[1fr_auto_1fr]">
          <span className="rounded-lg bg-surface2 px-3 py-2 font-semibold">{l}</span>
          <span className="hidden text-muted sm:block" aria-hidden="true">⟵</span>
          <select className="input" value={vals[i] || ''} disabled={readOnly} onChange={(e) => set(i, e.target.value)} aria-label={`ما يناسب: ${l}`}>
            <option value="">اختر…</option>
            {rights.map((r, k) => <option key={k} value={r}>{r}{vals.includes(r) && vals[i] !== r ? ' (مستخدم)' : ''}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}

function Order({ q, ans, readOnly, onValue }: Props) {
  const list: string[] = Array.isArray(ans.value) && ans.value.length ? ans.value : q.shuffled || [];
  const [dragI, setDragI] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (readOnly || to < 0 || to >= list.length || from === to) return;
    const next = [...list];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    onValue?.(next);
  };
  const untouched = !Array.isArray(ans.value) || !ans.value.length;
  return (
    <div>
    {!readOnly && untouched && (
      <p className="mb-2 flex flex-wrap items-center gap-2 text-sm text-muted">
        رتّب العناصر بالسحب أو بالأسهم.
        <button type="button" className="btn-outline btn-sm" onClick={() => onValue?.(list)}><Check size={14} /> هذا الترتيب صحيح</button>
      </p>
    )}
    <ol className="space-y-2">
      {list.map((it, i) => (
        <li
          key={it + i}
          draggable={!readOnly}
          onDragStart={() => setDragI(i)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => { if (dragI !== null) move(dragI, i); setDragI(null); }}
          className={cls('flex items-center gap-2 rounded-xl border border-line bg-surface p-2 ps-3', dragI === i && 'opacity-50')}
        >
          {!readOnly && <GripVertical size={16} className="shrink-0 cursor-grab text-muted" aria-hidden="true" />}
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">{i + 1}</span>
          <span className="flex-1 font-medium">{it}</span>
          {!readOnly && (
            <span className="flex">
              <button type="button" className="icon-btn" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="تحريك للأعلى"><ArrowUp size={16} /></button>
              <button type="button" className="icon-btn" onClick={() => move(i, i + 1)} disabled={i === list.length - 1} aria-label="تحريك للأسفل"><ArrowDown size={16} /></button>
            </span>
          )}
        </li>
      ))}
    </ol>
    </div>
  );
}

function DragSort({ q, ans, readOnly, onValue }: Props) {
  const placed: Record<string, number> = ans.value && typeof ans.value === 'object' && !Array.isArray(ans.value) ? ans.value : {};
  const [picked, setPicked] = useState<string | null>(null);
  const pool = (q.pool || []).filter((it) => placed[it] === undefined);
  const place = (item: string, cat: number | null) => {
    if (readOnly) return;
    const next = { ...placed };
    if (cat === null) delete next[item]; else next[item] = cat;
    onValue?.(next);
    setPicked(null);
  };
  const chip = (it: string) => (
    <button
      key={it} type="button" draggable={!readOnly}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', it); setPicked(it); }}
      onClick={() => !readOnly && setPicked(picked === it ? null : it)}
      className={cls('rounded-lg border-2 px-3 py-1.5 text-sm font-semibold transition', picked === it ? 'border-accent bg-accent/20' : 'border-line bg-surface hover:border-primary/50')}
      aria-pressed={picked === it}
    >
      {it}
    </button>
  );
  return (
    <div className="space-y-3">
      <div
        className="flex min-h-[56px] flex-wrap gap-2 rounded-xl border-2 border-dashed border-line bg-surface2/50 p-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => place(e.dataTransfer.getData('text/plain'), null)}
        onClick={(e) => { if (picked && e.target === e.currentTarget) place(picked, null); }}
      >
        {pool.length ? pool.map((it) => chip(it)) : <span className="text-sm text-muted">وُزّعت جميع العناصر</span>}
      </div>
      {!readOnly && <p className="hint">اسحب العنصر إلى مجموعته، أو اضغط عليه ثم اضغط على المجموعة.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {(q.catNames || []).map((c, ci) => (
          <div
            key={ci}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => place(e.dataTransfer.getData('text/plain'), ci)}
            onClick={() => picked && place(picked, ci)}
            className={cls('min-h-[110px] rounded-xl border-2 p-3 transition', picked ? 'cursor-pointer border-primary/60 bg-primary/5' : 'border-line bg-surface')}
          >
            <p className="mb-2 font-bold text-primary">{c}</p>
            <div className="flex flex-wrap gap-2">
              {Object.keys(placed).filter((k) => placed[k] === ci).map((it) => chip(it))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImageLabels({ q, ans, readOnly, onValue }: Props) {
  const vals: string[] = Array.isArray(ans.value) ? ans.value : [];
  const ms = q.markers || [];
  const set = (i: number, t: string) => {
    const next = ms.map((_, k) => vals[k] || '');
    next[i] = t;
    onValue?.(next);
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      {q.image ? (
        <div className="relative w-full self-start overflow-hidden rounded-xl border border-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={q.image} alt="صورة السؤال" className="block w-full" />
          {ms.map((m, i) => (
            <span key={m.id} style={{ left: `${m.x}%`, top: `${m.y}%` }} className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-accent text-sm font-bold text-[#2a1a00] shadow">
              {i + 1}
            </span>
          ))}
        </div>
      ) : <p className="text-muted">لم تُرفع صورة لهذا السؤال.</p>}
      <div className="space-y-2">
        {ms.map((m, i) => (
          <label key={m.id} className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-[#2a1a00]">{i + 1}</span>
            <input className="input" value={vals[i] || ''} readOnly={readOnly} onChange={(e) => set(i, e.target.value)} placeholder="ما هذا الجزء؟" />
          </label>
        ))}
      </div>
    </div>
  );
}

function LongBoxes({ q, ans, readOnly, onValue, meta, showAuthors }: Props) {
  const vals: string[] = Array.isArray(ans.value) ? ans.value : [];
  const boxes = q.boxes || [];
  const set = (i: number, t: string) => {
    const next = boxes.map((_, k) => vals[k] || '');
    next[i] = t;
    onValue?.(next);
  };
  return (
    <div className="space-y-3">
      {boxes.map((b, i) => (
        <div key={i}>
          <label className="label">{b}</label>
          <textarea className="input ruled min-h-[130px] leading-8" value={vals[i] || ''} readOnly={readOnly} onChange={(e) => set(i, e.target.value)} />
        </div>
      ))}
      <AuthorLine meta={meta} k="" show={showAuthors} />
    </div>
  );
}

function FillTable({ q, ans, readOnly, onPart, meta, showAuthors }: Props) {
  const parts = ans.parts || {};
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full min-w-[480px] border-collapse text-sm">
        <thead>
          <tr className="bg-surface2">
            <th className="border-b border-line p-2" />
            {(q.cols || []).map((c, i) => <th key={i} className="border-b border-s border-line p-2 text-start font-bold">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {(q.rows || []).map((r, ri) => (
            <tr key={ri}>
              <th className="border-t border-line bg-surface2/60 p-2 text-start font-semibold">{r}</th>
              {(q.cols || []).map((_, ci) => {
                const k = `r${ri}c${ci}`;
                return (
                  <td key={ci} className="border-s border-t border-line p-1 align-top">
                    <textarea
                      rows={2} className="w-full resize-y rounded-lg bg-transparent p-2 text-sm focus:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={typeof parts[k] === 'string' ? parts[k] : ''} readOnly={readOnly}
                      onChange={(e) => onPart?.(k, e.target.value)} aria-label={`${r} - ${q.cols?.[ci]}`}
                    />
                    {showAuthors && meta?.[k]?.name && <span className="block px-2 text-[10px] text-muted">{meta[k].mine ? 'أنت' : meta[k].name}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConceptMap({ q, ans, readOnly, onPart, meta, showAuthors }: Props) {
  const parts = ans.parts || {};
  const nodes = q.nodes || [];
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  return (
    <div className="overflow-x-auto">
      <div className="relative h-[380px] min-w-[560px] rounded-xl border border-line bg-surface2/40">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {(q.edges || []).map((e) => byId[e.from] && byId[e.to] && (
            <line key={e.id} x1={byId[e.from].x} y1={byId[e.from].y} x2={byId[e.to].x} y2={byId[e.to].y} stroke="rgb(var(--muted))" strokeWidth="0.35" vectorEffect="non-scaling-stroke" style={{ strokeWidth: 2 }} />
          ))}
        </svg>
        {(q.edges || []).map((e) => e.label && byId[e.from] && byId[e.to] && (
          <span key={e.id + 'l'} style={{ left: `${(byId[e.from].x + byId[e.to].x) / 2}%`, top: `${(byId[e.from].y + byId[e.to].y) / 2}%` }} className="absolute -translate-x-1/2 -translate-y-1/2 rounded bg-bg px-1.5 text-xs text-muted">
            {e.label}
          </span>
        ))}
        {nodes.map((n) => (
          <div key={n.id} style={{ left: `${n.x}%`, top: `${n.y}%` }} className="absolute w-40 -translate-x-1/2 -translate-y-1/2">
            {n.blank ? (
              <div>
                <input
                  className="w-full rounded-xl border-2 border-dashed border-accent bg-surface px-2 py-2 text-center text-sm font-semibold focus:border-solid focus:outline-none"
                  value={typeof parts[`n${n.id}`] === 'string' ? parts[`n${n.id}`] : ''} readOnly={readOnly} placeholder="…"
                  onChange={(e) => onPart?.(`n${n.id}`, e.target.value)} aria-label="مفهوم فارغ"
                />
                {showAuthors && meta?.[`n${n.id}`]?.name && <span className="block text-center text-[10px] text-muted">{meta[`n${n.id}`].mine ? 'أنت' : meta[`n${n.id}`].name}</span>}
              </div>
            ) : (
              <div className="rounded-xl border-2 border-primary bg-primary px-2 py-2 text-center text-sm font-bold text-primary-ink">{n.label}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Brainstorm({ ans, readOnly, onPart, meta }: Props) {
  const parts = ans.parts || {};
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const keys = Object.keys(parts).filter((k) => parts[k]?.text);
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    const k = 'note-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    onPart?.(k, { text: t.slice(0, 400) });
    setDraft('');
  };
  return (
    <div className="space-y-3">
      {!readOnly && (
        <div className="flex gap-2">
          <textarea className="input min-h-[52px]" rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="أضف فكرة أو حلًّا…" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); } }} />
          <button type="button" className="btn-primary shrink-0" onClick={add} disabled={!draft.trim()}><Plus size={16} /> إضافة</button>
        </div>
      )}
      {keys.length === 0 && <p className="text-sm text-muted">لا توجد أفكار بعد. كن أول من يضيف فكرة.</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {keys.map((k, i) => {
          const m = meta?.[k];
          return (
            <div key={k} className={cls('pop rounded-xl p-3 shadow-sm', NOTE_TINTS[i % NOTE_TINTS.length])}>
              {editing === k ? (
                <div className="space-y-2">
                  <textarea className="input text-sm" rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} />
                  <div className="flex gap-1">
                    <button type="button" className="btn-primary btn-sm" onClick={() => { if (editText.trim()) onPart?.(k, { text: editText.trim().slice(0, 400) }); setEditing(null); }}><Check size={14} /> حفظ</button>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(null)}><X size={14} /> إلغاء</button>
                  </div>
                </div>
              ) : (
                <p className="whitespace-pre-wrap text-[15px] font-medium text-ink">{parts[k].text}</p>
              )}
              <div className="mt-2 flex items-center justify-between text-xs text-muted">
                <span>{m?.mine ? 'أنت' : m?.name || ''}</span>
                {m?.mine && !readOnly && editing !== k && (
                  <span className="flex">
                    <button type="button" className="icon-btn h-7 w-7" aria-label="تعديل" onClick={() => { setEditing(k); setEditText(parts[k].text); }}><Pencil size={13} /></button>
                    <button type="button" className="icon-btn h-7 w-7" aria-label="حذف" onClick={() => onPart?.(k, null)}><Trash2 size={13} /></button>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

'use client';
import { Plus, Shuffle, Trash2, UserX, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { answerToText, autograde, gradable, isAnswered, isCollab } from '@/lib/questions';
import { buildAnsMap } from '@/lib/results';
import { errorText, supabase } from '@/lib/supabase';
import { cls, fmtTime, groupColor, shuffle } from '@/lib/utils';
import TypeIcon from '../TypeIcon';
import type { Ctx } from './types';

export default function LivePanel({ ctx }: { ctx: Ctx }) {
  const { session, keyQs, participants, groups, answers, scopes, online, toast } = ctx;
  const gq = gradable(keyQs);
  const map = useMemo(() => buildAnsMap(answers), [answers]);
  const [qIdx, setQIdx] = useState(0);
  const [busy, setBusy] = useState(false);

  const contrib: Record<string, number> = {};
  const lastAt: Record<string, string> = {};
  answers.forEach((a) => {
    contrib[a.author_id] = (contrib[a.author_id] || 0) + 1;
    if (!lastAt[a.author_id] || a.updated_at > lastAt[a.author_id]) lastAt[a.author_id] = a.updated_at;
  });
  const scopeOf = (userId: string, groupId: string | null) => (session.mode === 'individual' ? userId : session.mode === 'shared' ? 'all' : groupId || '');
  const progressOf = (scope: string) => gq.filter((q) => isAnswered(q, map[scope]?.[q.id])).length;
  const active = participants.filter((p) => contrib[p.user_id]).length;
  const onlineCount = participants.filter((p) => online.has(p.user_id)).length;

  // ---- إدارة المجموعات ----
  const addGroup = async () => {
    const n = groups.length;
    const { error } = await supabase.from('groups').insert({ session_id: session.id, name: `المجموعة ${n + 1}`, color: n });
    if (error) toast(errorText(error), 'err'); else ctx.reloadPeople();
  };
  const moveTo = async (pid: string, gid: string) => {
    const { error } = await supabase.from('participants').update({ group_id: gid || null }).eq('id', pid);
    if (error) toast(errorText(error), 'err'); else ctx.reloadPeople();
  };
  const randomize = async () => {
    if (!participants.length) return;
    if (!confirm('إعادة توزيع جميع الطلاب عشوائيًا على مجموعات؟ تبقى إجابات كل مجموعة محفوظة لها.')) return;
    setBusy(true);
    try {
      const size = Math.max(2, session.group_size || 4);
      const needed = Math.ceil(participants.length / size);
      let gs = [...groups];
      for (let i = gs.length; i < needed; i++) {
        const { data, error } = await supabase.from('groups').insert({ session_id: session.id, name: `المجموعة ${i + 1}`, color: i }).select('*').single();
        if (error) throw error;
        gs.push(data as any);
      }
      gs = gs.slice(0, needed);
      const order = shuffle(participants);
      for (let i = 0; i < order.length; i++) {
        const { error } = await supabase.from('participants').update({ group_id: gs[i % needed].id }).eq('id', order[i].id);
        if (error) throw error;
      }
      toast('وُزّع الطلاب عشوائيًا');
    } catch (e) { toast(errorText(e), 'err'); }
    await ctx.reloadPeople();
    setBusy(false);
  };
  const rename = async (gid: string, name: string) => {
    if (!name.trim()) return;
    await supabase.from('groups').update({ name: name.trim() }).eq('id', gid);
  };
  const delGroup = async (gid: string) => {
    const { error } = await supabase.from('groups').delete().eq('id', gid);
    if (error) toast(errorText(error), 'err'); else ctx.reloadPeople();
  };
  const removeStudent = async (pid: string, name: string) => {
    if (!confirm(`إخراج ${name} من النشاط؟ تبقى إجاباته السابقة.`)) return;
    const { error } = await supabase.from('participants').delete().eq('id', pid);
    if (error) toast(errorText(error), 'err'); else ctx.reloadPeople();
  };

  const q = gq[Math.min(qIdx, gq.length - 1)];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['انضموا', participants.length, 'text-ink'],
          ['متصلون الآن', onlineCount, 'text-success'],
          ['شاركوا بإجابة', active, 'text-primary'],
          ['لم يشاركوا بعد', participants.length - active, 'text-danger'],
        ].map(([l, v, c]) => (
          <div key={l as string} className="panel p-4">
            <p className={cls('text-3xl font-bold', c as string)}>{v as number}</p>
            <p className="text-sm text-muted">{l as string}</p>
          </div>
        ))}
      </div>

      {session.mode === 'group' ? (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">المجموعات</h2>
            <div className="flex gap-2">
              <button className="btn-outline btn-sm" onClick={randomize} disabled={busy || !participants.length}><Shuffle size={14} /> توزيع عشوائي ({session.group_size} في كل مجموعة)</button>
              <button className="btn-outline btn-sm" onClick={addGroup}><Plus size={14} /> مجموعة</button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[...groups, { id: '', name: 'بلا مجموعة', color: -1 } as any].map((g) => {
              const members = participants.filter((p) => (p.group_id || '') === g.id);
              if (!g.id && !members.length) return null;
              return (
                <div key={g.id || 'none'} className="panel overflow-hidden">
                  <div className="flex items-center gap-2 border-b border-line px-3 py-2" style={g.id ? { borderInlineStart: `5px solid ${groupColor(g.color)}` } : undefined}>
                    {g.id ? (
                      <input className="flex-1 bg-transparent font-bold focus:outline-none" defaultValue={g.name} onBlur={(e) => rename(g.id, e.target.value)} aria-label="اسم المجموعة" />
                    ) : <span className="flex-1 font-bold text-muted">{g.name}</span>}
                    {g.id && <span className="text-xs text-muted">{progressOf(g.id)}/{gq.length}</span>}
                    {g.id && !members.length && <button className="icon-btn h-7 w-7" onClick={() => delGroup(g.id)} aria-label="حذف المجموعة"><Trash2 size={14} /></button>}
                  </div>
                  <ul className="divide-y divide-line">
                    {members.map((p) => (
                      <li key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                        <span className={cls('h-2.5 w-2.5 shrink-0 rounded-full', online.has(p.user_id) ? 'bg-success' : 'bg-line')} title={online.has(p.user_id) ? 'متصل' : 'غير متصل'} />
                        <span className={cls('flex-1 font-medium', !contrib[p.user_id] && 'text-muted')}>{p.name}</span>
                        <span className="text-xs text-muted">{contrib[p.user_id] || 0} مشاركة</span>
                        <select className="rounded-lg border border-line bg-surface px-1.5 py-1 text-xs" value={p.group_id || ''} onChange={(e) => moveTo(p.id, e.target.value)} aria-label={`نقل ${p.name}`}>
                          <option value="">بلا مجموعة</option>
                          {groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                        </select>
                      </li>
                    ))}
                    {!members.length && <li className="px-3 py-3 text-xs text-muted">لا أعضاء بعد</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section>
          <h2 className="mb-3 text-lg font-bold">الطلاب</h2>
          {participants.length === 0 ? (
            <div className="panel p-10 text-center text-muted"><Users className="mx-auto mb-2" />بانتظار انضمام الطلاب. اعرض الرمز على السبورة.</div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {participants.map((p) => {
                const prog = session.mode === 'individual' ? progressOf(p.user_id) : null;
                return (
                  <div key={p.id} className={cls('group flex items-center gap-2.5 rounded-xl border p-3', contrib[p.user_id] ? 'border-line bg-surface' : 'border-dashed border-danger/40 bg-danger/5')}>
                    <span className={cls('h-2.5 w-2.5 shrink-0 rounded-full', online.has(p.user_id) ? 'bg-success' : 'bg-line')} title={online.has(p.user_id) ? 'متصل' : 'غير متصل'} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{p.name}</p>
                      <p className="text-xs text-muted">
                        {prog !== null ? `${prog}/${gq.length} سؤال` : `${contrib[p.user_id] || 0} مشاركة`}
                        {lastAt[p.user_id] ? `، آخر نشاط ${fmtTime(lastAt[p.user_id])}` : '، لم يشارك بعد'}
                      </p>
                      {prog !== null && <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface2"><div className="h-full bg-primary" style={{ width: `${gq.length ? (prog / gq.length) * 100 : 0}%` }} /></div>}
                    </div>
                    <button className="icon-btn h-7 w-7 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => removeStudent(p.id, p.name)} aria-label={`إخراج ${p.name}`}><UserX size={14} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {q && (
        <section>
          <h2 className="mb-3 text-lg font-bold">الإجابات لحظة بلحظة</h2>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {gq.map((x, i) => {
              const answered = scopes.filter((s) => isAnswered(x, map[s.key]?.[x.id])).length;
              return (
                <button key={x.id} onClick={() => setQIdx(i)} className={cls('flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition', i === qIdx ? 'border-primary bg-primary text-primary-ink' : 'border-line bg-surface hover:border-primary/50')}>
                  <TypeIcon type={x.type} size={14} /> {i + 1}
                  <span className={cls('text-xs', i === qIdx ? 'opacity-80' : 'text-muted')}>({answered}/{scopes.length})</span>
                </button>
              );
            })}
          </div>
          <div className="panel p-4">
            <p className="mb-4 whitespace-pre-wrap font-semibold">{q.prompt || q.fillText}</p>
            {scopes.length === 0 ? <p className="text-muted">لا توجد مساحات عمل بعد.</p> : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {scopes.map((s) => {
                  const a = map[s.key]?.[q.id];
                  const ok = isAnswered(q, a);
                  const auto = ok ? autograde(q, a || {}) : null;
                  const authors = Array.from(new Set(answers.filter((r) => r.scope_key === s.key && r.question_id === q.id).map((r) => r.author_name)));
                  return (
                    <div key={s.key} className={cls('rounded-xl border p-3', ok ? 'border-line' : 'border-dashed border-line opacity-60')} style={s.color !== undefined ? { borderInlineStartWidth: 4, borderInlineStartColor: groupColor(s.color) } : undefined}>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <span className="font-bold">{s.name}</span>
                        {auto !== null && <span className={cls('chip', auto >= q.points ? 'bg-success/15 text-success' : auto > 0 ? 'bg-accent/20' : 'bg-danger/10 text-danger')}>{auto}/{q.points}</span>}
                      </div>
                      <p className="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm">{ok ? answerToText(q, a) : 'لم تُكتب إجابة بعد'}</p>
                      {(isCollab(q) || session.mode !== 'individual') && authors.length > 0 && <p className="mt-2 text-[11px] text-muted">شارك: {authors.join('، ')}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

'use client';
import { CheckCircle2, CloudOff, Eye, EyeOff, Loader2, LogOut, PartyPopper, RefreshCw, Users } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Chat from '@/components/Chat';
import Modal from '@/components/Modal';
import QuestionView, { type PartMeta } from '@/components/QuestionView';
import TopBar from '@/components/TopBar';
import { answerToText, describeCorrect, gradable, isAnswered, isCollab, type Question } from '@/lib/questions';
import { ansKey, buildAnsMap, type AnswerRow, type GradeRow, type Group, type Participant, type Session } from '@/lib/results';
import { errorText, supabase } from '@/lib/supabase';
import { BASE_PATH, cls, groupColor, round2 } from '@/lib/utils';

type Pending = Record<string, { row: Partial<AnswerRow>; del?: boolean }>;

export default function StudentWorkspace({ params }: { params: { id: string } }) {
  const sid = params.id;
  const [userId, setUserId] = useState('');
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Participant | null>(null);
  const [people, setPeople] = useState<Participant[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [rows, setRows] = useState<Record<string, AnswerRow>>({});
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [fatal, setFatal] = useState('');
  const [status, setStatus] = useState<'saved' | 'saving' | 'offline'>('saved');
  const [endedOpen, setEndedOpen] = useState(false);
  const [peersOpen, setPeersOpen] = useState<Record<string, boolean>>({});
  const pending = useRef<Pending>({});
  const flushing = useRef(false);
  const flushTimer = useRef<any>(null);
  const prevStatus = useRef<string | null>(null);

  const storeKey = `pending-${sid}`;
  const persistPending = () => { try { localStorage.setItem(storeKey, JSON.stringify(pending.current)); } catch {} };

  const flush = useCallback(async () => {
    if (flushing.current) return;
    const entries = Object.entries(pending.current);
    if (!entries.length) { setStatus('saved'); return; }
    flushing.current = true;
    setStatus('saving');
    const snapshot = Object.fromEntries(entries);
    const ups = entries.filter(([, p]) => !p.del).map(([, p]) => p.row);
    const dels = entries.filter(([, p]) => p.del);
    let ok = true;
    if (ups.length) {
      const { error } = await supabase.from('answers').upsert(ups, { onConflict: 'session_id,question_id,scope_key,part_key' });
      if (error) ok = false;
    }
    for (const [, p] of dels) {
      const { error } = await supabase.from('answers').delete().match({ session_id: sid, question_id: p.row.question_id, scope_key: p.row.scope_key, part_key: p.row.part_key });
      if (error) ok = false;
    }
    if (ok) {
      for (const [k, p] of Object.entries(snapshot)) if (pending.current[k] === p) delete pending.current[k];
      persistPending();
    }
    flushing.current = false;
    if (!ok) setStatus('offline');
    else if (Object.keys(pending.current).length) flush();
    else setStatus('saved');
  }, [sid]);

  const scheduleFlush = useCallback((ms = 500) => {
    clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flush, ms);
  }, [flush]);

  // التحميل الأول
  const loadPeople = useCallback(async (uidv: string) => {
    const [p, g] = await Promise.all([
      supabase.from('participants').select('*').eq('session_id', sid),
      supabase.from('groups').select('*').eq('session_id', sid).order('created_at'),
    ]);
    const list = (p.data as any as Participant[]) || [];
    setPeople(list);
    setMe(list.find((x) => x.user_id === uidv) || null);
    setGroups((g.data as any) || []);
  }, [sid]);

  const loadAnswers = useCallback(async () => {
    const { data } = await supabase.from('answers').select('*').eq('session_id', sid);
    const m: Record<string, AnswerRow> = {};
    (data as any as AnswerRow[] || []).forEach((r) => (m[ansKey(r.question_id, r.scope_key, r.part_key)] = r));
    // الإجابات غير المرسلة بعد تبقى كما كتبها الطالب
    Object.entries(pending.current).forEach(([k, p]) => {
      if (p.del) delete m[k]; else m[k] = { ...(m[k] || {}), ...(p.row as any) };
    });
    setRows(m);
  }, [sid]);

  const loadGrades = useCallback(async () => {
    const { data } = await supabase.from('grades').select('*').eq('session_id', sid);
    setGrades((data as any) || []);
  }, [sid]);

  useEffect(() => {
    let ch: any;
    let retry: any;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      if (!u) { setFatal('انتهت جلسة الدخول. ادخل من جديد بالرمز واسمك.'); return; }
      setUserId(u.id);
      try { pending.current = JSON.parse(localStorage.getItem(storeKey) || '{}'); } catch { pending.current = {}; }
      const { data: s, error } = await supabase.from('sessions').select('*').eq('id', sid).single();
      if (error || !s) { setFatal('لا يمكنك فتح ورقة العمل هذه. ادخل بالرمز من الصفحة الرئيسية.'); return; }
      setSession(s as any);
      prevStatus.current = (s as any).status;
      await Promise.all([loadPeople(u.id), loadAnswers(), (s as any).results_released ? loadGrades() : null]);
      if (Object.keys(pending.current).length) flush();

      ch = supabase.channel(`s-${sid}`, { config: { presence: { key: u.id } } })
        // أحداث الحذف لا تقبل التصفية في Supabase، لذا نستقبلها كلها ونطابق بالمعرّف
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'answers' }, (p: any) => {
          setRows((m) => {
            const k = Object.keys(m).find((x) => m[x].id === p.old?.id);
            if (!k || pending.current[k]) return m;
            const n = { ...m }; delete n[k]; return n;
          });
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'answers', filter: `session_id=eq.${sid}` }, (p: any) => {
          if (p.eventType === 'DELETE') return;
          const r = p.new as AnswerRow;
          const k = ansKey(r.question_id, r.scope_key, r.part_key);
          if (pending.current[k]) return;
          setRows((m) => ({ ...m, [k]: r }));
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sid}` }, (p: any) => {
          const ns = p.new as Session;
          setSession((old) => ({ ...(old as any), ...ns }));
          if (ns.status === 'ended' && prevStatus.current !== 'ended') { setEndedOpen(true); flush(); }
          prevStatus.current = ns.status;
          if (ns.results_released) loadGrades();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `session_id=eq.${sid}` }, () => loadPeople(u.id))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'groups', filter: `session_id=eq.${sid}` }, () => loadPeople(u.id))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'grades', filter: `session_id=eq.${sid}` }, () => loadGrades())
        .subscribe(async (st: string) => {
          if (st === 'SUBSCRIBED') {
            const name = (() => { try { return localStorage.getItem('student-name') || ''; } catch { return ''; } })();
            await ch.track({ user_id: u.id, name, at: Date.now() });
            loadAnswers();
          }
        });
    })();
    retry = setInterval(() => { if (Object.keys(pending.current).length) flush(); }, 4000);
    const online = () => { flush(); loadAnswers(); };
    window.addEventListener('online', online);
    const offline = () => setStatus('offline');
    window.addEventListener('offline', offline);
    return () => {
      if (ch) supabase.removeChannel(ch);
      clearInterval(retry);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid]);

  const myScope = useMemo(() => {
    if (!session || !userId) return null;
    if (session.mode === 'individual') return userId;
    if (session.mode === 'shared') return 'all';
    return me?.group_id || null;
  }, [session, userId, me]);

  const map = useMemo(() => buildAnsMap(Object.values(rows)), [rows]);
  const live = session?.status === 'live';
  const qs: Question[] = session?.questions_public || [];
  const myGroup = groups.find((g) => g.id === me?.group_id);

  const write = (q: Question, part: string, value: any) => {
    if (!myScope || !live || !me) return;
    const k = ansKey(q.id, myScope, part);
    const row: Partial<AnswerRow> = { session_id: sid, question_id: q.id, scope_key: myScope, part_key: part, value, author_id: userId, author_name: me.name, updated_at: new Date().toISOString() };
    if (value === null) {
      pending.current[k] = { row, del: true };
      setRows((m) => { const n = { ...m }; delete n[k]; return n; });
    } else {
      pending.current[k] = { row };
      setRows((m) => ({ ...m, [k]: { ...(m[k] || ({} as any)), ...(row as any) } }));
    }
    persistPending();
    setStatus('saving');
    const typing = typeof value === 'string' || (Array.isArray(value) && value.some((x) => typeof x === 'string')) || (value && typeof value.text === 'string');
    scheduleFlush(typing ? 700 : 150);
  };

  const metaFor = (qid: string): Record<string, PartMeta> => {
    const out: Record<string, PartMeta> = {};
    Object.values(rows).forEach((r) => {
      if (r.question_id === qid && r.scope_key === myScope) out[r.part_key] = { name: r.author_name, mine: r.author_id === userId };
    });
    return out;
  };

  const gq = gradable(qs);
  const done = myScope ? gq.filter((q) => isAnswered(q, map[myScope]?.[q.id])).length : 0;
  const pct = gq.length ? Math.round((done / gq.length) * 100) : 0;
  const released = !!session?.results_released && !!session?.show_results;
  const gradeOf = (qid: string) => grades.find((g) => g.question_id === qid && g.scope_key === myScope);
  const overall = myScope ? gradeOf('_overall') : undefined;
  const total = round2(gq.reduce((s, q) => s + (Number(gradeOf(q.id)?.score) || 0), 0));
  const maxTotal = gq.reduce((s, q) => s + (Number(q.points) || 0), 0);
  const finalScore = overall?.score !== null && overall?.score !== undefined ? Number(overall.score) : total;
  const revealQ = (id: string) => session?.reveal?.find((x) => x.id === id);
  const collabMode = session?.mode !== 'individual';

  if (fatal) {
    return (
      <><TopBar />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <p className="mb-4 text-lg font-semibold">{fatal}</p>
          <Link href="/" className="btn-primary">العودة إلى صفحة الدخول</Link>
        </main>
      </>
    );
  }
  if (!session || !userId) return <><TopBar /><div className="flex justify-center py-24"><Loader2 className="animate-spin text-muted" /></div></>;

  let num = 0;
  return (
    <>
      <TopBar>
        <span className={cls('flex items-center gap-1.5 text-xs font-semibold', status === 'offline' ? 'text-danger' : 'text-muted')} role="status" aria-live="polite">
          {status === 'saving' ? <><Loader2 size={13} className="animate-spin" /> جارٍ الحفظ</>
            : status === 'offline' ? <><CloudOff size={14} /> غير متصل، ستُحفظ إجاباتك تلقائيًا</>
            : <><CheckCircle2 size={14} className="text-success" /> محفوظ</>}
        </span>
        <button className="btn-ghost btn-sm" onClick={async () => { if (!confirm('تبقى إجاباتك محفوظة عند المعلم، لكن إن دخلت مجددًا ستبدأ ورقة جديدة. هل تريد الخروج؟')) return; await flush(); await supabase.auth.signOut(); try { localStorage.removeItem('student-name'); } catch {} window.location.href = `${BASE_PATH}/`; }} title="لست هذا الطالب؟">
          <LogOut size={14} /> خروج
        </button>
      </TopBar>

      <div className="sticky top-16 z-20 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{me?.name}{myGroup && <span className="chip ms-2 text-white" style={{ background: groupColor(myGroup.color) }}>{myGroup.name}</span>}</p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="نسبة الإنجاز">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <span className="shrink-0 text-sm font-bold text-primary">{done}/{gq.length}</span>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-6 pb-28">
        <header className="mb-6">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {session.subject && <span className="chip bg-primary/10 text-primary">{session.subject}</span>}
            {session.grade && <span className="chip bg-accent/15">{session.grade}</span>}
            {collabMode && <span className="chip bg-surface2"><Users size={12} /> {session.mode === 'shared' ? 'الصف كله يكتب في هذه الورقة' : 'مجموعتك تكتب معك في هذه الورقة'}</span>}
          </div>
          <h1 className="text-3xl font-bold">{session.title}</h1>
          {session.objective && <p className="mt-2 text-muted">{session.objective}</p>}
        </header>

        {!live && (
          <div className="mb-6 rounded-2xl border-2 border-accent/60 bg-accent/10 p-4">
            <p className="font-bold">انتهى النشاط، ولم يعد بالإمكان تعديل الإجابات.</p>
            {released ? (
              <p className="mt-1 text-lg">نتيجتك: <b>{finalScore}</b> من {maxTotal}</p>
            ) : session.show_results ? <p className="mt-1 text-sm text-muted">ستظهر نتيجتك هنا عندما ينشرها المعلم.</p> : null}
            {released && overall?.feedback && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-surface p-3 text-sm">{overall.feedback}</p>}
          </div>
        )}

        {session.mode === 'group' && !me?.group_id ? (
          <div className="panel p-10 text-center">
            <Loader2 className="mx-auto mb-3 animate-spin text-primary" />
            <p className="text-lg font-bold">بانتظار توزيعك على مجموعة</p>
            <p className="text-muted">سيبدأ النشاط تلقائيًا عندما يضيفك المعلم إلى مجموعة.</p>
          </div>
        ) : (
          <div className="space-y-5">
            {qs.map((q) => {
              const a = (myScope && map[myScope]?.[q.id]) || {};
              const g = released ? gradeOf(q.id) : undefined;
              const rq = revealQ(q.id);
              const others = session.show_peers ? Object.keys(map).filter((s) => s !== myScope && map[s][q.id] && isAnswered(q, map[s][q.id])) : [];
              const scopeName = (s: string) => session.mode === 'group' ? groups.find((x) => x.id === s)?.name || 'مجموعة' : people.find((p) => p.user_id === s)?.name || 'زميل';
              return (
                <section key={q.id} className="panel p-5" aria-labelledby={`q-${q.id}`}>
                  {q.type !== 'content' && (
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-primary">السؤال {++num}</span>
                      <span className="flex items-center gap-2 text-xs text-muted">
                        {isAnswered(q, a) && <CheckCircle2 size={14} className="text-success" aria-label="تمت الإجابة" />}
                        {g && g.score !== null ? <b className="text-ink">{g.score} / {q.points}</b> : `${q.points} درجة`}
                      </span>
                    </div>
                  )}
                  {q.prompt && <h2 id={`q-${q.id}`} className="mb-3 whitespace-pre-wrap text-lg font-semibold">{q.prompt}</h2>}
                  <QuestionView
                    q={q} ans={a} meta={metaFor(q.id)} readOnly={!live || !myScope}
                    showAuthors={collabMode || isCollab(q)}
                    onValue={(v) => write(q, '', v)} onPart={(k, v) => write(q, k, v)}
                  />
                  {g?.feedback && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-primary/10 p-3 text-sm"><b>ملاحظة المعلم: </b>{g.feedback}</p>}
                  {rq && describeCorrect(rq) && <p className="mt-3 whitespace-pre-wrap rounded-xl bg-success/10 p-3 text-sm"><b>الإجابة الصحيحة: </b>{describeCorrect(rq)}</p>}
                  {others.length > 0 && (
                    <div className="mt-4 border-t border-line pt-3">
                      <button className="btn-ghost btn-sm" onClick={() => setPeersOpen((x) => ({ ...x, [q.id]: !x[q.id] }))}>
                        {peersOpen[q.id] ? <EyeOff size={14} /> : <Eye size={14} />} إجابات {session.mode === 'group' ? 'المجموعات الأخرى' : 'الزملاء'} ({others.length})
                      </button>
                      {peersOpen[q.id] && (
                        <div className="mt-2 space-y-2">
                          {others.map((s) => (
                            <div key={s} className="rounded-xl bg-surface2/60 p-3 text-sm">
                              <p className="mb-1 text-xs font-bold text-muted">{scopeName(s)}</p>
                              <p className="whitespace-pre-wrap">{answerToText(q, map[s][q.id])}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        {live && myScope && (
          <div className="mt-8 rounded-2xl bg-surface2/70 p-5 text-center">
            <p className="font-semibold">{pct === 100 ? 'أجبت عن جميع الأسئلة. يمكنك المراجعة حتى ينهي المعلم النشاط.' : `أنجزت ${pct}% من الورقة.`}</p>
            <p className="hint mt-1">تُحفظ إجاباتك تلقائيًا مع كل تعديل، ولا حاجة إلى زر إرسال.</p>
            {status === 'offline' && <button className="btn-outline btn-sm mt-3" onClick={flush}><RefreshCw size={14} /> أعد المحاولة الآن</button>}
          </div>
        )}
      </main>

      {me && <Chat sessionId={sid} enabled={!!session.chat_enabled && live} myName={me.name} myId={userId} />}

      <Modal open={endedOpen} onClose={() => setEndedOpen(false)} title="انتهى النشاط">
        <div className="space-y-4 text-center">
          <PartyPopper className="mx-auto text-accent" size={40} />
          <p className="text-lg">أنهى المعلم النشاط، وحُفظت جميع إجاباتك.</p>
          {session.show_results && <p className="text-muted">ستظهر نتيجتك في أعلى الصفحة عندما ينشرها المعلم.</p>}
          <button className="btn-primary" onClick={() => setEndedOpen(false)}>حسنًا</button>
        </div>
      </Modal>
    </>
  );
}

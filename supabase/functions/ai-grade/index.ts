// دالة التصحيح بمساعدة الذكاء الاصطناعي (Supabase Edge Function)
// تقترح درجات للمعلم فقط، ولا تُعتمد إلا بموافقته. لا تُرسل أسماء الطلاب.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { answerToText, isAnswered, type Ans, type Question } from './questions.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM = `أنت مساعد تصحيح لمعلم في مدرسة. تقيّم إجابات الطلاب بإنصاف ودقة وفق الإجابة النموذجية ومعايير التقييم التي يحددها المعلم.
- امنح درجة عددية بين 0 والدرجة الكاملة، ويجوز استخدام أرباع الدرجة.
- اذكر سببًا مختصرًا للدرجة (جملة أو جملتان) موجّهًا للمعلم.
- اكتب تغذية راجعة تعليمية مشجعة موجّهة للطالب (جملة أو جملتان) تبيّن ما أحسن فيه وما يحتاج تحسينه.
- لا تعاقب على الأخطاء الإملائية البسيطة إلا إذا نصّت المعايير على ذلك.
- إن كانت الإجابة فارغة أو لا علاقة لها بالسؤال فدرجتها 0.
أعد JSON فقط بلا أي نص آخر وبلا علامات تنسيق، بهذا الشكل:
[{"id":"A1","score":3,"reason":"...","feedback":"..."}]`;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

function parseJson(text: string): any[] {
  const clean = text.replace(/```json|```/g, '').trim();
  const a = clean.indexOf('[');
  const b = clean.lastIndexOf(']');
  if (a < 0 || b < a) return [];
  try { return JSON.parse(clean.slice(a, b + 1)); } catch { return []; }
}

function publicKey(): string {
  const legacy = Deno.env.get('SUPABASE_ANON_KEY');
  if (legacy) return legacy;
  try { return JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}').default || ''; } catch { return ''; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'طريقة غير مدعومة.' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'التصحيح بالذكاء الاصطناعي غير مفعّل بعد. أضف المفتاح ANTHROPIC_API_KEY في أسرار Edge Functions في Supabase.' });

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'سجّل الدخول أولًا.' }, 401);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, publicKey(), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: u } = await db.auth.getUser(token);
  const user: any = u?.user;
  if (!user || user.is_anonymous) return json({ error: 'هذه الميزة للمعلم فقط.' }, 403);

  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const { sessionId, questionId } = body || {};
  if (!sessionId || !questionId) return json({ error: 'طلب غير مكتمل.' }, 400);

  const { data: session } = await db.from('sessions').select('id,teacher_id,subject,grade').eq('id', sessionId).single();
  if (!session || session.teacher_id !== user.id) return json({ error: 'لا تملك صلاحية على هذا النشاط.' }, 403);

  const { data: keyRow } = await db.from('session_keys').select('questions').eq('session_id', sessionId).single();
  const q: Question | undefined = ((keyRow?.questions as Question[]) || []).find((x) => x.id === questionId);
  if (!q) return json({ error: 'السؤال غير موجود.' }, 404);

  const [{ data: rows }, { data: existing }] = await Promise.all([
    db.from('answers').select('scope_key,part_key,value').eq('session_id', sessionId).eq('question_id', questionId),
    db.from('grades').select('scope_key,source,score').eq('session_id', sessionId).eq('question_id', questionId),
  ]);

  const byScope: Record<string, Ans> = {};
  (rows || []).forEach((r: any) => {
    const a = (byScope[r.scope_key] ||= {});
    if (r.part_key === '') a.value = r.value;
    else (a.parts ||= {})[r.part_key] = r.value;
  });
  const manual = new Set((existing || []).filter((g: any) => g.source === 'manual' && g.score !== null).map((g: any) => g.scope_key));

  const items = Object.entries(byScope)
    .filter(([scope, a]) => !manual.has(scope) && isAnswered(q, a))
    .map(([scope, a], i) => ({ id: `A${i + 1}`, scope, text: answerToText(q, a).slice(0, 4000) }));
  if (!items.length) return json({ count: 0 });

  const model = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-5-5';
  const points = Number(q.points) || 0;
  const header = [
    session.subject && `المادة: ${session.subject}`,
    session.grade && `الصف: ${session.grade}`,
    `السؤال: ${q.prompt || q.fillText || ''}`,
    q.type === 'long' && q.boxes?.length ? `أقسام الإجابة: ${q.boxes.join('، ')}` : '',
    `الدرجة الكاملة: ${points}`,
    `الإجابة النموذجية: ${q.modelAnswer || 'غير محددة، اعتمد على معرفتك بالموضوع'}`,
    `معايير التقييم: ${q.rubric || 'غير محددة، قيّم الصحة والاكتمال والوضوح'}`,
  ].filter(Boolean).join('\n');

  const out: any[] = [];
  for (let i = 0; i < items.length; i += 15) {
    const chunk = items.slice(i, i + 15);
    const content = `${header}\n\nإجابات الطلاب:\n${JSON.stringify(chunk.map(({ id, text }) => ({ id, text })))}`;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 4000, system: SYSTEM, messages: [{ role: 'user', content }] }),
    });
    if (!res.ok) {
      const t = await res.text();
      return json({ error: `تعذّر الاتصال بخدمة الذكاء الاصطناعي (${res.status}). ${t.slice(0, 200)}` });
    }
    const data = await res.json();
    const text = (data.content || []).map((c: any) => (c.type === 'text' ? c.text : '')).join('\n');
    parseJson(text).forEach((s) => {
      const item = chunk.find((c) => c.id === s.id);
      if (!item) return;
      const score = Math.max(0, Math.min(points, Math.round((Number(s.score) || 0) * 4) / 4));
      out.push({
        session_id: sessionId, question_id: questionId, scope_key: item.scope, max_score: points,
        ai_score: score, ai_reason: String(s.reason || '').slice(0, 1000), ai_feedback: String(s.feedback || '').slice(0, 1000),
        ai_pending: true, updated_at: new Date().toISOString(),
      });
    });
  }

  if (out.length) {
    const { error } = await db.from('grades').upsert(out, { onConflict: 'session_id,question_id,scope_key' });
    if (error) return json({ error: error.message });
  }
  return json({ count: out.length });
});

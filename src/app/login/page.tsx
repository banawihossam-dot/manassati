'use client';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import TopBar from '@/components/TopBar';
import { errorText, supabase, supabaseConfigured } from '@/lib/supabase';
import { BASE_PATH, cls } from '@/lib/utils';

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setInfo(''); setBusy(true);
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.push('/teacher');
      } else {
        if (name.trim().length < 2) throw new Error('اكتب اسمك كما سيظهر للطلاب.');
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { full_name: name.trim() }, emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}${BASE_PATH}/teacher/` : undefined },
        });
        if (error) throw error;
        if (data.session) router.push('/teacher');
        else setInfo('أرسلنا رسالة تأكيد إلى بريدك. افتحها ثم عد وسجّل الدخول.');
      }
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-md px-4 py-12">
        <div className="panel p-6 shadow-lift sm:p-8">
          <h1 className="mb-5 text-2xl font-bold">حساب المعلم</h1>
          {!supabaseConfigured && (
            <p className="mb-4 rounded-lg bg-accent/15 p-3 text-sm">
              لم تُضبط مفاتيح Supabase بعد. أضف NEXT_PUBLIC_SUPABASE_URL وNEXT_PUBLIC_SUPABASE_ANON_KEY في إعدادات الاستضافة كما في دليل التشغيل.
            </p>
          )}
          <div className="mb-5 flex rounded-xl bg-surface2 p-1">
            {(['in', 'up'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)} className={cls('tab flex-1', mode === m && 'tab-active')}>
                {m === 'in' ? 'تسجيل الدخول' : 'حساب جديد'}
              </button>
            ))}
          </div>
          <form onSubmit={submit} className="space-y-4">
            {mode === 'up' && (
              <div>
                <label className="label" htmlFor="tname">الاسم</label>
                <input id="tname" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: أ. محمد" />
              </div>
            )}
            <div>
              <label className="label" htmlFor="email">البريد الإلكتروني</label>
              <input id="email" type="email" dir="ltr" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="pw">كلمة المرور</label>
              <input id="pw" type="password" dir="ltr" required minLength={6} className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {err && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">{err}</p>}
            {info && <p role="status" className="rounded-lg bg-success/10 px-3 py-2 text-sm font-semibold text-success">{info}</p>}
            <button className="btn-primary h-12 w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" size={18} />}
              {mode === 'in' ? 'تسجيل الدخول' : 'إنشاء الحساب'}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}

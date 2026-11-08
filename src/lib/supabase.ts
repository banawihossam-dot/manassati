import { createClient } from '@supabase/supabase-js';

// مشروع Supabase الخاص بالمنصة. المفتاح العام (publishable) مصمَّم ليكون في المتصفح، والحماية مفروضة بقواعد RLS في قاعدة البيانات.
const DEFAULT_URL = 'https://ljzwufiuhbpuywqjtyzw.supabase.co';
const DEFAULT_KEY = 'sb_publishable_ro_D8XxzjifmB_rkkgyTEg_zPDuH-eT';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_KEY;

export const supabaseConfigured = !!url && !!key;

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 20 } },
});

/** المستخدم الحالي إن كان معلمًا (حساب حقيقي وليس دخول طالب مجهول) */
export async function getTeacher() {
  const { data } = await supabase.auth.getSession();
  const u: any = data.session?.user;
  if (!u || u.is_anonymous) return null;
  return u;
}

export function errorText(e: any): string {
  const m = String(e?.message || e || '');
  if (m.includes('code_not_found')) return 'لم نجد ورقة عمل بهذا الرمز. تأكد من الرمز وحاول مرة أخرى.';
  if (m.includes('session_ended')) return 'انتهى هذا النشاط ولم يعد يستقبل مشاركين جددًا.';
  if (m.includes('name_required')) return 'اكتب اسمك (حرفان على الأقل).';
  if (m.includes('Anonymous sign-ins are disabled'))
    return 'دخول الطلاب غير مفعّل بعد. على المعلم تفعيل Anonymous Sign-ins في إعدادات Supabase.';
  if (m.includes('Invalid login credentials')) return 'البريد أو كلمة المرور غير صحيحة.';
  if (m.includes('Email not confirmed')) return 'لم يُؤكَّد البريد بعد. افتح رسالة التأكيد في بريدك ثم سجّل الدخول.';
  if (m.includes('User already registered')) return 'هذا البريد مسجّل مسبقًا. استخدم تسجيل الدخول.';
  if (m.includes('Password should be')) return 'كلمة المرور قصيرة: 6 أحرف على الأقل.';
  if (m.toLowerCase().includes('failed to fetch')) return 'تعذّر الاتصال بالخادم. تحقّق من الإنترنت.';
  if (m.includes('row-level security')) return 'لا تملك صلاحية تنفيذ هذا الإجراء.';
  return m || 'حدث خطأ غير متوقع.';
}

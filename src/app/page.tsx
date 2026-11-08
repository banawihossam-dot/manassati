import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import JoinForm from '@/components/JoinForm';
import TopBar from '@/components/TopBar';

export default function Home() {
  return (
    <>
      <TopBar>
        <Link href="/login" className="btn-outline btn-sm"><GraduationCap size={16} /> دخول المعلم</Link>
      </TopBar>
      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:py-20">
        <section>
          <h1 className="text-4xl font-bold leading-[1.35] sm:text-5xl">ورقة واحدة،<br />وصفّ كامل يكتب فيها معًا</h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            يصمّم المعلم ورقة العمل ويشارك رمزها، فيدخل الطلاب بأسمائهم ويحلّون معًا، وتظهر كل مشاركة أمام المعلم لحظة كتابتها.
          </p>
          <ul className="mt-8 grid max-w-xl gap-3 text-[15px] sm:grid-cols-2">
            {[
              ['١٤ نوعًا من الأنشطة', 'من الاختيار والتوصيل إلى خرائط المفاهيم والتفكير الجماعي'],
              ['عمل فردي أو جماعي', 'مساحة لكل طالب، أو لكل مجموعة، أو مساحة مشتركة للصف'],
              ['تصحيح بثلاث طرق', 'تلقائي، ويدوي، وبمساعدة الذكاء الاصطناعي بعد موافقتك'],
              ['تقارير جاهزة', 'نقاط القوة والضعف ومقارنة المجموعات، مع تصدير Excel وPDF'],
            ].map(([t, d]) => (
              <li key={t} className="border-s-4 border-accent ps-3">
                <span className="block font-bold">{t}</span>
                <span className="text-muted">{d}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel p-6 shadow-lift sm:p-8">
          <h2 className="mb-1 text-2xl font-bold">أنا طالب</h2>
          <p className="mb-6 text-muted">لا تحتاج إلى حساب. اكتب الرمز واسمك فقط.</p>
          <JoinForm />
        </section>
      </main>
    </>
  );
}

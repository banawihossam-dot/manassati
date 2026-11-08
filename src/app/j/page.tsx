'use client';
import JoinForm from '@/components/JoinForm';
import TopBar from '@/components/TopBar';
import { useQueryParam } from '@/lib/useQuery';

export default function JoinByLink() {
  const code = useQueryParam('code');
  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-md px-4 py-12">
        <div className="panel p-6 shadow-lift sm:p-8">
          <h1 className="mb-1 text-2xl font-bold">الانضمام إلى ورقة العمل</h1>
          <p className="mb-6 text-muted">اكتب اسمك ثم ادخل.</p>
          {code !== undefined && <JoinForm initialCode={code || ''} />}
        </div>
      </main>
    </>
  );
}

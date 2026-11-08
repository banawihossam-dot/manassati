'use client';
import Link from 'next/link';
import View from '@/views/StudentWorkspace';
import { useQueryParam } from '@/lib/useQuery';

export default function Page() {
  const id = useQueryParam('id');
  if (id === undefined) return null;
  if (!id) return <p className="p-10 text-center">الرابط غير مكتمل. <Link href="/" className="text-primary underline">العودة للرئيسية</Link></p>;
  return <View key={id} params={{ id }} />;
}

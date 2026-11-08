'use client';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { errorText, supabase } from '@/lib/supabase';
import { youtubeEmbed } from '@/lib/utils';

export function QuestionMedia({ image, video, hideImage }: { image?: string; video?: string; hideImage?: boolean }) {
  if (!image && !video) return null;
  const yt = video ? youtubeEmbed(video) : null;
  return (
    <div className="my-3 space-y-3">
      {image && !hideImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="صورة السؤال" className="max-h-80 rounded-xl border border-line object-contain" />
      )}
      {video && (yt ? (
        <div className="aspect-video w-full max-w-2xl overflow-hidden rounded-xl border border-line">
          <iframe src={yt} className="h-full w-full" allow="encrypted-media; picture-in-picture" allowFullScreen title="فيديو السؤال" />
        </div>
      ) : (
        <video src={video} controls className="w-full max-w-2xl rounded-xl border border-line" />
      ))}
    </div>
  );
}

export async function uploadMedia(file: File): Promise<string> {
  const { data: s } = await supabase.auth.getSession();
  const user = s.session?.user;
  if (!user) throw new Error('سجّل الدخول أولًا');
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}

export function MediaUpload({ value, onChange, accept = 'image/*', label = 'رفع صورة' }: {
  value?: string; onChange: (url?: string) => void; accept?: string; label?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pick = async (f?: File | null) => {
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) { setErr('الملف أكبر من 25 ميغابايت.'); return; }
    setBusy(true); setErr('');
    try { onChange(await uploadMedia(f)); } catch (e) { setErr(errorText(e)); } finally { setBusy(false); }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
      <button type="button" className="btn-outline btn-sm" onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />} {value ? 'تغيير' : label}
      </button>
      {value && (
        <button type="button" className="btn-danger btn-sm" onClick={() => onChange(undefined)}>
          <Trash2 size={14} /> إزالة
        </button>
      )}
      {err && <span className="text-xs text-danger">{err}</span>}
    </div>
  );
}

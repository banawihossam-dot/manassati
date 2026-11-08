import Link from 'next/link';

/** شعار: ورقتان متداخلتان ترمزان إلى العمل المشترك على الورقة نفسها */
export default function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true">
        <rect x="9" y="3" width="20" height="25" rx="4" fill="rgb(var(--accent))" />
        <rect x="4" y="7" width="20" height="25" rx="4" fill="rgb(var(--primary))" />
        <path d="M9 15h10M9 20h10M9 25h6" stroke="rgb(var(--primary-ink))" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="leading-tight">
        <span className="block text-lg font-bold text-ink">منصتي</span>
        <span className="block text-[11px] font-medium text-muted">أوراق العمل الجماعية</span>
      </span>
    </Link>
  );
}

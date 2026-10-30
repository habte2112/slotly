const HAS_BRAND_LOGO = Boolean(import.meta.env.VITE_BRAND_ASSETS);

export default function Logo({ className = "h-9 w-9" }: { className?: string }) {
  if (HAS_BRAND_LOGO) {
    return <img src="/logo.png" alt="" className={`${className} rounded-full object-cover`} />;
  }
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#0f766e" />
      <rect x="7" y="9" width="18" height="16" rx="3" fill="none" stroke="#fff" strokeWidth="2" />
      <path d="M7 14h18" stroke="#fff" strokeWidth="2" />
      <path d="M12 7v4M20 7v4" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <path
        d="m12.5 19.5 2.5 2.5 4.5-4.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
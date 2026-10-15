type Kind = "hair" | "color" | "health" | "default";

// ስሙ ውስጥ ባለ ቃል ላይ ተመስርቶ አዶ ይመርጣል (ቀለም መጀመሪያ ይፈተሻል፣ "Hair Coloring" ን ለመለየት)
function kindOf(name: string): Kind {
  const n = name.toLowerCase();
  if (/colou?r|dye|tint/.test(n)) return "color";
  if (/hair|cut|barber|trim|style/.test(n)) return "hair";
  if (/check|doctor|clinic|health|consult|medical|dental|therapy/.test(n)) return "health";
  return "default";
}

export default function ServiceIcon({ name, className = "h-6 w-6" }: { name: string; className?: string }) {
  const kind = kindOf(name);
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {kind === "hair" && (
        <>
          <circle cx="6" cy="6" r="2.5" />
          <circle cx="6" cy="18" r="2.5" />
          <path d="M8 7.5 20 18M8 16.5 20 6" />
        </>
      )}
      {kind === "color" && <path d="M12 3.5s6 6.2 6 10.5a6 6 0 0 1-12 0c0-4.3 6-10.5 6-10.5Z" />}
      {kind === "health" && (
        <>
          <rect x="4" y="4" width="16" height="16" rx="4" />
          <path d="M12 8.5v7M8.5 12h7" />
        </>
      )}
      {kind === "default" && <path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />}
    </svg>
  );
}
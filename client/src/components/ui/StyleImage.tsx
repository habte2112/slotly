import { useState } from "react";
import ServiceIcon from "./ServiceIcon";

// ምስሉ ከጠፋ ወይም ካልተጫነ በአዶ ይተካል
export default function StyleImage({
  src,
  alt,
  serviceName,
  className = "",
}: {
  src: string | null;
  alt: string;
  serviceName: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-brand-50 text-brand-700 ${className}`} aria-hidden="true">
        <ServiceIcon name={serviceName} className="h-8 w-8" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
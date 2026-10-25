import React, { useState } from "react";
import { resolveImageUrl } from "../../api";

// Shows the trip image, or a coloured placeholder when there is none or it fails to load
export default function TripImage({ image, alt, className = "" }) {
  const [failed, setFailed] = useState(false);
  const src = resolveImageUrl(image);

  if (!src || failed) {
    return (
      <div className={`tm-image-fallback ${className}`} role="img" aria-label={alt}>
        <span>{(alt || "?").charAt(0).toUpperCase()}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

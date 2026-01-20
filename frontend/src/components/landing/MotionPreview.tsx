"use client";

import { useEffect, useState } from "react";

type MotionPreviewProps = {
  src?: string;
  poster?: string;
  alt: string;
  forceVideo?: boolean;
};

export default function MotionPreview({
  src,
  poster,
  alt,
  forceVideo = false,
}: MotionPreviewProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) =>
      setReducedMotion(event.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handler);
    } else {
      mediaQuery.addListener(handler);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener("change", handler);
      } else {
        mediaQuery.removeListener(handler);
      }
    };
  }, []);

  const sharedClassName =
    "w-full h-auto rounded-xl border border-white/10 shadow-lg bg-black/40";

  const shouldReduceMotion = reducedMotion && !forceVideo;

  if (shouldReduceMotion || !src) {
    if (poster) {
      return (
        <img
          src={poster}
          alt={alt}
          aria-label={alt}
          className={sharedClassName}
        />
      );
    }

    return (
      <div
        aria-label={alt}
        className={`${sharedClassName} flex items-center justify-center text-xs text-muted-foreground`}
      >
        Preview paused
      </div>
    );
  }

  return (
    <video
      src={src}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={alt}
      className={sharedClassName}
    />
  );
}

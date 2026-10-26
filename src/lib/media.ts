/** Uploaded media stays on this app's own disk, not on a third-party CDN. */
export function isLocalUpload(src: string): boolean {
  // Avoid Next's build-time static/optimizer lookup for runtime-created files.
  // /uploads is rewritten to our Node file route by next.config.ts.
  return src.startsWith("/uploads/");
}

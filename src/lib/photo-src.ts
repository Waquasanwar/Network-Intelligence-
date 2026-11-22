/**
 * The address a page uses for someone's photo, or null when they have not agreed to show one.
 * A photo in the Vercel Blob store is linked directly. A photo kept on the record is served from
 * /api/photo/<id> instead of being written into the page, so a page carries a short link per face
 * rather than the image itself, and the browser fetches only the faces it draws, once.
 * Shared by the app and its tests. No I/O.
 */
import { canShowPhoto } from "./privacy";

export function photoSrc(p: { id: string; photoUrl?: string | null; privacy?: unknown }): string | null {
  if (!canShowPhoto(p, "internal")) return null;
  const url = p.photoUrl!;
  if (!url.startsWith("data:")) return url;
  // A short fingerprint of the image, so a new photo is fetched afresh rather than served from cache.
  let h = 2166136261;
  for (let i = Math.max(0, url.length - 96); i < url.length; i++) h = Math.imul(h ^ url.charCodeAt(i), 16777619);
  return `/api/photo/${encodeURIComponent(p.id)}?v=${((h ^ url.length) >>> 0).toString(36)}`;
}

/**
 * The same address, from a light row: whether the photo is kept on the record, its Blob link if not,
 * and a fingerprint of it. For listing many people without reading every image out of the database.
 */
export function photoSrcFromRow(r: { id: string; privacy: unknown; inline: boolean; url: string | null; v: string }): string | null {
  if (!canShowPhoto({ photoUrl: r.inline ? "data:" : r.url, privacy: r.privacy }, "internal")) return null;
  return r.inline ? `/api/photo/${encodeURIComponent(r.id)}?v=${r.v.slice(0, 10)}` : r.url;
}

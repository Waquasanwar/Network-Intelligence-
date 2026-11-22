import { describe, it, expect } from "vitest";
import { photoSrc, photoSrcFromRow } from "./photo-src";

const agreed = { consents: { showPhoto: true } };
describe("photoSrc", () => {
  it("shows nothing without the person's consent, or once they ask to be erased", () => {
    expect(photoSrc({ id: "a", photoUrl: "data:image/jpeg;base64,AAAA", privacy: null })).toBeNull();
    expect(photoSrc({ id: "a", photoUrl: "https://x.public.blob.vercel-storage.com/p.jpg", privacy: { consents: { showPhoto: false } } })).toBeNull();
    expect(photoSrc({ id: "a", photoUrl: "data:image/jpeg;base64,AAAA", privacy: { ...agreed, erasureRequestedAt: "2026-11-01" } })).toBeNull();
  });
  it("links a stored file directly, and serves a photo kept on the record by address, never inline", () => {
    expect(photoSrc({ id: "a", photoUrl: "https://x.public.blob.vercel-storage.com/p.jpg", privacy: agreed })).toBe("https://x.public.blob.vercel-storage.com/p.jpg");
    const src = photoSrc({ id: "a b", photoUrl: "data:image/jpeg;base64,AAAA", privacy: agreed })!;
    expect(src).toMatch(/^\/api\/photo\/a%20b\?v=[0-9a-z]+$/);
    expect(src).not.toContain("base64");
  });
  it("gives a new address when the photo changes, so the old one is not served from cache", () => {
    const a = photoSrc({ id: "a", photoUrl: "data:image/jpeg;base64,AAAA", privacy: agreed });
    const b = photoSrc({ id: "a", photoUrl: "data:image/jpeg;base64,BBBB", privacy: agreed });
    expect(a).not.toBe(b);
  });
  it("works from a light row too, without the image itself", () => {
    expect(photoSrcFromRow({ id: "a", privacy: agreed, inline: true, url: null, v: "0123456789abcdef" })).toBe("/api/photo/a?v=0123456789");
    expect(photoSrcFromRow({ id: "a", privacy: null, inline: true, url: null, v: "0123456789abcdef" })).toBeNull();
  });
});

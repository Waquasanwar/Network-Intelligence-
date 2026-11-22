import { put, del } from "@vercel/blob";

/**
 * Where photos live. With a Vercel Blob store connected (BLOB_READ_WRITE_TOKEN), each photo is a
 * small public file under an unguessable name; without one, the small resized image is kept inline
 * on the record, so the feature works the same in a local copy. Either way a photo is a 384px JPEG
 * the browser made, never the original file.
 */
export const MAX_PHOTO_BYTES = 400_000;
const isBlob = (url: string | null | undefined) => !!url && /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i.test(url);

/** A JPEG starts FF D8 FF. Anything else is refused, whatever it calls itself. */
export function looksLikeJpeg(bytes: Uint8Array) {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export async function storePhoto(personId: string, bytes: Uint8Array): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const r = await put(`photos/${personId}.jpg`, Buffer.from(bytes), { access: "public", contentType: "image/jpeg", addRandomSuffix: true, cacheControlMaxAge: 60 * 60 * 24 * 30 });
    return r.url;
  }
  return `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`;
}

/** Remove the stored file when a photo is replaced or deleted. Inline photos go with the record. */
export async function discardPhoto(url: string | null | undefined) {
  if (isBlob(url) && process.env.BLOB_READ_WRITE_TOKEN) await del(url!).catch(() => {});
}

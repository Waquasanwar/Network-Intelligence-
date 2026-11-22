"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { setMyPhoto, removeMyPhoto } from "@/server/actions/privacy";

const SIDE = 384;

/** Crop the middle square of any picture and make it a small JPEG, in the browser, before it is sent. */
async function squareJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const c = document.createElement("canvas"); c.width = SIDE; c.height = SIDE;
  const g = c.getContext("2d"); if (!g) throw new Error("no canvas");
  g.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIDE, SIDE);
  bmp.close();
  return await new Promise<Blob>((ok, no) => c.toBlob((b) => (b ? ok(b) : no(new Error("encode"))), "image/jpeg", 0.86));
}

/**
 * Your own photo: add one, change it, or take it away. Adding it is the choice to show it, to
 * members and the team inside the network; clients never see it on an anonymised card.
 */
export function PhotoPicker({ person, photo }: { person: { firstName: string; lastName: string }; photo: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(photo);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const pick = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!/^image\//.test(file.type)) { setError("Choose a picture: a JPG, PNG or HEIC from your phone works."); return; }
    start(async () => {
      try {
        const jpeg = await squareJpeg(file);
        setPreview(URL.createObjectURL(jpeg));
        const fd = new FormData(); fd.set("photo", new File([jpeg], "photo.jpg", { type: "image/jpeg" }));
        const r = await setMyPhoto(fd);
        if (!r.ok) { setError(r.error ?? "That did not work. Try again."); setPreview(photo); return; }
        router.refresh();
      } catch { setError("That picture could not be read. Try a different one."); setPreview(photo); }
    });
  };

  return (
    <div className="photo-picker" data-photo-picker>
      <button type="button" className="photo-picker-face" onClick={() => input.current?.click()} aria-label={preview ? "Change your photo" : "Add a photo"} disabled={pending}>
        <Avatar person={person} size="xl" src={preview} />
        <span className="photo-picker-badge" aria-hidden="true"><Camera className="h-3.5 w-3.5" /></span>
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink">{preview ? "Your photo" : "Add a photo"}</p>
        <p className="mt-0.5 text-[12.5px] leading-[1.5] text-ink-muted">{preview ? "Members and the team see it inside the network. Clients never see it on an anonymised card." : "Optional. Members and the team will see it inside the network; clients never do until you agree to an introduction."}</p>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[12.5px] font-semibold text-ink hover:border-line-strong" onClick={() => input.current?.click()} disabled={pending}>
            <Camera className="h-3.5 w-3.5" aria-hidden="true" />{pending ? "Saving…" : preview ? "Change photo" : "Choose a photo"}
          </button>
          {preview && !pending ? (
            <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold text-ink-muted hover:text-ink" onClick={() => start(async () => { await removeMyPhoto(); setPreview(null); router.refresh(); })}>
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Remove
            </button>
          ) : null}
        </div>
        {error ? <p role="alert" className="mt-2 text-[12.5px] font-medium text-coral-ink">{error}</p> : null}
      </div>
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} data-photo-input />
    </div>
  );
}

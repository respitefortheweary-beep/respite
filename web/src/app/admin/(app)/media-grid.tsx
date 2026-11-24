/* eslint-disable @next/next/no-img-element */
import { X } from "lucide-react";
import { MediaUpload } from "./media";
import type { MediaOwner } from "../actions";

type Act = (src: string) => () => Promise<void>;

/** The photos and videos already saved on a room or a house, with the uploader at the end. */
export function MediaGrid({
  kind,
  id,
  photos,
  videos,
  canUpload,
  cover,
  removePhoto,
  removeVideo,
}: {
  kind: MediaOwner;
  id: string;
  photos: string[];
  videos: string[];
  canUpload: boolean;
  cover: Act;
  removePhoto: Act;
  removeVideo: Act;
}) {
  const remove = (action: () => Promise<void>, what: string) => (
    <form action={action} className="absolute right-1.5 top-1.5">
      <button aria-label={`Remove ${what}`} className="press grid h-9 w-9 place-items-center rounded-full bg-night/75 text-white backdrop-blur-sm transition-colors hover:bg-ember">
        <X size={15} />
      </button>
    </form>
  );
  return (
    <div className="grid grid-cols-2 gap-3 p-5 pt-4 sm:grid-cols-3 sm:p-6 sm:pt-4">
      {photos.map((p, i) => (
        <div key={p} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-ink/[.05] ring-1 ring-line">
          <img src={p} alt="" className="h-full w-full object-cover" />
          {i === 0 ? (
            <span className="mono absolute bottom-1.5 left-1.5 inline-flex h-6 items-center rounded-full bg-porch px-2.5 text-[0.78rem] font-semibold text-white">Cover</span>
          ) : (
            <form action={cover(p)} className="absolute bottom-1.5 left-1.5">
              <button className="press inline-flex h-8 items-center rounded-full bg-night/75 px-3 text-[0.78rem] font-medium text-white backdrop-blur-sm transition-colors hover:bg-night">Make cover</button>
            </form>
          )}
          {remove(removePhoto(p), "photo")}
        </div>
      ))}
      {videos.map((v) => (
        <div key={v} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-night ring-1 ring-line">
          <video src={v} controls playsInline preload="metadata" className="h-full w-full object-cover" />
          <span className="mono pointer-events-none absolute bottom-1.5 left-1.5 inline-flex h-6 items-center rounded-full bg-night/75 px-2.5 text-[0.78rem] font-semibold text-white">Video</span>
          {remove(removeVideo(v), "video")}
        </div>
      ))}
      {process.env.SHOWCASE || !canUpload ? (
        <div className="flex aspect-[4/3] items-center justify-center rounded-xl border border-dashed border-line-strong p-3 text-center text-[0.82rem] leading-snug text-moss">Adding photos and videos is switched on in the live version.</div>
      ) : (
        <MediaUpload kind={kind} id={id} />
      )}
    </div>
  );
}

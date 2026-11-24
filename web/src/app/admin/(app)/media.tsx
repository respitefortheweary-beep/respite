"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, Play, X } from "lucide-react";
import { MEDIA_ACCEPT, isVideo, sendMedia, type Progress } from "@/lib/send-media";
import type { MediaOwner } from "../actions";

const tile = "relative aspect-[4/3] overflow-hidden rounded-lg bg-ink/[.05] ring-1 ring-line";
const addTile =
  "press flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-strong p-2 text-center text-[0.8rem] font-medium transition-colors hover:bg-ink/[.03] focus-within:ring-2 focus-within:ring-ink";

/** Photos and videos picked but not sent yet: the Add a house form sends them once the house exists. */
export function MediaPicker({ files, onChange, max = 20, label = "Add photos or videos" }: { files: File[]; onChange: (f: File[]) => void; max?: number; label?: string }) {
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const firstPhoto = files.findIndex((f) => !isVideo(f));
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {files.map((f, i) => (
        <div key={previews[i]} className={tile}>
          {isVideo(f) ? (
            <>
              <video src={previews[i]} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-night/70 text-white">
                  <Play size={14} fill="currentColor" />
                </span>
              </span>
            </>
          ) : (
            <img src={previews[i]} alt="" className="h-full w-full object-cover" />
          )}
          {i === firstPhoto && <span className="mono absolute bottom-1 left-1 rounded-full bg-porch px-2 py-0.5 text-[0.72rem] font-semibold text-white">Cover</span>}
          <button
            type="button"
            aria-label={`Take ${f.name} out`}
            onClick={() => onChange(files.filter((_, j) => j !== i))}
            className="press absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-night/75 text-white hover:bg-ember"
          >
            <X size={13} />
          </button>
        </div>
      ))}
      {files.length < max && (
        <label className={addTile}>
          <ImagePlus size={18} />
          {files.length ? "Add more" : label}
          <input
            type="file"
            multiple
            accept={MEDIA_ACCEPT}
            className="sr-only"
            onChange={(e) => {
              const picked = [...(e.currentTarget.files ?? [])];
              onChange([...files, ...picked].slice(0, max));
              e.currentTarget.value = "";
            }}
          />
        </label>
      )}
    </div>
  );
}

const mbText = (n: number) => `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;

/** On a room or house page: pick photos and videos and they upload straight away, with a progress bar. */
export function MediaUpload({ kind, id }: { kind: MediaOwner; id: string }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const stop = useRef<AbortController | null>(null);

  // Leaving the page mid-upload would lose it, so the browser asks first.
  useEffect(() => {
    if (!progress) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [progress]);

  const upload = async (files: File[]) => {
    setError("");
    setDone("");
    stop.current = new AbortController();
    const { added, error } = await sendMedia(kind, id, files, undefined, { onProgress: setProgress, signal: stop.current.signal });
    setProgress(null);
    stop.current = null;
    if (error) setError(error);
    if (added) setDone(added === 1 ? (files.length === 1 && isVideo(files[0]) ? "Video added." : "Added.") : `${added} added.`);
    if (input.current) input.current.value = "";
  };

  const pct = progress?.total ? Math.min(100, Math.round(((progress.sent ?? 0) / progress.total) * 100)) : 0;
  const busy = !!progress;

  return (
    <>
      {busy ? (
        <div role="status" aria-live="polite" className="flex aspect-[4/3] flex-col justify-center gap-2.5 rounded-xl bg-ink/[.03] p-3.5 ring-1 ring-line">
          <p className="flex items-center gap-2 text-[0.86rem] font-medium">
            <Loader2 size={15} className="shrink-0 animate-spin" />
            <span className="truncate">
              {progress.of > 1 ? `${progress.at} of ${progress.of}: ` : ""}
              {progress.video ? (pct >= 100 ? "Finishing video" : "Uploading video") : "Uploading photo"}
            </span>
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-ink/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Upload progress">
            <div className="h-full rounded-full bg-porch transition-[width] duration-300 ease-out" style={{ width: `${progress.video ? Math.max(pct, 2) : 100}%` }} />
          </div>
          <div className="flex items-center justify-between gap-2 text-[0.76rem] text-moss">
            <span className="mono tabular">{progress.video && progress.total ? `${pct}% · ${mbText(progress.sent ?? 0)} of ${mbText(progress.total)}` : "Working"}</span>
            <button type="button" onClick={() => stop.current?.abort()} className="press rounded-full px-2 py-1 font-medium text-ink hover:bg-ink/[.06]">
              Stop
            </button>
          </div>
        </div>
      ) : (
        <label className="press flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong p-3 text-center text-[0.86rem] font-medium transition-colors hover:bg-ink/[.03] focus-within:ring-2 focus-within:ring-ink">
          <ImagePlus size={20} />
          Add photos or videos
          <span className="text-[0.76rem] font-normal text-moss">Photos: JPG, PNG, WebP. Videos: MP4, MOV, WebM, up to 100 MB.</span>
          <input ref={input} type="file" multiple accept={MEDIA_ACCEPT} className="sr-only" onChange={(e) => e.currentTarget.files?.length && upload([...e.currentTarget.files])} />
        </label>
      )}
      {error && (
        <p role="alert" className="col-span-full rounded-xl bg-ember/10 px-3.5 py-2.5 text-[0.88rem] text-ember ring-1 ring-ember/25">
          {error}
        </p>
      )}
      {done && !error && (
        <p role="status" className="col-span-full rounded-xl bg-pine/10 px-3.5 py-2.5 text-[0.88rem] text-pine ring-1 ring-pine/25">
          {done}
        </p>
      )}
    </>
  );
}

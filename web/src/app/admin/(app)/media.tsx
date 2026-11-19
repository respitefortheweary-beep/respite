"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, Play, X } from "lucide-react";
import { MEDIA_ACCEPT, isVideo, sendMedia } from "@/lib/send-media";
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
          {i === firstPhoto && <span className="mono absolute bottom-1 left-1 rounded-full bg-porch px-2 py-0.5 text-[0.62rem] font-semibold uppercase text-ink">Cover</span>}
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

/** On a room or house page: pick photos and videos and they upload straight away. */
export function MediaUpload({ kind, id }: { kind: MediaOwner; id: string }) {
  const [step, setStep] = useState("");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const upload = async (files: File[]) => {
    setError("");
    const { error } = await sendMedia(kind, id, files, (at, of, video) => setStep(of > 1 ? `Uploading ${at} of ${of}` : video ? "Uploading video" : "Uploading"));
    setStep("");
    if (error) setError(error);
    if (input.current) input.current.value = "";
  };

  return (
    <>
      <label
        className={`press flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong p-3 text-center text-[0.86rem] font-medium transition-colors hover:bg-ink/[.03] focus-within:ring-2 focus-within:ring-ink ${step ? "pointer-events-none opacity-60" : ""}`}
      >
        {step ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={20} />}
        {step || "Add photos or videos"}
        <span className="text-[0.76rem] font-normal text-moss">Photos: JPG, PNG, WebP. Videos: MP4, MOV, WebM.</span>
        <input ref={input} type="file" multiple accept={MEDIA_ACCEPT} className="sr-only" onChange={(e) => e.currentTarget.files?.length && upload([...e.currentTarget.files])} />
      </label>
      {error && (
        <p role="alert" className="col-span-full rounded-xl bg-ember/10 px-3.5 py-2.5 text-[0.88rem] text-ember ring-1 ring-ember/25">
          {error}
        </p>
      )}
    </>
  );
}

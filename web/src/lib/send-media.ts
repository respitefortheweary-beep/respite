import { linkVideo, uploadHousePhoto, uploadPhoto, uploadVideo, videoTicket, type MediaOwner } from "@/app/admin/actions";
import { shrinkPhoto } from "./shrink-photo";

export const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm";
export const isVideo = (f: File) => f.type.startsWith("video/");
/** Without Cloudinary a video passes through the website, which takes about 10 MB at most. */
const MAX_PASSTHROUGH = 10 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;
/** Big videos go up in pieces, so a dropped connection only costs one piece. Cloudinary wants 5 MB or more per piece. */
const CHUNK = 6 * 1024 * 1024;
/** If not one byte moves for this long, the upload has stalled: stop and say so instead of spinning forever. */
const STALL_MS = 45_000;
const TRIES = 3;

export type Progress = { at: number; of: number; video: boolean; sent?: number; total?: number };
type Options = { onProgress?: (p: Progress) => void; signal?: AbortSignal };

class Stalled extends Error {}
class Cancelled extends Error {}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;

/** One POST with real upload progress (fetch can't report it) and a stall timer. */
function post(url: string, body: FormData, headers: Record<string, string>, onSent: (bytes: number) => void, signal?: AbortSignal) {
  return new Promise<{ status: number; json: Record<string, unknown> }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let stall: ReturnType<typeof setTimeout>;
    const arm = () => {
      clearTimeout(stall);
      stall = setTimeout(() => (xhr.abort(), reject(new Stalled())), STALL_MS);
    };
    const cancel = () => (xhr.abort(), reject(new Cancelled()));
    signal?.addEventListener("abort", cancel, { once: true });
    const done = () => (clearTimeout(stall), signal?.removeEventListener("abort", cancel));
    xhr.open("POST", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => (arm(), onSent(e.loaded));
    xhr.onload = () => {
      done();
      let json: Record<string, unknown> = {};
      try {
        json = JSON.parse(xhr.responseText);
      } catch {}
      resolve({ status: xhr.status, json });
    };
    xhr.onerror = () => (done(), reject(new Error("network")));
    arm();
    xhr.send(body);
  });
}

async function sendVideo(kind: MediaOwner, id: string, file: File, report: (sent: number) => void, signal?: AbortSignal): Promise<string | undefined> {
  if (file.size > MAX_VIDEO) return `That video is ${mb(file.size)}. The most is 100 MB, so use a shorter clip.`;
  const ticket = await videoTicket(kind, id);
  if ("error" in ticket) return ticket.error;
  if (!ticket.direct) {
    if (file.size > MAX_PASSTHROUGH) return `That video is ${mb(file.size)}. Videos over 10 MB need Cloudinary set up on the server. Use a shorter clip for now.`;
    const form = new FormData();
    form.set("video", file);
    return (await uploadVideo(kind, id, form))?.error;
  }

  // Send the file in pieces with the same upload id; Cloudinary joins them and answers the last one with the video's address.
  const uploadId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  let result: Record<string, unknown> = {};
  for (let start = 0; start < file.size; start += CHUNK) {
    const end = Math.min(start + CHUNK, file.size);
    const form = new FormData();
    for (const [k, v] of Object.entries(ticket.fields)) form.set(k, v);
    form.set("file", file.slice(start, end), file.name);
    const headers = { "X-Unique-Upload-Id": uploadId, "Content-Range": `bytes ${start}-${end - 1}/${file.size}` };
    for (let tryNo = 1; ; tryNo++) {
      try {
        const res = await post(ticket.url, form, headers, (b) => report(start + Math.min(b, end - start)), signal);
        if (res.status >= 200 && res.status < 300) {
          result = res.json;
          break;
        }
        const why = String((res.json.error as { message?: string } | undefined)?.message ?? "");
        if (res.status >= 400 && res.status < 500) return why ? `Cloudinary turned the video down: ${why}` : "Cloudinary turned the video down. Try an MP4 file.";
        throw new Error(why || `status ${res.status}`);
      } catch (e) {
        if (e instanceof Cancelled) return "Upload stopped.";
        if (tryNo >= TRIES) {
          const at = `${mb(start)} of ${mb(file.size)}`;
          return e instanceof Stalled
            ? `The upload stalled at ${at} and was stopped. Check the connection and try again.`
            : `The upload failed at ${at}. Check the connection and try again.`;
        }
        await new Promise((r) => setTimeout(r, 1500 * tryNo));
      }
    }
  }
  report(file.size);
  const url = String(result.secure_url ?? "");
  if (!url.startsWith(ticket.host)) return "The video went up but Cloudinary didn't send back its address. Try again in a minute.";
  return (await linkVideo(kind, id, url))?.error;
}

/** Sends photos and videos one by one to a room or a house; returns how many made it and the first error. */
export async function sendMedia(kind: MediaOwner, id: string, files: File[], onStep?: (at: number, of: number, video: boolean) => void, { onProgress, signal }: Options = {}) {
  let added = 0;
  let error: string | undefined;
  for (const [i, f] of files.entries()) {
    if (signal?.aborted) break;
    const video = isVideo(f);
    const step = { at: i + 1, of: files.length, video };
    onStep?.(step.at, step.of, video);
    onProgress?.({ ...step, sent: 0, total: f.size });
    let failed: string | undefined;
    try {
      if (video) failed = await sendVideo(kind, id, f, (sent) => onProgress?.({ ...step, sent, total: f.size }), signal);
      else {
        const form = new FormData();
        form.set("photo", await shrinkPhoto(f));
        failed = (await (kind === "rooms" ? uploadPhoto(id, form) : uploadHousePhoto(id, form)))?.error;
        onProgress?.({ ...step, sent: f.size, total: f.size });
      }
    } catch {
      failed = `${f.name} couldn't be uploaded. Try again in a minute.`;
    }
    if (failed) error ??= files.length > 1 ? `${f.name}: ${failed}` : failed;
    else added++;
  }
  return { added, error };
}

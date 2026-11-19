import { linkVideo, uploadHousePhoto, uploadPhoto, uploadVideo, videoTicket, type MediaOwner } from "@/app/admin/actions";
import { shrinkPhoto } from "./shrink-photo";

export const MEDIA_ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm";
export const isVideo = (f: File) => f.type.startsWith("video/");
/** Without Cloudinary a video passes through the website, which takes about 10 MB at most. */
const MAX_PASSTHROUGH = 10 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024;

async function sendVideo(kind: MediaOwner, id: string, file: File): Promise<string | undefined> {
  if (file.size > MAX_VIDEO) return "That video is over 100 MB. Use a shorter one.";
  const ticket = await videoTicket(kind, id);
  if ("error" in ticket) return ticket.error;
  if (!ticket.direct) {
    if (file.size > MAX_PASSTHROUGH) return "Videos over 10 MB need Cloudinary set up on the server. Use a shorter clip for now.";
    const form = new FormData();
    form.set("video", file);
    return (await uploadVideo(kind, id, form))?.error;
  }
  const form = new FormData();
  for (const [k, v] of Object.entries(ticket.fields)) form.set(k, v);
  form.set("file", file);
  try {
    const res = await fetch(ticket.url, { method: "POST", body: form });
    const body = await res.json();
    if (!res.ok || !String(body.secure_url ?? "").startsWith(ticket.host)) return "The video couldn't be uploaded. Try again in a minute.";
    return (await linkVideo(kind, id, body.secure_url))?.error;
  } catch {
    return "The video couldn't be uploaded. Check the connection and try again.";
  }
}

/** Sends photos and videos one by one to a room or a house; returns how many made it and the first error. */
export async function sendMedia(kind: MediaOwner, id: string, files: File[], onStep?: (at: number, of: number, video: boolean) => void) {
  let added = 0;
  let error: string | undefined;
  for (const [i, f] of files.entries()) {
    onStep?.(i + 1, files.length, isVideo(f));
    let failed: string | undefined;
    if (isVideo(f)) failed = await sendVideo(kind, id, f);
    else {
      const form = new FormData();
      form.set("photo", await shrinkPhoto(f));
      failed = (await (kind === "rooms" ? uploadPhoto(id, form) : uploadHousePhoto(id, form)))?.error;
    }
    if (failed) error ??= failed;
    else added++;
  }
  return { added, error };
}

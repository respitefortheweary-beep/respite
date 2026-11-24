"use client";
import { useRef } from "react";
import { X } from "lucide-react";
import { houseAmenities } from "@/lib/amenities";

const SHOWN = 10;

/** "What this house offers": the first ten, then every amenity by group in a pop-up. */
export function HouseAmenities({ keys }: { keys: string[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const groups = houseAmenities(keys);
  const all = groups.flatMap((g) => g.items);
  if (!all.length) return null;

  return (
    <section className="border-t border-line pt-10">
      <h2 className="mb-6 text-[1.3rem] font-extrabold tracking-[-0.02em]">What this house offers</h2>
      <ul className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {all.slice(0, SHOWN).map(({ key, label, icon: Icon }) => (
          <li key={key} className="flex items-center gap-4 text-[1rem]">
            <Icon size={22} strokeWidth={1.6} className="shrink-0 text-ink/80" aria-hidden />
            {label}
          </li>
        ))}
      </ul>
      {all.length > SHOWN && (
        <button type="button" onClick={() => dialog.current?.showModal()} className="btn btn-ghost press mt-7">
          Show all {all.length} amenities
        </button>
      )}

      <dialog
        ref={dialog}
        aria-labelledby="amenities-title"
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        className="m-auto max-h-[85dvh] w-[min(640px,calc(100vw-2rem))] overflow-hidden rounded-[20px] bg-white p-0 text-ink shadow-[0_24px_60px_-20px_rgba(20,24,28,0.35)] backdrop:bg-ink/50"
      >
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-center gap-3 border-b border-line px-5 py-4">
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="press grid h-9 w-9 place-items-center rounded-full hover:bg-oat">
              <X size={18} />
            </button>
            <h2 id="amenities-title" className="text-[1.05rem] font-bold">
              What this house offers
            </h2>
          </div>
          <div className="overflow-y-auto px-6 pb-8 pt-2">
            {groups.map((g) => (
              <div key={g.title} className="pt-6">
                <h3 className="mb-1 text-[1.1rem] font-bold">{g.title}</h3>
                <ul className="divide-y divide-line">
                  {g.items.map(({ key, label, icon: Icon }) => (
                    <li key={key} className="flex items-center gap-4 py-4 text-[1rem]">
                      <Icon size={22} strokeWidth={1.6} className="shrink-0 text-ink/80" aria-hidden />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </dialog>
    </section>
  );
}

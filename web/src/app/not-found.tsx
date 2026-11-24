import Link from "next/link";
import { Logo } from "@/components/site-chrome";
import { getHouse } from "@/lib/content";

export default async function NotFound() {
  const house = await getHouse();
  return (
    <main id="main" tabIndex={-1} className="grid min-h-dvh place-items-center bg-oat px-5 text-ink">
      <div className="w-full max-w-md rounded-[20px] bg-white p-8 text-center ring-1 ring-line sm:p-10">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <p className="text-[0.85rem] font-semibold text-porch">Page not found</p>
        <h1 className="mt-2 text-[clamp(1.8rem,6vw,2.3rem)] font-extrabold leading-tight tracking-[-0.03em]">We can&apos;t find that page.</h1>
        <p className="mx-auto mt-3 max-w-sm text-[0.98rem] leading-relaxed text-moss">It may have moved, or the link was typed wrong. The houses are still here.</p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/houses" className="btn btn-primary press w-full sm:w-auto">
            See the houses
          </Link>
          <a href={house.phoneHref} className="btn btn-ghost press w-full sm:w-auto">
            Call {house.phone}
          </a>
        </div>
      </div>
    </main>
  );
}

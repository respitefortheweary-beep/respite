import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { siteUrl } from "@/lib/site";
import { getWhere } from "@/lib/where";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

// the town comes from the houses listed, so a new house in a new town shows up in search titles by itself
export async function generateMetadata(): Promise<Metadata> {
  const where = await getWhere();
  const TITLE = `Sober Living, Veteran & Senior Housing in ${where} · Respite for the Weary`;
  const DESCRIPTION = `Sober living and supportive shared homes in ${where} for veterans, people in recovery and independent seniors. Furnished rooms, VA benefits accepted. See open beds.`;
  return {
  metadataBase: new URL(siteUrl()),
  title: { default: TITLE, template: "%s · Respite for the Weary" },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Respite for the Weary",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/images/hero/house-day.webp", alt: "A white clapboard house with a deep front porch on a clear morning" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/images/hero/house-day.webp"] },
  alternates: { canonical: "/" },
  formatDetection: { telephone: false, email: false, address: false },
  // Paste the codes from Google Search Console and Bing Webmaster Tools into these env vars
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
    ...(process.env.BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } } : {}),
  },
  robots: process.env.SHOWCASE
    ? { index: false, follow: false }
    : { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  };
}

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only z-[100] rounded-full bg-porch px-3 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}

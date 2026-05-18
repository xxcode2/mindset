import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import { Providers } from "./providers";
import { Navbar } from "@/components/Navbar";
import { NetworkWarning } from "@/components/NetworkWarning";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Footer } from "@/components/Footer";
import { Toaster } from "@/components/Toaster";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-outfit",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://mindset-rosy.vercel.app";

const miniAppEmbed = {
  version: "1",
  imageUrl: `${APP_URL}/mindset.jpg`,
  button: {
    title: "Open Mindset",
    action: {
      type: "launch_miniapp",
      name: "Mindset",
      url: APP_URL,
      splashImageUrl: `${APP_URL}/mindset.jpg`,
      splashBackgroundColor: "#05050f",
    },
  },
};

export const metadata: Metadata = {
  title: "MINDSET — Prediction Markets on Farcaster",
  description:
    "Non-custodial parimutuel YES/NO prediction markets on Base. Take a side, win the pool.",
  metadataBase: new URL(APP_URL),
  openGraph: {
    title: "MINDSET — Prediction Markets on Farcaster",
    description:
      "Non-custodial parimutuel YES/NO prediction markets on Base. Take a side, win the pool.",
    url: APP_URL,
    images: [{ url: "/mindset.jpg" }],
  },
  other: {
    "base:app_id": "6a0b1abf7abfff0aca7b1763",
    "fc:miniapp": JSON.stringify(miniAppEmbed),
    "fc:frame": JSON.stringify(miniAppEmbed),
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <NetworkWarning />
            <ErrorBoundary>
              <main className="flex-1">{children}</main>
            </ErrorBoundary>
            <Footer />
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}

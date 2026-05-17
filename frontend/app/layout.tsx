import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.example.com";

const miniAppEmbed = {
  version: "1",
  imageUrl: `${APP_URL}/og.png`,
  button: {
    title: "Open Mindset",
    action: {
      type: "launch_miniapp",
      name: "Mindset",
      url: APP_URL,
      splashImageUrl: `${APP_URL}/splash.png`,
      splashBackgroundColor: "#0a0a0f",
    },
  },
};

export const metadata: Metadata = {
  title: "Mindset — Bet on what you believe",
  description:
    "Non-custodial parimutuel prediction markets on Base. Create a market, bet ETH, win the pool.",
  metadataBase: new URL(APP_URL),
  openGraph: {
    title: "Mindset — Bet on what you believe",
    description: "Non-custodial parimutuel prediction markets on Base.",
    url: APP_URL,
    images: [{ url: "/og.png" }],
  },
  // Farcaster Mini App embed metadata.
  // Both fc:miniapp and fc:frame (legacy alias) are emitted for max compatibility.
  other: {
    "fc:miniapp": JSON.stringify(miniAppEmbed),
    "fc:frame": JSON.stringify(miniAppEmbed),
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-ink text-white min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

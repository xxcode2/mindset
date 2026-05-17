import { NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.example.com";

/**
 * Farcaster Mini App manifest.
 * Served at /.well-known/farcaster.json and discovered by Farcaster clients.
 *
 * Fill `accountAssociation` with a signed JFS payload proving you control the
 * FID linked to this domain. Generate it at:
 *   https://farcaster.xyz/~/developers/mini-apps/manifest
 *
 * It's OK to deploy without it for local testing — it's only required before
 * publishing to the Mini App store.
 */
export async function GET() {
  return NextResponse.json({
    accountAssociation: {
      header: "",
      payload: "",
      signature: "",
    },
    miniapp: {
      version: "1",
      name: "Mindset",
      iconUrl: `${APP_URL}/icon.png`,
      homeUrl: APP_URL,
      imageUrl: `${APP_URL}/og.png`,
      buttonTitle: "Open Mindset",
      splashImageUrl: `${APP_URL}/splash.png`,
      splashBackgroundColor: "#05050f",
      subtitle: "Prediction markets on Farcaster",
      description:
        "Non-custodial parimutuel YES/NO prediction markets on Base. Take a side, win the pool.",
      primaryCategory: "social",
      tags: ["prediction", "markets", "base", "social", "betting"],
    },
  });
}

import { NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://your-app.example.com";

/**
 * Farcaster Mini App manifest.
 * Served at /.well-known/farcaster.json and discovered by Farcaster clients.
 *
 * The `accountAssociation` block must be filled with a signed JFS payload
 * proving you control the FID linked to this domain. Generate it with the
 * Farcaster Developer Tools (manifest tool). It is OK to deploy without it
 * for local testing; you only need it before publishing to the Mini App store.
 */
export async function GET() {
  return NextResponse.json({
    accountAssociation: {
      // Fill these in via the Farcaster manifest tool before publishing.
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
      splashBackgroundColor: "#0a0a0f",
      subtitle: "Bet on what you believe",
      description:
        "Non-custodial parimutuel prediction markets on Base. Create a market, bet ETH, win the pool.",
      primaryCategory: "social",
      tags: ["prediction", "markets", "base", "social", "betting"],
    },
  });
}

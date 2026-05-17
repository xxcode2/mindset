import { NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://mindset-rosy.vercel.app";

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
   "accountAssociation": {
    "header": "eyJmaWQiOjIzNjM0NCwidHlwZSI6ImF1dGgiLCJrZXkiOiIweGMxRWI5MDIxMTUwMDg5NWQ2RmJBZjFENjk4MTMyNzhGMzgwOEExYkEifQ",
    "payload": "eyJkb21haW4iOiJtaW5kc2V0LXJvc3kudmVyY2VsLmFwcCJ9",
    "signature": "lrI8qNfK899OT5koQAgA9+ApuKqJnw3lnqOJF70Pw6BtW5UpJeAxvPBaBUXZW2qjzL8zFXeXM5vKGkM3FhcBOxs="
    },
    miniapp: {
      version: "1",
      name: "Mindset",
      iconUrl: `${APP_URL}/mindset-nobg.jpg`,
      homeUrl: APP_URL,
      imageUrl: `${APP_URL}/mindset.jpg`,
      buttonTitle: "Open Mindset",
      splashImageUrl: `${APP_URL}/mindset.jpg`,
      splashBackgroundColor: "#05050f",
      subtitle: "Prediction markets on Farcaster",
      description:
        "Non-custodial parimutuel YES/NO prediction markets on Base. Take a side, win the pool.",
      primaryCategory: "social",
      tags: ["prediction", "markets", "base", "social", "betting"],
      requiredChains: ["eip155:84532"],
      requiredCapabilities: [
        "actions.signIn",
        "wallet.getEthereumProvider",
      ],
    },
  });
}

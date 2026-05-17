import { NextResponse } from "next/server";

const APP_URL = "https://mindset-rosy.vercel.app";

export async function GET() {
  return NextResponse.json({
    accountAssociation: {
      header: "",
      payload: "",
      signature: "",
    },
    frame: {
      name: "Mindset",
      version: "1",
      iconUrl: `${APP_URL}/mindset-nobg.jpg`,
      homeUrl: APP_URL,
      subtitle: "Prediction markets on Farcaster",
      description:
        "Non-custodial parimutuel YES/NO prediction markets on Base. Take a side, win the pool.",
      primaryCategory: "social",
      imageUrl: `${APP_URL}/mindset.jpg`,
      heroImageUrl: `${APP_URL}/mindset-nobg.jpg`,
      splashImageUrl: `${APP_URL}/mindset.jpg`,
      splashBackgroundColor: "#05050f",
      tags: [],
      tagline: "Grow, Predict, Mindset",
      buttonTitle: "Open Mindset",
      ogTitle: "Mindset - Prediction Markets",
      ogDescription:
        "prediction markets on Base. Take a side, win the pool.",
      ogImageUrl: `${APP_URL}/mindset.jpg`,
    },
  });
}

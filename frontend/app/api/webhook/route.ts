import { NextRequest, NextResponse } from "next/server";

/**
 * Farcaster Mini App Webhook endpoint.
 * Farcaster clients send lifecycle events here (e.g. app_added, app_removed, notifications).
 * For now we acknowledge all events with 200 OK.
 * Extend this handler when you want to track installs, send notifications, etc.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Webhook event received — extend cases below to handle.

    const event = body?.event;

    switch (event) {
      case "frame_added":
        // User added the mini app — could track installs, send welcome notification
        break;
      case "frame_removed":
        // User removed the mini app
        break;
      case "notifications_enabled":
        // User enabled notifications — store their notification token
        break;
      case "notifications_disabled":
        // User disabled notifications
        break;
      default:
        // Unknown event type — acknowledge anyway
        break;
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e) {
    console.error("[farcaster-webhook] error:", e);
    return NextResponse.json({ success: true }, { status: 200 });
  }
}

// Also handle GET for health checks
export async function GET() {
  return NextResponse.json({ status: "ok", service: "mindset-webhook" });
}

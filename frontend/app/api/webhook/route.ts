import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

/**
 * Verify the webhook signature using HMAC-SHA256.
 * Farcaster signs the raw body with the shared secret.
 */
function verifySignature(
  rawBody: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

/**
 * Farcaster Mini App Webhook endpoint.
 * Farcaster clients send lifecycle events here (e.g. app_added, app_removed, notifications).
 *
 * Security: verifies HMAC-SHA256 signature when WEBHOOK_SECRET is configured.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const webhookSecret = process.env.WEBHOOK_SECRET;

    // If a secret is configured, enforce signature verification
    if (webhookSecret) {
      const signature =
        req.headers.get("x-farcaster-signature") ??
        req.headers.get("x-signature") ??
        req.headers.get("x-hub-signature-256")?.replace("sha256=", "") ??
        null;

      if (!verifySignature(rawBody, signature, webhookSecret)) {
        console.warn("[farcaster-webhook] invalid signature — rejecting");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }
    }

    const body = JSON.parse(rawBody);
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
    return NextResponse.json(
      { error: "Bad request" },
      { status: 400 }
    );
  }
}

// Also handle GET for health checks
export async function GET() {
  return NextResponse.json({ status: "ok", service: "mindset-webhook" });
}

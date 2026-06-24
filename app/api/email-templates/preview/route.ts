import { NextRequest, NextResponse } from "next/server";
import { render } from "@react-email/render";
import React from "react";
import { getActiveWorkspace } from "@/lib/active-workspace";
import { WelcomeEmail } from "@/emails/templates/Welcome";
import { FeatureNudgeEmail } from "@/emails/templates/FeatureNudge";
import { ValueDemoEmail } from "@/emails/templates/ValueDemo";
import { CheckInEmail } from "@/emails/templates/CheckIn";
import { UpgradeOfferEmail } from "@/emails/templates/UpgradeOffer";
import { UrgencyEmail } from "@/emails/templates/Urgency";
import { ChurnPreventionEmail } from "@/emails/templates/ChurnPrevention";
import { LimitUpgradeEmail } from "@/emails/templates/LimitUpgrade";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.conversioncrm.co";

function buildDefaultElement(trigger: string, productName: string) {
  const userName = "{{userName}}";
  const appUrl = APP_URL;
  switch (trigger) {
    case "welcome":          return React.createElement(WelcomeEmail, { userName, productName, appUrl });
    case "feature_nudge":    return React.createElement(FeatureNudgeEmail, { userName, productName, appUrl, keyFeatureName: "your key feature" });
    case "value_demo":       return React.createElement(ValueDemoEmail, { userName, productName, appUrl });
    case "check_in":         return React.createElement(CheckInEmail, { userName, productName, appUrl });
    case "upgrade_offer":    return React.createElement(UpgradeOfferEmail, { userName, productName, appUrl, score: 78 });
    case "urgency":          return React.createElement(UrgencyEmail, { userName, productName, pricingUrl: appUrl });
    case "churn_prevention": return React.createElement(ChurnPreventionEmail, { userName, productName, appUrl });
    case "limit_upgrade":    return React.createElement(LimitUpgradeEmail, { userName, productName, appUrl, limitLabel: "email quota" });
    default: return null;
  }
}

/** GET /api/email-templates/preview?trigger=welcome — returns rendered HTML */
export async function GET(req: NextRequest) {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) return new NextResponse("Unauthorized", { status: 401 });

  const trigger = new URL(req.url).searchParams.get("trigger");
  if (!trigger) return new NextResponse("Missing trigger", { status: 400 });

  const el = buildDefaultElement(trigger, workspace.product_name ?? workspace.name ?? "Your Product");
  if (!el) return new NextResponse("Unknown trigger", { status: 400 });

  try {
    const html = await render(el);
    return new NextResponse(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch {
    return new NextResponse("Render error", { status: 500 });
  }
}

/** POST /api/email-templates/preview — renders arbitrary HTML for preview */
export async function POST(req: NextRequest) {
  const { workspace } = await getActiveWorkspace();
  if (!workspace) return new NextResponse("Unauthorized", { status: 401 });

  const { html } = await req.json() as { html?: string };
  if (!html) return new NextResponse("Missing html", { status: 400 });

  // Substitute preview placeholder vars
  const preview = html
    .replace(/\{\{userName\}\}/g, "Alex")
    .replace(/\{\{productName\}\}/g, workspace.product_name ?? workspace.name ?? "Your Product")
    .replace(/\{\{ctaUrl\}\}/g, APP_URL)
    .replace(/\{\{appUrl\}\}/g, APP_URL)
    .replace(/\{\{score\}\}/g, "78")
    .replace(/\{\{limitLabel\}\}/g, "email quota")
    .replace(/\{\{keyFeatureName\}\}/g, workspace.key_feature_name ?? "your key feature");

  return new NextResponse(preview, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com",
    },
  });
}

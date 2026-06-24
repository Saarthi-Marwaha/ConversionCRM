import { Text, Section } from "@react-email/components";
import * as React from "react";
import {
  EmailShell,
  emailText,
  statBox,
  statNumber,
  statLabel,
  BulletItem,
  Highlight,
} from "./shared";

interface LimitUpgradeEmailProps {
  userName: string;
  limitLabel: string;
  checkoutUrl?: string;
  appUrl?: string;
  productName?: string;
}

export function LimitUpgradeEmail({
  userName,
  limitLabel,
  checkoutUrl,
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.conversioncrm.co",
  productName,
}: LimitUpgradeEmailProps) {
  const ctaUrl = checkoutUrl ?? `${appUrl}/pricing`;
  const product = productName ?? "the product";

  return (
    <EmailShell
      preview={`Your ${limitLabel} on ${product} has been reached`}
      heading={`You've hit your ${limitLabel} — here's how to keep going`}
      userName={userName}
      ctaLabel="Upgrade now →"
      ctaUrl={ctaUrl}
      productName={productName}
      ps={
        <>
          If you&apos;re not sure which plan to pick, reply with your expected
          monthly active users and I&apos;ll recommend the right tier in one
          reply. Takes 2 minutes and saves you from over- or under-buying.
        </>
      }
    >
      {/* Limit callout */}
      <Section style={statBox}>
        <Text style={{ ...statNumber, fontSize: "26px", margin: "0 0 6px" }}>Limit reached</Text>
        <Text style={{ ...statLabel, textTransform: "none" as const, fontSize: "14px", fontWeight: "normal", color: "#374151", margin: 0 }}>
          Your <strong style={{ color: "#0b0d12" }}>{limitLabel}</strong> on the Free plan has been exhausted
        </Text>
      </Section>

      <Text style={emailText}>
        This isn&apos;t a problem — it means you&apos;re actually using{" "}
        {product}. The free plan is intentionally capped to let you validate the
        product before committing. You&apos;ve validated it. Here&apos;s what
        happens next depending on what you choose:
      </Text>

      <Text style={{ ...emailText, fontWeight: "600", color: "#0b0d12" }}>
        Your options right now:
      </Text>

      <Section>
        <BulletItem>
          <Highlight>Upgrade to Basic ($49/mo)</Highlight> — 5,000 tracked
          users, 20,000 emails/month, custom SMTP, manual email composer.
          Covers most early-stage SaaS products up to ~$1M ARR.
        </BulletItem>
        <BulletItem>
          <Highlight>Upgrade to Pro ($199/mo)</Highlight> — 25,000 tracked
          users, 100,000 emails/month, A/B testing, revenue attribution, and
          upgrade-intent alerts. For teams scaling past product-market fit.
        </BulletItem>
        <BulletItem>
          <Highlight>Stay on Free</Highlight> — tracking and scoring continue
          without interruption. Only email sends are paused until the month
          resets. Your pipeline data is never lost.
        </BulletItem>
      </Section>

      <Text style={emailText}>
        <strong>Beta pricing note:</strong> These are our current rates during
        public beta. Teams that upgrade now{" "}
        <strong>lock in this price permanently</strong> — even after we raise
        prices at launch. We will never change the rate for an existing paid
        workspace.
      </Text>

      <Text style={emailText}>
        Upgrades take effect immediately. Your email sends resume the moment
        the payment clears — no waiting for a billing cycle.
      </Text>
    </EmailShell>
  );
}

export default LimitUpgradeEmail;

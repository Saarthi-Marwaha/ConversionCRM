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

interface UpgradeOfferEmailProps {
  userName: string;
  score: number;
  checkoutUrl?: string;
  appUrl?: string;
  productName?: string;
}

export function UpgradeOfferEmail({
  userName,
  score,
  checkoutUrl,
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.conversioncrm.co",
  productName,
}: UpgradeOfferEmailProps) {
  const ctaUrl = checkoutUrl ?? `${appUrl}/pricing`;
  const product = productName ?? "the product";

  const tier =
    score >= 90 ? "top 5%" : score >= 80 ? "top 15%" : score >= 71 ? "top 25%" : "top tier";

  return (
    <EmailShell
      preview={`Your score hit ${score}/100 — you're ready to upgrade`}
      heading={`You're getting serious value out of ${product}`}
      userName={userName}
      ctaLabel="See upgrade options →"
      ctaUrl={ctaUrl}
      productName={productName}
      ps={
        <>
          Plans start at <strong>$49/mo</strong> (Basic — 5,000 users, 20,000
          emails). If you&apos;re not sure which plan fits, reply and tell me
          your monthly active users — I&apos;ll point you to the right one in
          30 seconds.
        </>
      }
    >
      {/* Score callout */}
      <Section style={statBox}>
        <Text style={{ ...statNumber, margin: "0 0 4px" }}>{score}/100</Text>
        <Text style={{ ...statLabel, margin: 0 }}>Your engagement score — {tier} of all users</Text>
      </Section>

      <Text style={emailText}>
        That score means you&apos;re in the <strong>{tier}</strong> of all
        users on {product}. The system flagged you as{" "}
        <strong>Conversion Ready</strong> — which is the stage where teams
        who upgrade almost always say it was the right call.
      </Text>

      <Text style={{ ...emailText, fontWeight: "600", color: "#0b0d12" }}>
        Here&apos;s what upgrading gets you:
      </Text>

      <Section>
        <BulletItem>
          <Highlight>No email limits</Highlight> — the free plan caps at 2,000
          emails/month. A growing trial pipeline burns through that fast.
          Upgrading keeps every automated email firing without interruption.
        </BulletItem>
        <BulletItem>
          <Highlight>Your own sending domain</Highlight> — on Basic and above,
          every email goes out from your domain and your SMTP, not ours. Higher
          deliverability, better open rates, replies to your inbox.
        </BulletItem>
        <BulletItem>
          <Highlight>More tracked users</Highlight> — Basic handles 5,000.
          Pro handles 25,000. Scale handles 150,000. Your data never gets
          truncated or sampled.
        </BulletItem>
        <BulletItem>
          <Highlight>Lock in your price</Highlight> — we&apos;re in public
          beta. Teams that upgrade now keep their plan rate forever, even after
          we raise prices at launch.
        </BulletItem>
      </Section>

      <Text style={emailText}>
        You&apos;ve already done the hard part — installed the widget, got
        users flowing in, and built a real picture of who&apos;s converting and
        who isn&apos;t. Upgrading just removes the ceiling.
      </Text>
    </EmailShell>
  );
}

export default UpgradeOfferEmail;

import { Text, Section } from "@react-email/components";
import * as React from "react";
import {
  EmailShell,
  emailText,
  BulletItem,
  Highlight,
} from "./shared";

interface Props {
  userName: string;
  appUrl?: string;
  productName?: string;
}

export function ValueDemoEmail({
  userName,
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.conversioncrm.co",
  productName,
}: Props) {
  const product = productName ?? "the product";

  return (
    <EmailShell
      preview={`Your data is building up — here's what it's showing`}
      heading={`Here's what ${product} already knows about your users`}
      userName={userName}
      ctaLabel="See your user data →"
      ctaUrl={appUrl}
      productName={productName}
      ps={
        <>
          The dashboard updates <strong>live every 3 seconds</strong> while
          you&apos;re watching it. Open it on one screen while you work — you
          can literally watch users move through stages in real time. Most teams
          find that eye-opening in a way they didn&apos;t expect.
        </>
      }
    >
      <Text style={emailText}>
        You&apos;ve been in {product} for a few days now, and the system has
        been quietly working. Here&apos;s what&apos;s been happening behind the
        scenes for your users:
      </Text>

      <Section>
        <BulletItem>
          <Highlight>Every session is tracked</Highlight> — page visits, clicks,
          time on page, and SPA navigation, all tied to named users via
          identify().
        </BulletItem>
        <BulletItem>
          <Highlight>Every user has a score</Highlight> — a 0–100 engagement
          number across 6 weighted layers: recency, frequency, depth, key
          feature hit, time spent, and buying intent.
        </BulletItem>
        <BulletItem>
          <Highlight>Every user has a stage</Highlight> — Signup, Onboarding,
          Active, Conversion ready, Going quiet, or Churned. Assigned
          automatically, updated nightly.
        </BulletItem>
        <BulletItem>
          <Highlight>Emails are already queueing</Highlight> — tonight&apos;s
          run will match each user to the right email for their stage and send
          it under your sender name.
        </BulletItem>
      </Section>

      <Text style={emailText}>
        Open your dashboard right now and filter by{" "}
        <strong>&quot;Conversion ready&quot;</strong> — those are the users
        with a score above 71 who are most likely to upgrade in the next 7
        days. That list is your most valuable sales asset, and it exists without
        any manual work on your part.
      </Text>

      <Text style={emailText}>
        If you want to make the scoring sharper,{" "}
        <strong>set your key feature in Settings</strong>. That single change
        improves the signal quality across all 8 automated emails.
      </Text>
    </EmailShell>
  );
}

export default ValueDemoEmail;

import { Text, Section } from "@react-email/components";
import * as React from "react";
import {
  EmailShell,
  emailText,
  emailTextSmall,
  BulletItem,
  Highlight,
} from "./shared";

interface WelcomeEmailProps {
  userName: string;
  appUrl?: string;
  productName?: string;
}

export function WelcomeEmail({
  userName,
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.conversioncrm.co",
  productName,
}: WelcomeEmailProps) {
  const product = productName ?? "the platform";

  return (
    <EmailShell
      preview={`You're in — here's what happens in the next 48 hours`}
      heading={`Welcome to ${product} — you're set up`}
      userName={userName}
      ctaLabel="Open your dashboard →"
      ctaUrl={appUrl}
      productName={productName}
      ps={
        <>
          The single fastest way to get value:{" "}
          <strong>open the dashboard, find one user who signed up this week, and look at their score and stage.</strong>{" "}
          That alone will show you more about your trial pipeline than most analytics tools.
        </>
      }
    >
      <Text style={emailText}>
        Tracking is already running. From this moment, every page visit, click,
        and session from your signed-up users is being recorded and scored — you
        don&apos;t need to do anything else to get data.
      </Text>

      <Text style={{ ...emailText, fontWeight: "600", color: "#0b0d12" }}>
        Here&apos;s what happens over the next 48 hours:
      </Text>

      <Section>
        <BulletItem>
          <Highlight>Right now</Highlight> — your tracking snippet is live.
          Users who visit your app are being fingerprinted and queued for scoring.
        </BulletItem>
        <BulletItem>
          <Highlight>Tonight (00:00 UTC)</Highlight> — scores are computed for
          every user. You&apos;ll see a 0–100 engagement score and an automatic
          lifecycle stage (Signup, Onboarding, Active, Conversion ready, Going
          quiet) in your dashboard.
        </BulletItem>
        <BulletItem>
          <Highlight>Tomorrow night</Highlight> — your first automated emails
          go out. Welcome emails fire the moment someone signs up. Nudges,
          upgrade offers, and check-ins begin routing to the right users based
          on their stage.
        </BulletItem>
      </Section>

      <Text style={emailText}>
        Before that happens, take 5 minutes to set your{" "}
        <strong>sender name, reply-to address, and key feature</strong> in
        Settings. The sender name is what users see in their inbox —{" "}
        <em>your name</em> converts better than a product name. The key feature
        is the aha moment that unlocks the Feature Nudge email.
      </Text>

      <Text style={emailText}>
        If anything looks off or you have questions — just reply to this email.
        We&apos;ll get back to you the same day.
      </Text>
    </EmailShell>
  );
}

export default WelcomeEmail;

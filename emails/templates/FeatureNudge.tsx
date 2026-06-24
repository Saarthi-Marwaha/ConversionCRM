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
  keyFeatureName: string;
  appUrl?: string;
  productName?: string;
}

export function FeatureNudgeEmail({
  userName,
  keyFeatureName,
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.conversioncrm.co",
  productName,
}: Props) {
  const product = productName ?? "the product";

  return (
    <EmailShell
      preview={`The one thing that makes ${product} click — have you tried it?`}
      heading={`Most teams find their aha moment here`}
      userName={userName}
      ctaLabel={`Try ${keyFeatureName} now →`}
      ctaUrl={appUrl}
      productName={productName}
      ps={
        <>
          Users who use <strong>{keyFeatureName}</strong> in their first week
          are significantly more likely to still be using {product} 30 days
          later. It&apos;s the single highest-signal action in the whole
          onboarding flow — that&apos;s why we&apos;re flagging it.
        </>
      }
    >
      <Text style={emailText}>
        You&apos;ve been exploring {product} — great. But there&apos;s one step
        that most teams say &quot;that&apos;s when it clicked&quot; about, and
        you haven&apos;t hit it yet:{" "}
        <strong>{keyFeatureName}</strong>.
      </Text>

      <Text style={{ ...emailText, fontWeight: "600", color: "#0b0d12" }}>
        Here&apos;s why it matters:
      </Text>

      <Section>
        <BulletItem>
          <Highlight>It takes about 2 minutes</Highlight> — no complex setup,
          no data import required. You can try it right now.
        </BulletItem>
        <BulletItem>
          <Highlight>It makes everything else make sense</Highlight> — teams
          that skip this step often feel like the product is &quot;kind of
          useful.&quot; Teams that don&apos;t skip it feel like they can&apos;t
          go back.
        </BulletItem>
        <BulletItem>
          <Highlight>It&apos;s the step most teams wish they&apos;d done first</Highlight> — not last, after everything else.
        </BulletItem>
      </Section>

      <Text style={emailText}>
        Open {product}, navigate to{" "}
        <strong>{keyFeatureName}</strong>, and spend 2 minutes with it. If
        something doesn&apos;t make sense or it doesn&apos;t work the way you
        expected, reply to this email — we&apos;ll walk you through it in
        minutes.
      </Text>

      <Text style={emailText}>
        You don&apos;t need to finish your entire setup before trying this. In
        fact, <em>starting</em> here is the faster path.
      </Text>
    </EmailShell>
  );
}

export default FeatureNudgeEmail;

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
  pricingUrl?: string;
  productName?: string;
}

export function UrgencyEmail({ userName, pricingUrl, productName }: Props) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://www.conversioncrm.co";
  const ctaUrl = pricingUrl ?? `${appUrl}/pricing`;
  const product = productName ?? "the product";

  return (
    <EmailShell
      preview={`You looked at pricing — let me answer any questions`}
      heading={`You checked pricing — let me make this easier`}
      userName={userName}
      ctaLabel="See the plans →"
      ctaUrl={ctaUrl}
      productName={productName}
      ps={
        <>
          If you&apos;re comparing options or want to know if {product} is the
          right fit before committing, <strong>just reply to this email</strong>.
          Tell me your use case in one sentence and I&apos;ll give you a
          straight answer — including if we&apos;re not the right tool.
        </>
      }
    >
      <Text style={emailText}>
        You visited the pricing page recently. That usually means one of two
        things: you&apos;re ready to upgrade and just need a nudge, or you have
        a specific question that the page didn&apos;t answer. Either way — let
        me help.
      </Text>

      <Text style={{ ...emailText, fontWeight: "600", color: "#0b0d12" }}>
        The most common things people wonder about:
      </Text>

      <Section>
        <BulletItem>
          <Highlight>&quot;Am I using enough of it to justify paying?&quot;</Highlight>{" "}
          — Open your dashboard and filter by &quot;Conversion ready.&quot; If
          there are users in that stage, the automated upgrade emails alone are
          worth more than the plan cost.
        </BulletItem>
        <BulletItem>
          <Highlight>&quot;What happens to my data if I stay on Free?&quot;</Highlight>{" "}
          — Nothing. Your events, scores, and stages keep building up. The only
          limit that kicks in is the 2,000 email/month cap, which pauses email
          sends (not tracking).
        </BulletItem>
        <BulletItem>
          <Highlight>&quot;Which plan do I actually need?&quot;</Highlight>{" "}
          — Most early-stage teams start on Basic ($49/mo). It covers 5,000
          tracked users and 20,000 emails — enough for most SaaS products up to
          ~$1M ARR.
        </BulletItem>
        <BulletItem>
          <Highlight>&quot;Can I cancel if it&apos;s not working?&quot;</Highlight>{" "}
          — Yes. Email support and we&apos;ll cancel same-day, no questions. We
          also offer a 14-day pro-rata refund if the product didn&apos;t work
          as described.
        </BulletItem>
      </Section>

      <Text style={emailText}>
        We&apos;re in beta, which means{" "}
        <strong>teams that upgrade now lock in their plan price forever</strong>{" "}
        — even after launch pricing goes up. No hard sell on that — just worth
        knowing.
      </Text>
    </EmailShell>
  );
}

export default UrgencyEmail;

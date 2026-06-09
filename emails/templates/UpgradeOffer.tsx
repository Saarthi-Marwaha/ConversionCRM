import { Text } from "@react-email/components";
import * as React from "react";
import { EmailShell, emailText } from "./shared";

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
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.conversioncrm.io",
  productName,
}: UpgradeOfferEmailProps) {
  const ctaUrl = checkoutUrl ?? `${appUrl}/pricing`;

  return (
    <EmailShell
      preview={`Your engagement score is ${score} — you're ready to upgrade`}
      heading="You're getting serious value"
      userName={userName}
      ctaLabel="See upgrade options →"
      ctaUrl={ctaUrl}
      productName={productName}
    >
      <Text style={emailText}>
        Your engagement score is <strong>{score}/100</strong>. That puts you
        among the most active users on {productName ?? "the platform"}.
      </Text>
      <Text style={emailText}>
        You&apos;ve clearly found real value. Upgrading keeps everything you
        rely on — without limits or interruptions.
      </Text>
    </EmailShell>
  );
}

export default UpgradeOfferEmail;

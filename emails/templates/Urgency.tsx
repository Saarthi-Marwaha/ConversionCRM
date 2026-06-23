import { Text } from "@react-email/components";
import * as React from "react";
import { EmailShell, emailText } from "./shared";

interface Props {
  userName: string;
  pricingUrl?: string;
  productName?: string;
}

export function UrgencyEmail({
  userName,
  pricingUrl,
  productName,
}: Props) {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://www.conversioncrm.co";
  const ctaUrl = pricingUrl ?? `${appUrl}/pricing`;

  return (
    <EmailShell
      preview="Questions about pricing? We're here."
      heading="Still thinking about upgrading?"
      userName={userName}
      ctaLabel="View pricing →"
      ctaUrl={ctaUrl}
      productName={productName}
    >
      <Text style={emailText}>
        You checked out pricing recently — smart move. Most teams want to know
        exactly what they get before committing.
      </Text>
      <Text style={emailText}>
        If you have questions about plans, limits, or whether{" "}
        {productName ?? "the product"} fits your use case, reply to this email.
        We&apos;ll help you decide — no hard sell.
      </Text>
    </EmailShell>
  );
}

export default UrgencyEmail;

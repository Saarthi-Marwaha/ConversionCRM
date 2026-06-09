import { Text } from "@react-email/components";
import * as React from "react";
import { EmailShell, emailText } from "./shared";

interface Props {
  userName: string;
  appUrl?: string;
  productName?: string;
}

export function ChurnPreventionEmail({
  userName,
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.conversioncrm.io",
  productName,
}: Props) {
  return (
    <EmailShell
      preview="We'd love to have you back"
      heading="Your account is still here"
      userName={userName}
      ctaLabel={`Log back in to ${productName ?? "the app"} →`}
      ctaUrl={appUrl}
      productName={productName}
    >
      <Text style={emailText}>
        It&apos;s been a few weeks since you last used{" "}
        {productName ?? "the product"}. Your data and settings are still saved.
      </Text>
      <Text style={emailText}>
        If you left because something wasn&apos;t working, reply and tell us
        what happened — we fix real problems fast. If you just got busy, one
        click gets you back in.
      </Text>
    </EmailShell>
  );
}

export default ChurnPreventionEmail;

import { Text } from "@react-email/components";
import * as React from "react";
import { EmailShell, emailText } from "./shared";

interface Props {
  userName: string;
  appUrl?: string;
  productName?: string;
}

export function CheckInEmail({
  userName,
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.conversioncrm.io",
  productName,
}: Props) {
  return (
    <EmailShell
      preview="Just checking in — everything okay?"
      heading="We haven't seen you in a while"
      userName={userName}
      ctaLabel={`Come back to ${productName ?? "the app"} →`}
      ctaUrl={appUrl}
      productName={productName}
    >
      <Text style={emailText}>
        It&apos;s been about ten days since your last visit. Life gets busy —
        totally normal.
      </Text>
      <Text style={emailText}>
        If something blocked you (confusing UI, missing feature, a bug), reply
        to this email and tell us. We read every message.
      </Text>
    </EmailShell>
  );
}

export default CheckInEmail;

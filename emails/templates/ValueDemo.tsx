import { Text } from "@react-email/components";
import * as React from "react";
import { EmailShell, emailText } from "./shared";

interface Props {
  userName: string;
  appUrl?: string;
  productName?: string;
}

export function ValueDemoEmail({
  userName,
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.conversioncrm.io",
  productName,
}: Props) {
  return (
    <EmailShell
      preview="You're exploring — here's the one thing to try next"
      heading="You're getting the hang of it"
      userName={userName}
      ctaLabel="Continue where you left off →"
      ctaUrl={appUrl}
      productName={productName}
    >
      <Text style={emailText}>
        You&apos;ve been browsing {productName ?? "the product"} this week —
        that&apos;s a great sign. People who explore a few pages early tend to
        find their workflow faster.
      </Text>
      <Text style={emailText}>
        Pick up where you left off. One focused session today beats a dozen
        half-finished visits.
      </Text>
    </EmailShell>
  );
}

export default ValueDemoEmail;

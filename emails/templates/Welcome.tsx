import { Text } from "@react-email/components";
import * as React from "react";
import { EmailShell, emailText } from "./shared";

interface WelcomeEmailProps {
  userName: string;
  appUrl?: string;
  productName?: string;
}

export function WelcomeEmail({
  userName,
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.conversioncrm.io",
  productName,
}: WelcomeEmailProps) {
  return (
    <EmailShell
      preview={`Welcome to ${productName ?? "the platform"} — here's how to start`}
      heading={`Welcome to ${productName ?? "the platform"}`}
      userName={userName}
      ctaLabel="Get started →"
      ctaUrl={appUrl}
      productName={productName}
    >
      <Text style={emailText}>
        Thanks for signing up. You&apos;re in — and we&apos;re glad you&apos;re
        here.
      </Text>
      <Text style={emailText}>
        The fastest way to get value: log in, explore the core workflow, and
        try one key feature today. Small first step, big difference.
      </Text>
    </EmailShell>
  );
}

export default WelcomeEmail;

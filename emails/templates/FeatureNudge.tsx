import { Text } from "@react-email/components";
import * as React from "react";
import { EmailShell, emailText } from "./shared";

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
  return (
    <EmailShell
      preview={`Try ${keyFeatureName} — it's the fastest way to get value`}
      heading={`Have you tried ${keyFeatureName}?`}
      userName={userName}
      ctaLabel={`Open ${productName ?? "the app"} →`}
      ctaUrl={appUrl}
      productName={productName}
    >
      <Text style={emailText}>
        Most people who stick with {productName ?? "the product"} try{" "}
        <strong>{keyFeatureName}</strong> in their first week. It&apos;s the
        step that usually clicks everything into place.
      </Text>
      <Text style={emailText}>
        You haven&apos;t used it yet — no pressure, but it takes about a minute
        and makes the rest of the product much easier to understand.
      </Text>
    </EmailShell>
  );
}

export default FeatureNudgeEmail;

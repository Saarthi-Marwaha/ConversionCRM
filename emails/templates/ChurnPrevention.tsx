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
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.conversioncrm.co",
  productName,
}: Props) {
  const product = productName ?? "the product";

  return (
    <EmailShell
      preview={`Before you go — 30 seconds?`}
      heading={`Your account is still here — and I have one question`}
      userName={userName}
      ctaLabel={`Log back in to ${product} →`}
      ctaUrl={appUrl}
      productName={productName}
      ps={
        <>
          If you want us to delete your account and data completely, just reply
          with &quot;delete my account&quot; and we&apos;ll take care of it
          within 24 hours. No friction, no retention campaign. We just want to
          do right by you either way.
        </>
      }
    >
      <Text style={emailText}>
        It&apos;s been a few weeks since you last used {product}. I&apos;m not
        going to send you ten emails trying to win you back — that&apos;s not
        how we operate. But I do want to ask one honest question:
      </Text>

      <Text
        style={{
          ...emailText,
          fontStyle: "italic",
          color: "#1557c9",
          fontWeight: "600",
          paddingLeft: "16px",
          borderLeft: "3px solid #b9d8fb",
        }}
      >
        What got in the way?
      </Text>

      <Text style={emailText}>
        Was it the setup? The install? A missing feature? Something that
        didn&apos;t work the way you expected? A competitor that looked better
        on paper?
      </Text>

      <Text style={emailText}>
        <strong>Reply to this email and tell me.</strong> I read every response
        personally. If it was a bug or a product gap, I want to know so we can
        fix it — not just for you, but for everyone who hits the same wall. If
        it was a fit problem, that&apos;s genuinely useful feedback too.
      </Text>

      <Text style={emailText}>
        And if you just got pulled into something else — your account, data, and
        settings are exactly as you left them. Nothing has been deleted. One
        click gets you back in.
      </Text>

      <Text style={emailText}>
        Either way, thank you for trying {product}. That means something to us.
      </Text>
    </EmailShell>
  );
}

export default ChurnPreventionEmail;

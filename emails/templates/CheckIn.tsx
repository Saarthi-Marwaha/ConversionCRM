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
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.conversioncrm.co",
  productName,
}: Props) {
  const product = productName ?? "the product";

  return (
    <EmailShell
      preview={`Quick question — what got in the way?`}
      heading={`Still thinking about ${product}?`}
      userName={userName}
      ctaLabel={`Come back to ${product} →`}
      ctaUrl={appUrl}
      productName={productName}
      ps={
        <>
          If the setup got confusing, reply with &quot;help me set up&quot; and
          we&apos;ll schedule a 15-minute call to get you live. It&apos;s free,
          no pitch — just get it working.
        </>
      }
    >
      <Text style={emailText}>
        It&apos;s been about ten days since you were last active in {product}.
        That&apos;s not unusual — most people who sign up hit a moment where
        something slows them down. I&apos;d like to know what that was for you.
      </Text>

      <Text style={emailText}>
        <strong>Was it one of these?</strong>
      </Text>

      <Text style={{ ...emailText, paddingLeft: "16px", borderLeft: "3px solid #b9d8fb" }}>
        &ldquo;The setup felt more involved than I expected.&rdquo;<br />
        &ldquo;I couldn&apos;t find time to get it properly installed.&rdquo;<br />
        &ldquo;I wasn&apos;t sure what to do after signing up.&rdquo;<br />
        &ldquo;Something didn&apos;t work and I moved on.&rdquo;
      </Text>

      <Text style={emailText}>
        Whatever it was — <strong>reply to this email and tell me</strong>. We
        fix real problems fast, and if it was a bug or a confusing UI pattern,
        knowing about it makes the product better for everyone.
      </Text>

      <Text style={emailText}>
        If you just got busy (totally normal), one click gets you back to where
        you left off. Your data and settings are still exactly as you left them.
      </Text>

      <Text style={emailText}>
        No pressure either way — just want to make sure you had a fair shot at
        seeing what {product} actually does.
      </Text>
    </EmailShell>
  );
}

export default CheckInEmail;

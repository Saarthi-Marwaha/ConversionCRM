import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface WelcomeEmailProps {
  userName: string;
  appUrl?: string;
}

export function WelcomeEmail({
  userName,
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.conversioncrm.io",
}: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome! You're all set to start converting more users.</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome to ConversionCRM 👋</Heading>

          <Text style={text}>Hi {userName},</Text>

          <Text style={text}>
            You've just joined the smartest way to turn free-trial users into
            paying customers. ConversionCRM automatically tracks engagement,
            scores every user, and sends the right nudge at the right time — so
            you spend zero time on manual follow-ups.
          </Text>

          <Section style={buttonSection}>
            <Button href={`${appUrl}/dashboard`} style={button}>
              Open your dashboard →
            </Button>
          </Section>

          <Text style={text}>
            Your next step: add the one-line tracking widget to your app and
            mark your "aha moment" feature. We'll take care of the rest.
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            Questions? Just reply to this email.
            <br />
            <Link href={appUrl} style={link}>
              ConversionCRM
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default WelcomeEmail;

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const main: React.CSSProperties = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "40px auto",
  padding: "40px",
  borderRadius: "8px",
  maxWidth: "560px",
  border: "1px solid #e6ebf1",
};

const h1: React.CSSProperties = {
  color: "#1a1a2e",
  fontSize: "24px",
  fontWeight: "700",
  lineHeight: "1.3",
  margin: "0 0 24px",
};

const text: React.CSSProperties = {
  color: "#4a4a68",
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 16px",
};

const buttonSection: React.CSSProperties = {
  textAlign: "center",
  margin: "32px 0",
};

const button: React.CSSProperties = {
  backgroundColor: "#6366f1",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600",
  padding: "12px 28px",
  textDecoration: "none",
  display: "inline-block",
};

const hr: React.CSSProperties = {
  borderColor: "#e6ebf1",
  margin: "32px 0 24px",
};

const footer: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "13px",
  lineHeight: "1.5",
};

const link: React.CSSProperties = {
  color: "#6366f1",
  textDecoration: "none",
};

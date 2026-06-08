import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface UpgradeOfferEmailProps {
  userName: string;
  score: number;
  checkoutUrl?: string;
  appUrl?: string;
}

export function UpgradeOfferEmail({
  userName,
  score,
  checkoutUrl,
  appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.conversioncrm.io",
}: UpgradeOfferEmailProps) {
  const ctaUrl = checkoutUrl ?? `${appUrl}/dashboard?upgrade=1`;

  return (
    <Html>
      <Head />
      <Preview>
        You've unlocked 70+ engagement — time to make it permanent.
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={scoreBadge}>
            <Text style={scoreText}>Engagement Score: {score}/100</Text>
          </Section>

          <Heading style={h1}>You're getting serious value — let's keep it going</Heading>

          <Text style={text}>Hi {userName},</Text>

          <Text style={text}>
            Your engagement score just hit <strong>{score}/100</strong>. That
            means you're one of the top users in your cohort — and your trial is
            doing exactly what a trial should: showing real results.
          </Text>

          <Text style={text}>
            Upgrade now to lock in unlimited tracking, automated emails, and
            full conversion analytics — so the momentum you've built doesn't
            stop when the trial ends.
          </Text>

          <Section style={buttonSection}>
            <Button href={ctaUrl} style={button}>
              Upgrade now →
            </Button>
          </Section>

          <Text style={subtext}>
            Takes 60 seconds. Cancel any time.
          </Text>

          <Hr style={hr} />

          <Text style={footer}>
            You're receiving this because your engagement score crossed 70.
            <br />
            If you have questions, just reply to this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default UpgradeOfferEmail;

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

const scoreBadge: React.CSSProperties = {
  backgroundColor: "#eef2ff",
  borderRadius: "6px",
  padding: "10px 16px",
  marginBottom: "24px",
  display: "inline-block",
};

const scoreText: React.CSSProperties = {
  color: "#6366f1",
  fontSize: "14px",
  fontWeight: "700",
  margin: 0,
};

const h1: React.CSSProperties = {
  color: "#1a1a2e",
  fontSize: "22px",
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
  margin: "32px 0 8px",
};

const button: React.CSSProperties = {
  backgroundColor: "#6366f1",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600",
  padding: "14px 32px",
  textDecoration: "none",
  display: "inline-block",
};

const subtext: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "13px",
  textAlign: "center",
  margin: "0 0 32px",
};

const hr: React.CSSProperties = {
  borderColor: "#e6ebf1",
  margin: "24px 0",
};

const footer: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "13px",
  lineHeight: "1.5",
};

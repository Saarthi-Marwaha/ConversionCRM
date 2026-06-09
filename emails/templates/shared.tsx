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

export const emailMain: React.CSSProperties = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

export const emailContainer: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "40px auto",
  padding: "40px",
  borderRadius: "8px",
  maxWidth: "560px",
  border: "1px solid #e6ebf1",
};

export const emailH1: React.CSSProperties = {
  color: "#1a1a2e",
  fontSize: "22px",
  fontWeight: "700",
  lineHeight: "1.35",
  margin: "0 0 20px",
};

export const emailText: React.CSSProperties = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "1.65",
  margin: "0 0 16px",
};

export const emailButtonSection: React.CSSProperties = {
  textAlign: "center",
  margin: "28px 0",
};

export const emailButton: React.CSSProperties = {
  backgroundColor: "#111827",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600",
  padding: "12px 28px",
  textDecoration: "none",
  display: "inline-block",
};

export const emailHr: React.CSSProperties = {
  borderColor: "#e6ebf1",
  margin: "28px 0 20px",
};

export const emailFooter: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "13px",
  lineHeight: "1.5",
  margin: 0,
};

export type EmailShellProps = {
  preview: string;
  heading: string;
  userName: string;
  children: React.ReactNode;
  ctaLabel: string;
  ctaUrl: string;
  productName?: string;
};

export function EmailShell({
  preview,
  heading,
  userName,
  children,
  ctaLabel,
  ctaUrl,
  productName,
}: EmailShellProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={emailMain}>
        <Container style={emailContainer}>
          <Heading style={emailH1}>{heading}</Heading>
          <Text style={emailText}>Hi {userName},</Text>
          {children}
          <Section style={emailButtonSection}>
            <Button href={ctaUrl} style={emailButton}>
              {ctaLabel}
            </Button>
          </Section>
          <Hr style={emailHr} />
          <Text style={emailFooter}>
            You&apos;re receiving this from {productName ?? "our team"}. Reply
            to this email if you have questions — a real person will see it.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

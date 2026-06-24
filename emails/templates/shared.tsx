import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

// ── Design tokens ─────────────────────────────────────────────────────────────
const BRAND      = "#1557c9";   // blue-deep
const BRAND_PALE = "#eef5fe";
const INK        = "#0b0d12";
const INK_2      = "#374151";
const INK_3      = "#6b7280";
const LINE       = "#e6ebf1";
const BG         = "#f4f6fb";

// ── Shared styles ─────────────────────────────────────────────────────────────
export const emailMain: React.CSSProperties = {
  backgroundColor: BG,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

export const emailContainer: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "32px auto",
  padding: "0",
  borderRadius: "10px",
  maxWidth: "580px",
  border: `1px solid ${LINE}`,
  overflow: "hidden",
};

/** Top brand stripe */
const emailHeader: React.CSSProperties = {
  backgroundColor: BRAND,
  padding: "18px 40px",
};

const headerText: React.CSSProperties = {
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "700",
  letterSpacing: "0.04em",
  margin: 0,
};

const emailBody: React.CSSProperties = {
  padding: "36px 40px 28px",
};

export const emailH1: React.CSSProperties = {
  color: INK,
  fontSize: "22px",
  fontWeight: "700",
  lineHeight: "1.3",
  margin: "0 0 22px",
  letterSpacing: "-0.02em",
};

export const emailText: React.CSSProperties = {
  color: INK_2,
  fontSize: "15px",
  lineHeight: "1.7",
  margin: "0 0 16px",
};

export const emailTextSmall: React.CSSProperties = {
  color: INK_3,
  fontSize: "13.5px",
  lineHeight: "1.65",
  margin: "0 0 12px",
};

export const emailButtonSection: React.CSSProperties = {
  textAlign: "center",
  margin: "32px 0",
};

export const emailButton: React.CSSProperties = {
  backgroundColor: BRAND,
  borderRadius: "7px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "700",
  padding: "13px 32px",
  textDecoration: "none",
  display: "inline-block",
  letterSpacing: "0.01em",
};

export const emailHr: React.CSSProperties = {
  borderColor: LINE,
  margin: "24px 0 20px",
};

export const emailFooter: React.CSSProperties = {
  color: INK_3,
  fontSize: "12.5px",
  lineHeight: "1.6",
  margin: "0 0 6px",
};

/** Highlighted metric box — e.g. score callout */
export const statBox: React.CSSProperties = {
  backgroundColor: BRAND_PALE,
  border: `1px solid #b9d8fb`,
  borderRadius: "8px",
  padding: "18px 22px",
  margin: "0 0 20px",
  textAlign: "center",
};

export const statNumber: React.CSSProperties = {
  color: BRAND,
  fontSize: "36px",
  fontWeight: "800",
  lineHeight: "1",
  display: "block",
  letterSpacing: "-0.03em",
  margin: "0 0 4px",
};

export const statLabel: React.CSSProperties = {
  color: INK_2,
  fontSize: "13px",
  fontWeight: "600",
  letterSpacing: "0.03em",
  textTransform: "uppercase",
  margin: 0,
};

/** Bullet list item */
export function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ ...emailText, paddingLeft: "0", margin: "0 0 10px", display: "flex" }}>
      <span style={{ color: BRAND, fontWeight: "700", marginRight: "10px", flexShrink: 0 }}>→</span>
      <span>{children}</span>
    </Text>
  );
}

/** Inline highlight for key phrases */
export function Highlight({ children }: { children: React.ReactNode }) {
  return (
    <strong style={{ color: INK, fontWeight: "700" }}>{children}</strong>
  );
}

// ── Shell component ───────────────────────────────────────────────────────────

export type EmailShellProps = {
  preview: string;
  heading: string;
  userName: string;
  children: React.ReactNode;
  ctaLabel: string;
  ctaUrl: string;
  productName?: string;
  ps?: React.ReactNode;
  /** Skip the CTA button entirely (e.g. for plain text check-ins) */
  hideCta?: boolean;
};

export function EmailShell({
  preview,
  heading,
  userName,
  children,
  ctaLabel,
  ctaUrl,
  productName,
  ps,
  hideCta = false,
}: EmailShellProps) {
  const brand = productName ?? "the team";
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={emailMain}>
        <Container style={emailContainer}>

          {/* Brand header stripe */}
          <Section style={emailHeader}>
            <Text style={headerText}>{productName ?? "ConversionCRM"}</Text>
          </Section>

          {/* Body */}
          <Section style={emailBody}>
            <Text style={{ ...emailH1 }}>{heading}</Text>

            <Text style={emailText}>Hi {userName},</Text>

            {children}

            {!hideCta && (
              <Section style={emailButtonSection}>
                <Button href={ctaUrl} style={emailButton}>
                  {ctaLabel}
                </Button>
              </Section>
            )}

            {ps && (
              <>
                <Hr style={emailHr} />
                <Text style={{ ...emailTextSmall }}>
                  <strong style={{ color: INK }}>P.S.</strong>{" "}{ps}
                </Text>
              </>
            )}

            <Hr style={{ ...emailHr, marginTop: ps ? "20px" : "28px" }} />

            <Text style={emailFooter}>
              You&apos;re receiving this from{" "}
              <strong style={{ color: INK_2 }}>{brand}</strong>. Reply to this
              email and a real person will see it — we read everything.
            </Text>
            <Text style={{ ...emailFooter, margin: 0 }}>
              If you don&apos;t want lifecycle emails from us, reply with
              &quot;unsubscribe&quot; and we&apos;ll stop immediately.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  );
}

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

const GA_ID = "G-0ZPXQTXLF7";

export const metadata: Metadata = {
  title: "ConversionCRM — Turn free trials into paying customers",
  description:
    "Auto-track engagement, score users 0–100, and send the right email at the right moment. One embed. Zero manual work.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        {/* Google tag (gtag.js) — app routes (dashboard, signup, pricing, …) */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga4-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
        </Script>
        {children}
      </body>
    </html>
  );
}

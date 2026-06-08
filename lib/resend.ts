import { Resend } from "resend";

// Singleton — instantiated once at module level
export const resend = new Resend(process.env.RESEND_API_KEY);

export const EMAIL_FROM = `${process.env.RESEND_FROM_NAME ?? "ConversionCRM"} <${process.env.RESEND_FROM_EMAIL ?? "noreply@conversioncrm.io"}>`;

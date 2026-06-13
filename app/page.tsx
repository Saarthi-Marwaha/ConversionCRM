import { redirect } from "next/navigation";

/**
 * The root path is handled by middleware:
 *   - signed-in visitors → /dashboard
 *   - everyone else → rewritten to the static landing (public/landing.html)
 *
 * This component only runs as a safety fallback if middleware is bypassed;
 * send such visitors to sign up.
 */
export default function RootFallback() {
  redirect("/signup");
}

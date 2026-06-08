/**
 * widget.ts — Source for the ConversionCRM browser tracking widget.
 *
 * This is the human-readable source. The /api/widget route generates
 * a version of this at runtime with the API key baked in.
 *
 * For local development/testing, you can build this with esbuild and
 * serve it as a static file.
 *
 * Usage in a customer's app:
 *   <script src="https://app.conversioncrm.io/api/widget?api_key=ccrm_xxx"></script>
 *   <script>
 *     ccrm.identify('user-123', { email: 'alice@example.com', name: 'Alice' });
 *     // Track events manually
 *     ccrm.track('feature_click', { feature: 'export' });
 *     ccrm.track('pricing_page_visit');
 *   </script>
 */

declare global {
  interface Window {
    ccrm: ConversionCRM;
    __ccrm_loaded: boolean;
  }
}

interface UserTraits {
  email?: string;
  name?: string;
  [key: string]: unknown;
}

interface ConversionCRM {
  identify(userId: string, traits?: UserTraits): void;
  track(event: string, properties?: Record<string, unknown>): void;
  page(name?: string, properties?: Record<string, unknown>): void;
}

export {};

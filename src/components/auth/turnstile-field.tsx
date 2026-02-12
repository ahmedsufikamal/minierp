"use client";

import Script from "next/script";

interface TurnstileFieldProps {
  fieldName?: string;
}

export function TurnstileField({ fieldName = "turnstileToken" }: TurnstileFieldProps) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  if (!siteKey) return null;

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <div
        className="cf-turnstile"
        data-sitekey={siteKey}
        data-response-field-name={fieldName}
        data-theme="auto"
      />
    </>
  );
}

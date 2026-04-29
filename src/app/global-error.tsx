"use client";

import * as Sentry from "@sentry/nextjs";
import { useState } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // Capture once during initial render; lazy initializer avoids
  // running on every render, and Sentry.captureException is sync.
  const [eventId] = useState(() => Sentry.captureException(error));

  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          backgroundColor: "#0b0b0c",
          color: "#e7e7ea",
          padding: "24px",
        }}
      >
        <main
          role="alert"
          aria-labelledby="global-error-heading"
          style={{
            maxWidth: "520px",
            width: "100%",
            border: "1px solid #2a2a2e",
            borderRadius: "16px",
            padding: "32px",
            backgroundColor: "#141416",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "11px",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#8a8a90",
            }}
          >
            Fehler · Error
          </p>
          <h1
            id="global-error-heading"
            style={{
              margin: "12px 0 16px",
              fontSize: "28px",
              fontWeight: 600,
              lineHeight: 1.2,
            }}
          >
            Da ist etwas schiefgelaufen.
          </h1>
          <p style={{ margin: "0 0 24px", fontSize: "15px", lineHeight: 1.6 }}>
            Die Seite konnte nicht geladen werden. Wir wurden automatisch
            informiert.
          </p>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                minHeight: "44px",
                padding: "0 20px",
                borderRadius: "999px",
                border: "1px solid #2a2a2e",
                backgroundColor: "#e7e7ea",
                color: "#0b0b0c",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Erneut versuchen
            </button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{
                minHeight: "44px",
                padding: "0 20px",
                borderRadius: "999px",
                border: "1px solid #2a2a2e",
                backgroundColor: "transparent",
                color: "#e7e7ea",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              Zur Startseite
            </a>
          </div>
          {eventId ? (
            <p
              style={{
                margin: "20px 0 0",
                fontSize: "11px",
                color: "#8a8a90",
                fontFamily:
                  "ui-monospace, SFMono-Regular, Menlo, Monaco, monospace",
              }}
            >
              Referenz: {eventId}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}

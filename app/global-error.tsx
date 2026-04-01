"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          backgroundColor: "#0d0b08",
          color: "#e8b030",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
            치명적 오류가 발생했습니다
          </h2>
          <button
            onClick={() => reset()}
            style={{
              padding: "0.5rem 1.5rem",
              backgroundColor: "#c8900a",
              color: "#0d0b08",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            다시 시도
          </button>
        </div>
      </body>
    </html>
  );
}

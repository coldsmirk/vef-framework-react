import type { ReactNode } from "react";
import type { FallbackProps } from "react-error-boundary";

import { stringify } from "@vef-framework-react/shared";

export default function ErrorFallback({ error, resetErrorBoundary }: FallbackProps): ReactNode {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        minHeight: "200px"
      }}
    >
      <h2 style={{ color: "#ef4444", marginBottom: "16px" }}>
        出错了
      </h2>

      <pre style={{
        color: "#64748b",
        marginBottom: "16px",
        whiteSpace: "pre-wrap"
      }}
      >
        {error instanceof Error ? error.message : (stringify(error) || "未知错误")}
      </pre>

      <button
        type="button"
        style={{
          padding: "8px 16px",
          backgroundColor: "#3b82f6",
          color: "#ffffff",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer"
        }}
        onClick={resetErrorBoundary}
      >
        重试
      </button>
    </div>
  );
}

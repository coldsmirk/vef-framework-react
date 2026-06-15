import type { CSSProperties, FC, ReactNode } from "react";

interface StepHeaderProps {
  index: number;
  title: string;
  description: ReactNode;
}

const badgeStyle: CSSProperties = {
  width: 44,
  height: 44,
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: 14,
  fontSize: 20,
  fontWeight: 600,
  color: "#fff",
  background: "linear-gradient(135deg, var(--vef-color-primary), color-mix(in srgb, var(--vef-color-primary) 76%, #000))",
  boxShadow: "0 8px 22px -8px color-mix(in srgb, var(--vef-color-primary) 60%, transparent)"
};

/**
 * Full-width hero header for a wizard step: a prominent index badge, the step
 * title, and a one-line guidance subtitle. Gives each step gravity and anchors
 * the full-canvas layout so it commands the screen rather than huddling.
 */
export const StepHeader: FC<StepHeaderProps> = ({
  index,
  title,
  description
}) => (
  <div style={{
    display: "flex",
    alignItems: "center",
    gap: 18,
    paddingBottom: 20,
    marginBottom: 24,
    borderBottom: "1px solid var(--vef-color-border-secondary)"
  }}
  >
    <div style={badgeStyle}>{index}</div>

    <div style={{ minWidth: 0 }}>
      <div style={{
        fontSize: 22,
        fontWeight: 600,
        lineHeight: 1.25,
        letterSpacing: "0.5px",
        color: "var(--vef-color-text)"
      }}
      >
        {title}
      </div>

      <div style={{
        marginTop: 5,
        fontSize: 13.5,
        color: "var(--vef-color-text-secondary)"
      }}
      >
        {description}
      </div>
    </div>
  </div>
);

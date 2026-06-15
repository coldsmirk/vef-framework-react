import { css, keyframes } from "@emotion/react";
import { globalCssVars } from "@vef-framework-react/components";

// Dynamic gradient background animation
const gradientShift = keyframes`
  0%, 100% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
`;

// Floating orb animation
const floatOrb = keyframes`
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(30px, -50px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }
`;

const floatOrbReverse = keyframes`
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(-40px, 30px) scale(0.95);
  }
  66% {
    transform: translate(25px, -40px) scale(1.05);
  }
`;

// Shimmer effect for button
const shimmer = keyframes`
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
`;

// ============================================
// Themed Styles (Light default, Dark via html.dark)
// ============================================

export const login = css({
  position: "relative",
  height: "100%",
  overflow: "hidden",
  fontFamily: globalCssVars.fontFamily,

  // Light theme (default) - richer gradient
  background: `linear-gradient(-45deg,
    ${globalCssVars.colorPrimary100},
    ${globalCssVars.colorSlate50},
    ${globalCssVars.colorPrimary50},
    ${globalCssVars.colorWhite},
    ${globalCssVars.colorPrimary100})`,
  backgroundSize: "400% 400%",
  animation: `${gradientShift} 15s ease infinite`,

  // Dark theme - different gradient colors
  "html.dark &": {
    background: `linear-gradient(-45deg, ${globalCssVars.colorPrimary950}, ${globalCssVars.colorPrimary900}, ${globalCssVars.colorSlate900}, ${globalCssVars.colorPrimary800})`,
    animation: `${gradientShift} 12s ease infinite`
  }
});

export const backgroundOrbs = css({
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  pointerEvents: "none",
  zIndex: 0
});

export const orb = css({
  position: "absolute",
  borderRadius: "50%",

  // Light theme - more visible
  filter: "blur(40px)",
  opacity: 1,

  // Dark theme - brighter
  "html.dark &": {
    filter: "blur(45px)",
    opacity: 0.9
  }
});

export const orbPrimary = css({
  width: "700px",
  height: "700px",
  top: "-10%",
  left: "-5%",

  // Light theme - more saturated colors
  background: `radial-gradient(circle, ${globalCssVars.colorPrimary200} 0%, transparent 70%)`,
  animation: `${floatOrb} 20s ease-in-out infinite`,

  // Dark theme - more vibrant colors
  "html.dark &": {
    top: "-5%",
    left: "0%",
    background: `radial-gradient(circle, ${globalCssVars.colorPrimary500} 0%, transparent 70%)`,
    animation: `${floatOrb} 18s ease-in-out infinite`
  }
});

export const orbSecondary = css({
  width: "600px",
  height: "600px",
  bottom: "-15%",
  right: "10%",

  // Light theme - cyan/teal accent
  background: `radial-gradient(circle, ${globalCssVars.colorPrimary100} 0%, transparent 70%)`,
  animation: `${floatOrbReverse} 25s ease-in-out infinite`,

  // Dark theme - brighter
  "html.dark &": {
    bottom: "-10%",
    right: "15%",
    background: `radial-gradient(circle, ${globalCssVars.colorPrimary400} 0%, transparent 70%)`,
    animation: `${floatOrbReverse} 22s ease-in-out infinite`
  }
});

export const orbAccent = css({
  width: "500px",
  height: "500px",
  top: "40%",
  left: "25%",

  // Light theme - info color accent
  background: `radial-gradient(circle, ${globalCssVars.colorInfo100} 0%, transparent 70%)`,
  animation: `${floatOrb} 18s ease-in-out infinite reverse`,

  // Dark theme - brighter
  "html.dark &": {
    width: "450px",
    height: "450px",
    top: "45%",
    left: "30%",
    background: `radial-gradient(circle, ${globalCssVars.colorInfo400} 0%, transparent 70%)`,
    animation: `${floatOrb} 16s ease-in-out infinite reverse`
  }
});

export const logo = css({
  position: "absolute",
  top: 0,
  left: 0,
  padding: globalCssVars.spacingLg,
  lineHeight: 0,
  fontSize: "64px",
  zIndex: 10,
  transition: `all ${globalCssVars.motionDurationMid} ${globalCssVars.motionEaseOut}`,

  // Light theme - enhanced shadow with subtle glow
  filter: `drop-shadow(0 4px 12px rgba(0, 0, 0, 0.12)) drop-shadow(0 0 20px color-mix(in srgb, ${globalCssVars.colorPrimary} 15%, transparent))`,

  // Dark theme - stronger shadow with primary color glow
  "html.dark &": {
    filter: `drop-shadow(0 6px 16px rgba(0, 0, 0, 0.4)) drop-shadow(0 0 30px color-mix(in srgb, ${globalCssVars.colorPrimary} 30%, transparent))`
  },

  "&:hover": {
    transform: "scale(1.05)",
    filter: `drop-shadow(0 6px 16px rgba(0, 0, 0, 0.16)) drop-shadow(0 0 30px color-mix(in srgb, ${globalCssVars.colorPrimary} 25%, transparent))`,

    "html.dark &": {
      filter: `drop-shadow(0 8px 20px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 40px color-mix(in srgb, ${globalCssVars.colorPrimary} 40%, transparent))`
    }
  }
});

export const title = css({
  flex: "none",
  paddingBlockStart: 80,
  textAlign: "center",

  "& > h1": {
    fontSize: "clamp(28px, 4vw, 42px)",
    fontWeight: 700,
    letterSpacing: "-0.02em",

    // Light theme - use primary color for text
    color: globalCssVars.colorPrimary700,
    textShadow: `0 0 60px color-mix(in srgb, ${globalCssVars.colorPrimary} 20%, transparent)`,

    // Dark theme - white text
    "html.dark &": {
      color: globalCssVars.colorWhite,
      textShadow: `0 0 80px color-mix(in srgb, ${globalCssVars.colorPrimary} 50%, transparent)`
    }
  }
});

export const icon = css({
  flex: "auto",
  width: "45%",
  minHeight: 0,
  transition: `transform ${globalCssVars.motionDurationSlow} ${globalCssVars.motionEaseOut}`,

  // Light theme
  filter: "drop-shadow(0 15px 30px rgba(0, 0, 0, 0.1))",

  // Dark theme - dim the illustration, reduce brightness
  "html.dark &": {
    filter: "drop-shadow(0 20px 40px rgba(0, 0, 0, 0.4)) brightness(0.85) contrast(0.9)"
  },

  "&:hover": {
    transform: "scale(1.02)"
  }
});

export const leftContent = css({
  position: "relative",
  display: "flex",
  flex: "auto",
  height: "100%",
  overflow: "hidden",
  zIndex: 1,
  "@media (max-width: 768px)": {
    display: "none"
  }
});

export const rightContent = css({
  position: "relative",
  width: "480px",
  height: "100%",
  padding: "0 56px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: globalCssVars.spacingLg,
  backdropFilter: "blur(24px) saturate(180%)",
  WebkitBackdropFilter: "blur(24px) saturate(180%)",
  zIndex: 2,

  // Light theme - enhanced glass effect with visible border
  background: `linear-gradient(
    135deg,
    color-mix(in srgb, ${globalCssVars.colorWhite} 85%, transparent) 0%,
    color-mix(in srgb, ${globalCssVars.colorWhite} 75%, transparent) 100%
  )`,
  borderLeft: `1px solid color-mix(in srgb, ${globalCssVars.colorPrimary300} 40%, transparent)`,
  boxShadow: `
    -30px 0 80px color-mix(in srgb, ${globalCssVars.colorPrimary} 12%, transparent),
    inset 1px 0 0 color-mix(in srgb, ${globalCssVars.colorWhite} 80%, transparent),
    inset 0 1px 0 color-mix(in srgb, ${globalCssVars.colorWhite} 60%, transparent)
  `,

  // Dark theme - dark glass effect with primary color tint
  "html.dark &": {
    backdropFilter: "blur(24px) saturate(200%)",
    WebkitBackdropFilter: "blur(24px) saturate(200%)",
    background: `linear-gradient(
      135deg,
      color-mix(in srgb, ${globalCssVars.colorPrimary950} 85%, transparent) 0%,
      color-mix(in srgb, ${globalCssVars.colorPrimary900} 70%, transparent) 100%
    )`,
    borderLeft: `1px solid color-mix(in srgb, ${globalCssVars.colorPrimary400} 20%, transparent)`,
    boxShadow: `
      -30px 0 80px rgba(0, 0, 0, 0.5),
      inset 1px 0 0 color-mix(in srgb, ${globalCssVars.colorPrimary400} 15%, transparent),
      inset 0 1px 0 color-mix(in srgb, ${globalCssVars.colorPrimary400} 10%, transparent)
    `
  },

  "@media (max-width: 1200px)": {
    width: "400px",
    padding: "0 32px"
  },

  "@media (max-width: 768px)": {
    width: "100%",
    borderLeft: "none",
    background: `color-mix(in srgb, ${globalCssVars.colorWhite} 92%, transparent)`,

    "html.dark &": {
      background: `color-mix(in srgb, ${globalCssVars.colorBgLayout} 88%, transparent)`
    }
  }
});

export const formHeader = css({
  marginBottom: globalCssVars.spacingSm,

  "& h2": {
    fontSize: globalCssVars.fontSizeHeading2,
    fontWeight: 600,
    letterSpacing: "-0.01em",
    marginBottom: "8px",
    color: globalCssVars.colorText
  }
});

export const formControl = css({
  height: "52px",
  borderRadius: globalCssVars.borderRadiusLg,
  fontSize: globalCssVars.fontSizeLg,
  transition: `all ${globalCssVars.motionDurationMid} ${globalCssVars.motionEaseOut}`,
  background: globalCssVars.colorBgContainer,
  border: `1px solid ${globalCssVars.colorBorder}`,
  color: globalCssVars.colorText,

  // Light theme - subtle shadow
  boxShadow: `0 2px 8px color-mix(in srgb, ${globalCssVars.colorPrimary} 6%, transparent)`,

  // Dark theme - lighter background with subtle glow
  "html.dark &": {
    background: globalCssVars.colorBgElevated,
    boxShadow: `0 0 0 1px color-mix(in srgb, ${globalCssVars.colorPrimary} 15%, transparent)`
  },

  "&:hover": {
    borderColor: globalCssVars.colorPrimaryBorderHover,
    boxShadow: `0 4px 16px color-mix(in srgb, ${globalCssVars.colorPrimary} 12%, transparent)`,

    "html.dark &": {
      boxShadow: `0 0 0 1px color-mix(in srgb, ${globalCssVars.colorPrimary} 25%, transparent)`
    }
  },

  "&:focus, &:focus-within": {
    borderColor: globalCssVars.colorPrimary,
    boxShadow: `0 0 0 3px color-mix(in srgb, ${globalCssVars.colorPrimary} 12%, transparent), 0 4px 20px color-mix(in srgb, ${globalCssVars.colorPrimary} 18%, transparent)`
  },

  "& input": {
    color: globalCssVars.colorText
  },

  "& .ant-input-prefix": {
    marginRight: "12px",
    color: globalCssVars.colorTextSecondary
  }
});

export const submitButton = css({
  height: "52px",
  borderRadius: globalCssVars.borderRadiusLg,
  fontSize: globalCssVars.fontSizeLg,
  fontWeight: 600,
  letterSpacing: "0.05em",
  border: "none",
  transition: `all ${globalCssVars.motionDurationMid} ${globalCssVars.motionEaseOut}`,
  position: "relative",
  overflow: "hidden",
  background: `linear-gradient(135deg, ${globalCssVars.colorPrimary} 0%, ${globalCssVars.colorPrimaryHover} 100%)`,
  boxShadow: `0 4px 20px color-mix(in srgb, ${globalCssVars.colorPrimary} 40%, transparent)`,

  // Shimmer effect overlay
  "&::before": {
    content: "\"\"",
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: `linear-gradient(
      90deg,
      transparent 0%,
      color-mix(in srgb, ${globalCssVars.colorWhite} 20%, transparent) 50%,
      transparent 100%
    )`,
    transform: "translateX(-100%)",
    animation: `${shimmer} 3s ease-in-out infinite`
  },

  "&:hover": {
    transform: "translateY(-2px)",
    boxShadow: `0 8px 30px color-mix(in srgb, ${globalCssVars.colorPrimary} 50%, transparent)`,

    "&::before": {
      animationDuration: "1.5s"
    }
  },

  "&:active": {
    transform: "translateY(0)",
    boxShadow: `0 4px 16px color-mix(in srgb, ${globalCssVars.colorPrimary} 40%, transparent)`
  }
});

export const date = css({
  position: "absolute",
  top: globalCssVars.spacingLg,
  right: globalCssVars.spacingLg,
  left: globalCssVars.spacingLg,
  fontSize: globalCssVars.fontSizeSm,
  letterSpacing: "0.02em",
  color: globalCssVars.colorTextTertiary,
  opacity: 0.8
});

export const copyright = css({
  position: "absolute",
  right: 0,
  bottom: globalCssVars.spacingLg,
  left: 0,
  textAlign: "center",
  fontSize: globalCssVars.fontSizeSm,
  letterSpacing: "0.01em",
  color: globalCssVars.colorTextTertiary,
  opacity: 0.7
});

export const description = css({
  height: "32px",
  lineHeight: "32px",
  fontSize: globalCssVars.fontSizeLg,
  fontWeight: 400,
  color: globalCssVars.colorTextSecondary
});

export const formSubtitle = css({
  fontSize: globalCssVars.fontSize,
  lineHeight: 1.6,
  margin: 0,
  color: globalCssVars.colorTextSecondary
});

export const dateHighlight = css({
  fontWeight: 500,
  color: globalCssVars.colorPrimary
});

export const formIcon = css({
  marginRight: "8px",
  color: globalCssVars.colorPrimary
});

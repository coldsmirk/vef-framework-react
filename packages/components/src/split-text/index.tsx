import type { CSSProperties, ElementType, FC } from "react";

import type { SplitTextProps } from "./props";

import { useGSAP } from "@gsap/react";
import { clsx } from "@vef-framework-react/core";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText as GSAPSplitText } from "gsap/SplitText";
import { useEffect, useRef, useState } from "react";

type SplitMode = "chars" | "words" | "lines";

// Tracks the active GSAP SplitText instance per host element so a re-run of the
// effect can revert the previous instance before creating a new one. Using a
// WeakMap avoids attaching framework state directly to the DOM node.
const splitTextInstances = new WeakMap<HTMLElement, GSAPSplitText>();

const ROOT_MARGIN_REGEX = /^(?<value>-?\d+(?:\.\d+)?)(?<unit>px|em|rem|%)?$/;

function parseRootMargin(margin: string) {
  const trimmedMargin = margin.trim();
  const match = ROOT_MARGIN_REGEX.exec(trimmedMargin);

  if (!match?.groups?.value) {
    return { value: 0, unit: "px" as const };
  }

  return {
    value: Number.parseFloat(match.groups.value),
    unit: (match.groups.unit ?? "px") as "px" | "em" | "rem" | "%"
  };
}

function normalizeSplitModes(splitType: SplitTextProps["splitType"]): SplitMode[] {
  if (!splitType) {
    return ["chars"];
  }

  const candidates = splitType.split(",").map(mode => mode.trim());
  const validModes = candidates.filter(
    (mode): mode is SplitMode => mode === "chars" || mode === "words" || mode === "lines"
  );

  return validModes.length > 0 ? validModes : ["chars"];
}

function selectSplitTargets(splitInstance: GSAPSplitText, preferredModes: SplitMode[]) {
  for (const mode of preferredModes) {
    if (mode === "chars" && splitInstance.chars.length > 0) {
      return splitInstance.chars;
    }

    if (mode === "words" && splitInstance.words.length > 0) {
      return splitInstance.words;
    }

    if (mode === "lines" && splitInstance.lines.length > 0) {
      return splitInstance.lines;
    }
  }

  if (splitInstance.chars.length > 0) {
    return splitInstance.chars;
  }

  if (splitInstance.words.length > 0) {
    return splitInstance.words;
  }

  return splitInstance.lines;
}

// gsap.registerPlugin is deferred to first component mount instead of running
// at module load. Module-level registration starts ScrollTrigger's 250ms sync
// loop on import, which both breaks SSR (jsdom-style window access at the
// wrong time) and leaks a setInterval that outlives vitest's jsdom teardown.
// Registering inside the lifecycle is the pattern GSAP recommends for SSR/
// Next.js, and it makes the component side-effect-free on import.
let pluginsRegistered = false;

function ensureGsapPluginsRegistered(): void {
  if (pluginsRegistered) {
    return;
  }

  gsap.registerPlugin(ScrollTrigger, GSAPSplitText, useGSAP);
  pluginsRegistered = true;
}

const DEFAULT_FROM = { opacity: 0, y: 40 };
const DEFAULT_TO = { opacity: 1, y: 0 };

export const SplitText: FC<SplitTextProps> = ({
  text,
  className,
  delay = 100,
  duration = 0.6,
  ease = "power3.out",
  splitType = "chars",
  from = DEFAULT_FROM,
  to = DEFAULT_TO,
  threshold = 0.1,
  rootMargin = "-100px",
  textAlign = "center",
  tag = "p",
  onLetterAnimationComplete
}) => {
  const elementRef = useRef<HTMLElement>(null);
  const [areFontsLoaded, setAreFontsLoaded] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined" || !("fonts" in document)) {
      setAreFontsLoaded(true);
      return;
    }

    if (document.fonts.status === "loaded") {
      setAreFontsLoaded(true);
      return;
    }

    let isSubscribed = true;
    document.fonts.ready
      .then(() => {
        if (isSubscribed) {
          setAreFontsLoaded(true);
        }
      })
      .catch(() => {
        if (isSubscribed) {
          setAreFontsLoaded(true);
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, []);

  useGSAP(
    () => {
      if (!elementRef.current || !text || !areFontsLoaded) {
        return;
      }

      ensureGsapPluginsRegistered();

      const hostElement = elementRef.current;
      const previousInstance = splitTextInstances.get(hostElement);

      if (previousInstance) {
        try {
          previousInstance.revert();
        } catch {
          // Revert errors are non-fatal; swallow to keep the animation chain alive.
        }

        splitTextInstances.delete(hostElement);
      }

      const preferredModes = normalizeSplitModes(splitType);
      const { value: rootMarginValue, unit: rootMarginUnit } = parseRootMargin(rootMargin);
      const startPercentage = (1 - threshold) * 100;
      const offsetSign
        = rootMarginValue === 0
          ? ""
          : `${rootMarginValue < 0 ? "-=" : "+="}${Math.abs(rootMarginValue)}${rootMarginUnit}`;
      const scrollTriggerStart = `top ${startPercentage}%${offsetSign}`;
      const staggerDelaySeconds = delay / 1000;

      const splitInstance = new GSAPSplitText(hostElement, {
        type: splitType,
        smartWrap: true,
        autoSplit: splitType === "lines",
        linesClass: "split-line",
        wordsClass: "split-word",
        charsClass: "split-char",
        reduceWhiteSpace: false,
        onSplit: (instance: GSAPSplitText) => {
          const targets = selectSplitTargets(instance, preferredModes);
          return gsap.fromTo(
            targets,
            { ...from },
            {
              ...to,
              duration,
              ease,
              stagger: staggerDelaySeconds,
              scrollTrigger: {
                trigger: hostElement,
                start: scrollTriggerStart,
                once: true,
                fastScrollEnd: true,
                anticipatePin: 0.4
              },
              onComplete: () => {
                onLetterAnimationComplete?.();
              },
              willChange: "transform, opacity",
              force3D: true
            }
          );
        }
      });

      splitTextInstances.set(hostElement, splitInstance);

      return () => {
        for (const trigger of ScrollTrigger.getAll()) {
          if (trigger.trigger === hostElement) {
            trigger.kill();
          }
        }

        try {
          splitInstance.revert();
        } catch {
          // Ignore revert errors; GSAP handles cleanup tolerantly.
        }

        splitTextInstances.delete(hostElement);
      };
    },
    {
      dependencies: [
        text,
        delay,
        duration,
        ease,
        splitType,
        JSON.stringify(from),
        JSON.stringify(to),
        threshold,
        rootMargin,
        areFontsLoaded,
        onLetterAnimationComplete
      ],
      scope: elementRef
    }
  );

  const style: CSSProperties = {
    textAlign,
    overflow: "hidden",
    display: "inline-block",
    whiteSpace: "normal",
    wordWrap: "break-word",
    willChange: "transform, opacity"
  };

  const Tag = tag as ElementType;

  return (
    <Tag ref={elementRef} className={clsx("split-parent", className)} style={style}>
      {text}
    </Tag>
  );
};

export { type SplitTextProps } from "./props";

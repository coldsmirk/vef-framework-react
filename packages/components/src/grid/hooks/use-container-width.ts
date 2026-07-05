import { useIsomorphicEffect } from "@vef-framework-react/hooks";
import { useEffect, useRef, useState } from "react";

export function useContainerWidth() {
  const rafIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useIsomorphicEffect(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.getBoundingClientRect().width);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(() => {
        const width = entry.contentBoxSize.at(0)?.inlineSize ?? entry.contentRect.width;
        setContainerWidth(width);
      });
    });

    observer.observe(containerRef.current, {
      box: "content-box"
    });

    return () => {
      observer.disconnect();

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return {
    containerWidth,
    containerRef
  };
}

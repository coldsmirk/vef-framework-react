import type { Breakpoint } from "../../_base";

import { useMemo } from "react";

// export function useResponsiveBreakpoint(
//   breakpoints: Record<Breakpoint, number>,
//   defaultBreakpoint: Breakpoint = "sm"
// ) {
//   const rafIdRef = useRef(0);
//   const containerRef = useRef<HTMLDivElement>(null);
//   const [breakpoint, setBreakpoint] = useState<Breakpoint>(defaultBreakpoint);

//   useEffect(() => {
//     const updateBreakpoint = (width: number) => {
//       for (const [breakpoint, breakpointWidth] of Object.entries(breakpoints)) {
//         if (width <= breakpointWidth) {
//           setBreakpoint(breakpoint as Breakpoint);
//           break;
//         }
//       }
//     };

//     const observer = new ResizeObserver(([entry]) => {
//       if (!entry) {
//         return;
//       }

//       cancelAnimationFrame(rafIdRef.current);
//       rafIdRef.current = requestAnimationFrame(() => {
//         const boxSize = entry.contentBoxSize.at(0);

//         if (boxSize) {
//           updateBreakpoint(boxSize.inlineSize);
//         } else {
//           updateBreakpoint(entry.contentRect.width);
//         }
//       });
//     });

//     if (containerRef.current) {
//       observer.observe(containerRef.current, {
//         box: "content-box"
//       });
//     }

//     return () => {
//       observer.disconnect();

//       if (rafIdRef.current) {
//         cancelAnimationFrame(rafIdRef.current);
//       }
//     };
//   }, [breakpoints]);

//   return {
//     breakpoint,
//     containerRef
//   };
// }

export function useResponsiveBreakpoint(
  breakpoints: Record<Breakpoint, number>,
  width: number
) {
  return useMemo(() => {
    for (const [breakpoint, breakpointWidth] of Object.entries(breakpoints)) {
      if (width <= breakpointWidth) {
        return breakpoint as Breakpoint;
      }
    }

    return "xxl";
  }, [width, breakpoints]);
}

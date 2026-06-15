import type { Position } from "@vef-framework-react/components";

import type { ColorScheme } from "../../../stores";

import { useColorScheme, useReducedMotion } from "@vef-framework-react/hooks";

import { useThemeStore } from "../../../stores";

function getNextColorScheme(colorScheme: ColorScheme): ColorScheme {
  switch (colorScheme) {
    case "system": {
      return "light";
    }

    case "light": {
      return "dark";
    }

    default: {
      return "system";
    }
  }
}

function removeColorSchemeTransitionClass() {
  document.documentElement.classList.remove("color-scheme-transition");
}

/**
 * A hook to update the color scheme of the application.
 *
 * @returns A function to update the color scheme of the application.
 */
export function useColorSchemeUpdater() {
  const currentColorScheme = useThemeStore(state => state.colorScheme);
  const reducedMotion = useReducedMotion(false, {
    getInitialValueInEffect: false
  });
  const systemColorScheme = useColorScheme("light", {
    getInitialValueInEffect: false
  });

  function updateColorSchemeInternal(colorScheme: ColorScheme) {
    useThemeStore.setState(state => {
      state.colorScheme = colorScheme;
    });
  }

  function updateColorScheme(nextColorScheme: ColorScheme, position: Position, isLoop = false) {
    if (reducedMotion) {
      updateColorSchemeInternal(nextColorScheme);
      return;
    }

    if (isLoop && ((currentColorScheme === "system" && systemColorScheme === "light") || (currentColorScheme === "dark" && systemColorScheme === "dark"))) {
      updateColorSchemeInternal(nextColorScheme);
      return;
    }

    if (!isLoop && ((nextColorScheme === "system" && currentColorScheme === systemColorScheme) || (currentColorScheme === "system" && nextColorScheme === systemColorScheme))) {
      updateColorSchemeInternal(nextColorScheme);
      return;
    }

    document.documentElement.classList.add("color-scheme-transition");

    const transition = document.startViewTransition(() => {
      updateColorSchemeInternal(nextColorScheme);
    });

    const { x, y } = position;
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const isDarken = nextColorScheme === "dark" || (nextColorScheme === "system" && systemColorScheme === "dark");

    transition.ready.then(() => {
      const animation = document.documentElement.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`]
        },
        {
          duration: 800,
          easing: "ease-out",
          direction: isDarken ? "normal" : "reverse",
          pseudoElement: isDarken ? "::view-transition-new(root)" : "::view-transition-old(root)"
        }
      );

      animation.addEventListener("cancel", removeColorSchemeTransitionClass);
      animation.addEventListener("remove", removeColorSchemeTransitionClass);
    });
    transition.finished.then(removeColorSchemeTransitionClass);
  }

  return {
    getNextColorScheme,
    updateColorScheme
  };
}

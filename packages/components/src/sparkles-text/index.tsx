import type { SparklesTextProps } from "./props";
import type { SparkleProps } from "./sparkle";

import { css } from "@emotion/react";
import { useEffect, useState } from "react";

import { Sparkle } from "./sparkle";

function generateStar(): SparkleProps {
  const starX = `${Math.random() * 100}%`;
  const starY = `${Math.random() * 100}%`;
  const color = Math.random() > 0.5 ? "var(--vef-color-primary)" : "var(--vef-color-warning)";
  const delay = Math.random() * 2;
  const scale = Math.random() * 1 + 0.3;
  const lifespan = Math.random() * 10 + 5;
  const id = `${starX}-${starY}-${Date.now()}`;
  return {
    id,
    x: starX,
    y: starY,
    color,
    delay,
    scale,
    lifespan
  };
}

const textWrapperStyle = css({
  position: "relative",
  display: "inline-block"
});

export function SparklesText({
  sparklesCount = 10,
  children,
  ...props
}: SparklesTextProps) {
  const [sparkles, setSparkles] = useState<SparkleProps[]>([]);

  useEffect(() => {
    const initializeStars = () => {
      const newSparkles = Array.from({ length: sparklesCount }, generateStar);
      setSparkles(newSparkles);
    };

    const updateStars = () => {
      setSparkles(currentSparkles => currentSparkles.map(star => star.lifespan <= 0 ? generateStar() : { ...star, lifespan: star.lifespan - 0.1 }));
    };

    initializeStars();
    const interval = setInterval(updateStars, 100);

    return () => clearInterval(interval);
  }, [sparklesCount]);

  return (
    <div {...props}>
      <span css={textWrapperStyle}>
        {
          sparkles.map(
            sparkle => <Sparkle key={sparkle.id} {...sparkle} />
          )
        }

        <strong>{children}</strong>
      </span>
    </div>
  );
}

export { type SparklesTextProps } from "./props";

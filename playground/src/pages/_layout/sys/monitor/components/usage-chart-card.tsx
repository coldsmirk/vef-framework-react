import type { ChartOption } from "@vef-framework-react/components";
import type { ReactElement, ReactNode } from "react";

import { Card, Chart, Icon, useThemeTokens } from "@vef-framework-react/components";
import { AlertTriangleIcon } from "lucide-react";
import { memo, useMemo } from "react";

import classes from "../styles/index.module.scss";

interface UsageChartCardProps {
  title: string;
  usagePercent: number;
  extra?: ReactNode;
  showWarning?: boolean;
}

type UsageLevel = "normal" | "medium" | "high";

function getUsageLevel(percent: number): UsageLevel {
  if (percent >= 90) {
    return "high";
  }

  if (percent >= 70) {
    return "medium";
  }

  return "normal";
}

function getProgressColor(
  level: UsageLevel,
  colors: { success: string; warning: string; error: string }
): string {
  switch (level) {
    case "high": {
      return colors.error;
    }

    case "medium": {
      return colors.warning;
    }

    case "normal": {
      return colors.success;
    }
  }
}

function renderExtraNode(level: UsageLevel, extra: ReactNode | undefined): ReactNode {
  if (extra) {
    return extra;
  }

  if (level === "high") {
    return <span className={classes.chartCardExtraDanger}>警告</span>;
  }

  if (level === "medium") {
    return <span className={classes.chartCardExtraWarning}>注意</span>;
  }

  return null;
}

function UsageChartCardComponent({
  title,
  usagePercent,
  extra,
  showWarning = false
}: UsageChartCardProps): ReactElement {
  const {
    colorSuccess,
    colorWarning,
    colorError,
    colorFillTertiary,
    fontFamilyCode
  } = useThemeTokens();

  const usageLevel = getUsageLevel(usagePercent);
  const isHighUsage = usageLevel === "high";

  const option = useMemo<ChartOption>(() => {
    const progressColor = getProgressColor(usageLevel, {
      success: colorSuccess,
      warning: colorWarning,
      error: colorError
    });

    return {
      grid: {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        containLabel: false
      },
      series: [
        {
          type: "gauge",
          startAngle: 90,
          endAngle: -270,
          radius: "100%",
          center: ["50%", "50%"],
          pointer: {
            show: false
          },
          emphasis: {
            itemStyle: {
              opacity: 0.8
            }
          },
          progress: {
            show: true,
            overlap: false,
            roundCap: true,
            clip: false,
            itemStyle: {
              color: progressColor
            }
          },
          axisLine: {
            lineStyle: {
              width: 16,
              color: [[1, colorFillTertiary]]
            }
          },
          splitLine: {
            show: false
          },
          axisTick: {
            show: false
          },
          axisLabel: {
            show: false
          },
          detail: {
            valueAnimation: true,
            width: "60%",
            lineHeight: 36,
            borderRadius: 8,
            offsetCenter: [0, 0],
            fontSize: 40,
            fontWeight: "bold",
            fontFamily: fontFamilyCode,
            formatter: (value: number) => `${value}%`,
            color: progressColor
          },
          data: [
            {
              value: usagePercent
            }
          ]
        }
      ]
    };
  }, [usagePercent, usageLevel, colorSuccess, colorWarning, colorError, colorFillTertiary, fontFamilyCode]);

  const titleNode = (
    <span className={classes.chartCardTitle}>
      {title}

      {showWarning && isHighUsage && (
        <Icon
          className={classes.warningIcon}
          component={AlertTriangleIcon}
        />
      )}
    </span>
  );

  const extraNode = renderExtraNode(usageLevel, extra);

  return (
    <Card className={classes.usageCard} extra={extraNode} title={titleNode}>
      <Chart height={160} option={option} />
    </Card>
  );
}

export const UsageChartCard = memo(UsageChartCardComponent);
UsageChartCard.displayName = "UsageChartCard";

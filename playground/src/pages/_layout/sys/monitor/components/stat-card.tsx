import type { CSSProperties, ReactElement, ReactNode } from "react";

import { Card, Group, Statistic } from "@vef-framework-react/components";

import classes from "../styles/index.module.scss";

export interface StatCardProps {
  title: string;
  value: string | number;
  suffix?: string;
  prefix?: ReactNode;
  icon?: ReactNode;
  valueStyle?: CSSProperties;
  precision?: number;
}

export function StatCard({
  title,
  value,
  suffix,
  prefix,
  icon,
  valueStyle,
  precision
}: StatCardProps): ReactElement {
  const titleNode = icon
    ? (
        <Group>
          {icon}
          <span>{title}</span>
        </Group>
      )
    : title;

  return (
    <Card className={classes.card}>
      <Statistic
        precision={precision}
        prefix={prefix}
        suffix={suffix}
        title={titleNode}
        value={value}
        styles={{
          content: valueStyle
        }}
      />
    </Card>
  );
}

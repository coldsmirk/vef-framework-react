import type { ReactElement } from "react";

import { Col, Icon, Row } from "@vef-framework-react/components";
import { ActivityIcon, BookmarkIcon, ComputerIcon, CpuIcon, ServerIcon } from "lucide-react";
import { memo } from "react";

import classes from "../styles/index.module.scss";
import { StatCard } from "./stat-card";

interface SystemInfoSectionProps {
  hostname?: string;
  platform?: string;
  platformVersion?: string;
  kernelArch?: string;
  uptime?: string;
  cpuCores?: number;
}

function formatOsInfo(
  platform: string | undefined,
  platformVersion: string | undefined,
  kernelArch: string | undefined
): string {
  if (!platform) {
    return "-";
  }

  return `${platform} - ${platformVersion} / ${kernelArch}`;
}

function SystemInfoSectionComponent({
  hostname,
  platform,
  platformVersion,
  kernelArch,
  uptime,
  cpuCores = 0
}: SystemInfoSectionProps): ReactElement {
  return (
    <>
      <h3 className={classes.sectionTitle}>
        <Icon component={ComputerIcon} />
        系统信息
      </h3>

      <Row className={classes.row} gutter={["var(--vef-spacing-md)", "var(--vef-spacing-md)"]}>
        <Col lg={8} md={8} sm={12} xl={6} xs={24}>
          <StatCard
            icon={<Icon component={BookmarkIcon} />}
            title="主机名"
            value={hostname || "-"}
          />
        </Col>

        <Col lg={8} md={8} sm={12} xl={6} xs={24}>
          <StatCard
            icon={<Icon component={ServerIcon} />}
            title="操作系统"
            value={formatOsInfo(platform, platformVersion, kernelArch)}
          />
        </Col>

        <Col lg={8} md={8} sm={12} xl={6} xs={24}>
          <StatCard
            icon={<Icon component={ActivityIcon} />}
            title="运行时间"
            value={uptime || "-"}
          />
        </Col>

        <Col lg={8} md={8} sm={12} xl={6} xs={24}>
          <StatCard
            icon={<Icon component={CpuIcon} />}
            suffix="核"
            title="CPU核心"
            value={cpuCores}
          />
        </Col>
      </Row>
    </>
  );
}

export const SystemInfoSection = memo(SystemInfoSectionComponent);
SystemInfoSection.displayName = "SystemInfoSection";

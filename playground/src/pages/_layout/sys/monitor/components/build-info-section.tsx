import type { ReactElement } from "react";

import { Col, Icon, Row } from "@vef-framework-react/components";
import { DEFAULT_DATETIME_FORMAT, formatDate, parseDate } from "@vef-framework-react/shared";
import { ClockIcon, GitCommitIcon, PackageIcon, TagIcon } from "lucide-react";
import { memo } from "react";

import classes from "../styles/index.module.scss";
import { StatCard } from "./stat-card";

interface BuildInfoSectionProps {
  vefVersion?: string;
  appVersion?: string;
  buildTime?: string;
  gitCommit?: string;
}

function formatBuildTime(buildTime: string | undefined): string {
  if (!buildTime) {
    return "-";
  }

  return formatDate(parseDate(buildTime), DEFAULT_DATETIME_FORMAT);
}

function formatGitCommit(gitCommit: string | undefined): string {
  if (!gitCommit) {
    return "-";
  }

  return gitCommit.slice(-7);
}

function BuildInfoSectionComponent({
  vefVersion,
  appVersion,
  buildTime,
  gitCommit
}: BuildInfoSectionProps): ReactElement {
  return (
    <>
      <h3 className={classes.sectionTitle}>
        <Icon component={PackageIcon} />
        构建信息
      </h3>

      <Row className={classes.row} gutter={["var(--vef-spacing-md)", "var(--vef-spacing-md)"]}>
        <Col lg={8} md={12} sm={12} xl={6} xs={24}>
          <StatCard
            icon={<Icon component={PackageIcon} />}
            title="VEF框架版本"
            value={vefVersion || "-"}
          />
        </Col>

        <Col lg={8} md={12} sm={12} xl={6} xs={24}>
          <StatCard
            icon={<Icon component={TagIcon} />}
            title="应用版本"
            value={appVersion || "-"}
          />
        </Col>

        <Col lg={8} md={12} sm={12} xl={6} xs={24}>
          <StatCard
            icon={<Icon component={ClockIcon} />}
            title="构建时间"
            value={formatBuildTime(buildTime)}
          />
        </Col>

        <Col lg={8} md={12} sm={12} xl={6} xs={24}>
          <StatCard
            icon={<Icon component={GitCommitIcon} />}
            title="Git提交"
            value={formatGitCommit(gitCommit)}
          />
        </Col>
      </Row>
    </>
  );
}

export const BuildInfoSection = memo(BuildInfoSectionComponent);
BuildInfoSection.displayName = "BuildInfoSection";

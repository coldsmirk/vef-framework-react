import type { ChartOption } from "@vef-framework-react/components";
import type { ReactNode } from "react";

import {
  BellOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  MedicineBoxOutlined,
  TeamOutlined,
  UserOutlined
} from "@ant-design/icons";
import { createFileRoute } from "@tanstack/react-router";
import {
  Avatar,
  Chart,
  Flex,
  FlexCard,
  Grid,
  Group,
  Page,
  Stack,
  Statistic,
  Text,
  Title
} from "@vef-framework-react/components";
import { getLocalizedDateTime } from "@vef-framework-react/shared";
import { useMemo } from "react";
import { getGreeting, getRandomBlessing } from "~helpers";

import classes from "./styles/index.module.scss";

// Types
interface StatItem {
  title: string;
  value: number;
  icon: ReactNode;
  color: string;
  suffix: string;
}

interface QuickAction {
  icon: ReactNode;
  title: string;
}

// Constants
const STATS: StatItem[] = [
  {
    title: "今日挂号",
    value: 128,
    icon: <UserOutlined />,
    color: "var(--vef-color-primary)",
    suffix: "人"
  },
  {
    title: "预约就诊",
    value: 45,
    icon: <CalendarOutlined />,
    color: "var(--vef-color-success)",
    suffix: "人"
  },
  {
    title: "住院人数",
    value: 312,
    icon: <MedicineBoxOutlined />,
    color: "var(--vef-color-warning)",
    suffix: "人"
  },
  {
    title: "值班医护",
    value: 86,
    icon: <TeamOutlined />,
    color: "var(--vef-color-error)",
    suffix: "人"
  }
];

const QUICK_ACTIONS: QuickAction[] = [
  { icon: <UserOutlined />, title: "患者登记" },
  { icon: <ClockCircleOutlined />, title: "排班管理" },
  { icon: <TeamOutlined />, title: "科室管理" },
  { icon: <BellOutlined />, title: "消息通知" }
];

const RESPONSIVE_STAT_SPAN = {
  xs: 24,
  sm: 12,
  md: 12,
  lg: 6
};
const RESPONSIVE_CHART_MAIN_SPAN = {
  xs: 24,
  md: 24,
  lg: 16
};
const RESPONSIVE_CHART_SIDE_SPAN = {
  xs: 24,
  md: 24,
  lg: 8
};
const CHART_HEIGHT = 320;

const VISIT_CHART_OPTION: ChartOption = {
  tooltip: { trigger: "axis" },
  legend: {
    top: "0px",
    right: "0px",
    data: ["门诊量", "急诊量"]
  },
  grid: {
    left: "3%",
    right: "4%",
    bottom: "3%",
    top: "12%",
    containLabel: true
  },
  xAxis: {
    type: "category",
    boundaryGap: false,
    data: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
    axisLine: { show: false },
    axisTick: { show: false }
  },
  yAxis: {
    type: "value",
    splitLine: { lineStyle: { type: "dashed" } }
  },
  series: [
    {
      name: "门诊量",
      type: "line",
      smooth: true,
      showSymbol: false,
      areaStyle: { opacity: 0.1 },
      lineStyle: { width: 3 },
      data: [120, 132, 101, 134, 90, 230, 210]
    },
    {
      name: "急诊量",
      type: "line",
      smooth: true,
      showSymbol: false,
      areaStyle: { opacity: 0.1 },
      lineStyle: { width: 3 },
      data: [20, 32, 11, 34, 20, 50, 40]
    }
  ]
};

const DEPARTMENT_DATA = [
  { name: "内科", value: 45 },
  { name: "外科", value: 32 },
  { name: "儿科", value: 28 },
  { name: "妇产科", value: 24 },
  { name: "眼科", value: 15 }
];

const DEPT_CHART_OPTION: ChartOption = {
  tooltip: { trigger: "item" },
  legend: {
    bottom: "10px",
    left: "center",
    icon: "circle"
  },
  series: [
    {
      name: "科室分布",
      type: "pie",
      radius: ["40%", "70%"],
      center: ["50%", "40%"],
      avoidLabelOverlap: false,
      itemStyle: {
        borderRadius: 10,
        borderColor: "#fff",
        borderWidth: 2
      },
      label: { show: false, position: "center" },
      emphasis: {
        label: {
          show: true,
          fontSize: 20,
          fontWeight: "bold"
        }
      },
      data: DEPARTMENT_DATA
    }
  ]
};

// Route definition
export const Route = createFileRoute("/_layout/")({
  component: IndexPage
});

// Component
function IndexPage(): ReactNode {
  const greeting = useMemo(() => getGreeting(), []);
  const blessing = useMemo(() => getRandomBlessing(), []);
  const todayDate = useMemo(() => getLocalizedDateTime(false), []);

  return (
    <Page scrollable scrollMargin>
      <div className={classes.container}>
        {/* Welcome Section */}
        <FlexCard className={classes.welcomeCard}>
          <Group align="start" justify="space-between" wrap="wrap">
            <Group gap="medium">
              <Avatar size={72} src="https://avatars.githubusercontent.com/u/18739624?v=4" />

              <Stack>
                <Title className={classes.welcomeTitle} level={2}>
                  {greeting}
                  ，管理员
                </Title>

                <Text type="secondary">
                  今天是
                  {todayDate}
                  ，
                  {blessing}
                </Text>
              </Stack>
            </Group>

            <Group className={classes.welcomeStats} gap="large">
              <Stack align="center" className={classes.welcomeStatItem}>
                <Text type="secondary">待办事项</Text>
                <span>80</span>
              </Stack>

              <Stack align="center" className={classes.welcomeStatItem}>
                <Text type="secondary">消息</Text>
                <span>99</span>
              </Stack>
            </Group>
          </Group>
        </FlexCard>

        {/* Stats Cards */}
        <Grid gap="medium">
          {STATS.map(stat => (
            <Grid.Item key={stat.title} span={RESPONSIVE_STAT_SPAN}>
              <FlexCard className={classes.statCard}>
                <Flex align="center" justify="space-between">
                  <Statistic
                    suffix={<Text type="secondary">{stat.suffix}</Text>}
                    title={stat.title}
                    value={stat.value}
                  />

                  <div className={classes.statCardIconWrapper} style={{ color: stat.color }}>
                    {stat.icon}
                  </div>
                </Flex>
              </FlexCard>
            </Grid.Item>
          ))}
        </Grid>

        {/* Quick Actions */}
        <FlexCard title="快捷操作">
          <Grid gap="small">
            {QUICK_ACTIONS.map(action => (
              <Grid.Item key={action.title} span={6}>
                <Group justify="center">
                  <div>{action.icon}</div>
                  <Text>{action.title}</Text>
                </Group>
              </Grid.Item>
            ))}
          </Grid>
        </FlexCard>

        {/* Charts */}
        <Grid gap="medium">
          <Grid.Item span={RESPONSIVE_CHART_MAIN_SPAN}>
            <FlexCard title="就诊趋势分析">
              <Chart height={CHART_HEIGHT} option={VISIT_CHART_OPTION} />
            </FlexCard>
          </Grid.Item>

          <Grid.Item span={RESPONSIVE_CHART_SIDE_SPAN}>
            <FlexCard title="科室就诊占比">
              <Chart height={CHART_HEIGHT} option={DEPT_CHART_OPTION} />
            </FlexCard>
          </Grid.Item>
        </Grid>
      </div>
    </Page>
  );
}

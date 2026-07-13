import type { TableColumn } from "@vef-framework-react/components";
import type { ReactElement } from "react";
import type { StreamGroupInfo } from "~apis";

import { Card, Empty, Icon, Table, Tag } from "@vef-framework-react/components";
import { useQuery } from "@vef-framework-react/core";
import { RadioTowerIcon } from "lucide-react";
import { memo } from "react";
import { getEventStreams } from "~apis";

import classes from "../styles/index.module.scss";

const REFETCH_INTERVAL = 15_000;

/**
 * A group whose undelivered backlog reaches this size is flagged as an orphan
 * candidate — likely a subscriber that was removed or renamed without
 * decommissioning its consumer group.
 */
const ORPHAN_LAG_THRESHOLD = 500;

interface StreamGroupRow extends StreamGroupInfo {
  key: string;
  stream: string;
  streamLength: number;
  /**
   * How many group rows the stream spans — set on the first row of each
   * stream so the stream cells merge, 0 on the rest.
   */
  streamRowSpan: number;
}

function lagColor(lag: number): string | undefined {
  if (lag >= ORPHAN_LAG_THRESHOLD) {
    return "error";
  }

  return lag > 0 ? "warning" : undefined;
}

const COLUMNS: Array<TableColumn<StreamGroupRow>> = [
  {
    title: "事件流",
    dataIndex: "stream",
    onCell: row => { return { rowSpan: row.streamRowSpan }; }
  },
  {
    title: "长度",
    dataIndex: "streamLength",
    width: 90,
    onCell: row => { return { rowSpan: row.streamRowSpan }; }
  },
  {
    title: "消费组",
    dataIndex: "name"
  },
  {
    title: "消费者",
    dataIndex: "consumers",
    width: 80
  },
  {
    title: "待确认",
    dataIndex: "pending",
    width: 80
  },
  {
    title: "滞后",
    dataIndex: "lag",
    width: 100,
    render: (lag: number) => {
      const color = lagColor(lag);
      return color ? <Tag color={color}>{lag}</Tag> : lag;
    }
  },
  {
    title: "最后投递 ID",
    dataIndex: "lastDeliveredId",
    width: 180
  }
];

/**
 * Cross-process event stream observability (`sys/monitor.get_event_streams`):
 * one row per consumer group, with lag highlighted so orphaned groups —
 * growing lag with idle consumers — stand out.
 */
function EventStreamsSectionComponent(): ReactElement | null {
  const { data } = useQuery({
    queryKey: ["system-event-streams"],
    queryFn: getEventStreams,
    refetchInterval: REFETCH_INTERVAL
  });

  if (!data) {
    return null;
  }

  const rows: StreamGroupRow[] = data.streams.flatMap(stream => {
    if (stream.groups.length === 0) {
      return [
        {
          key: stream.stream,
          stream: stream.stream,
          streamLength: stream.length,
          streamRowSpan: 1,
          name: "—",
          consumers: 0,
          pending: 0,
          lag: 0,
          lastDeliveredId: "—"
        }
      ];
    }

    return stream.groups.map((group, index) => {
      return {
        ...group,
        key: `${stream.stream}/${group.name}`,
        stream: stream.stream,
        streamLength: stream.length,
        streamRowSpan: index === 0 ? stream.groups.length : 0
      };
    });
  });

  return (
    <>
      <h3 className={classes.sectionTitle}>
        <Icon component={RadioTowerIcon} />
        事件流
      </h3>

      <Card className={classes.card}>
        {data.enabled
          ? rows.length === 0
            ? <Empty description="暂无事件流" />
            : (
                <Table<StreamGroupRow>
                  columns={COLUMNS}
                  dataSource={rows}
                  pagination={false}
                  rowKey="key"
                  size="small"
                />
              )
          : <Empty description="事件流观测未启用(需要 redis_stream 传输)" />}
      </Card>
    </>
  );
}

export const EventStreamsSection = memo(EventStreamsSectionComponent);

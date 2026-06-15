import type { ReactElement } from "react";

import { Card, Descriptions } from "@vef-framework-react/components";
import { formatBytes, formatNumber } from "@vef-framework-react/shared";
import { memo } from "react";

import classes from "../styles/index.module.scss";

interface NetworkTrafficCardProps {
  bytesSent?: number;
  bytesRecv?: number;
  packetsSent?: number;
  packetsRecv?: number;
  interfaces?: number;
}

function NetworkTrafficCardComponent({
  bytesSent = 0,
  bytesRecv = 0,
  packetsSent = 0,
  packetsRecv = 0,
  interfaces = 0
}: NetworkTrafficCardProps): ReactElement {
  return (
    <Card className={classes.card} title="网络流量">
      <Descriptions className={classes.justifiedDescriptions} column={1} size="small">
        <Descriptions.Item label="发送流量">
          {formatBytes(bytesSent)}
        </Descriptions.Item>

        <Descriptions.Item label="接收流量">
          {formatBytes(bytesRecv)}
        </Descriptions.Item>

        <Descriptions.Item label="发送数据包">
          {formatNumber(packetsSent)}
        </Descriptions.Item>

        <Descriptions.Item label="接收数据包">
          {formatNumber(packetsRecv)}
        </Descriptions.Item>

        <Descriptions.Item label="网卡数量">
          {interfaces}
          {" "}
          个
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
}

export const NetworkTrafficCard = memo(NetworkTrafficCardComponent);
NetworkTrafficCard.displayName = "NetworkTrafficCard";

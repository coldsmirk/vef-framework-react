import * as echarts from "echarts";

export function connectCharts(groupId: string): void {
  echarts.connect(groupId);
}

export function disconnectCharts(groupId: string): void {
  echarts.disconnect(groupId);
}

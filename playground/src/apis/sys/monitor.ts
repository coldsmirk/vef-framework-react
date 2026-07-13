import { API_PATH, apiClient, createApiRequest } from "~api";

export interface SystemOverview {
  host: HostSummary | null;
  cpu: CpuSummary | null;
  memory: MemorySummary | null;
  disk: DiskSummary | null;
  network: NetworkSummary | null;
  process: ProcessSummary | null;
  load: LoadInfo | null;
  build: BuildInfo | null;
}

export interface HostSummary {
  hostname: string;
  os: string;
  platform: string;
  platformVersion: string;
  kernelArch: string;
  uptime: number;
}

export interface CpuSummary {
  physicalCores: number;
  logicalCores: number;
  usagePercent: number;
  /**
   * The CPU capacity that usagePercent is normalized against: the cgroup
   * quota/cpuset capacity inside a limited container (possibly fractional,
   * e.g. 0.5), otherwise equal to logicalCores.
   */
  effectiveCores: number;
}

export interface MemorySummary {
  total: number;
  used: number;
  usedPercent: number;
}

export interface DiskSummary {
  total: number;
  used: number;
  usedPercent: number;
  partitions: number;
}

export interface NetworkSummary {
  interfaces: number;
  bytesSent: number;
  bytesRecv: number;
  packetsSent: number;
  packetsRecv: number;
}

export interface ProcessSummary {
  pid: number;
  name: string;
  cpuPercent: number;
  memoryPercent: number;
}

export interface LoadInfo {
  load1: number;
  load5: number;
  load15: number;
}

export interface BuildInfo {
  vefVersion: string;
  appVersion: string;
  buildTime: string;
  gitCommit: string;
}

/**
 * One consumer group attached to a cross-process event stream, aligned with
 * the backend `event.StreamGroupInfo`. A group whose lag keeps growing while
 * its consumers stay idle is an orphan candidate — a subscriber that was
 * removed or renamed without decommissioning its consumer group.
 */
export interface StreamGroupInfo {
  name: string;
  consumers: number;
  pending: number;
  lag: number;
  lastDeliveredId: string;
}

/**
 * One transport-level event stream and its consumer groups, aligned with the
 * backend `event.StreamInfo`.
 */
export interface StreamInfo {
  stream: string;
  length: number;
  groups: StreamGroupInfo[];
}

/**
 * Payload of `sys/monitor.get_event_streams`, aligned with the backend
 * `monitor.EventStreamsInfo`. `enabled` is false when no stream inspector is
 * available (the redis_stream transport is off).
 */
export interface EventStreamsInfo {
  enabled: boolean;
  streams: StreamInfo[];
}

export const getSystemOverview = apiClient.createQueryFn(
  "get_system_overview",
  ({ post }) => async () => {
    const result = await post<SystemOverview>(
      API_PATH,
      { data: createApiRequest("sys/monitor", "get_overview") }
    );
    return result.data;
  }
);

export const getEventStreams = apiClient.createQueryFn(
  "get_event_streams",
  ({ post }) => async () => {
    const result = await post<EventStreamsInfo>(
      API_PATH,
      { data: createApiRequest("sys/monitor", "get_event_streams") }
    );
    return result.data;
  }
);

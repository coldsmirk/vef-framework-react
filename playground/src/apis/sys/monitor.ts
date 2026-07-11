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

import { faker } from "@faker-js/faker";

import { defineMock } from "../define-mock";

interface StreamGroupInfo {
  name: string;
  consumers: number;
  pending: number;
  lag: number;
  lastDeliveredId: string;
}

interface EventStreamsInfo {
  enabled: boolean;
  streams: Array<{ stream: string; length: number; groups: StreamGroupInfo[] }>;
}

interface SystemOverview {
  host: {
    hostname: string;
    os: string;
    platform: string;
    platformVersion: string;
    kernelArch: string;
    uptime: number;
  };
  cpu: { physicalCores: number; logicalCores: number; usagePercent: number; effectiveCores: number };
  memory: { total: number; used: number; usedPercent: number };
  disk: { total: number; used: number; usedPercent: number; partitions: number };
  network: { interfaces: number; bytesSent: number; bytesRecv: number; packetsSent: number; packetsRecv: number };
  process: { pid: number; name: string; cpuPercent: number; memoryPercent: number };
  load: { load1: number; load5: number; load15: number };
  build: { vefVersion: string; appVersion: string; buildTime: string; gitCommit: string };
}

defineMock<void, SystemOverview>("sys/monitor", "get_overview", () => {
  const memTotal = 32 * 1024 * 1024 * 1024;
  const memUsed = Math.floor(memTotal * faker.number.float({ min: 0.3, max: 0.7 }));
  const diskTotal = 512 * 1024 * 1024 * 1024;
  const diskUsed = Math.floor(diskTotal * faker.number.float({ min: 0.4, max: 0.85 }));

  return {
    host: {
      hostname: "playground-host",
      os: "linux",
      platform: "ubuntu",
      platformVersion: "24.04",
      kernelArch: "x86_64",
      uptime: faker.number.int({ min: 60_000, max: 1_000_000 })
    },
    cpu: {
      physicalCores: 8,
      logicalCores: 16,
      usagePercent: faker.number.float({
        min: 5,
        max: 70,
        fractionDigits: 2
      }),
      // Matches logicalCores on an unlimited host; a limited container would
      // report its (possibly fractional) cgroup quota instead.
      effectiveCores: 16
    },
    memory: {
      total: memTotal,
      used: memUsed,
      usedPercent: Number(((memUsed / memTotal) * 100).toFixed(2))
    },
    disk: {
      total: diskTotal,
      used: diskUsed,
      usedPercent: Number(((diskUsed / diskTotal) * 100).toFixed(2)),
      // The Go side now reports the root filesystem only.
      partitions: 1
    },
    network: {
      interfaces: 4,
      bytesSent: faker.number.int({ min: 1_000_000, max: 1_000_000_000 }),
      bytesRecv: faker.number.int({ min: 1_000_000, max: 1_000_000_000 }),
      packetsSent: faker.number.int({ min: 10_000, max: 1_000_000 }),
      packetsRecv: faker.number.int({ min: 10_000, max: 1_000_000 })
    },
    process: {
      pid: 12_345,
      name: "vef-playground",
      cpuPercent: faker.number.float({
        min: 0.5,
        max: 8,
        fractionDigits: 2
      }),
      memoryPercent: faker.number.float({
        min: 1,
        max: 6,
        fractionDigits: 2
      })
    },
    load: {
      load1: faker.number.float({
        min: 0.1,
        max: 3,
        fractionDigits: 2
      }),
      load5: faker.number.float({
        min: 0.1,
        max: 2.5,
        fractionDigits: 2
      }),
      load15: faker.number.float({
        min: 0.1,
        max: 2,
        fractionDigits: 2
      })
    },
    build: {
      vefVersion: "2.1.12",
      appVersion: "0.0.3",
      buildTime: new Date().toISOString(),
      gitCommit: faker.git.commitSha().slice(0, 10)
    }
  };
});

function buildStreamGroup(name: string, lag: number): StreamGroupInfo {
  return {
    name,
    consumers: faker.number.int({ min: 1, max: 4 }),
    pending: faker.number.int({ min: 0, max: 20 }),
    lag,
    lastDeliveredId: `${Date.now() - lag * 1000}-0`
  };
}

defineMock<void, EventStreamsInfo>("sys/monitor", "get_event_streams", () => {
  return {
    enabled: true,
    streams: [
      {
        stream: "vef:events:approval.instance",
        length: faker.number.int({ min: 200, max: 5000 }),
        groups: [
          buildStreamGroup("approval-projection", 0),
          buildStreamGroup("business-write-back", faker.number.int({ min: 0, max: 5 })),
          // An orphan candidate: large and growing lag with idle consumers.
          buildStreamGroup("legacy-notifier", faker.number.int({ min: 800, max: 2000 }))
        ]
      },
      {
        stream: "vef:events:audit.log",
        length: faker.number.int({ min: 50, max: 800 }),
        groups: [buildStreamGroup("audit-archiver", 0)]
      }
    ]
  };
});

import { registerTheme } from "echarts";

export function registerWaldenDarkTheme() {
  registerTheme("walden-dark", {
    color: [
      "#5ec4f5",
      "#7df5d5",
      "#7a85b3",
      "#b5bdf2",
      "#d8f5c4",
      "#aee8f0"
    ],
    backgroundColor: "rgba(0,0,0,0)",
    textStyle: {
      color: "#b9b8ce"
    },
    title: {
      textStyle: {
        color: "#eef1fa"
      },
      subtextStyle: {
        color: "#b9b8ce"
      }
    },
    line: {
      itemStyle: {
        borderWidth: "2"
      },
      lineStyle: {
        width: "3"
      },
      symbolSize: "8",
      symbol: "emptyCircle",
      smooth: false
    },
    radar: {
      itemStyle: {
        borderWidth: "2"
      },
      lineStyle: {
        width: "3"
      },
      symbolSize: "8",
      symbol: "emptyCircle",
      smooth: false
    },
    bar: {
      itemStyle: {
        barBorderWidth: 0,
        barBorderColor: "#484753"
      }
    },
    pie: {
      itemStyle: {
        borderWidth: 0,
        borderColor: "#484753"
      }
    },
    scatter: {
      itemStyle: {
        borderWidth: 0,
        borderColor: "#484753"
      }
    },
    boxplot: {
      itemStyle: {
        borderWidth: 0,
        borderColor: "#484753"
      }
    },
    parallel: {
      itemStyle: {
        borderWidth: 0,
        borderColor: "#484753"
      }
    },
    sankey: {
      itemStyle: {
        borderWidth: 0,
        borderColor: "#484753"
      }
    },
    funnel: {
      itemStyle: {
        borderWidth: 0,
        borderColor: "#484753"
      }
    },
    gauge: {
      itemStyle: {
        borderWidth: 0,
        borderColor: "#484753"
      },
      title: {
        color: "#b9b8ce"
      },
      detail: {
        color: "#eef1fa"
      },
      axisLine: {
        lineStyle: {
          color: [[1, "#484753"]]
        }
      },
      axisTick: {
        lineStyle: {
          color: "#484753"
        }
      },
      splitLine: {
        lineStyle: {
          color: "#484753"
        }
      },
      axisLabel: {
        color: "#b9b8ce"
      }
    },
    candlestick: {
      itemStyle: {
        color: "#f78fb3",
        color0: "transparent",
        borderColor: "#f78fb3",
        borderColor0: "#5ec4f5",
        borderWidth: "2"
      }
    },
    graph: {
      itemStyle: {
        borderWidth: 0,
        borderColor: "#484753"
      },
      lineStyle: {
        width: "1",
        color: "#484753"
      },
      symbolSize: "8",
      symbol: "emptyCircle",
      smooth: false,
      color: [
        "#5ec4f5",
        "#7df5d5",
        "#7a85b3",
        "#b5bdf2",
        "#d8f5c4",
        "#aee8f0"
      ],
      label: {
        color: "#eef1fa"
      }
    },
    map: {
      itemStyle: {
        areaColor: "#2a2a3c",
        borderColor: "#484753",
        borderWidth: 0.5
      },
      label: {
        color: "#eef1fa"
      },
      emphasis: {
        itemStyle: {
          areaColor: "rgba(94,196,245,0.25)",
          borderColor: "#5ec4f5",
          borderWidth: 1
        },
        label: {
          color: "#5ec4f5"
        }
      }
    },
    geo: {
      itemStyle: {
        areaColor: "#2a2a3c",
        borderColor: "#484753",
        borderWidth: 0.5
      },
      label: {
        color: "#eef1fa"
      },
      emphasis: {
        itemStyle: {
          areaColor: "rgba(94,196,245,0.25)",
          borderColor: "#5ec4f5",
          borderWidth: 1
        },
        label: {
          color: "#5ec4f5"
        }
      }
    },
    categoryAxis: {
      axisLine: {
        show: true,
        lineStyle: {
          color: "#484753"
        }
      },
      axisTick: {
        show: false,
        lineStyle: {
          color: "#b9b8ce"
        }
      },
      axisLabel: {
        show: true,
        color: "#b9b8ce"
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: ["#2a2a3c"]
        }
      },
      splitArea: {
        show: false,
        areaStyle: {
          color: [
            "rgba(255,255,255,0.02)",
            "rgba(255,255,255,0.05)"
          ]
        }
      }
    },
    valueAxis: {
      axisLine: {
        show: true,
        lineStyle: {
          color: "#484753"
        }
      },
      axisTick: {
        show: false,
        lineStyle: {
          color: "#b9b8ce"
        }
      },
      axisLabel: {
        show: true,
        color: "#b9b8ce"
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: ["#2a2a3c"]
        }
      },
      splitArea: {
        show: false,
        areaStyle: {
          color: [
            "rgba(255,255,255,0.02)",
            "rgba(255,255,255,0.05)"
          ]
        }
      }
    },
    logAxis: {
      axisLine: {
        show: true,
        lineStyle: {
          color: "#484753"
        }
      },
      axisTick: {
        show: false,
        lineStyle: {
          color: "#b9b8ce"
        }
      },
      axisLabel: {
        show: true,
        color: "#b9b8ce"
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: ["#2a2a3c"]
        }
      },
      splitArea: {
        show: false,
        areaStyle: {
          color: [
            "rgba(255,255,255,0.02)",
            "rgba(255,255,255,0.05)"
          ]
        }
      }
    },
    timeAxis: {
      axisLine: {
        show: true,
        lineStyle: {
          color: "#484753"
        }
      },
      axisTick: {
        show: false,
        lineStyle: {
          color: "#b9b8ce"
        }
      },
      axisLabel: {
        show: true,
        color: "#b9b8ce"
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: ["#2a2a3c"]
        }
      },
      splitArea: {
        show: false,
        areaStyle: {
          color: [
            "rgba(255,255,255,0.02)",
            "rgba(255,255,255,0.05)"
          ]
        }
      }
    },
    toolbox: {
      iconStyle: {
        borderColor: "#b9b8ce"
      },
      emphasis: {
        iconStyle: {
          borderColor: "#eef1fa"
        }
      }
    },
    legend: {
      textStyle: {
        color: "#b9b8ce"
      },
      left: "center",
      right: "auto",
      top: "auto",
      bottom: 15
    },
    tooltip: {
      backgroundColor: "rgba(16,12,42,0.9)",
      borderColor: "#484753",
      borderWidth: 1,
      textStyle: {
        color: "#eef1fa"
      },
      axisPointer: {
        lineStyle: {
          color: "#484753",
          width: 1
        },
        crossStyle: {
          color: "#484753",
          width: 1
        }
      }
    },
    timeline: {
      lineStyle: {
        color: "#7a85b3",
        width: 1
      },
      itemStyle: {
        color: "#7a85b3",
        borderWidth: 1
      },
      controlStyle: {
        color: "#7a85b3",
        borderColor: "#7a85b3",
        borderWidth: 0.5
      },
      checkpointStyle: {
        color: "#5ec4f5",
        borderColor: "rgba(94,196,245,0.25)"
      },
      label: {
        color: "#7a85b3"
      },
      emphasis: {
        itemStyle: {
          color: "#7a85b3"
        },
        controlStyle: {
          color: "#7a85b3",
          borderColor: "#7a85b3",
          borderWidth: 0.5
        },
        label: {
          color: "#7a85b3"
        }
      }
    },
    visualMap: {
      textStyle: {
        color: "#b9b8ce"
      },
      color: [
        "#4a8cc7",
        "#7df5d5"
      ]
    },
    markPoint: {
      label: {
        color: "#eef1fa"
      },
      emphasis: {
        label: {
          color: "#eef1fa"
        }
      }
    },
    grid: {
      left: "15%",
      right: "10%",
      top: 65,
      bottom: 80
    }
  });
}

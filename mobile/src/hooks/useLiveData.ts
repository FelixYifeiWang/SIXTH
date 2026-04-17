import { useEffect, useRef, useState } from "react";
import {
  type Alert,
  type ExpeditionInfo,
  type Metric,
  expedition as baseExpedition,
  getStatus,
  metrics as initialMetrics,
} from "../data/mockData";
import { fetchSensorReport, type SensorReport } from "../api/sensorApi";

export type LiveConnection = "disconnected" | "connecting" | "connected" | "error";

const POLL_MS = 1000;
const TREND_WINDOW = 7;

function blankMetrics(): Metric[] {
  return initialMetrics.map((m) => ({
    ...m,
    value: 0,
    trend: [],
    status: "normal",
    placeholder: true,
  }));
}

function applyReport(
  base: Metric[],
  report: SensorReport,
  history: Record<string, number[]>,
): Metric[] {
  return base.map((m) => {
    if (m.id === "core-temp") {
      const v = Number(report.thermistorC.toFixed(1));
      const trend = history[m.id] ?? [];
      trend.push(v);
      while (trend.length > TREND_WINDOW) trend.shift();
      history[m.id] = trend;
      return {
        ...m,
        value: v,
        trend: [...trend],
        status: getStatus(v, m.range),
        placeholder: false,
      };
    }
    return m;
  });
}

export function useLiveData(host: string | null) {
  const [metrics, setMetrics] = useState<Metric[]>(blankMetrics);
  const [connection, setConnection] = useState<LiveConnection>("disconnected");
  const historyRef = useRef<Record<string, number[]>>({});

  useEffect(() => {
    let cancelled = false;
    setConnection(host ? "connecting" : "disconnected");

    const tick = async () => {
      try {
        const report = await fetchSensorReport(host);
        if (cancelled) return;
        if (!report) {
          setConnection("disconnected");
          return;
        }
        setConnection("connected");
        setMetrics((prev) => applyReport(prev, report, historyRef.current));
      } catch {
        if (!cancelled) setConnection("error");
      }
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [host]);

  return {
    metrics,
    expedition: baseExpedition as ExpeditionInfo,
    extremeAlerts: [] as Alert[],
    dailyAlerts: [] as Alert[],
    connection,
  };
}

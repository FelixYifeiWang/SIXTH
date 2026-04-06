// ── Types ──

export type MetricStatus = "normal" | "warning" | "critical";

export type MetricRange = {
  min: number;
  max: number;
  warningLow?: number;
  warningHigh?: number;
  criticalLow?: number;
  criticalHigh?: number;
};

export type AppMode = "daily" | "extreme";

export type Metric = {
  id: string;
  label: string;
  value: number;
  unit: string;
  icon: string;
  accentColor: string;
  trend: number[];
  section: "vitals" | "body" | "environment" | "motion";
  status: MetricStatus;
  range?: MetricRange;
  subtitle?: string;
  modes: AppMode[];
};

export type AlertChannel = "haptic" | "audio" | "thermal";

export type Alert = {
  id: string;
  code: string;
  severity: "info" | "warning" | "critical";
  message: string;
  channels: AlertChannel[];
  timestamp: string;
  mode: AppMode;
};

export type ExpeditionInfo = {
  name: string;
  mountain: string;
  currentAltitude: number;
  targetAltitude: number;
  baseAltitude: number;
  campName: string;
  day: number;
  totalDays: number;
  weatherCondition: string;
  windDirection: string;
  sunrise: string;
  sunset: string;
};

// ── Helpers ──

function getStatus(
  value: number,
  range?: MetricRange
): MetricStatus {
  if (!range) return "normal";
  if (
    (range.criticalLow !== undefined && value <= range.criticalLow) ||
    (range.criticalHigh !== undefined && value >= range.criticalHigh)
  )
    return "critical";
  if (
    (range.warningLow !== undefined && value <= range.warningLow) ||
    (range.warningHigh !== undefined && value >= range.warningHigh)
  )
    return "warning";
  return "normal";
}

// ── Expedition ──

export const expedition: ExpeditionInfo = {
  name: "Everest North Ridge",
  mountain: "Mt. Everest",
  currentAltitude: 7_162,
  targetAltitude: 8_849,
  baseAltitude: 5_150,
  campName: "Camp III — North Col",
  day: 18,
  totalDays: 42,
  weatherCondition: "Partly Cloudy",
  windDirection: "NW 48 km/h",
  sunrise: "06:12",
  sunset: "18:47",
};

// ── Metrics ──

const rawMetrics: Omit<Metric, "status">[] = [
  // ── Vitals (Pulse oximeter · ECG) ──
  {
    id: "heart-rate",
    label: "Heart Rate",
    value: 98,
    unit: "bpm",
    icon: "❤️",
    accentColor: "#FF6B8A",
    trend: [88, 104, 91, 112, 96, 85, 98],
    section: "vitals",
    modes: ["daily", "extreme"],
    range: { min: 40, max: 200, warningHigh: 120, criticalHigh: 150, warningLow: 50, criticalLow: 40 },
  },
  {
    id: "blood-oxygen",
    label: "SpO₂",
    value: 82,
    unit: "%",
    icon: "🫁",
    accentColor: "#5B8DEF",
    trend: [89, 84, 87, 81, 85, 79, 82],
    section: "vitals",
    modes: ["daily", "extreme"],
    subtitle: "Low",
    range: { min: 50, max: 100, warningLow: 85, criticalLow: 75 },
  },
  {
    id: "hrv",
    label: "HRV",
    value: 28,
    unit: "ms RMSSD",
    icon: "💓",
    accentColor: "#A78BFA",
    trend: [38, 26, 33, 22, 31, 24, 28],
    section: "vitals",
    modes: ["extreme"],
    subtitle: "Stressed",
    range: { min: 10, max: 100, warningLow: 25, criticalLow: 15 },
  },

  // ── Body (Skin temp · Core temp estimator) ──
  {
    id: "core-temp",
    label: "Core Temp",
    value: 36.4,
    unit: "°C",
    icon: "🌡️",
    accentColor: "#F5A623",
    trend: [36.9, 36.5, 36.8, 36.3, 36.6, 36.2, 36.4],
    section: "body",
    modes: ["daily", "extreme"],
    subtitle: "Watch",
    range: { min: 34, max: 40, warningLow: 36.0, criticalLow: 35.0, warningHigh: 38.5, criticalHigh: 39.5 },
  },
  {
    id: "skin-temp",
    label: "Skin Temp",
    value: 28.1,
    unit: "°C",
    icon: "🤚",
    accentColor: "#FFBB54",
    trend: [31.4, 28.6, 30.1, 27.8, 29.3, 27.5, 28.1],
    section: "body",
    modes: ["extreme"],
    range: { min: 15, max: 37, warningLow: 27, criticalLow: 22 },
  },

  // ── Environment (Barometric · Ambient temp) ──
  {
    id: "altitude",
    label: "Altitude",
    value: 7_162,
    unit: "m",
    icon: "⛰️",
    accentColor: "#6EE7B7",
    trend: [6840, 6960, 6910, 7050, 7020, 7130, 7162],
    section: "environment",
    modes: ["daily", "extreme"],
  },
  {
    id: "air-pressure",
    label: "Pressure",
    value: 376,
    unit: "hPa",
    icon: "📊",
    accentColor: "#93C5FD",
    trend: [382, 379, 381, 377, 378, 375, 376],
    section: "environment",
    modes: ["extreme"],
    subtitle: "37% sea lvl",
  },
  {
    id: "ambient-temp",
    label: "Ambient",
    value: -22,
    unit: "°C",
    icon: "❄️",
    accentColor: "#5AC8CA",
    trend: [-18, -21, -19, -23, -20, -24, -22],
    section: "environment",
    modes: ["daily", "extreme"],
    range: { min: -50, max: 10, warningLow: -25, criticalLow: -35 },
  },

  // ── Motion (IMU / accelerometer) ──
  {
    id: "cadence",
    label: "Cadence",
    value: 42,
    unit: "spm",
    icon: "🦶",
    accentColor: "#818CF8",
    trend: [48, 40, 46, 38, 44, 41, 42],
    section: "motion",
    modes: ["extreme"],
  },
  {
    id: "ascent-rate",
    label: "Ascent Rate",
    value: 84,
    unit: "m/hr",
    icon: "📈",
    accentColor: "#6EE7B7",
    trend: [120, 95, 108, 88, 96, 80, 84],
    section: "motion",
    modes: ["daily", "extreme"],
    subtitle: "Slowing",
  },
];

// Apply status based on ranges
export const metrics: Metric[] = rawMetrics.map((m) => ({
  ...m,
  status: getStatus(m.value, m.range),
}));

// ── Alerts ──

export const extremeAlerts: Alert[] = [
  {
    id: "e2",
    code: "E2",
    severity: "warning",
    message: "Descend or rest",
    channels: ["haptic", "audio"],
    timestamp: "2m",
    mode: "extreme",
  },
  {
    id: "e4",
    code: "E4",
    severity: "warning",
    message: "Storm approaching",
    channels: ["haptic", "audio"],
    timestamp: "18m",
    mode: "extreme",
  },
];

export const dailyAlerts: Alert[] = [
  {
    id: "d3",
    code: "D3",
    severity: "info",
    message: "Recovery low — easy day",
    channels: ["audio", "thermal"],
    timestamp: "6:14 AM",
    mode: "daily",
  },
  {
    id: "d2",
    code: "D2",
    severity: "info",
    message: "Time to drink",
    channels: ["thermal", "haptic"],
    timestamp: "12m",
    mode: "daily",
  },
];


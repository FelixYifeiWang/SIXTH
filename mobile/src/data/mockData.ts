export type Metric = {
  id: string;
  label: string;
  value: number;
  unit: string;
  icon: string;
  accentColor: string;
  trend: number[];
  section: "environment" | "body";
};

export const metrics: Metric[] = [
  {
    id: "humidity",
    label: "Humidity",
    value: 62,
    unit: "%",
    icon: "💧",
    accentColor: "#5AC8CA",
    trend: [40, 48, 55, 52, 58, 60, 62],
    section: "environment",
  },
  {
    id: "temperature",
    label: "Temperature",
    value: 23.4,
    unit: "°C",
    icon: "🌡️",
    accentColor: "#F5A623",
    trend: [21, 21.5, 22, 22.8, 23, 23.2, 23.4],
    section: "environment",
  },
  {
    id: "heart-rate",
    label: "Heart Rate",
    value: 72,
    unit: "bpm",
    icon: "❤️",
    accentColor: "#FF6B8A",
    trend: [68, 71, 74, 70, 69, 73, 72],
    section: "body",
  },
  {
    id: "body-temp",
    label: "Body Temp",
    value: 36.8,
    unit: "°C",
    icon: "🔥",
    accentColor: "#FFBB54",
    trend: [36.6, 36.7, 36.7, 36.8, 36.8, 36.9, 36.8],
    section: "body",
  },
  {
    id: "blood-oxygen",
    label: "Blood Oxygen",
    value: 98,
    unit: "%",
    icon: "🫁",
    accentColor: "#5B8DEF",
    trend: [97, 98, 97, 98, 99, 98, 98],
    section: "body",
  },
  {
    id: "hydration",
    label: "Hydration",
    value: 74,
    unit: "%",
    icon: "💦",
    accentColor: "#4ECDC4",
    trend: [60, 64, 68, 66, 70, 72, 74],
    section: "body",
  },
];

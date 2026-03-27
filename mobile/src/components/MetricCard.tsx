import { StyleSheet, Text, View } from "react-native";
import type { Metric } from "../data/mockData";

type Props = {
  metric: Metric;
};

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  return (
    <View style={sparkStyles.container}>
      {data.map((val, i) => {
        const normalized = (val - min) / range;
        const height = 4 + normalized * 20;
        return (
          <View
            key={i}
            style={[
              sparkStyles.bar,
              {
                height,
                backgroundColor: color,
                opacity: 0.25 + normalized * 0.5,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const sparkStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    marginTop: 14,
  },
  bar: {
    width: 4,
    borderRadius: 2,
  },
});

export default function MetricCard({ metric }: Props) {
  const lastTwo = metric.trend.slice(-2);
  const trending = lastTwo[1] >= lastTwo[0] ? "↑" : "↓";

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.icon}>{metric.icon}</Text>
        <Text style={styles.label}>{metric.label}</Text>
        <Text style={[styles.trend, { color: metric.accentColor }]}>
          {trending}
        </Text>
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.value}>{metric.value}</Text>
        <Text style={styles.unit}>{metric.unit}</Text>
      </View>

      <Sparkline data={metric.trend} color={metric.accentColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#2A2A2A",
    width: "48%",
    marginBottom: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    fontSize: 16,
    marginRight: 6,
  },
  label: {
    color: "#888888",
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  trend: {
    fontSize: 14,
    fontWeight: "600",
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 10,
  },
  value: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "700",
  },
  unit: {
    color: "#666666",
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 4,
  },
});

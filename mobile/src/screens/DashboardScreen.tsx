import { ScrollView, StyleSheet, Text, View } from "react-native";
import MetricCard from "../components/MetricCard";
import SectionHeader from "../components/SectionHeader";
import { metrics } from "../data/mockData";

export default function DashboardScreen() {
  const environment = metrics.filter((m) => m.section === "environment");
  const body = metrics.filter((m) => m.section === "body");

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>ConnectQ</Text>
      <Text style={styles.subtitle}>Live Readings · Mar 27, 2026 · 4:32 PM</Text>

      <SectionHeader title="Environment" />
      <View style={styles.grid}>
        {environment.map((m) => (
          <MetricCard key={m.id} metric={m} />
        ))}
      </View>

      <SectionHeader title="Body" />
      <View style={styles.grid}>
        {body.map((m) => (
          <MetricCard key={m.id} metric={m} />
        ))}
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 32,
    fontWeight: "700",
  },
  subtitle: {
    color: "#666666",
    fontSize: 14,
    fontWeight: "400",
    marginTop: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  spacer: {
    height: 40,
  },
});

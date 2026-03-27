import { useEffect, useRef } from "react";
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from "react-native";
import MetricCard from "../components/MetricCard";
import SectionHeader from "../components/SectionHeader";
import { metrics } from "../data/mockData";

export default function DashboardScreen() {
  const environment = metrics.filter((m) => m.section === "environment");
  const body = metrics.filter((m) => m.section === "body");

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [headerOpacity, headerTranslateY]);

  const envSectionDelay = 300;
  const envCardBaseDelay = 400;
  const bodySectionDelay = envCardBaseDelay + environment.length * 100 + 200;
  const bodyCardBaseDelay = bodySectionDelay + 100;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View
        style={{
          opacity: headerOpacity,
          transform: [{ translateY: headerTranslateY }],
        }}
      >
        <Text style={styles.title}>ConnectQ</Text>
        <Text style={styles.subtitle}>Live Readings · Mar 27, 2026 · 4:32 PM</Text>
      </Animated.View>

      <SectionHeader title="Environment" delay={envSectionDelay} />
      <View style={styles.grid}>
        {environment.map((m, i) => (
          <MetricCard key={m.id} metric={m} delay={envCardBaseDelay + i * 100} />
        ))}
      </View>

      <SectionHeader title="Body" delay={bodySectionDelay} />
      <View style={styles.grid}>
        {body.map((m, i) => (
          <MetricCard key={m.id} metric={m} delay={bodyCardBaseDelay + i * 100} />
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

import { useEffect, useRef, useState } from "react";
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from "react-native";
import MetricCard from "../components/MetricCard";
import SectionHeader from "../components/SectionHeader";
import { metrics } from "../data/mockData";

function formatNow(): string {
  const now = new Date();
  const month = now.toLocaleString("en-US", { month: "short" });
  const day = now.getDate();
  const year = now.getFullYear();
  const time = now.toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `Live Readings · ${month} ${day}, ${year} · ${time}`;
}

export default function DashboardScreen() {
  const environment = metrics.filter((m) => m.section === "environment");
  const body = metrics.filter((m) => m.section === "body");
  const [subtitle, setSubtitle] = useState(formatNow);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(-12)).current;
  const scrollY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const interval = setInterval(() => setSubtitle(formatNow()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(headerTranslateY, {
        toValue: 0,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [headerOpacity, headerTranslateY]);

  // Scroll-driven header parallax: fade + shift as user scrolls
  const scrollFadeOpacity = scrollY.interpolate({
    inputRange: [0, 160],
    outputRange: [1, 0.4],
    extrapolate: "clamp",
  });
  const scrollTranslateY = scrollY.interpolate({
    inputRange: [0, 160],
    outputRange: [0, -8],
    extrapolate: "clamp",
  });

  // Combine entrance + scroll animations
  const combinedHeaderOpacity = Animated.multiply(headerOpacity, scrollFadeOpacity);

  const envSectionDelay = 200;
  const envCardBaseDelay = 280;
  const bodySectionDelay = envCardBaseDelay + environment.length * 80 + 120;
  const bodyCardBaseDelay = bodySectionDelay + 80;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { y: scrollY } } }],
        { useNativeDriver: true }
      )}
    >
      <Animated.View
        style={{
          opacity: combinedHeaderOpacity,
          transform: [
            { translateY: Animated.add(headerTranslateY, scrollTranslateY) },
          ],
        }}
      >
        <Text style={styles.title}>ConnectQ</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </Animated.View>

      <SectionHeader title="Environment" delay={envSectionDelay} />
      <View style={styles.grid}>
        {environment.map((m, i) => (
          <MetricCard key={m.id} metric={m} delay={envCardBaseDelay + i * 80} />
        ))}
      </View>

      <SectionHeader title="Body" delay={bodySectionDelay} />
      <View style={styles.grid}>
        {body.map((m, i) => (
          <MetricCard key={m.id} metric={m} delay={bodyCardBaseDelay + i * 80} />
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
    paddingTop: 24,
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
    marginBottom: 8,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  spacer: {
    height: 60,
  },
});

import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import type { ExpeditionInfo } from "../data/mockData";

type Props = {
  expedition: ExpeditionInfo;
  delay?: number;
};

export default function ExpeditionHero({ expedition, delay = 0 }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const progress =
    (expedition.currentAltitude - expedition.baseAltitude) /
    (expedition.targetAltitude - expedition.baseAltitude);

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        Animated.timing(progressAnim, {
          toValue: progress,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [fadeAnim, translateY, progressAnim, delay, progress]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  const remaining = expedition.targetAltitude - expedition.currentAltitude;

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim, transform: [{ translateY }] },
      ]}
    >
      <View style={styles.topRow}>
        <Text style={styles.label}>
          {expedition.campName}
        </Text>
        <Text style={styles.dayText}>
          {expedition.day}/{expedition.totalDays}
        </Text>
      </View>

      <View style={styles.altRow}>
        <Text style={styles.altValue}>
          {expedition.currentAltitude.toLocaleString()}
        </Text>
        <Text style={styles.altUnit}>m</Text>
        <Text style={styles.remaining}>
          {remaining.toLocaleString()}m left
        </Text>
      </View>

      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: progressWidth }]} />
      </View>
      <View style={styles.trackLabels}>
        <Text style={styles.trackText}>
          {expedition.baseAltitude.toLocaleString()}
        </Text>
        <Text style={styles.trackPercent}>{Math.round(progress * 100)}%</Text>
        <Text style={styles.trackText}>
          {expedition.targetAltitude.toLocaleString()}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1C1917",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(168,162,158,0.10)",
    padding: 16,
    marginBottom: 10,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  label: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "500",
  },
  dayText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
  },
  altRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 12,
  },
  altValue: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1,
  },
  altUnit: {
    color: "#475569",
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 3,
  },
  remaining: {
    color: "#6EE7B7",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: "auto",
  },
  track: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: "#5B8DEF",
    borderRadius: 2,
  },
  trackLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  trackText: {
    color: "#334155",
    fontSize: 10,
    fontWeight: "500",
  },
  trackPercent: {
    color: "#5B8DEF",
    fontSize: 10,
    fontWeight: "700",
  },
});

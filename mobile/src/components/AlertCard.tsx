import { useCallback, useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Alert, AlertChannel } from "../data/mockData";

type Props = {
  alert: Alert;
  delay?: number;
};

const severityColors: Record<string, string> = {
  info: "#5B8DEF",
  warning: "#FBBF24",
  critical: "#F87171",
};

const channelLabels: Record<AlertChannel, string> = {
  haptic: "H",
  audio: "A",
  thermal: "T",
};

export default function AlertCard({ alert, delay = 0 }: Props) {
  const color = severityColors[alert.severity];
  const bgColor = alert.mode === "extreme"
    ? "#1C1917"
    : "#111827";
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-12)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [fadeAnim, translateX, delay]);

  const handlePressIn = useCallback(() => {
    Animated.timing(pressScale, { toValue: 0.97, duration: 80, useNativeDriver: true }).start();
  }, [pressScale]);

  const handlePressOut = useCallback(() => {
    Animated.spring(pressScale, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }).start();
  }, [pressScale]);

  return (
    <Animated.View
      style={{ opacity: fadeAnim, transform: [{ translateX }, { scale: pressScale }] }}
    >
      <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut}>
        <View style={[styles.container, { backgroundColor: bgColor, borderColor: color + "20" }]}>
          <View style={[styles.severityBar, { backgroundColor: color }]} />
          <View style={styles.content}>
            <View style={styles.row}>
              <Text style={[styles.code, { color }]}>{alert.code}</Text>
              <Text style={styles.message}>{alert.message}</Text>
              <View style={styles.meta}>
                {alert.channels.map((ch) => (
                  <Text key={ch} style={[styles.channel, { color: color + "80" }]}>
                    {channelLabels[ch]}
                  </Text>
                ))}
                <Text style={styles.time}>{alert.timestamp}</Text>
              </View>
            </View>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    overflow: "hidden",
  },
  severityBar: {
    width: 3,
  },
  content: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  code: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginRight: 10,
    width: 22,
  },
  message: {
    color: "#CBD5E1",
    fontSize: 13,
    fontWeight: "400",
    flex: 1,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginLeft: 10,
  },
  channel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  time: {
    color: "#334155",
    fontSize: 10,
    fontWeight: "500",
  },
});

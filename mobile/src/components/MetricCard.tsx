import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Metric } from "../data/mockData";

type Props = {
  metric: Metric;
  delay?: number;
};

function Sparkline({
  data,
  color,
  active,
}: {
  data: number[];
  color: string;
  active: boolean;
}) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const barScales = useRef(data.map(() => new Animated.Value(1))).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.7,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  useEffect(() => {
    if (active) {
      // Staggered wave: shrink then grow each bar left-to-right
      const animations = barScales.map((scale, i) =>
        Animated.sequence([
          Animated.delay(i * 40),
          Animated.timing(scale, {
            toValue: 0.2,
            duration: 100,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.spring(scale, {
            toValue: 1,
            friction: 4,
            tension: 160,
            useNativeDriver: true,
          }),
        ])
      );
      Animated.parallel(animations).start();
    }
  }, [active, barScales]);

  return (
    <Animated.View style={[sparkStyles.container, { opacity: pulseAnim }]}>
      {data.map((val, i) => {
        const normalized = (val - min) / range;
        const height = 4 + normalized * 20;
        return (
          <Animated.View
            key={i}
            style={[
              sparkStyles.bar,
              {
                height,
                backgroundColor: color,
                opacity: 0.25 + normalized * 0.5,
                transform: [{ scaleY: barScales[i] }],
              },
            ]}
          />
        );
      })}
    </Animated.View>
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

export default function MetricCard({ metric, delay = 0 }: Props) {
  const lastTwo = metric.trend.slice(-2);
  const trending = lastTwo[1] >= lastTwo[0] ? "↑" : "↓";

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  // Press interaction values
  const pressScale = useRef(new Animated.Value(1)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const [sparkActive, setSparkActive] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [fadeAnim, translateY, scaleAnim, delay]);

  const combinedScale = Animated.multiply(scaleAnim, pressScale);

  const handlePressIn = useCallback(() => {
    setSparkActive(true);
    Animated.parallel([
      Animated.timing(pressScale, {
        toValue: 0.96,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [pressScale, glowOpacity]);

  const handlePressOut = useCallback(() => {
    setSparkActive(false);
    Animated.parallel([
      Animated.spring(pressScale, {
        toValue: 1,
        friction: 6,
        tension: 180,
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [pressScale, glowOpacity]);

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: fadeAnim,
          transform: [{ translateY }, { scale: combinedScale }],
        },
      ]}
    >
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.pressable}
      >
        {/* Accent glow border overlay */}
        <Animated.View
          style={[
            styles.glowBorder,
            {
              borderColor: metric.accentColor,
              opacity: glowOpacity,
            },
          ]}
          pointerEvents="none"
        />

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

        <Sparkline
          data={metric.trend}
          color={metric.accentColor}
          active={sparkActive}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#2A2A2A",
    width: "48%",
    marginBottom: 14,
    overflow: "hidden",
  },
  pressable: {
    padding: 18,
  },
  glowBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
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

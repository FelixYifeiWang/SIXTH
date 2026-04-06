import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { AppMode, Metric } from "../data/mockData";

type Props = {
  metric: Metric;
  mode: AppMode;
  delay?: number;
  fullWidth?: boolean;
};

const statusBorder = {
  extreme: {
    normal: "rgba(168,162,158,0.10)",
    warning: "rgba(251,191,36,0.30)",
    critical: "rgba(248,113,113,0.40)",
  },
  daily: {
    normal: "rgba(107,114,128,0.12)",
    warning: "rgba(251,191,36,0.20)",
    critical: "rgba(248,113,113,0.25)",
  },
} as const;

const statusBg = {
  extreme: {
    normal: "#1C1917",
    warning: "rgba(251,191,36,0.05)",
    critical: "rgba(248,113,113,0.05)",
  },
  daily: {
    normal: "#111827",
    warning: "rgba(251,191,36,0.04)",
    critical: "rgba(248,113,113,0.04)",
  },
} as const;

function Sparkline({
  data,
  color,
  active,
  entranceDelay,
}: {
  data: number[];
  color: string;
  active: boolean;
  entranceDelay: number;
}) {
  if (data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const barScales = useRef(data.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.7, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel(
        barScales.map((scale, i) =>
          Animated.sequence([
            Animated.delay(i * 25),
            Animated.spring(scale, { toValue: 1, friction: 4, tension: 140, useNativeDriver: true }),
          ])
        )
      ).start();
    }, entranceDelay + 200);
    return () => clearTimeout(timer);
  }, [barScales, entranceDelay]);

  useEffect(() => {
    if (active) {
      Animated.parallel(
        barScales.map((scale, i) =>
          Animated.sequence([
            Animated.delay(i * 30),
            Animated.timing(scale, { toValue: 0.1, duration: 100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.spring(scale, { toValue: 1, friction: 3, tension: 200, useNativeDriver: true }),
          ])
        )
      ).start();
    }
  }, [active, barScales]);

  return (
    <Animated.View style={[sparkStyles.container, { opacity: pulseAnim }]}>
      {data.map((val, i) => {
        const n = (val - min) / range;
        return (
          <Animated.View
            key={i}
            style={[sparkStyles.bar, {
              height: 4 + n * 18,
              backgroundColor: color,
              opacity: 0.3 + n * 0.5,
              transform: [{ scaleY: barScales[i] }],
            }]}
          />
        );
      })}
    </Animated.View>
  );
}

const sparkStyles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "flex-end", gap: 3, marginTop: 10 },
  bar: { width: 4, borderRadius: 2 },
});

export default function MetricCard({ metric, mode, delay = 0, fullWidth = false }: Props) {
  const isExtreme = mode === "extreme";

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  const scaleAnim = useRef(new Animated.Value(0.96)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  const pressRotate = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const [sparkActive, setSparkActive] = useState(false);
  const counterAnim = useRef(new Animated.Value(0)).current;
  const [displayValue, setDisplayValue] = useState(0);
  const isDecimal = !Number.isInteger(metric.value);
  const decimals = isDecimal ? (String(metric.value).split(".")[1]?.length ?? 1) : 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start(() => {
        Animated.timing(counterAnim, { toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [fadeAnim, translateY, scaleAnim, counterAnim, delay]);

  useEffect(() => {
    const id = counterAnim.addListener(({ value }) => setDisplayValue(value * metric.value));
    return () => counterAnim.removeListener(id);
  }, [counterAnim, metric.value]);

  const formattedValue = displayValue >= metric.value
    ? String(metric.value)
    : isDecimal ? displayValue.toFixed(decimals) : String(Math.round(displayValue));

  const combinedScale = Animated.multiply(scaleAnim, pressScale);
  const rotateInterpolation = pressRotate.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: ["-1.5deg", "0deg", "1.5deg"],
  });

  const handlePressIn = useCallback(() => {
    setSparkActive(true);
    Animated.parallel([
      Animated.timing(pressScale, { toValue: 0.96, duration: 100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(pressRotate, { toValue: 1, duration: 100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: 1, duration: 100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [pressScale, pressRotate, glowOpacity]);

  const handlePressOut = useCallback(() => {
    setSparkActive(false);
    Animated.parallel([
      Animated.spring(pressScale, { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }),
      Animated.spring(pressRotate, { toValue: 0, friction: 5, tension: 200, useNativeDriver: true }),
      Animated.timing(glowOpacity, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [pressScale, pressRotate, glowOpacity]);

  const borders = statusBorder[mode];
  const bgs = statusBg[mode];
  const borderColor = borders[metric.status] ?? borders.normal;
  const bgColor = bgs[metric.status] ?? bgs.normal;

  return (
    <Animated.View
      style={[
        styles.card,
        fullWidth && styles.cardFull,
        {
          backgroundColor: bgColor,
          borderColor,
          opacity: fadeAnim,
          transform: [{ translateY }, { scale: combinedScale }, { rotate: rotateInterpolation }],
        },
      ]}
    >
      <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} style={styles.pressable}>
        <Animated.View
          style={[styles.glowBorder, { borderColor: metric.accentColor, opacity: glowOpacity }]}
          pointerEvents="none"
        />

        <Text style={styles.label}>{metric.label}</Text>

        <View style={styles.valueRow}>
          <Text style={styles.value}>{formattedValue}</Text>
          <Text style={styles.unit}>{metric.unit}</Text>
        </View>

        {metric.subtitle && (
          <Text
            style={[
              styles.subtitle,
              metric.status === "critical" && { color: "#F87171" },
              metric.status === "warning" && { color: "#FBBF24" },
            ]}
          >
            {metric.subtitle}
          </Text>
        )}

        <Sparkline data={metric.trend} color={metric.accentColor} active={sparkActive} entranceDelay={delay} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    width: "48%",
    marginBottom: 12,
    overflow: "hidden",
  },
  cardFull: {
    width: "100%",
  },
  pressable: {
    padding: 14,
  },
  glowBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  label: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 6,
  },
  value: {
    color: "#F1F5F9",
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  unit: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "500",
    marginLeft: 4,
  },
  subtitle: {
    color: "#475569",
    fontSize: 10,
    fontWeight: "400",
    marginTop: 3,
  },
});

import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Stamp } from "../data/scenarioPresets";

type Props = {
  stamps: Stamp[];
  title?: string;
  subtitle?: string;
  locked?: Stamp[];
};

// Deterministic rotation per stamp so it's consistent across re-renders
function rotationForIndex(i: number): number {
  const seed = [2.1, -1.8, 3.2, -2.5, 1.4, -3.1, 2.7, -1.2, 0.8, -2.9, 1.9, -0.6];
  return seed[i % seed.length];
}

// Accent color tiers by altitude
function accentForAltitude(alt: number): string {
  if (alt >= 8000) return "#F87171";
  if (alt >= 6000) return "#FBBF24";
  if (alt >= 5000) return "#A78BFA";
  return "#6EE7B7";
}

export default function StampWall({ stamps, title, subtitle, locked }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const titleScale = useRef(new Animated.Value(0.8)).current;
  const total = stamps.length + (locked?.length ?? 0);
  const stampAnims = useRef(Array.from({ length: total }, () => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start(() => {
      const stampSequence = () =>
        Animated.stagger(60,
          stampAnims.map((anim) =>
            Animated.spring(anim, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }),
          ),
        ).start();

      if (title) {
        Animated.spring(titleScale, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start(stampSequence);
      } else {
        stampSequence();
      }
    });
  }, [fadeAnim, stampAnims, titleScale, title]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {title && (
        <Animated.View style={[styles.titleWrap, { transform: [{ scale: titleScale }], opacity: titleScale }]}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </Animated.View>
      )}

      {/* Stamp counter */}
      <Text style={styles.counter}>
        {stamps.length} summit{stamps.length !== 1 ? "s" : ""}
        {locked && locked.length > 0 ? ` \u2022 ${locked.length} to go` : ""}
      </Text>

      <ScrollView
        contentContainerStyle={styles.stampGrid}
        showsVerticalScrollIndicator={false}
      >
        {/* Completed stamps */}
        {stamps.map((stamp, i) => {
          const accent = accentForAltitude(stamp.altitude);
          const rotation = `${rotationForIndex(i)}deg`;
          return (
            <Animated.View
              key={stamp.mountain}
              style={[
                styles.stamp,
                {
                  borderColor: accent + "35",
                  opacity: stampAnims[i],
                  transform: [
                    { rotate: rotation },
                    { scale: stampAnims[i].interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) },
                  ],
                },
              ]}
            >
              <View style={[styles.stampAccent, { backgroundColor: accent }]} />
              <Text style={styles.stampMountain}>{stamp.mountain}</Text>
              <Text style={[styles.stampAlt, { color: accent }]}>
                {stamp.altitude.toLocaleString()}m
              </Text>
              {stamp.region && <Text style={styles.stampRegion}>{stamp.region}</Text>}
              {stamp.date && <Text style={styles.stampDate}>{stamp.date}</Text>}
              {stamp.subtitle && (
                <Text style={styles.stampSubtitle}>{stamp.subtitle}</Text>
              )}
            </Animated.View>
          );
        })}

        {/* Locked stamps */}
        {locked?.map((stamp, i) => {
          const idx = stamps.length + i;
          const rotation = `${rotationForIndex(idx)}deg`;
          return (
            <Animated.View
              key={stamp.mountain}
              style={[
                styles.stamp,
                styles.stampLocked,
                {
                  opacity: stampAnims[idx]?.interpolate({
                    inputRange: [0, 1], outputRange: [0, 0.30],
                  }) ?? 0.30,
                  transform: [
                    { rotate: rotation },
                    { scale: stampAnims[idx]?.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) ?? 1 },
                  ],
                },
              ]}
            >
              <Text style={styles.lockedMountain}>{stamp.mountain}</Text>
              <Text style={styles.lockedAlt}>
                {stamp.altitude.toLocaleString()}m
              </Text>
              {stamp.region && <Text style={styles.lockedRegion}>{stamp.region}</Text>}
            </Animated.View>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030712",
    paddingTop: 56,
    paddingBottom: 32,
  },
  titleWrap: {
    alignItems: "center",
    marginBottom: 4,
    paddingHorizontal: 24,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 2.5,
    textAlign: "center",
  },
  subtitle: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
    letterSpacing: 0.5,
  },
  counter: {
    color: "rgba(255,255,255,0.25)",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    textAlign: "center",
    marginBottom: 20,
    marginTop: 12,
  },
  stampGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    paddingHorizontal: 16,
    gap: 10,
    paddingBottom: 20,
  },
  stamp: {
    width: 108,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.02)",
    overflow: "hidden",
  },
  stampAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  stampLocked: {
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  stampMountain: {
    color: "rgba(255,255,255,0.90)",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 2,
  },
  stampAlt: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  stampRegion: {
    color: "rgba(255,255,255,0.30)",
    fontSize: 9,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  stampDate: {
    color: "rgba(255,255,255,0.20)",
    fontSize: 9,
    fontWeight: "500",
  },
  stampSubtitle: {
    color: "rgba(255,255,255,0.15)",
    fontSize: 8,
    fontWeight: "500",
    fontStyle: "italic",
    marginTop: 4,
  },
  lockedMountain: {
    color: "rgba(255,255,255,0.30)",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 2,
  },
  lockedAlt: {
    color: "rgba(255,255,255,0.18)",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  lockedRegion: {
    color: "rgba(255,255,255,0.12)",
    fontSize: 9,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
});

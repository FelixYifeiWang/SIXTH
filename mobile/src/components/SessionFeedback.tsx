import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import type { FeedbackItem } from "../data/scenarioPresets";

type Props = {
  title: string;
  heroScore: number;
  heroLabel: string;
  items: FeedbackItem[];
  summary: string;
  recommendation?: string;
};

export default function SessionFeedback({ title, heroScore, heroLabel, items, summary, recommendation }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const heroAnim = useRef(new Animated.Value(0)).current;
  const itemAnims = useRef(items.map(() => new Animated.Value(0))).current;
  const barAnims = useRef(items.map(() => new Animated.Value(0))).current;
  const footerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start(() => {
      // Hero score
      Animated.spring(heroAnim, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
      // Items stagger
      Animated.stagger(80,
        itemAnims.map((a) => Animated.spring(a, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true })),
      ).start(() => {
        // Progress bars fill after items appear
        Animated.stagger(60,
          barAnims.map((a, i) =>
            Animated.timing(a, { toValue: items[i].score / 100, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
          ),
        ).start();
        // Footer
        Animated.timing(footerAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      });
    });
  }, [fadeAnim, heroAnim, itemAnims, barAnims, footerAnim, items]);

  // Hero score color based on value
  const heroColor = heroScore >= 80 ? "#6EE7B7" : heroScore >= 60 ? "#FBBF24" : "#F87171";

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Title */}
      <Text style={styles.title}>{title}</Text>

      {/* Hero score */}
      <Animated.View style={[styles.heroWrap, {
        opacity: heroAnim,
        transform: [{ scale: heroAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
      }]}>
        <View style={[styles.heroRing, { borderColor: heroColor + "30" }]}>
          <Text style={[styles.heroScore, { color: heroColor }]}>{heroScore}</Text>
        </View>
        <Text style={styles.heroLabel}>{heroLabel}</Text>
      </Animated.View>

      {/* Items with progress bars */}
      <View style={styles.list}>
        {items.map((item, i) => {
          const isGood = item.status === "good";
          const barColor = isGood ? "#6EE7B7" : "#FBBF24";
          return (
            <Animated.View
              key={item.label}
              style={[
                styles.row,
                {
                  opacity: itemAnims[i],
                  transform: [{ translateX: itemAnims[i].interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
                },
              ]}
            >
              <View style={styles.rowHeader}>
                <View style={styles.rowLabelWrap}>
                  <Text style={[styles.indicator, { color: barColor }]}>
                    {isGood ? "\u2713" : "\u25B2"}
                  </Text>
                  <Text style={styles.label}>{item.label}</Text>
                </View>
                <Text style={[styles.scoreText, { color: barColor }]}>{item.score}</Text>
              </View>
              {/* Progress bar */}
              <View style={styles.barTrack}>
                <Animated.View style={[styles.barFill, {
                  backgroundColor: barColor,
                  width: barAnims[i].interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                }]} />
              </View>
              <Text style={[styles.detail, { color: isGood ? "rgba(255,255,255,0.45)" : "rgba(251,191,36,0.55)" }]}>
                {item.detail}
              </Text>
            </Animated.View>
          );
        })}
      </View>

      {/* Footer */}
      <Animated.View style={[styles.footerWrap, { opacity: footerAnim }]}>
        <Text style={styles.summary}>{summary}</Text>
        {recommendation && <Text style={styles.recommendation}>{recommendation}</Text>}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030712",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  title: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: 20,
  },
  heroWrap: {
    alignItems: "center",
    marginBottom: 28,
  },
  heroRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  heroScore: {
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -1,
  },
  heroLabel: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  list: {
    gap: 12,
    marginBottom: 28,
  },
  row: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  rowLabelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  indicator: {
    fontSize: 13,
    fontWeight: "800",
  },
  label: {
    color: "rgba(255,255,255,0.90)",
    fontSize: 13,
    fontWeight: "600",
  },
  scoreText: {
    fontSize: 14,
    fontWeight: "800",
  },
  barTrack: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 1.5,
    marginBottom: 8,
    overflow: "hidden",
  },
  barFill: {
    height: 3,
    borderRadius: 1.5,
  },
  detail: {
    fontSize: 11,
    fontWeight: "400",
    lineHeight: 15,
  },
  footerWrap: {
    alignItems: "center",
  },
  summary: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  recommendation: {
    color: "#6EE7B7",
    fontSize: 13,
    fontWeight: "500",
    marginTop: 10,
    textAlign: "center",
    lineHeight: 18,
  },
});

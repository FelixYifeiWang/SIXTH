import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import type { JourneyStage } from "../data/scenarioPresets";

type Props = {
  title: string;
  subtitle: string;
  stages: JourneyStage[];
  badge: string;
  insight: string;
};

export default function JourneyMap({ title, subtitle, stages, badge, insight }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const stageAnims = useRef(stages.map(() => new Animated.Value(0))).current;
  const footerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start(() => {
      Animated.spring(titleAnim, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
      Animated.stagger(100,
        stageAnims.map((a) => Animated.spring(a, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true })),
      ).start(() => {
        Animated.timing(footerAnim, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      });
    });
  }, [fadeAnim, titleAnim, stageAnims, footerAnim]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Hero title */}
      <Animated.View style={[styles.heroWrap, {
        opacity: titleAnim,
        transform: [{ scale: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
      }]}>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSubtitle}>{subtitle}</Text>
      </Animated.View>

      {/* Stage timeline */}
      <View style={styles.timeline}>
        {stages.map((stage, i) => {
          const isCurrent = stage.status === "current";
          const isDone = stage.status === "done";
          const isLast = i === stages.length - 1;

          return (
            <Animated.View
              key={stage.label}
              style={[styles.stageRow, {
                opacity: stageAnims[i],
                transform: [{ translateX: stageAnims[i].interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
              }]}
            >
              {/* Dot + line */}
              <View style={styles.trackCol}>
                <View style={[
                  styles.dot,
                  isDone && styles.dotDone,
                  isCurrent && styles.dotCurrent,
                ]} />
                {!isLast && (
                  <View style={[
                    styles.line,
                    (isDone || isCurrent) && styles.lineDone,
                  ]} />
                )}
              </View>

              {/* Label */}
              <Text style={[
                styles.stageLabel,
                isDone && styles.stageDone,
                isCurrent && styles.stageCurrent,
                !isDone && !isCurrent && styles.stageLocked,
              ]}>
                {stage.label}
                {isCurrent ? "  \u2190" : ""}
              </Text>
            </Animated.View>
          );
        })}
      </View>

      {/* Footer: badge + insight */}
      <Animated.View style={[styles.footerWrap, { opacity: footerAnim }]}>
        <View style={styles.badgeWrap}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
        <Text style={styles.insight}>{insight}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030712",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  heroWrap: {
    alignItems: "center",
    marginBottom: 36,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: 6,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 8,
    letterSpacing: 0.5,
  },
  timeline: {
    alignSelf: "stretch",
    paddingLeft: 32,
    marginBottom: 36,
  },
  stageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  trackCol: {
    width: 20,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginTop: 4,
  },
  dotDone: {
    backgroundColor: "#6EE7B7",
  },
  dotCurrent: {
    backgroundColor: "#5B8DEF",
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 3,
  },
  line: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginVertical: 2,
  },
  lineDone: {
    backgroundColor: "rgba(110,231,183,0.25)",
  },
  stageLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 14,
    marginTop: 2,
  },
  stageDone: {
    color: "rgba(255,255,255,0.50)",
  },
  stageCurrent: {
    color: "#FFFFFF",
  },
  stageLocked: {
    color: "rgba(255,255,255,0.20)",
  },
  footerWrap: {
    alignItems: "center",
  },
  badgeWrap: {
    borderWidth: 1,
    borderColor: "rgba(91,141,239,0.3)",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: "rgba(91,141,239,0.08)",
    marginBottom: 12,
  },
  badgeText: {
    color: "#5B8DEF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  insight: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 12,
    fontWeight: "500",
    letterSpacing: 0.3,
  },
});

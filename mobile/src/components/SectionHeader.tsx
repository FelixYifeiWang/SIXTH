import { useCallback, useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet } from "react-native";
import type { AppMode } from "../data/mockData";

type Props = {
  title: string;
  mode: AppMode;
  delay?: number;
};

export default function SectionHeader({ title, mode, delay = 0 }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const lineScaleX = useRef(new Animated.Value(0)).current;
  const labelOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(lineScaleX, { toValue: 1, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [fadeAnim, lineScaleX, delay]);

  const handlePress = useCallback(() => {
    Animated.parallel([
      Animated.sequence([
        Animated.timing(lineScaleX, { toValue: 0.3, duration: 100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(lineScaleX, { toValue: 1, friction: 4, tension: 180, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(labelOpacity, { toValue: 1.6, duration: 80, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(labelOpacity, { toValue: 1, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
  }, [lineScaleX, labelOpacity]);

  const labelColor = mode === "extreme" ? "#78716C" : "#6B7280";
  const lineColor = mode === "extreme" ? "rgba(168,162,158,0.08)" : "rgba(107,114,128,0.10)";

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <Animated.Text style={[styles.label, { opacity: labelOpacity, color: labelColor }]}>
          {title}
        </Animated.Text>
        <Animated.View
          style={[styles.line, { backgroundColor: lineColor, transform: [{ scaleX: lineScaleX }] }]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginRight: 10,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
});

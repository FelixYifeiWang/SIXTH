import { useCallback, useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet } from "react-native";

type Props = {
  title: string;
  delay?: number;
};

export default function SectionHeader({ title, delay = 0 }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const lineScaleX = useRef(new Animated.Value(0)).current;
  const labelOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(lineScaleX, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [fadeAnim, lineScaleX, delay]);

  const handlePress = useCallback(() => {
    // Pulse the line: shrink then spring back
    Animated.parallel([
      Animated.sequence([
        Animated.timing(lineScaleX, {
          toValue: 0.3,
          duration: 100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(lineScaleX, {
          toValue: 1,
          friction: 4,
          tension: 180,
          useNativeDriver: true,
        }),
      ]),
      // Flash the label brighter
      Animated.sequence([
        Animated.timing(labelOpacity, {
          toValue: 1.6,
          duration: 80,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(labelOpacity, {
          toValue: 1,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [lineScaleX, labelOpacity]);

  return (
    <Pressable onPress={handlePress}>
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        <Animated.Text style={[styles.label, { opacity: labelOpacity }]}>
          {title}
        </Animated.Text>
        <Animated.View
          style={[
            styles.line,
            {
              transform: [{ scaleX: lineScaleX }],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 32,
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  label: {
    color: "#666666",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginRight: 12,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#333333",
  },
});

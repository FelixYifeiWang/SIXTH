import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet } from "react-native";

type Props = {
  title: string;
  delay?: number;
};

export default function SectionHeader({ title, delay = 0 }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const lineScaleX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(lineScaleX, {
          toValue: 1,
          duration: 350,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);
    return () => clearTimeout(timer);
  }, [fadeAnim, lineScaleX, delay]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Animated.Text style={styles.label}>{title}</Animated.Text>
      <Animated.View
        style={[
          styles.line,
          {
            transform: [{ scaleX: lineScaleX }],
          },
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  label: {
    color: "#666666",
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginRight: 12,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#333333",
  },
});

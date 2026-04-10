import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import type { OnboardingSection } from "../data/scenarioPresets";

type Props = {
  title: string;
  sections: OnboardingSection[];
  assessment: string;
  insight: string;
};

export default function Onboarding({ title, sections, assessment, insight }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;
  const sectionAnims = useRef(sections.map(() => new Animated.Value(0))).current;
  const footerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 400, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start(() => {
      Animated.spring(titleAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
      Animated.stagger(120,
        sectionAnims.map((a) => Animated.spring(a, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true })),
      ).start(() => {
        Animated.spring(footerAnim, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
      });
    });
  }, [fadeAnim, titleAnim, sectionAnims, footerAnim]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* Title */}
      <Animated.View style={[styles.titleWrap, {
        opacity: titleAnim,
        transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
      }]}>
        <Text style={styles.title}>{title}</Text>
      </Animated.View>

      {/* Sections */}
      <View style={styles.sectionList}>
        {sections.map((section, si) => (
          <Animated.View
            key={section.header}
            style={[styles.section, {
              opacity: sectionAnims[si],
              transform: [{ translateY: sectionAnims[si].interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            }]}
          >
            <Text style={styles.sectionHeader}>{section.header}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, ii) => (
                <View
                  key={item.label}
                  style={[styles.itemRow, ii < section.items.length - 1 && styles.itemBorder]}
                >
                  <Text style={styles.itemLabel}>{item.label}</Text>
                  <View style={styles.itemValueWrap}>
                    <Text style={[styles.itemValue, item.selected && styles.itemValueSelected]}>
                      {item.value}
                    </Text>
                    {item.selected && <View style={styles.selectedDot} />}
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        ))}
      </View>

      {/* Assessment */}
      <Animated.View style={[styles.footerWrap, {
        opacity: footerAnim,
        transform: [{ scale: footerAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
      }]}>
        <View style={styles.assessmentBadge}>
          <Text style={styles.assessmentText}>{assessment}</Text>
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
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: "center",
  },
  titleWrap: {
    marginBottom: 28,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  sectionList: {
    gap: 16,
    marginBottom: 32,
  },
  section: {},
  sectionHeader: {
    color: "rgba(255,255,255,0.30)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 8,
    marginLeft: 2,
  },
  sectionCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.02)",
    overflow: "hidden",
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  itemLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    fontWeight: "500",
  },
  itemValueWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemValue: {
    color: "rgba(255,255,255,0.40)",
    fontSize: 13,
    fontWeight: "600",
  },
  itemValueSelected: {
    color: "#FFFFFF",
  },
  selectedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#5B8DEF",
  },
  footerWrap: {
    alignItems: "center",
  },
  assessmentBadge: {
    borderWidth: 1,
    borderColor: "rgba(91,141,239,0.3)",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: "rgba(91,141,239,0.08)",
    marginBottom: 12,
  },
  assessmentText: {
    color: "#5B8DEF",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  insight: {
    color: "rgba(255,255,255,0.40)",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 18,
  },
});

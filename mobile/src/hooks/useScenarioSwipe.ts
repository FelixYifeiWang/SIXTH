import { useCallback, useRef, useState } from "react";
import { PanResponder } from "react-native";
import { SCENARIO_PRESETS, type ScenarioPreset } from "../data/scenarioPresets";

const SWIPE_THRESHOLD = 50;
const SWIPE_COOLDOWN_MS = 400;

export function useScenarioSwipe() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const indexRef = useRef(0);
  const lastSwipeRef = useRef(0);

  const advance = useCallback((dir: 1 | -1) => {
    const now = Date.now();
    if (now - lastSwipeRef.current < SWIPE_COOLDOWN_MS) return;

    const next = indexRef.current + dir;
    if (next < 0 || next >= SCENARIO_PRESETS.length) return;

    lastSwipeRef.current = now;
    indexRef.current = next;
    setScenarioIndex(next);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > Math.abs(gs.dy) && Math.abs(gs.dx) > 15,
      onMoveShouldSetPanResponderCapture: () => false,
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -SWIPE_THRESHOLD) {
          advance(1);
        } else if (gs.dx > SWIPE_THRESHOLD) {
          advance(-1);
        }
      },
    }),
  ).current;

  return {
    scenarioIndex,
    currentPreset: SCENARIO_PRESETS[scenarioIndex] as ScenarioPreset,
    panHandlers: panResponder.panHandlers,
  };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { DOG_HOME, type DogVisitor } from "../lib/dog-tour";
import type { createGardenWalk, GardenWalkState } from "./garden-walk-renderer";

export type WalkPose = Pick<GardenWalkState, "dog" | "target" | "moving" | "reduced" | "reading" | "ambient">;

export function useGardenWalk(preview: boolean, visitors: DogVisitor[], total: number, onPick: (visitor: DogVisitor) => void) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<ReturnType<typeof createGardenWalk>>(undefined);
  const state = useRef<GardenWalkState>({ visitors, total, dog: DOG_HOME, target: null, moving: false, reduced: false, reading: false, ambient: false });
  const pick = useRef(onPick);
  const [ready, setReady] = useState(false);
  const [overview, setOverview] = useState(false);

  useEffect(() => {
    pick.current = onPick;
    state.current = { ...state.current, visitors, total };
    renderer.current?.update(state.current);
  }, [visitors, total, onPick]);

  // The tour publishes its current ground position without re-rendering React on each step.
  const placeCamera = useCallback((pose: WalkPose) => {
    state.current = { ...state.current, ...pose };
    renderer.current?.update(state.current);
  }, []);

  useEffect(() => {
    const element = canvas.current;
    if (preview || !element) return;
    let stopped = false;
    function fallback() {
      if (stopped) return;
      stopped = true;
      renderer.current?.dispose();
      renderer.current = undefined;
      setReady(false);
    }
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      void import("./garden-walk-renderer").then(({ createGardenWalk }) => {
        if (stopped) return;
        const view = createGardenWalk(element!, () => {
          if (!stopped) setReady(true);
        }, fallback, ordinal => {
          const visitor = state.current.visitors.find(item => item.ordinal === ordinal);
          if (visitor) pick.current(visitor);
        });
        if (stopped) { view?.dispose(); return; }
        renderer.current = view;
        view?.update(state.current);
      }).catch(fallback);
    }, { rootMargin: "160px" });
    observer.observe(element);
    return () => {
      stopped = true;
      observer.disconnect();
      renderer.current?.dispose();
      renderer.current = undefined;
    };
  }, [preview]);

  return { canvas, ready, overview, setOverview, walking: ready && !overview, placeCamera };
}

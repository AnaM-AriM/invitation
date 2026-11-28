import { useEffect, useRef, useState } from "react";
import { Moon, Sun, Sunset } from "lucide-react";
import CoupleSprite from "../app/couple-sprite";
import { publicPath } from "../lib/public-path";
import type { GardenLight, GardenView } from "./cover-scene";

const lights = [
  { id: "garden", label: "아침 정원", Icon: Sun },
  { id: "sunset", label: "노을", Icon: Sunset },
  { id: "night", label: "별밤", Icon: Moon },
] as const;

export default function IllustratedCover() {
  const [light, setLight] = useState<GardenLight>("garden");
  const [ready, setReady] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<GardenView | null>(null);
  const currentLight = useRef(light);

  useEffect(() => {
    const controller = new AbortController();
    const element = canvas.current!;
    function fallback() {
      if (controller.signal.aborted) return;
      controller.abort();
      view.current?.dispose();
      view.current = null;
      setReady(false);
    }
    element.addEventListener("webglcontextlost", fallback);
    void import("./cover-scene").then(async ({ createGardenView }) => {
      if (controller.signal.aborted) return;
      const garden = await createGardenView(element, controller.signal);
      if (controller.signal.aborted) { garden?.dispose(); return; }
      if (garden) {
        view.current = garden;
        garden.setLight(currentLight.current);
        setReady(true);
      }
    }).catch(fallback);
    return () => {
      element.removeEventListener("webglcontextlost", fallback);
      controller.abort();
      view.current?.dispose();
      view.current = null;
    };
  }, []);

  function chooseLight(next: GardenLight) {
    currentLight.current = next;
    setLight(next);
    view.current?.setLight(next);
  }

  return <div className="wi-garden-cover" data-light={light}>
    <div className="wi-garden-mat">
      <div className="wi-hero-art wi-garden-window" role="img" aria-label={`${lights.find(item => item.id === light)!.label}, 꽃 아치 아래 함께 선 두 사람`}>
        <div className="wi-garden-print" aria-hidden="true" style={{ backgroundImage: `url("${publicPath(`/assets/v10/bg-${light}.webp`)}")` }}/>
        <img className="wi-hero-arch" src={publicPath("/assets/v10/decor/arch.webp")} alt=""/>
        <CoupleSprite preview/>
        <canvas ref={canvas} className="wi-garden-canvas" data-ready={ready} aria-hidden="true"/>
      </div>
    </div>
    <div className="wi-garden-lights" role="group" aria-label="정원 시간대">
      {lights.map(({ id, label, Icon }) => <button key={id} type="button" aria-pressed={light === id} onClick={() => chooseLight(id)}><Icon size={14} strokeWidth={1.5} aria-hidden="true"/>{label}</button>)}
    </div>
  </div>;
}

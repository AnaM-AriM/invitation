import { useEffect, useRef, useState } from "react";
import { publicPath } from "../lib/public-path";

export default function BackgroundMusic() {
  const audio = useRef<HTMLAudioElement>(null), wanted = useRef(false), intent = useRef(0);
  const [playing, setPlaying] = useState(false), [pending, setPending] = useState(false), [notice, setNotice] = useState("");
  useEffect(() => {
    const media = audio.current!;
    media.volume = 0.25;
    function hide() {
      if (document.visibilityState !== "hidden") return;
      wanted.current = false; ++intent.current; media.pause(); setPlaying(false); setPending(false);
    }
    document.addEventListener("visibilitychange", hide);
    return () => { document.removeEventListener("visibilitychange", hide); wanted.current = false; ++intent.current; media.pause(); };
  }, []);
  function failed() {
    wanted.current = false; ++intent.current; audio.current?.pause(); setPlaying(false); setPending(false);
    setNotice("음악을 재생하지 못했어요. 다시 눌러 주세요.");
  }
  async function toggle() {
    const media = audio.current!;
    const attempt = ++intent.current;
    if (wanted.current) {
      wanted.current = false; media.pause(); setPlaying(false); setPending(false); setNotice(""); return;
    }
    wanted.current = true; setPending(true); setNotice("");
    try {
      if (media.error) media.load();
      await media.play();
      // An old request may finish after cancellation or after a newer request.
      // Only the current OFF intent may stop the media in that case.
      if (!wanted.current) media.pause();
    } catch {
      if (attempt === intent.current && wanted.current) failed();
    }
  }
  return <div className="wi-music">
    <audio ref={audio} src={publicPath("/audio/spring-garden.mp3")} hidden loop preload="none"
      onPlaying={() => {
        if (!wanted.current || document.visibilityState === "hidden") { audio.current?.pause(); return; }
        setPlaying(true); setPending(false);
      }}
      onPause={() => {
        if (!audio.current?.paused) return;
        wanted.current = false; ++intent.current; setPlaying(false); setPending(false);
      }} onError={failed}/>
    <button type="button" aria-pressed={playing} onClick={() => void toggle()}>{playing ? "음악 끄기" : pending ? "음악 취소" : "음악 켜기"}</button>
    <span className="wi-music-status" role="status" aria-live="polite">{notice}</span>
  </div>;
}

import { useRef, useState, type ComponentType, type RefObject } from "react";
type Dialog = ComponentType<{ close: () => void; trigger: RefObject<HTMLButtonElement | null> }>;
export default function PhotoManager() {
  const [open, setOpen] = useState(false), trigger = useRef<HTMLButtonElement>(null);
  const [Manager, setManager] = useState<Dialog | null>(null), [loading, setLoading] = useState(false), [notice, setNotice] = useState("");
  const pending = useRef(false);
  async function show() {
    if (pending.current) return;
    if (Manager) { setOpen(true); return; }
    pending.current = true; setLoading(true); setNotice("");
    try { const module = await import("./photo-manager-dialog"); setManager(() => module.default); setOpen(true); }
    catch { setNotice("사진 관리를 불러오지 못했어요. 사진 관리 버튼을 눌러 다시 시도해 주세요."); }
    finally { pending.current = false; setLoading(false); }
  }
  return <><button type="button" ref={trigger} className="wi-photo-manage-trigger" disabled={loading} onClick={() => void show()}>{loading ? "사진 관리 불러오는 중…" : "사진 관리"}</button>{notice && <p role="status">{notice}</p>}{open && Manager && <Manager trigger={trigger} close={() => setOpen(false)}/>}</>;
}

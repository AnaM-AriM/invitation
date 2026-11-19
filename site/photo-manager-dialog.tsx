import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { inferRepository, PhotoSaveError, saveGitHubPhotos, type PhotoInput } from "./github-photos";
type Selection = PhotoInput & { preview: string };
export default function Manager({ close, trigger }: { close: () => void; trigger: RefObject<HTMLButtonElement | null> }) {
  const dialog = useRef<HTMLDialogElement>(null), busy = useRef(false), fileInput = useRef<HTMLInputElement>(null);
  const [repository, setRepository] = useState(() => inferRepository(location.hostname, location.pathname));
  const [token, setToken] = useState(""), [photos, setPhotos] = useState<Selection[]>([]), [commonAlt, setCommonAlt] = useState("두 사람이 함께한 순간");
  const [saving, setSaving] = useState(false), [notice, setNotice] = useState(""), [actions, setActions] = useState("");
  const selection = useRef<Selection[]>([]);
  useEffect(() => { const element = dialog.current!, opener = trigger.current; const overflow = document.body.style.overflow; document.body.style.overflow = "hidden"; element.showModal(); return () => { element.close(); document.body.style.overflow = overflow; selection.current.forEach(photo => URL.revokeObjectURL(photo.preview)); opener?.focus({ preventScroll: true }); }; }, [trigger]);
  function choose(files: FileList | null) {
    if (busy.current) return;
    selection.current.forEach(photo => URL.revokeObjectURL(photo.preview));
    const next = Array.from(files || []).map(file => ({ file, alt: commonAlt, preview: URL.createObjectURL(file) }));
    selection.current = next; setPhotos(next); setNotice(""); setActions("");
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy.current) return;
    busy.current = true; setSaving(true); setNotice(""); setActions("");
    try {
      const result = await saveGitHubPhotos(repository, token, photos);
      setNotice("GitHub 저장소에 저장했어요. Pages 배포가 끝나면 사진이 반영됩니다. Actions에서 배포 결과를 확인해 주세요."); setActions(result.actions);
      selection.current.forEach(photo => URL.revokeObjectURL(photo.preview)); selection.current = []; setPhotos([]); if (fileInput.current) fileInput.current.value = "";
    } catch (error) { setNotice(error instanceof PhotoSaveError ? error.message : "저장 여부를 확인하지 못했어요. 재시도 전에 GitHub를 확인해 주세요."); }
    finally { setToken(""); busy.current = false; setSaving(false); }
  }
  function dismiss() { if (!busy.current) { setToken(""); close(); } }
  return <dialog ref={dialog} className="wi-photo-manager" aria-labelledby="wi-photo-manager-title" onCancel={event => { event.preventDefault(); dismiss(); }}>
    <header><h2 id="wi-photo-manager-title">사진 관리</h2><button type="button" onClick={dismiss} disabled={saving} aria-label="사진 관리 닫기">닫기 ×</button></header>
    <p>청첩장 소유자용입니다. 사진을 이 청첩장의 GitHub 저장소 main에 추가합니다.</p>
    <form onSubmit={event => void save(event)}>
      <fieldset disabled={saving}>
        <label htmlFor="wi-photo-repository">청첩장 GitHub 저장소 (owner/repository)</label><input id="wi-photo-repository" value={repository} onChange={event => setRepository(event.target.value)} placeholder="owner/invitation" required autoCapitalize="none" autoCorrect="off" spellCheck={false}/>
        <label htmlFor="wi-photo-token">GitHub 토큰</label><input id="wi-photo-token" type="password" autoComplete="off" value={token} onChange={event => setToken(event.target.value)} required spellCheck={false}/>
        <small>이 저장소만 선택한 Fine-grained 토큰의 Contents 읽기·쓰기 권한이 필요합니다. 토큰은 보관하지 않으며 닫거나 저장 시도 후 지워집니다.</small>
        <label htmlFor="wi-photo-common-alt">새로 선택할 사진의 공통 설명</label><input id="wi-photo-common-alt" value={commonAlt} onChange={event => setCommonAlt(event.target.value)}/>
        <label htmlFor="wi-photo-files">사진 선택</label><input id="wi-photo-files" ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => choose(event.target.files)}/>
        <small>JPEG·PNG·WebP, 한 장 10 MiB 이하, 한 번에 10장·총 20 MiB 이하. 원본과 위치 등 메타데이터가 공개됩니다.</small>
        <div className="wi-photo-selection">{photos.map((photo, index) => <div key={photo.preview}><img src={photo.preview} alt="선택한 사진 미리보기"/><label>{index + 1}. {photo.file.name}<input aria-label={`사진 ${index + 1} 설명`} value={photo.alt} required onChange={event => setPhotos(current => current.map((item, position) => position === index ? { ...item, alt: event.target.value } : item))}/></label></div>)}</div>
        <button className="wi-button wi-primary" type="submit" disabled={!photos.length}>{saving ? "GitHub 저장 확인 중…" : "GitHub에 저장"}</button>
      </fieldset>
    </form>
    <p role="status" aria-live="polite">{notice}</p>{actions && <a href={actions} target="_blank" rel="noreferrer">GitHub Actions에서 배포 확인</a>}
  </dialog>;
}

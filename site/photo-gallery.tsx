import { useEffect, useRef, useState, type ReactNode } from "react";
import { publicPath } from "../lib/public-path";

type Photo = { src: string; alt: string };
function PhotoImage({ photo, className, eager = false }: { photo: Photo; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="wi-photo-error" role="img" aria-label={photo.alt}>{photo.alt}<small>사진을 불러오지 못했어요</small></span> : <img className={className} src={publicPath(photo.src)} alt={photo.alt} loading={eager ? "eager" : "lazy"} onError={() => setFailed(true)}/>;
}
export function CoverPhoto({ photo, children }: { photo?: Photo; children: ReactNode }) {
  const [failed, setFailed] = useState(false);
  return photo && !failed ? <figure className="wi-cover-photo"><img src={publicPath(photo.src)} alt={photo.alt} onError={() => setFailed(true)}/></figure> : children;
}
export default function PhotoGallery({ photos }: { photos: Photo[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement | null>(null);
  const isOpen = index !== null;
  useEffect(() => {
    if (!isOpen) return;
    const element = dialog.current!;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      trigger.current?.focus({ preventScroll: true });
    };
  }, [isOpen]);
  const move = (offset: number) => setIndex(current => current === null ? null : (current + offset + photos.length) % photos.length);
  return <>
    <div className="wi-gallery">{photos.map((photo, position) => <button type="button" key={`${photo.src}-${position}`} aria-label={`사진 ${position + 1} 크게 보기: ${photo.alt}`} onClick={event => { trigger.current = event.currentTarget; setIndex(position); }}><PhotoImage photo={photo}/></button>)}</div>
    <dialog ref={dialog} className="wi-lightbox" aria-label="사진 크게 보기" onCancel={event => { event.preventDefault(); setIndex(null); }} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setIndex(null); } }} onKeyDown={event => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); } }}>
      <button type="button" className="wi-photo-close" aria-label="사진 닫기" onClick={() => setIndex(null)}>닫기 ×</button>
      {index !== null && <>
        <figure><PhotoImage key={`${photos[index].src}-${index}`} photo={photos[index]} eager/><figcaption>{photos[index].alt}</figcaption></figure>
        <div className="wi-photo-navigation">{photos.length > 1 && <button type="button" aria-label="이전 사진" onClick={() => move(-1)}>← 이전</button>}<span aria-live="polite">{index + 1} / {photos.length}</span>{photos.length > 1 && <button type="button" aria-label="다음 사진" onClick={() => move(1)}>다음 →</button>}</div>
      </>}
    </dialog>
  </>;
}

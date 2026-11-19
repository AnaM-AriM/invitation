import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import GroupScene from "../app/group-scene";
import CoupleSprite from "../app/couple-sprite";
import { templates, daysToWedding, type GardenData, type Wish } from "../lib/garden";
import { publicPath } from "../lib/public-path";
import { calendarFile, postGuestbook, prepareSubmission, readGuestbook, type Submission } from "./guestbook";
import { wedding as w } from "./wedding";
import PhotoGallery, { CoverPhoto } from "./photo-gallery";
import PhotoManager from "./photo-manager";
const endpoint = (import.meta as ImportMeta & { env: Record<string, string> }).env.VITE_GUESTBOOK_URL || w.guestbookUrl;
const empty: GardenData = { comments: [], guests: [], total: 0, page: 0, scene: 0 };
const date = new Date(w.dateTime);
const longDate = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "long", day: "numeric", weekday: "long", hour: "numeric", minute: "2-digit" }).format(date);
const dateParts = w.dateTime.slice(0, 10).split("-").map(Number);
const [year, month, day] = dateParts;
const monthDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
export default function Invitation() {
  const [data, setData] = useState<GardenData>(empty), [selected, setSelected] = useState<Wish | null>(null);
  const [name, setName] = useState(""), [message, setMessage] = useState(""), [notice, setNotice] = useState(""), [readError, setReadError] = useState("");
  const [sending, setSending] = useState(false), [loading, setLoading] = useState(false), [dog, setDog] = useState(true);
  const pending = useRef<Submission | undefined>(undefined), readSequence = useRef(0), abortRead = useRef<AbortController | null>(null);
  const demo = useRef<Wish[]>([]);
  const load = useCallback(async (page = 0, scene = 0) => {
    const sequence = ++readSequence.current; abortRead.current?.abort();
    const controller = new AbortController(); abortRead.current = controller;
    setLoading(true); setReadError("");
    try {
      let next: GardenData;
      if (endpoint) next = await readGuestbook(endpoint, page, scene, controller.signal);
      else {
        const all = demo.current, p = Math.min(Math.max(0, page), Math.max(0, Math.ceil(all.length / 6) - 1)), s = Math.min(Math.max(0, scene), Math.max(0, Math.ceil(all.length / 36) - 1));
        next = { total: all.length, page: p, scene: s, comments: [...all].reverse().slice(p * 6, p * 6 + 6), guests: all.slice(s * 36, s * 36 + 36) };
      }
      if (sequence === readSequence.current && !controller.signal.aborted) { setData(next); setSelected(null); }
    } catch { if (sequence === readSequence.current && !controller.signal.aborted) setReadError("방명록을 불러오지 못했어요. 아래 새로고침으로 다시 시도해 주세요."); }
    finally { if (sequence === readSequence.current) setLoading(false); }
  }, []);
  useEffect(() => { const startup = setTimeout(() => void load(), 0); return () => { clearTimeout(startup); abortRead.current?.abort(); }; }, [load]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (sending) return;
    setNotice("");
    try {
      const attempt = prepareSubmission(name, message, pending.current); pending.current = attempt;
      setSending(true);
      if (endpoint) {
        await postGuestbook(endpoint, attempt);
        setNotice("축하의 마음이 저장되었어요. 고맙습니다.");
      } else {
        demo.current.push({ id: demo.current.length + 1, name: attempt.name, message: attempt.message, createdAt: new Date().toISOString() });
        setNotice("예시 화면에만 추가했어요. 저장되지 않으며 새로고침하면 사라집니다.");
      }
      pending.current = undefined; setName(""); setMessage(""); await load(0, data.scene);
    } catch (error) { setNotice(`${error instanceof Error ? error.message : "저장 여부를 확인하지 못했어요."} 입력 내용은 유지됩니다. 같은 내용으로 다시 시도할 수 있어요.`); }
    finally { setSending(false); }
  }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setNotice("복사했어요."); } catch { setNotice("복사하지 못했어요. 내용을 길게 눌러 복사해 주세요."); }
  }
  async function share() {
    try { if (navigator.share) await navigator.share({ title: `${w.couple[0].name} · ${w.couple[1].name}의 결혼식`, url: location.href }); else await copy(location.href); } catch { /* Dismissing the native share sheet is expected. */ }
  }
  function downloadCalendar() {
    const blob = new Blob([calendarFile(`${w.couple[0].name} · ${w.couple[1].name} 결혼식`, w.dateTime, w.endDateTime, `${w.venue.name} ${w.venue.address}`)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = "wedding.ics"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <main className="wi-page">
    {w.isExample && <aside className="wi-example">예시 청첩장 · 이름과 예식 정보는 실제 정보가 아닙니다</aside>}
    <header className="wi-cover">
      <p className="wi-kicker">THE WEDDING OF</p><h1>{w.couple[0].name}<span>&amp;</span>{w.couple[1].name}</h1>
      <CoverPhoto photo={w.coverPhoto}><div className="wi-hero-art" aria-label="꽃 아래 함께 선 두 사람"><img className="wi-hero-arch" src={publicPath("/assets/v10/decor/arch.webp")} alt=""/><CoupleSprite preview/></div></CoverPhoto>
      <p className="wi-date-line">{year}.{String(month).padStart(2, "0")}.{String(day).padStart(2, "0")}</p>
      <p className="wi-venue-line">{longDate}<br/>{w.venue.name} · {w.venue.hall}</p><a href="#invitation" className="wi-scroll" aria-label="초대의 글로 이동">아래로 천천히 ↓</a>
    </header>
    <section id="invitation" className="wi-section wi-letter"><p className="wi-kicker">INVITATION</p><h2>함께 맞이하는 우리의 봄</h2><div className="wi-letter-text">{w.invitation.map(line => <p key={line}>{line}</p>)}</div><div className="wi-families">{w.couple.map(person => <p key={person.name}><span>{person.parents}</span><strong>{person.name}</strong>{person.phone && <span className="wi-contact"><a href={`tel:${person.phone}`}>전화</a><a href={`sms:${person.phone}`}>문자</a></span>}</p>)}</div></section>
    <section className="wi-section wi-calendar"><p className="wi-kicker">SAVE THE DATE</p><h2>{year}년 {month}월 {day}일</h2><p>{longDate}</p><div className="wi-calendar-grid" aria-label={`${year}년 ${month}월 달력`}>{["일", "월", "화", "수", "목", "금", "토"].map(label => <span className="wi-weekday" key={label}>{label}</span>)}{Array.from({ length: firstDay }, (_, i) => <span key={`empty-${i}`}/>)}{Array.from({ length: monthDays }, (_, i) => <span key={i} className={i + 1 === day ? "wi-wedding-day" : undefined} aria-label={i + 1 === day ? `예식일 ${day}일` : undefined}>{i + 1}</span>)}</div><button className="wi-button" onClick={downloadCalendar}>달력에 일정 담기{w.isExample ? " (예시)" : ""}</button></section>
    <section className="wi-section"><p className="wi-kicker">OUR MOMENTS</p><h2>함께 쌓아 온 순간들</h2>{w.photos.length ? <PhotoGallery photos={w.photos}/> : <div className="wi-photo-placeholder"><span aria-hidden="true">✿</span><p>우리의 사진을 준비하고 있어요</p><small>사진이 들어갈 자리입니다</small></div>}</section>
    <section id="location" className="wi-section wi-location"><p className="wi-kicker">LOCATION</p><h2>오시는 길</h2><h3>{w.venue.name}</h3><p>{w.venue.hall}</p>{w.venue.address ? <><p>{w.venue.address}</p><div className="wi-actions"><button className="wi-button" onClick={() => void copy(w.venue.address)}>주소 복사</button><a className="wi-button" target="_blank" rel="noreferrer" href={`https://map.naver.com/p/search/${encodeURIComponent(w.venue.address)}`}>네이버 지도</a><a className="wi-button" target="_blank" rel="noreferrer" href={`https://map.kakao.com/?q=${encodeURIComponent(w.venue.address)}`}>카카오맵</a></div></> : <p className="wi-muted">예식장 주소와 교통 안내를 준비하고 있어요.</p>}{w.venue.transit.map(line => <p key={line} className="wi-transit">{line}</p>)}</section>
    {w.accounts.length > 0 && <section className="wi-section"><p className="wi-kicker">WITH GRATITUDE</p><h2>마음 전하실 곳</h2><p className="wi-muted">전해 주시는 따뜻한 마음에 감사드립니다.</p>{w.accounts.map(account => <details className="wi-account" key={`${account.bank}-${account.number}`}><summary>{account.label}</summary><p>{account.bank} {account.number}<br/>{account.holder}</p><button className="wi-button" onClick={() => void copy(account.number)}>계좌번호 복사</button></details>)}</section>}
    <section id="guestbook" className="wi-section wi-guestbook"><p className="wi-kicker">OUR GUEST GARDEN</p><h2>축하가 모여 피어나는 정원</h2><p className="wi-muted">하객을 눌러 축하의 마음을 읽어 보세요.<br/>남겨 주신 메시지마다 정원에 한 분이 함께합니다.</p>{!endpoint && <p className="wi-demo-note">저장되지 않는 예시 방명록입니다. 메시지는 이 화면에서만 보이며 새로고침하면 사라집니다.</p>}
      <GroupScene template={templates[0]} totalGuests={data.total} scene={data.scene} days={daysToWedding(w.dateTime.slice(0, 10))} effects getWish={ordinal => data.guests[ordinal - data.scene * 36]} selected={selected} onSelect={setSelected} dogEnabled={dog} onDogEnabledChange={setDog} dogScope="pages-wedding" onDogSceneChange={scene => void load(data.page, scene)}/>
      {data.total > 36 && <nav className="wi-pagination" aria-label="정원 장면"><button disabled={loading || data.scene === 0} onClick={() => void load(data.page, data.scene - 1)}>이전 정원</button><span>{data.scene + 1} / {Math.ceil(data.total / 36)}</span><button disabled={loading || (data.scene + 1) * 36 >= data.total} onClick={() => void load(data.page, data.scene + 1)}>다음 정원</button></nav>}
      <div className="wi-comments-heading"><h3>축하 메시지 <small>{data.total}</small></h3><button onClick={() => void load(data.page, data.scene)} disabled={loading}>{loading ? "불러오는 중…" : "새로고침"}</button></div>
      {readError && <p role="alert" className="wi-error">{readError}</p>}
      <div className="wi-comments" aria-busy={loading}>{data.comments.map(comment => <article key={comment.id}><div><strong>{comment.name}</strong><time dateTime={comment.createdAt}>{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" }).format(new Date(comment.createdAt))}</time></div><p>{comment.message}</p></article>)}{!data.comments.length && !loading && !readError && <p className="wi-empty">첫 번째 축하의 마음을 남겨 주세요.</p>}</div>
      {data.total > 6 && <nav className="wi-pagination" aria-label="메시지 페이지"><button disabled={loading || data.page === 0} onClick={() => void load(data.page - 1, data.scene)}>이전 메시지</button><span>{data.page + 1} / {Math.ceil(data.total / 6)}</span><button disabled={loading || (data.page + 1) * 6 >= data.total} onClick={() => void load(data.page + 1, data.scene)}>다음 메시지</button></nav>}
      <form onSubmit={submit} className="wi-form"><label htmlFor="wi-name">성함</label><input id="wi-name" value={name} maxLength={20} required autoComplete="name" placeholder="성함을 남겨 주세요" disabled={sending} onChange={event => setName(event.target.value)}/><label htmlFor="wi-message">축하의 마음</label><textarea id="wi-message" value={message} maxLength={300} required rows={4} placeholder="두 사람에게 전하고 싶은 마음" disabled={sending} onChange={event => setMessage(event.target.value)}/><small>이름과 메시지는 방문자 모두에게 공개됩니다. 연락처 등 개인정보를 적지 말아 주세요.</small><button className="wi-button wi-primary" disabled={sending} type="submit">{sending ? "저장 확인 중…" : endpoint ? "축하 메시지 남기기" : "저장 없이 예시로 남기기"}</button></form>
    </section><footer className="wi-footer"><span>THANK YOU FOR BEING PART OF OUR DAY</span><p>{w.couple[0].name} &amp; {w.couple[1].name}</p><small>함께해 주셔서 고맙습니다.</small><PhotoManager/></footer>
    <div className="wi-toast" role="status" aria-live="polite">{notice}</div><nav className="wi-dock" aria-label="빠른 이동"><a href="#location">오시는 길</a><a href="#guestbook">축하 남기기</a><button onClick={() => void share()}>초대장 공유</button></nav>
  </main>;
}

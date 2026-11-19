"use client";
import { publicPath } from "../lib/public-path";
import { useRef, useState, type CSSProperties } from "react";
import { X } from "lucide-react";
import PartyDog from "./party-dog";
import GuestSprite from "./guest-sprite";
import CoupleSprite from "./couple-sprite";
import type { DogVisitor } from "../lib/dog-tour";
import { ACTOR_HEIGHT, ACTOR_WIDTH, couple, receptionFurnishings, guestPresentation, spriteWidth, atmosphere, gardenDecorations, groupCamera, guestSlots, photoDepth, type Wish, type templates } from "../lib/garden";
type Props={template:typeof templates[number];totalGuests:number;scene:number;days:number|null;effects:boolean;getWish?:(ordinal:number)=>Wish|undefined;selected?:Wish|null;onSelect?:(wish:Wish|null)=>void;preview?:boolean;dogEnabled?:boolean;dogScope?:string;onDogEnabledChange?:(enabled:boolean)=>void;onDogSceneChange?:(scene:number)=>void};
export default function GroupScene({template,totalGuests,scene,days,effects,getWish,selected,onSelect,preview=false,dogEnabled=true,dogScope="preview",onDogEnabledChange,onDogSceneChange}:Props){
 const [broken,setBroken]=useState(false),[dogGuest,setDogGuest]=useState<number|null>(null);
 const sceneRef=useRef<HTMLDivElement>(null),worldRef=useRef<HTMLDivElement>(null);
 const slots=guestSlots(totalGuests,scene),camera=groupCamera(slots.length,scene),mood=atmosphere(totalGuests,days),decor=gardenDecorations(totalGuests),furnishings=receptionFurnishings(totalGuests);
 const visitors:DogVisitor[]=slots.flatMap(slot=>{const wish=getWish?.(slot.ordinal);return wish?[{...slot,wish}]:[];});
 const actorStyle=(left:number,bottom:number,depth:number,scale=1,width=ACTOR_WIDTH)=>({"--left":`${left}%`,"--bottom":`${bottom}%`,"--depth":depth,"--actor-height":`${ACTOR_HEIGHT*scale}%`,"--actor-width":`${width*scale}%`} as CSSProperties);
 const decorations=(layer:"back"|"front")=><div className={`scene-decor scene-decor-${layer}`} aria-hidden="true" data-testid={`decor-${layer}`}>{decor.filter(item=>item.layer===layer).map(item=><img key={item.id} className="decor-item" src={publicPath(`/assets/v10/decor/${item.asset}.webp`)} alt="" data-decor={item.id} style={{left:`${item.left}%`,top:`${item.top}%`,width:`${item.width}%`,height:`${item.height}%`,transform:item.flip?"scaleX(-1)":undefined}} loading={preview?"lazy":"eager"}/>)}</div>;
 return <div className="scene-frame" data-testid="scene-frame">
  <div className="scene" ref={sceneRef} aria-label={`${template.name}, ${scene+1}번째 장면에 하객 ${slots.length}명`} data-testid="garden-scene" data-count={slots.length} data-decor-count={decor.length} data-mood={mood.level} data-effects={effects} data-composition="reception" data-prop-count={furnishings.length} style={{"--background-blur":`${mood.blur}px`,"--background-wash":Math.min(.2,totalGuests/400)} as CSSProperties}>
   <img className="scene-bg" src={publicPath(template.image)} alt={`${template.name} 곳곳에서 춤추고 대화하며 피로연을 즐기는 신랑·신부와 하객`} width={1120} height={1400} loading={preview?"lazy":"eager"} fetchPriority={preview?"auto":"high"} onLoad={()=>setBroken(false)} onError={()=>setBroken(true)}/>
   <div className="scene-depth" aria-hidden="true" />
   {decorations("back")}
   {broken && <div className="asset-error" role="alert">배경을 불러오지 못했어요. 잠시 후 새로고침해 주세요.</div>}
   <div className="group-world" ref={worldRef} data-testid="group-world" style={{"--camera-zoom":camera.zoom,"--camera-y":`${camera.y}%`} as CSSProperties}>
    {furnishings.map(prop=><div key={prop.id} className="reception-prop group-actor" data-testid="reception-prop" data-prop={prop.id} style={{"--left":`${prop.left}%`,"--bottom":`${prop.bottom}%`,"--depth":prop.depth,"--actor-width":`${prop.width}%`,"--actor-height":`${prop.height}%`} as CSSProperties} aria-hidden="true"><img src={publicPath(`/assets/v10/props/${prop.asset}.webp`)} alt="" loading={preview?"lazy":"eager"}/></div>)}
    {slots.map(slot=>{const wish=getWish?.(slot.ordinal),pose=guestPresentation(slot.sprite,slot.left,slot.direction);return <button key={slot.ordinal} className={`guest group-actor ${wish && selected?.id===wish.id?"is-selected":""} ${dogGuest===slot.ordinal && !selected?"dog-visited":""}`} style={{...actorStyle(slot.left,slot.bottom,slot.depth,slot.scale,spriteWidth(slot.sprite)),"--face-left":`${pose.faceLeft}%`,"--face-width":`${ACTOR_WIDTH*.44/spriteWidth(slot.sprite)*100}%`} as CSSProperties} onClick={()=>wish && onSelect?.(wish)} aria-label={wish?`${wish.name} 님의 축하 읽기`:`하객 ${slot.ordinal+1}`} data-testid="guest" data-ordinal={slot.ordinal} data-sprite={slot.sprite} data-zone={slot.zone} data-scale={slot.scale} data-action={pose.action} data-facing={pose.facing} tabIndex={preview?-1:0}><GuestSprite sprite={slot.sprite} flip={pose.flip} action={pose.action} ordinal={slot.ordinal} preview={preview}/><span className="guest-hit guest-hit-face" aria-hidden="true"/><span className="guest-hit guest-hit-body" aria-hidden="true"/></button>;})}
    <div className="reception-couple group-actor" data-testid="wedding-couple" style={{"--left":`${couple.left}%`,"--bottom":`${couple.bottom}%`,"--depth":photoDepth(couple.bottom),"--actor-width":`${couple.width}%`,"--actor-height":`${couple.height}%`} as CSSProperties}><CoupleSprite preview={preview}/><span className="reception-couple-mark" aria-hidden="true">JUST MARRIED</span></div>
   </div>
   {decorations("front")}
   {effects && <div className="scene-effects" aria-hidden="true" data-testid="scene-effects">
    {Array.from({length:mood.petals},(_,i)=><i key={`p${i}`} className="petal" style={{"--x":`${(i*31+7)%100}%`,"--delay":`${-(i*1.7)}s`,"--duration":`${12+i%5}s`,"--drift":`${i%2?25:-25}px`} as CSSProperties}/>)}
    {Array.from({length:mood.sparkles},(_,i)=><i key={`s${i}`} className="sparkle" style={{left:`${(i*37+8)%95}%`,top:`${(i*23+4)%85}%`,animationDelay:`${-i*.7}s`}}/>)}
    {Array.from({length:mood.confetti},(_,i)=><i key={`c${i}`} className="confetti" style={{"--x":`${(i*29+4)%100}%`,"--delay":`${-i*.8}s`,"--duration":`${9+i%4}s`,background:["#d2ab63","#c88d91","#a1b49b","#e6d7b1"][i%4]} as CSSProperties}/>)}
    {mood.level>=2 && <div className="fairy-lights">{Array.from({length:9},(_,i)=><i key={i} />)}</div>}
   </div>}
   {selected && <div className="guest-popover" role="status"><strong>{selected.name}</strong><p>{selected.message}</p><button aria-label="축하 메시지 닫기" onClick={()=>onSelect?.(null)}><X size={14}/></button></div>}
  </div>
  <div className="scene-caption"><span><i className="live-dot"/>{mood.name}</span><span>하객 <strong data-testid="guest-total">{totalGuests.toLocaleString()}</strong>명 · 함께한 주인공 2명</span></div>
  <PartyDog visitors={visitors} scene={scene} totalGuests={totalGuests} scope={dogScope} enabled={dogEnabled} effects={effects} preview={preview} manualSelected={!!selected} sceneRef={sceneRef} worldRef={worldRef} onEnabledChange={onDogEnabledChange} onAdvanceScene={onDogSceneChange} onVisitChange={setDogGuest} onClearManual={()=>onSelect?.(null)}/>
 </div>;
}

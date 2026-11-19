"use client";
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Pause, PawPrint, Play, SkipForward, X } from "lucide-react";
import DogSprite from "./dog-sprite";
import { photoDepth, sceneCount } from "../lib/garden";
import { DOG_HEIGHT, DOG_HOME, DOG_WIDTH, DOG_ROAM_POINTS, dogDestination, dogPathPoint, dogReadingTime, dogTravelTime, type DogPoint, type DogVisitor } from "../lib/dog-tour";

type Phase="idle"|"walking"|"roaming"|"reading";
type Props={visitors:DogVisitor[];scene:number;totalGuests:number;scope:string;enabled:boolean;effects:boolean;preview:boolean;manualSelected:boolean;sceneRef:RefObject<HTMLDivElement|null>;worldRef:RefObject<HTMLDivElement|null>;onEnabledChange?:(enabled:boolean)=>void;onAdvanceScene?:(scene:number)=>void;onVisitChange:(ordinal:number|null)=>void;onClearManual:()=>void};
export default function PartyDog(props:Props){
 const {visitors,scene,totalGuests,scope,enabled,effects,preview,manualSelected,sceneRef,worldRef}=props;
 const [mounted,setMounted]=useState(false),[reduced,setReduced]=useState(false),[visible,setVisible]=useState(true),[inView,setInView]=useState(false),[command,setCommand]=useState(0);
 const [view,setView]=useState<{phase:Phase;visitor:DogVisitor|null;facing:number}>({phase:"idle",visitor:null,facing:1});
 const dogRef=useRef<HTMLDivElement>(null),latest=useRef(props),lastContext=useRef("");
 latest.current=props;
 const worldSize=useRef({width:0,height:0});
 const roamIndex=useRef(0),roamTarget=useRef<DogPoint|null>(null);
 const machine=useRef<{phase:Phase;ordinal:number|null;point:DogPoint;facing:number}>({phase:"idle",ordinal:null,point:{...DOG_HOME},facing:1});
 const requested=useRef<number|null>(null),acrossScene=useRef<"manual"|"auto"|null>(null),singleVisit=useRef(false);
 const context=`${scope}:${scene}`;
 // Appending wishes must not restart the current walk or its reading timer.
 const queueSignal=!visitors.length?"empty":lastContext.current===context && machine.current.ordinal!==null && !visitors.some(v=>v.ordinal===machine.current.ordinal)?"missing":"ready";
 const motionAllowed=!preview && effects && !reduced;
 const autoActive=mounted && enabled && motionAllowed && visible && inView && !manualSelected;
 useEffect(()=>{setMounted(true);if(preview)return;
  const media=window.matchMedia("(prefers-reduced-motion: reduce)"),onMotion=()=>setReduced(media.matches),onVisibility=()=>setVisible(document.visibilityState==="visible");
  onMotion();onVisibility();media.addEventListener("change",onMotion);document.addEventListener("visibilitychange",onVisibility);
  const observer=new IntersectionObserver(entries=>setInView(entries.some(entry=>entry.isIntersecting && entry.intersectionRatio>=.1)),{threshold:[0,.1]});
  if(sceneRef.current)observer.observe(sceneRef.current);
  return()=>{media.removeEventListener("change",onMotion);document.removeEventListener("visibilitychange",onVisibility);observer.disconnect();};
 },[preview,sceneRef]);
 function place(point:DogPoint){
  machine.current.point=point;
  const element=dogRef.current;if(!element)return;
  const {width,height}=worldSize.current;
  element.style.transform=`translate3d(${width*(point.left-DOG_WIDTH/2)/100}px,${-height*point.bottom/100}px,0)`;
  const depth=String(photoDepth(point.bottom));if(element.style.zIndex!==depth)element.style.zIndex=depth;
  element.dataset.left=point.left.toFixed(4);element.dataset.bottom=point.bottom.toFixed(4);
 }
 useEffect(()=>{
  if(!mounted || !worldRef.current)return;
  const world=worldRef.current;
  const resize=()=>{worldSize.current={width:world.clientWidth,height:world.clientHeight};place(machine.current.point);};
  resize();const observer=new ResizeObserver(resize);observer.observe(world);return()=>observer.disconnect();
 },[mounted,worldRef]);
 useEffect(()=>{
  if(!mounted || preview)return;
  let canceled=false,frame=0,timer:ReturnType<typeof setTimeout>|undefined;
  const m=machine.current;
  if(lastContext.current!==context){
   lastContext.current=context;m.phase="idle";m.ordinal=null;m.point={...DOG_HOME};singleVisit.current=false;roamIndex.current=0;roamTarget.current=null;
   setView({phase:"idle",visitor:null,facing:m.facing});place(m.point);latest.current.onVisitChange(null);
  }
  const currentList=()=>latest.current.visitors;
  if(!currentList().length){
   m.ordinal=null;singleVisit.current=false;
   if(m.phase!=="roaming")m.phase="idle";
   setView({phase:m.phase,visitor:null,facing:m.facing});latest.current.onVisitChange(null);
  }
  if(m.ordinal!==null && !currentList().some(v=>v.ordinal===m.ordinal)){
   m.phase="idle";m.ordinal=null;singleVisit.current=false;setView({phase:"idle",visitor:null,facing:m.facing});latest.current.onVisitChange(null);
  }
  const explicit=requested.current!==null || acrossScene.current==="manual";
  if(manualSelected || (!autoActive && !explicit && !singleVisit.current))return;
  singleVisit.current=(explicit || singleVisit.current) && !autoActive;
  function advance(){
   if(canceled)return;
   const list=currentList(),index=list.findIndex(v=>v.ordinal===m.ordinal);
   if(!list.length){roam();return;}
   if(index+1>=list.length && latest.current.onAdvanceScene && sceneCount(latest.current.totalGuests)>1){
    acrossScene.current="auto";
    latest.current.onAdvanceScene!((latest.current.scene+1)%sceneCount(latest.current.totalGuests));
    return;
   }
   walkTo(list[(index+1)%list.length].ordinal);
  }
  function showMessage(visitor:DogVisitor){
   if(canceled)return;
   const live=currentList().find(v=>v.ordinal===visitor.ordinal);if(!live)return;
   const destination=dogDestination(live);place(destination);m.facing=live.left>=destination.left?1:-1;m.phase="reading";m.ordinal=live.ordinal;singleVisit.current=false;
   setView({phase:"reading",visitor:live,facing:m.facing});latest.current.onVisitChange(live.ordinal);
   if(autoActive)timer=setTimeout(roam,dogReadingTime(live.wish.message));
  }
  function roam(){
   if(canceled || !autoActive)return;
   if(!roamTarget.current){
    let destination=DOG_ROAM_POINTS[roamIndex.current%DOG_ROAM_POINTS.length];
    if(Math.hypot(destination.left-m.point.left,destination.bottom-m.point.bottom)<12){roamIndex.current++;destination=DOG_ROAM_POINTS[roamIndex.current%DOG_ROAM_POINTS.length];}
    roamTarget.current=destination;
   }
   const from={...m.point},to=roamTarget.current;
   m.phase="roaming";if(Math.abs(to.left-from.left)>.1)m.facing=to.left>=from.left?1:-1;
   setView({phase:"roaming",visitor:null,facing:m.facing});latest.current.onVisitChange(null);
   const duration=dogTravelTime(from,to),start=performance.now();
   const tick=(now:number)=>{
    if(canceled)return;
    const progress=Math.min(1,(now-start)/duration);place(dogPathPoint(from,to,progress,roamIndex.current+100));
    if(progress<1)frame=requestAnimationFrame(tick);
    else{roamTarget.current=null;roamIndex.current++;advance();}
   };
   frame=requestAnimationFrame(tick);
  }
  function walkTo(ordinal:number){
   if(canceled)return;
   const visitor=currentList().find(v=>v.ordinal===ordinal);if(!visitor)return;
   roamTarget.current=null;
   const from={...m.point},to=dogDestination(visitor),distance=Math.hypot(to.left-from.left,to.bottom-from.bottom);
   m.ordinal=ordinal;m.phase="walking";if(Math.abs(to.left-from.left)>.1)m.facing=to.left>=from.left?1:-1;
   latest.current.onVisitChange(null);setView({phase:"walking",visitor,facing:m.facing});
   if(!motionAllowed || distance<.1){showMessage(visitor);return;}
   const duration=dogTravelTime(from,to),start=performance.now();
   const tick=(now:number)=>{
    if(canceled)return;
    const progress=Math.min(1,(now-start)/duration);place(dogPathPoint(from,to,progress,ordinal));
    if(progress<1)frame=requestAnimationFrame(tick);else showMessage(visitor);
   };
   frame=requestAnimationFrame(tick);
  }
  const request=requested.current;requested.current=null;
  const crossing=acrossScene.current;acrossScene.current=null;
  if(request!==null)walkTo(request);
  else if(crossing && currentList().length)walkTo(currentList()[0].ordinal);
  else if(m.phase==="roaming")roam();
  else if(m.phase==="reading" && m.ordinal!==null){const visitor=currentList().find(v=>v.ordinal===m.ordinal);if(visitor)showMessage(visitor);}
  else if(m.ordinal!==null)walkTo(m.ordinal);
  else timer=setTimeout(()=>{const first=currentList()[0];if(first)walkTo(first.ordinal);else roam();},900);
  return()=>{canceled=true;cancelAnimationFrame(frame);if(timer)clearTimeout(timer);};
 },[context,queueSignal,autoActive,motionAllowed,mounted,preview,command,manualSelected]);
 function next(){
  latest.current.onClearManual();sceneRef.current?.scrollIntoView({behavior:reduced?"instant":"smooth",block:"center"});const list=latest.current.visitors;if(!list.length)return;
  const index=list.findIndex(v=>v.ordinal===machine.current.ordinal);
  if(index+1>=list.length && latest.current.onAdvanceScene && sceneCount(totalGuests)>1){
   acrossScene.current="manual";latest.current.onAdvanceScene((scene+1)%sceneCount(totalGuests));
  }else{requested.current=list[(index+1)%list.length].ordinal;setCommand(n=>n+1);}
 }
 function dismiss(){
  latest.current.onEnabledChange?.(false);machine.current.phase="idle";singleVisit.current=false;roamTarget.current=null;
  latest.current.onVisitChange(null);setView(current=>({...current,phase:"idle",visitor:null}));
 }
 const moving=(view.phase==="walking" || view.phase==="roaming") && motionAllowed && visible && inView && !manualSelected && (autoActive || singleVisit.current);
 const animate=motionAllowed && visible && inView && !manualSelected && (enabled || singleVisit.current);
 const point=machine.current.point,caption=view.phase==="reading" && !manualSelected?view.visitor:null;
 const resting=!autoActive && !moving;
 const status=!effects?"움직이는 효과를 켜면 자동 산책해요":reduced?"동작 줄이기 설정으로 쉬고 있어요":moving?view.phase==="roaming"?"정원을 자동으로 산책하고 있어요":"축하를 만나러 가는 중":caption?`${caption.wish.name} 님의 축하를 전해요`:resting?"잠시 쉬고 있어요":"곧 자동 산책을 시작해요";
 return <>
  {mounted && worldRef.current && createPortal(<div ref={dogRef} className="party-dog" role="img" aria-hidden={preview?true:undefined} aria-label="축하를 전하는 정원의 강아지" data-testid="party-dog" data-phase={view.phase} data-facing={view.facing===1?"right":"left"} data-walking={moving} data-animate={animate} data-target-ordinal={view.visitor?.ordinal??""} data-left={point.left.toFixed(4)} data-bottom={point.bottom.toFixed(4)} style={{width:`${DOG_WIDTH}%`,height:`${DOG_HEIGHT}%`,zIndex:photoDepth(point.bottom)} as CSSProperties}><div className="dog-facing" style={{transform:`scaleX(${view.facing})`}}><DogSprite/></div></div>,worldRef.current)}
  {mounted && sceneRef.current && caption && createPortal(<div className="dog-message" role="group" aria-label={`${caption.wish.name} 님의 축하 메시지`} data-testid="dog-message" data-ordinal={caption.ordinal} style={{left:`${Math.max(34,Math.min(66,point.left))}%`,...(point.bottom>48?{top:`${100-point.bottom+8}%`}:{bottom:`${point.bottom+8}%`})} as CSSProperties}>
   <div className="dog-message-heading"><PawPrint size={13}/><span>강아지가 전하는 축하</span><button aria-label="강아지의 축하 메시지 닫기" onClick={dismiss}><X size={13}/></button></div>
   <strong>{caption.wish.name}</strong><p>{caption.wish.message}</p>
  </div>,sceneRef.current)}
  {!preview && <div className="dog-tour-controls" data-testid="dog-tour-controls"><div><PawPrint size={14}/><span>{status}</span></div><div className="dog-tour-buttons">
   <button aria-label={enabled?"강아지 안내 일시정지":"강아지 안내 시작"} aria-pressed={enabled} disabled={!effects || reduced} onClick={()=>latest.current.onEnabledChange?.(!enabled)}>{enabled?<Pause size={12}/>:<Play size={12}/>}<span>{enabled?"쉬기":"자동 산책"}</span></button>
   <button aria-label="강아지와 다음 축하 보기" disabled={!visitors.length} onClick={next}><SkipForward size={13}/><span>다음 축하</span></button>
  </div></div>}
 </>;
}

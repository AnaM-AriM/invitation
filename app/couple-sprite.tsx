"use client";
import { publicPath } from "../lib/public-path";
import { useEffect, useId, useState, type CSSProperties } from "react";
import parts from "../lib/couple-parts.json";
import { PaintedArmLayer, PaintedRootCover, type PaintedParts } from "./painted-arm";

export default function CoupleSprite({preview=false}:{preview?:boolean}){
 const rig=parts as PaintedParts,id=useId().replace(/[^a-zA-Z0-9_-]/g,"_");
 const complete=["arm-left","arm-right"].every(side=>rig.arms[side] && rig.arms[side].polygon.length>=3);
 const key=complete?[rig.body,...Object.values(rig.arms).map(arm=>arm.source ?? rig.source)].join("|"):"";
 const [loadedParts,setLoadedParts]=useState<string|null>(null);
 useEffect(()=>{
  if(!rig || !complete || preview)return;
  let active=true;
  const sources=[rig.body,...Object.values(rig.arms).map(arm=>arm.source ?? rig.source)];
  const images=sources.map(source=>{const image=new window.Image();image.src=publicPath(source);return image;});
  Promise.all(images.map(async image=>{await image.decode();if(image.naturalWidth!==640 || image.naturalHeight!==640)throw new Error("Invalid couple part dimensions");}))
   .then(()=>{if(active)setLoadedParts(key);}).catch(()=>{if(active)setLoadedParts(null);});
  return ()=>{active=false;};
 },[rig,key,complete,preview]);
 const ready=complete && !preview && loadedParts===key,failed=()=>setLoadedParts(null);
 return <span className="couple-rig" role="img" aria-label="손을 잡고 웃는 안경 쓴 신랑과 부케를 든 신부" data-preview={preview} data-motion="parts" data-motion-ready={ready} style={{"--guest-tempo":`${rig.duration}s`,"--guest-delay":"-.8s"} as CSSProperties}>
  <img className="couple-original" src={publicPath("/assets/v10/couple.webp")} alt="" width={640} height={640} draggable={false} loading={preview?"lazy":"eager"}/>
  {ready && <span className="human-parts" aria-hidden="true">
   <img className="human-body human-part" data-part="body" src={publicPath(rig.body)} alt="" width={640} height={640} draggable={false} onError={failed}/>
   {["rear","front"].flatMap(z=>Object.entries(rig.arms).filter(([,arm])=>arm.z===z).map(([side,arm])=><PaintedArmLayer key={side} id={id} side={side} arm={arm} arms={rig.arms} source={rig.source} stage={rig.stage} onError={failed}/>))}
   {Object.entries(rig.arms).filter(([,arm])=>arm.coverSource==="original").map(([side,arm])=><PaintedRootCover key={`${side}-cap`} body={rig.body} source={rig.source} arm={arm} stage={rig.stage} onError={failed}/>)}
  </span>}
 </span>;
}

"use client";
import { publicPath } from "../lib/public-path";
import { useEffect, useId, useState, type CSSProperties } from "react";
import { spritePath, type partyActions } from "../lib/garden";
import rigs from "../lib/guest-parts.json";
import { PaintedArmLayer, PaintedRootCover, type PaintedParts } from "./painted-arm";

type Props={sprite:number;flip:boolean;action:typeof partyActions[number];ordinal:number;preview?:boolean};
// One fixed 320 × 400 body; two original-pixel arms rotate at their shoulders.
export default function GuestSprite({sprite,flip,action,ordinal,preview=false}:Props){
 const rig=rigs[sprite] as PaintedParts|undefined,id=useId().replace(/[^a-zA-Z0-9_-]/g,"_");
 const complete=!!rig && ["arm-left","arm-right"].every(side=>rig.arms[side] && (rig.arms[side].hidden || rig.arms[side].polygon.length>=3));
 const key=complete?[rig.body,...Object.values(rig.arms).map(arm=>arm.source ?? rig.source)].join("|"):"";
 const [loadedParts,setLoadedParts]=useState<string|null>(null);
 useEffect(()=>{
  if(!rig || !complete || preview)return;
  let active=true;
  const sources=[rig.body,...Object.values(rig.arms).map(arm=>arm.source ?? rig.source)];
  const images=sources.map(source=>{const image=new window.Image();image.src=publicPath(source);return image;});
  Promise.all(images.map(async image=>{await image.decode();if(image.naturalWidth!==320 || image.naturalHeight!==400)throw new Error("Invalid guest part dimensions");}))
   .then(()=>{if(active)setLoadedParts(key);}).catch(()=>{if(active)setLoadedParts(null);});
  return ()=>{active=false;};
 },[rig,key,complete,preview]);
 const ready=complete && !preview && loadedParts===key,failed=()=>setLoadedParts(null);
 return <span className="guest-rig-facing" style={{transform:flip?"scaleX(-1)":undefined}} aria-hidden="true">
  <span className="guest-rig" data-action={action} data-preview={preview} data-motion="parts" data-motion-ready={ready} style={{"--guest-delay":`${-(ordinal%17)*.37}s`,"--guest-tempo":`${rig?.duration ?? 5.2}s`} as CSSProperties}>
   <img className="guest-original" src={publicPath(spritePath(sprite))} alt="" width={320} height={400} draggable={false} loading={preview?"lazy":"eager"}/>
   {ready && <span className="human-parts">
    <img className="human-body human-part" data-part="body" src={publicPath(rig.body)} alt="" width={320} height={400} draggable={false} onError={failed}/>
    {["rear","front"].flatMap(z=>Object.entries(rig.arms).filter(([,arm])=>arm.z===z).map(([side,arm])=><PaintedArmLayer key={side} id={id} side={side} arm={arm} arms={rig.arms} source={rig.source} stage={rig.stage} onError={failed}/>))}
    {Object.entries(rig.arms).filter(([,arm])=>arm.coverSource==="original").map(([side,arm])=><PaintedRootCover key={`${side}-cap`} body={rig.body} source={rig.source} arm={arm} stage={rig.stage} onError={failed}/>)}
   </span>}
  </span>
 </span>;
}

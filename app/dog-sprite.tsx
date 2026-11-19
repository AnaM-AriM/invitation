"use client";
import { publicPath } from "../lib/public-path";
import { memo } from "react";

// Ink outlines stay visible; opaque attachment caps sit behind the torso.
function Part({name,asset=name}:{name:string;asset?:string}){
 return <img className={`dog-part dog-${name}`} src={publicPath(`/assets/v11/dog/${asset}.webp`)} alt="" draggable={false} decoding="async"/>;
}
export default memo(function DogSprite(){
 return <div className="dog-art" aria-hidden="true">
  <div className="dog-shadow"/>
  <div className="dog-rig dog-part">
   <Part name="tail"/>
   <Part name="leg-back-far" asset="hind-leg"/>
   <Part name="leg-front-far" asset="front-leg"/>
   <Part name="leg-back-near" asset="hind-leg"/>
   <Part name="leg-front-near" asset="front-leg"/>
   <Part name="body"/>
   <div className="dog-head-group dog-part"><Part name="head"/><Part name="bowtie"/></div>
  </div>
 </div>;
});

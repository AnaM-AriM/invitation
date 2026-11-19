import { publicPath } from "../lib/public-path";
import { type CSSProperties } from "react";

export interface PaintedArm {
 pivot:number[];polygon:number[][];includePolygons?:number[][][];z:string;motion:number;owner:string;cover:number[];occludedBy?:string;excludePolygons?:number[][][];source?:string;hidden?:boolean;coverSource?:string;coverPolygon?:number[][];
}
export function PaintedArmLayer({id,side,arm,arms,source,stage,onError}:{id:string;side:string;arm:PaintedArm;arms:Record<string,PaintedArm>;source:string;stage:number[];onError:()=>void}){
 const [width,height]=stage,clip=`${id}-${side}`,points=arm.polygon.map(point=>point.join(",")).join(" ");
 const excluded=arm.occludedBy?arms[arm.occludedBy]:null;
 const exclusions=[...(arm.excludePolygons ?? []),...(excluded?[excluded.polygon,...(excluded.includePolygons??[])]:[])];
 const painted=<image href={publicPath(arm.source ?? source)} width={width} height={height} clipPath={`url(#${clip})`} onError={onError}/>;
 return <svg className="human-arm human-part" data-part={side} data-owner={arm.owner} data-z={arm.z} data-hidden={arm.hidden || undefined} data-moving={!arm.hidden && arm.motion!==0} viewBox={`0 0 ${width} ${height}`} width={width} height={height} preserveAspectRatio="none" style={{transformOrigin:`${arm.pivot[0]/width*100}% ${arm.pivot[1]/height*100}%`,"--arm-open":`${arm.motion}deg`} as CSSProperties}>
  <defs>
   <clipPath id={clip}><polygon points={points}/>{arm.includePolygons?.map((polygon,index)=><polygon key={index} points={polygon.map(point=>point.join(",")).join(" ")}/>)}</clipPath>
   {exclusions.map((polygon,index)=><clipPath key={index} id={`${clip}-ownership-${index}`}><path clipRule="evenodd" fillRule="evenodd" d={`M0 0H${width}V${height}H0Z M${polygon.map(point=>point.join(" ")).join("L")}Z`}/></clipPath>)}
  </defs>
  {exclusions.reduce((layer,_polygon,index)=><g key={index} clipPath={`url(#${clip}-ownership-${index})`}>{layer}</g>,painted)}
 </svg>;
}
export function PaintedRootCover({body,source,arm,stage,onError}:{body:string;source:string;arm:PaintedArm;stage:number[];onError:()=>void}){
 const [width,height]=stage,[left,top,right,bottom]=arm.cover;
 const clip=arm.coverPolygon?.map(([x,y])=>`${x/width*100}% ${y/height*100}%`).join(",") ?? `${left/width*100}% ${top/height*100}%,${right/width*100}% ${top/height*100}%,${right/width*100}% ${bottom/height*100}%,${left/width*100}% ${bottom/height*100}%`;
 return <img className="human-root-cover" src={publicPath(arm.coverSource==="original"?source:body)} alt="" width={width} height={height} draggable={false} onError={onError} style={{clipPath:`polygon(${clip})`}}/>;
}
export interface PaintedParts {
 body:string;source:string;stage:number[];duration:number;arms:Record<string,PaintedArm>;
}

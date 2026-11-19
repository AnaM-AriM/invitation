import type { Wish } from "./garden";
export type DogPoint={left:number;bottom:number};
export type DogVisitor=DogPoint & {ordinal:number;direction:number;scale:number;wish:Wish};
export const DOG_HOME:DogPoint={left:48,bottom:8};
export const DOG_WIDTH=12;
export const DOG_HEIGHT=7;
// Follow the open lawn around the reception, away from the central first dance.
export const DOG_ROAM_POINTS:readonly DogPoint[]=[
 {left:24,bottom:14},{left:13,bottom:39},{left:32,bottom:66},
 {left:73,bottom:58},{left:86,bottom:31},{left:67,bottom:12},
];
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
export function dogDestination(guest:Pick<DogVisitor,"left"|"bottom"|"direction"|"scale">):DogPoint{
 return {left:clamp(guest.left-guest.direction*3.8*guest.scale,6,94),bottom:clamp(guest.bottom-1.8,5,69)};
}
export function dogTravelTime(from:DogPoint,to:DogPoint){return clamp(Math.hypot(to.left-from.left,(to.bottom-from.bottom)*1.25)*45,1000,3600);}
export function dogReadingTime(message:string){return clamp(3500+message.length*45,6500,14000);}
export function dogPathPoint(from:DogPoint,to:DogPoint,progress:number,ordinal:number):DogPoint{
 const p=clamp(progress,0,1),t=p*p*(3-2*p),dx=to.left-from.left,dy=to.bottom-from.bottom,length=Math.hypot(dx,dy)||1,bend=ordinal%2?2:-2;
 const control={left:clamp((from.left+to.left)/2-dy/length*bend,6,94),bottom:clamp((from.bottom+to.bottom)/2+dx/length*bend,5,69)};
 return {left:(1-t)**2*from.left+2*(1-t)*t*control.left+t*t*to.left,bottom:(1-t)**2*from.bottom+2*(1-t)*t*control.bottom+t*t*to.bottom};
}

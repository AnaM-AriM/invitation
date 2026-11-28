import type { Wish } from "./garden";
export type DogPoint={left:number;bottom:number};
export type DogVisitor=DogPoint & {ordinal:number;direction:number;scale:number;wish:Wish};
export const DOG_HOME:DogPoint={left:48,bottom:8};
export const DOG_WIDTH=12;
export const DOG_HEIGHT=7;
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
export function dogDestination(guest:Pick<DogVisitor,"left"|"bottom"|"direction"|"scale">):DogPoint{
 return {left:clamp(guest.left-guest.direction*3.8*guest.scale,6,94),bottom:clamp(guest.bottom-1.8,5,69)};
}
export function dogTravelTime(from:DogPoint,to:DogPoint){return clamp(2800+Math.hypot(to.left-from.left,(to.bottom-from.bottom)*1.25)*92,4800,11000);}
export function dogReadingTime(message:string){return clamp(6800+message.length*55,10000,22000);}
export function dogPathPoint(from:DogPoint,to:DogPoint,progress:number,ordinal:number):DogPoint{
 const p=clamp(progress,0,1),t=p*p*(3-2*p),dx=to.left-from.left,dy=to.bottom-from.bottom,length=Math.hypot(dx,dy)||1,bend=ordinal%2?2:-2;
 const control={left:clamp((from.left+to.left)/2-dy/length*bend,6,94),bottom:clamp((from.bottom+to.bottom)/2+dx/length*bend,5,69)};
 return {left:(1-t)**2*from.left+2*(1-t)*t*control.left+t*t*to.left,bottom:(1-t)**2*from.bottom+2*(1-t)*t*control.bottom+t*t*to.bottom};
}

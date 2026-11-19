import guestMotion from "./guest-motion.json" with { type: "json" };
export type GuestAction="toast"|"clap"|"chat"|"dance"|"photo"|"wave"|"laugh"|"petals"|"music"|"walk"|"watch";
export interface GuestMotion {sprite:number;action:GuestAction;facing:-1|0|1;mode:"frames"|"idle";atlas:string|null;columns:4;rows:6;frames:24;duration:number;drawings:number;sequence:number[];source:string|null;still?:string;}
export const guestMotions=guestMotion as GuestMotion[];
// World coordinates remain fixed. The camera fits the growing group as a whole.
export const GUESTS_PER_SCENE = 36;
export const COMMENTS_PER_PAGE = 6;
export const SPRITE_COUNT = 48;
export const ACTOR_HEIGHT = 17.2;
export const ACTOR_WIDTH = ACTOR_HEIGHT * 1.25 * .65;
export const templates = [
  { id: "garden", name: "푸른 정원", tone: "맑고 싱그러운 오후", image: "/assets/v10/bg-garden.webp" },
  { id: "sunset", name: "노을 정원", tone: "다정한 살구빛 저녁", image: "/assets/v10/bg-sunset.webp" },
  { id: "forest", name: "숲속 정원", tone: "초록으로 물든 하루", image: "/assets/v10/bg-forest.webp" },
  { id: "night", name: "별빛 정원", tone: "별 아래 반짝이는 약속", image: "/assets/v10/bg-night.webp" },
  { id: "coast", name: "바닷가 정원", tone: "바람을 닮은 푸른 약속", image: "/assets/v10/bg-coast.webp" },
] as const;
export const layouts = [
  { id: "garden", name: "정원 엽서", description: "꽃과 아치로 감싸는 초대" },
  { id: "letter", name: "다정한 편지", description: "차분한 종이 위에 전하는 마음" },
  { id: "album", name: "웨딩 앨범", description: "우리의 풍경부터 펼치는 기록" },
] as const;
export type TemplateId = typeof templates[number]["id"];
export type LayoutId = typeof layouts[number]["id"];
export interface Wish { id: number; name: string; message: string; createdAt: string }
export interface GardenData { total: number; comments: Wish[]; guests: Wish[]; page: number; scene: number }
export function countGuests(comments: number, ratio = 1) {
  if (!Number.isFinite(comments) || !Number.isFinite(ratio) || ratio < 1) return 0;
  return Math.floor(Math.max(0, comments) / Math.floor(ratio));
}
export function sceneCount(totalGuests: number) { return Math.max(1, Math.ceil(totalGuests / GUESTS_PER_SCENE)); }
// Stable, deliberately asymmetric reception groups. A guest faces their local
// conversation/dance partner, rather than everyone turning toward the couple.
export type ReceptionZone="cocktail"|"dance"|"dinner"|"music"|"photo"|"lounge";
const points: [number,number,ReceptionZone,number][]=[
 [18,51,"cocktail",1],[27,48,"cocktail",-1],
 [75,31,"dance",-1],[65,34,"dance",1],
 [72,58,"dinner",-1],[63,61,"dinner",1],
 [43,58,"music",1],[52,53,"music",-1],
 [22,26,"photo",1],[29,30,"photo",-1],
 [78,13,"lounge",-1],[68,15,"lounge",1],
 [11,44,"cocktail",1],[32,55,"cocktail",-1],
 [86,50,"dinner",-1],[80,44,"dinner",1],
 [12,15,"lounge",1],[21,11,"lounge",-1],
 [88,26,"dance",-1],[83,36,"dance",1],
 [37,41,"photo",1],[48,42,"photo",-1],
 [57,47,"music",-1],[57,33,"dance",-1],
 [13,62,"cocktail",1],[24,66,"cocktail",-1],
 [86,63,"dinner",-1],[79,69,"dinner",-1],
 [34,22,"dance",1],[61,22,"dance",-1],
 [10,32,"photo",1],[90,39,"dinner",-1],
 [38,65,"music",1],[54,67,"music",-1],
 [38,11,"photo",1],[56,9,"lounge",-1],
];
const partyOrder=[0,1,6,7,13,15,23,2,8,9,22,10,...Array.from({length:12},(_,i)=>24+i),3,4,5,11,12,14,16,17,18,19,20,21,...Array.from({length:12},(_,i)=>36+i)];
export function photoDepth(bottom:number){return Math.round((100-bottom)*10);}
export function spriteForOrdinal(ordinal:number){return partyOrder[ordinal%SPRITE_COUNT];}
export const partyActions:GuestAction[]=guestMotions.map(motion=>motion.action);
// Inspected source directions; 0 marks a three-quarter back view.
const sourceFacing=guestMotions.map(motion=>motion.facing);
export function spritePixels(_sprite:number){return 320;}
export function spriteWidth(sprite:number){return ACTOR_HEIGHT*1.25*spritePixels(sprite)/400;}
export function guestPresentation(sprite:number,left:number,direction=left>50?-1:1){
 const facing=sourceFacing[sprite],flip=facing!==0 && facing!==direction;
 return {action:partyActions[sprite],facing:facing===0?"back":direction===1?"right":"left",flip,faceLeft:50};
}
export function guestSlots(totalGuests:number,scene:number){
 const start=scene*GUESTS_PER_SCENE;
 return Array.from({length:Math.max(0,Math.min(GUESTS_PER_SCENE,totalGuests-start))},(_,slot)=>{
  const [x,y,zone,direction]=points[slot];
  const left=x+((slot*7)%5-2)*.1,bottom=y+((slot*11)%5-2)*.12;
  const scale=Number((.83+(70-bottom)*.003).toFixed(4));
  return {ordinal:start+slot,sprite:spriteForOrdinal(start+slot),left,bottom,scale,zone,direction,depth:photoDepth(bottom)};
 });
}
export function spritePath(index:number){
 const sprite=index%SPRITE_COUNT+1;
 return guestMotions[sprite-1].still ?? `/assets/v10/guests/guest-${String(sprite).padStart(2,"0")}.webp`;
}
export const couple={left:49,bottom:23,width:29,height:23.2};
export const CAMERA_ORIGIN=80;
// Keep the whole reception visible, including its open paths and furniture.
// A fixed camera also prevents existing guests drifting when a wish arrives.
export function groupCamera(_visibleGuests:number,_scene=0){return {zoom:1,y:0};}
export interface ReceptionProp {id:string;asset:string;left:number;bottom:number;width:number;height:number;depth:number;}
export function receptionFurnishings(guests:number):ReceptionProp[]{
 const items:ReceptionProp[]=[];
 const add=(id:string,asset:string,left:number,bottom:number,width:number,height:number,ground=false)=>items.push({id,asset,left,bottom,width,height,depth:ground?0:photoDepth(bottom)});
 add("dance-floor","dance-floor",49,17,43,17,true);
 if(guests>=1)add("cocktail-table","cocktail",23,45,16,11);
 if(guests>=4)add("dining-table","dining",76,49,25,12);
 if(guests>=6){add("music-corner","music",46,59,18,11);add("festoon-lights","lights",50,82,88,10,true);}
 if(guests>=12)add("garden-lounge","lounge",18,7,25,12);
 if(guests>=24)add("dessert-table","dessert",82,9,18,13);
 if(guests>=36)add("garden-bar","bar",19,61,17,9);
 if(guests>=60)add("second-cocktail-table","cocktail",29,25,13,9);
 if(guests>=100)add("second-lounge","lounge",82,59,21,10);
 return items;
}
export interface GardenDecoration { id:string; asset:string; layer:"back"|"front"; left:number; top:number; width:number; height:number; flip?:boolean; }
export function gardenDecorations(guests:number):GardenDecoration[]{
 const items:GardenDecoration[]=[];
 const add=(id:string,asset:string,layer:"back"|"front",left:number,top:number,width:number,height:number,flip=false)=>items.push({id,asset,layer,left,top,width,height,flip});
 if(guests>=1){add("planter-left","planters","back",1,81,12,14);add("planter-right","planters","back",87,81,12,14,true);}
 if(guests>=6)add("bunting","bunting","back",10,2,80,8);
 if(guests>=12){add("daisies-front","daisies","front",0,89,15,11);add("roses-front","blossoms","front",85,89,15,11);}
 if(guests>=24)add("flower-arch","arch","back",66,10,27,34);
 if(guests>=36){add("lanterns-left","lanterns","back",4,11,10,14);add("lanterns-right","lanterns","back",86,9,10,14,true);}
 if(guests>=60){add("daisies-back","daisies","back",0,60,9,15);add("roses-back","blossoms","back",91,61,9,15);}
 if(guests>=100){add("bunting-inner","bunting","back",28,8,43,5);add("flower-border","blossoms","front",40,96,20,4);}
 return items;
}
const DAY = 86400000;
export function daysToWedding(date: string, now: Date = new Date()): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const target=Date.parse(`${date}T00:00:00+09:00`);
  if (!Number.isFinite(target) || new Date(target+9*3600000).toISOString().slice(0,10)!==date) return null;
  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
  return Math.round((target-Date.parse(`${today}T00:00:00+09:00`))/DAY);
}
export function atmosphere(guests: number, days: number | null) {
  const crowd=guests>=100?3:guests>=36?2:guests>=12?1:0;
  const date=days===0?3:days!==null && days>0 && days<=7?2:days!==null && days>0 && days<=30?1:0;
  const level=Math.max(crowd,date);
  return {level,name:["설레는 시작","꽃이 피는 정원","빛이 모이는 정원","축제가 된 정원"][level],petals:[0,6,10,12][level],sparkles:level>=2?8:0,confetti:level===3?12:0,blur:Math.min(1.2,guests/60),progress:Math.min(100,Math.round(guests/100*100))};
}

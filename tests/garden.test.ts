import test from "node:test";
import assert from "node:assert/strict";
import { ACTOR_HEIGHT, ACTOR_WIDTH, couple, receptionFurnishings, SPRITE_COUNT, guestPresentation, spriteWidth, CAMERA_ORIGIN, GUESTS_PER_SCENE, atmosphere, gardenDecorations, photoDepth, countGuests, daysToWedding, groupCamera, guestSlots, sceneCount, spriteForOrdinal, spritePath } from "../lib/garden.ts";
import { DOG_HOME, DOG_ROAM_POINTS, dogDestination, dogPathPoint, dogReadingTime, dogTravelTime } from "../lib/dog-tour.ts";
import { validateWish } from "../lib/validation.ts";
test("zero, thresholds, and 5000 wishes keep every guest in one of the scenes", () => {
  for (const ratio of [1, 3, 5]) for (const count of [0,1,2,3,5,11,12,13,24,25,4999,5000]) {
    const guests=countGuests(count,ratio);
    assert.equal(guests,Math.floor(count/ratio));
    const all=Array.from({length:sceneCount(guests)},(_,i)=>guestSlots(guests,i)).flat();
    assert.equal(all.length,guests); assert.equal(new Set(all.map(i=>i.ordinal)).size,guests);
    assert.ok(all.every(i=>i.left>=8 && i.left<=92 && i.bottom>=7 && i.sprite>=0 && i.sprite<SPRITE_COUNT));
  }
});
test("adding wishes never moves an existing guest", () => {
  for(let count=1;count<100;count++) for(let scene=0;scene<sceneCount(count);scene++) {
    const before=guestSlots(count,scene),after=guestSlots(count+1,scene);
    assert.deepEqual(after.slice(0,before.length),before);
  }
});
test("invalid counts and ratios cannot create guests",()=>{
  for(const count of [-1,NaN,Infinity]) assert.equal(countGuests(count),0);
  for(const ratio of [0,-1,NaN,Infinity]) assert.equal(countGuests(10,ratio),0);
  assert.equal(guestSlots(0,0).length,0); assert.equal(sceneCount(0),1);
});
test("sprite cycle stays bounded",()=>{
  assert.equal(spritePath(0),"/assets/v10/guests/guest-01.webp");
  assert.equal(spritePath(11),"/assets/v10/guests/guest-12.webp");
  assert.equal(spritePath(5000),"/assets/v10/guests/guest-09.webp");
});
const valid={name:"  친구  ",message:"  축하합니다!\n행복하세요  ",requestId:"a92c9e08-6e36-4bdf-a2f4-5cfbc7168ee1"};
test("validation trims input and preserves safe message newlines",()=>{
  const result=validateWish(valid);assert.ok(result.data);assert.equal(result.data.name,"친구");assert.equal(result.data.message,"축하합니다!\n행복하세요");
});
test("validation rejects malformed payloads, oversize and invisible input",()=>{
  for(const input of [null,[],"text",{}, {...valid,name:" "},{...valid,name:"가".repeat(21)},{...valid,message:"가".repeat(301)},{...valid,requestId:"bad"},{...valid,name:"a\n"+"b"},{...valid,message:"a\u0000b"}]) assert.ok(validateWish(input).error);
});

test("48 candid designs appear before any design repeats",()=>{
 assert.equal(new Set(Array.from({length:48},(_,i)=>spriteForOrdinal(i))).size,48);
 assert.equal(spriteForOrdinal(48),spriteForOrdinal(0));
});
test("guests occupy the whole reception and face local partners",()=>{
 const guests=guestSlots(36,0),first=guests[0];
 assert.equal(first.zone,"cocktail");assert.ok(first.left<couple.left-20);
 assert.ok(Math.max(...guests.map(g=>g.left))-Math.min(...guests.map(g=>g.left))>78);
 assert.ok(Math.max(...guests.map(g=>g.bottom))-Math.min(...guests.map(g=>g.bottom))>59);
 assert.equal(new Set(guests.map(g=>g.zone)).size,6);
 assert.ok(guests.some(g=>g.left<40 && g.direction<0));
 assert.ok(guests.some(g=>g.left>60 && g.direction>0));
 assert.equal(new Set(guests.slice(0,8).map(g=>g.zone)).size,4);
});
test("camera keeps the entire reception in frame without zooming when guests arrive",()=>{
 for(let scene=0;scene<4;scene++)for(let n=0;n<=GUESTS_PER_SCENE;n++){
  assert.deepEqual(groupCamera(n,scene),{zoom:1,y:0});
  const actors=[{...couple},...guestSlots(scene*GUESTS_PER_SCENE+n,scene).map(p=>({...p,width:spriteWidth(p.sprite)*p.scale,height:ACTOR_HEIGHT*p.scale}))];
  for(const actor of actors){
   assert.ok(actor.left-actor.width/2>=1 && actor.left+actor.width/2<=99);
   assert.ok(100-actor.bottom-actor.height>=8 && 100-actor.bottom<=98);
  }
 }
});
test("wedding countdown uses Seoul midnight and validates real dates",()=>{
 assert.equal(daysToWedding("2026-10-21",new Date("2026-10-20T14:59:00Z")),1);
 assert.equal(daysToWedding("2026-10-21",new Date("2026-10-20T15:01:00Z")),0);
 assert.equal(daysToWedding("2026-10-20",new Date("2026-10-20T15:01:00Z")),-1);
 for(const date of ["","2027-02-30","2026-13-01","oops"])assert.equal(daysToWedding(date),null);
});
test("guest and date milestones both drive bounded atmosphere effects",()=>{
 assert.equal(atmosphere(0,90).level,0);assert.equal(atmosphere(12,90).level,1);assert.equal(atmosphere(36,90).level,2);assert.equal(atmosphere(100,90).level,3);
 assert.equal(atmosphere(0,30).level,1);assert.equal(atmosphere(0,7).level,2);assert.equal(atmosphere(0,0).level,3);assert.equal(atmosphere(0,-1).level,0);
 const mood=atmosphere(5000,0);assert.ok(mood.blur<=1.2 && mood.petals+mood.sparkles+mood.confetti<=32);assert.equal(mood.progress,100);
});

test("candid groups protect faces and use feet to resolve overlaps",()=>{
 for(let scene=0;scene<4;scene++){
  const actors=guestSlots(144,scene);
  for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){
   const a=actors[i],b=actors[j],dx=Math.abs(a.left-b.left),dy=Math.abs((100-a.bottom-ACTOR_HEIGHT*a.scale*.845)-(100-b.bottom-ACTOR_HEIGHT*b.scale*.845));
   assert.ok((dx/(ACTOR_WIDTH*.22*(a.scale+b.scale)))**2+(dy/(ACTOR_HEIGHT*.12*(a.scale+b.scale)))**2>1,`faces overlap: ${scene}:${i},${j}`);
   if(a.bottom<b.bottom-.11)assert.ok(a.depth>b.depth);
  }
 }
});
test("physical scenery grows cumulatively and remains bounded",()=>{
 let previous:string[]=[];
 for(const [count,expected] of [[0,0],[1,2],[6,3],[12,5],[24,6],[36,8],[60,10],[100,12],[5000,12]]){
  const decor=gardenDecorations(count);assert.equal(decor.length,expected);
  assert.equal(new Set(decor.map(d=>d.id)).size,decor.length);
  assert.ok(previous.every(id=>decor.some(d=>d.id===id)),"new guests must not remove earlier decorations");
  assert.ok(decor.every(d=>d.left>=0 && d.top>=0 && d.left+d.width<=100 && d.top+d.height<=100));
  previous=decor.map(d=>d.id);
 }
});

test("all guests have candid actions and follow their local partner direction",()=>{
 const guests=guestSlots(36,0),poses=guests.map(g=>guestPresentation(g.sprite,g.left,g.direction));
 assert.ok(new Set(poses.map(p=>p.action)).size>=9);
 assert.ok(poses.some(p=>p.facing==="back"));
 for(const guest of guests){const pose=guestPresentation(guest.sprite,guest.left,guest.direction);if(pose.facing!=="back")assert.equal(pose.facing,guest.direction===1?"right":"left");}
});
test("all 5000 guests use the candid character library",()=>{
 for(let scene=0;scene<139;scene++)for(const guest of guestSlots(5000,scene))assert.ok(guest.sprite<48 && guestPresentation(guest.sprite,guest.left,guest.direction).action);
});
test("reception furnishings grow cumulatively and retain their open dance floor",()=>{
 let previous:string[]=[];
 for(const [count,expected] of [[0,1],[1,2],[4,3],[6,5],[12,6],[24,7],[36,8],[60,9],[100,10],[5000,10]]){
  const props=receptionFurnishings(count);assert.equal(props.length,expected);assert.ok(previous.every(id=>props.some(p=>p.id===id)));
  assert.equal(props[0].asset,"dance-floor");assert.equal(props[0].depth,0);
  for(const p of props){assert.ok(p.left-p.width/2>=0 && p.left+p.width/2<=100 && p.bottom>=0 && p.bottom+p.height<=100);assert.ok(p.asset==="lights" || p.bottom<=70,"furniture feet must stay on the lawn");}
  previous=props.map(p=>p.id);
 }
});

test("the dog arrives beside each guest's feet and stays inside the reception",()=>{
 for(let scene=0;scene<139;scene++)for(const guest of guestSlots(5000,scene)){
  const point=dogDestination(guest);
  assert.ok(point.left>=6 && point.left<=94 && point.bottom>=5 && point.bottom<=69);
  assert.ok(Math.abs(point.left-guest.left)<5 && Math.abs(point.bottom-guest.bottom)<2);
 }
});
test("dog paths retain their endpoints, remain bounded and never teleport mid-route",()=>{
 const destinations=[...guestSlots(36,0).map(dogDestination),...DOG_ROAM_POINTS,...DOG_ROAM_POINTS];let from=DOG_HOME;
 for(const [i,to] of destinations.entries()){
  assert.deepEqual(dogPathPoint(from,to,0,i),from);assert.deepEqual(dogPathPoint(from,to,1,i),to);
  let last=from;
  for(let step=1;step<=100;step++){const point=dogPathPoint(from,to,step/100,i);assert.ok(point.left>=5 && point.left<=95 && point.bottom>=5 && point.bottom<=69);assert.ok(Math.hypot(point.left-last.left,point.bottom-last.bottom)<2);last=point;}
  from=to;
 }
});
test("walking and reading times stay bounded for nearby guests and long wishes",()=>{
 assert.ok(dogTravelTime(DOG_HOME,DOG_HOME)>=1000);
 assert.ok(dogTravelTime({left:0,bottom:0},{left:100,bottom:100})<=3600);
 assert.ok(dogReadingTime("축하해요")>=6500);assert.ok(dogReadingTime("가".repeat(300))<=14000);
 assert.ok(dogReadingTime("가".repeat(300))>dogReadingTime("축하해요"));
});


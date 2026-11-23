// Original instrumental for this invitation: Spring Garden, G major, 3/4, 90 BPM.
// Procedural soft keys and music-box timbres; no recordings, samples or external music.
// Regenerate with Node.js + ffmpeg: node scripts/create-garden-music.mjs public/audio/spring-garden.mp3
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const output = process.argv[2];
if (!output) throw new Error('Provide the output MP3 path.');
const rate = 44100, bpm = 90, beat = 60 / bpm, bars = 32, length = Math.round(bars * 3 * beat * rate);
const left = new Float64Array(length), right = new Float64Array(length);
const notes = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
function midi(note) { const [, name, sharp, octave] = /^([A-G])(#?)(\d)$/.exec(note); return (+octave + 1) * 12 + notes[name] + (sharp ? 1 : 0); }
function sound(note, at, velocity, kind, pan, duration = 2.8) {
  const pitch = midi(note), freq = 440 * 2 ** ((pitch - 69) / 12), start = Math.round(at * beat * rate);
  const partials = kind === 'bell' ? [[1,1,1.8],[2.003,.20,.8],[3.99,.05,.27]] : [[1,1,1.5],[2.001,.25,.8],[3.003,.09,.5],[4.005,.025,.25]];
  const gainL = Math.cos((pan + 1) * Math.PI / 4), gainR = Math.sin((pan + 1) * Math.PI / 4);
  const samples = Math.round(duration * rate);
  for (let i=0; i<samples; i++) {
    const t = i/rate, attack = 1-Math.exp(-t/0.009), release = Math.min(1,(samples-i)/(rate*.08));
    let value=0;
    for (const [multiple,amp,decay] of partials) value += amp * Math.sin(2*Math.PI*freq*multiple*t) * Math.exp(-t/decay);
    value *= velocity * attack * release;
    const index=(start+i)%length; left[index]+=value*gainL; right[index]+=value*gainR;
  }
}
// Four eight-bar phrases, each varied in its response and final cadence.
const melody = [
 ['D5',1,'G5',.5,'B5',.5,'A5',1], ['F#5',1.5,'E5',.5,'D5',1],
 ['G5',1,'B5',1,'E5',1], ['E5',1.5,'D5',.5,'G5',1],
 ['A5',1,'G5',.5,'E5',.5,'D5',1], ['F#5',1,'A5',1,'F#5',1],
 ['G5',1.5,'B5',.5,'A5',1], ['D5',2,'B4',1],
 ['B5',1,'A5',.5,'G5',.5,'D5',1], ['A5',1.5,'F#5',.5,'E5',1],
 ['G5',1,'E5',1,'B4',1], ['D5',1.5,'E5',.5,'G5',1],
 ['A5',1,'B5',.5,'A5',.5,'G5',1], ['F#5',1.5,'E5',.5,'D5',1],
 ['B4',1,'D5',1,'G5',1], ['A5',2,'F#5',1],
 ['G5',1.5,'A5',.5,'B5',1], ['A5',1,'F#5',1,'D5',1],
 ['B5',1,'G5',.5,'E5',.5,'D5',1], ['E5',1.5,'G5',.5,'A5',1],
 ['C6',1,'B5',.5,'A5',.5,'G5',1], ['A5',1.5,'F#5',.5,'D5',1],
 ['G5',2,'E5',1], ['D5',1.5,'B4',.5,'D5',1],
 ['B5',1,'G5',1,'A5',1], ['F#5',1.5,'E5',.5,'D5',1],
 ['G5',1,'E5',1,'B4',1], ['E5',1.5,'D5',.5,'C5',1],
 ['A4',1,'C5',1,'E5',1], ['D5',1,'F#5',1,'A5',1],
 ['B5',1,'A5',.5,'G5',.5,'D5',1], ['G5',2.5,'D5',.5],
];
const progression = [
 ['G2','D4','G4','B4'], ['F#2','D4','F#4','A4'], ['E2','B3','E4','G4'], ['C3','G3','B3','E4'],
 ['A2','E4','G4','C5'], ['D3','A3','C4','F#4'], ['G2','D4','G4','B4'], ['D3','A3','C4','F#4'],
];
for (let bar=0; bar<bars; bar++) {
  const chord=progression[bar%8], offset=bar*3, breath=0.94+0.06*Math.cos(bar*.83);
  sound(chord[0],offset,.12*breath,'key',-.12,3.0);
  for (let b=0;b<3;b++) for (let n=1;n<4;n++) sound(chord[n],offset+b+.04+(n-1)*.018,.032*breath*(b===0?.75:1),'key',-.35+(n-1)*.22,2.2);
  const line=melody[bar]; let cursor=0;
  for (let i=0;i<line.length;i+=2) {
    const note=line[i], dur=line[i+1];
    sound(note,offset+cursor+.02,.075*breath*(cursor===0?1:.88),'bell',.16,Math.min(3,dur*beat+1.6));
    // Quiet lower octave adds a warm felt-key body below the chime.
    const lower=note.replace(/\d$/,String(Number(note.at(-1))-1));
    sound(lower,offset+cursor+.028,.036*breath,'key',-.12,2.0); cursor+=dur;
  }
}
// Gentle circular room reflections carry the cadence into the next repetition.
const dryL=left.slice(), dryR=right.slice();
for (const [seconds,gain] of [[.083,.11],[.139,.08],[.227,.05],[.379,.025]]) {
  const delay=Math.round(seconds*rate);
  for(let i=0;i<length;i++) { const j=(i+delay)%length; left[j]+=dryR[i]*gain; right[j]+=dryL[i]*gain; }
}
let peak=0;
for(let i=0;i<length;i++) peak=Math.max(peak,Math.abs(left[i]),Math.abs(right[i]));
const pcm=Buffer.alloc(length*4), scale=.32/peak;
for(let i=0;i<length;i++) { pcm.writeInt16LE(Math.round(left[i]*scale*32767),i*4);pcm.writeInt16LE(Math.round(right[i]*scale*32767),i*4+2); }
const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(36+pcm.length,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(2,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*4,28);header.writeUInt16LE(4,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);
const temporary=mkdtempSync(join(tmpdir(),'garden-music-'));
try {
 const wav=join(temporary,'spring-garden.wav');writeFileSync(wav,Buffer.concat([header,pcm]));mkdirSync(dirname(resolve(output)),{recursive:true});
 const encoded=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',wav,'-codec:a','libmp3lame','-q:a','4','-metadata','title=Spring Garden','-metadata','comment=Original invitation instrumental; procedurally synthesized, no samples',resolve(output)],{encoding:'utf8'});
 if(encoded.error) throw encoded.error;if(encoded.status!==0)throw new Error(encoded.stderr);
 console.log(JSON.stringify({output:resolve(output),durationSeconds:length/rate,bpm,meter:'3/4',key:'G major',bytes:readFileSync(resolve(output)).length,peakBeforeEncoding:.32}));
} finally {rmSync(temporary,{recursive:true,force:true});}

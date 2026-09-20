// Turns 대전광역시_시내버스 기반정보 (data.go.kr, EUC-KR CSV) into public/data/bus-stops.json.
//
// The file is a stop register, not a route register: it does not say which services are low-floor.
// What it does carry is every stop in the city with a coordinate, and whether each one has a
// 버스안내단말기 — the display that tells you when the next bus arrives. That display is the
// difference between waiting with information and waiting without it, which matters most to the
// people this app is for.
//
// Usage: node scripts/build-bus-stops.mjs [path-to-csv]
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';

const given=process.argv[2];
const found=given??readdirSync('.').find(f=>/시내버스 기반정보.*\.csv$/i.test(f));
if(!found){console.error('CSV를 찾지 못했어요. 경로를 인자로 넘겨 주세요.');process.exit(1);}

// Public data portal files come out of Excel in the Windows Korean codepage, not UTF-8.
const text=new TextDecoder('euc-kr').decode(readFileSync(found));
const lines=text.split(/\r?\n/).filter(line=>line.trim());
const header=lines[0].split(',').map(h=>h.trim());
const at=name=>{
 const index=header.indexOf(name);
 if(index<0)throw Error(`열을 찾지 못했어요: ${name} (있는 열: ${header.join(', ')})`);
 return index;
};
const col={
 id:at('정류장 코드'),name:at('정류장명'),district:at('시군구명'),dong:at('읍면동명'),
 display:at('버스안내단말기 설치유무'),lat:at('와이좌표'),lon:at('엑스좌표'),
};

// Daejeon's bounding box, same one the route engine uses. Two rows in the 2025-04 file fall outside
// it; a stop with no usable coordinate cannot be drawn or routed to, so it is left out rather than
// placed somewhere wrong.
const inside=(lon,lat)=>lon>127.21&&lon<127.58&&lat>36.15&&lat<36.54;

let skipped=0;
const stops=[];
for(const line of lines.slice(1)){
 const cells=line.split(',');
 const lon=Number(cells[col.lon]),lat=Number(cells[col.lat]);
 if(!Number.isFinite(lon)||!Number.isFinite(lat)||!inside(lon,lat)){skipped++;continue;}
 stops.push({
  id:String(cells[col.id]).trim(),
  name:String(cells[col.name]).trim(),
  district:String(cells[col.district]).trim(),
  dong:String(cells[col.dong]).trim(),
  // 'O' means the arrival display is installed. Anything else is recorded as not installed, which
  // is what the file says — not that the stop is unusable.
  arrivalDisplay:String(cells[col.display]).trim()==='O',
  lon,lat,
 });
}

const withDisplay=stops.filter(s=>s.arrivalDisplay).length;
const snapshot={
 source:'대전광역시_시내버스 기반정보 · 공공데이터포털',
 note:'정류장 등록 자료입니다. 노선별 저상버스 여부는 이 파일에 없습니다.',
 collectedAt:new Date().toISOString().slice(0,10),
 counts:{stops:stops.length,arrivalDisplay:withDisplay,noArrivalDisplay:stops.length-withDisplay,skipped},
 stops:stops.sort((a,b)=>a.name.localeCompare(b.name,'ko')),
};

mkdirSync('public/data',{recursive:true});
writeFileSync('public/data/bus-stops.json',JSON.stringify(snapshot));
console.log(`저장: public/data/bus-stops.json (${found})`);
console.log(JSON.stringify(snapshot.counts,null,1));

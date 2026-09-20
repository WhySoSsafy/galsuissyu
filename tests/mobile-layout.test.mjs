// The phone layout cannot be opened in this environment, so the rules it depends on are asserted
// against the stylesheets directly. These are the ones whose absence silently breaks a phone.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';

const css=readdirSync('src').filter(f=>f.endsWith('.css')).map(f=>readFileSync('src/'+f,'utf8')).join('\n');

function mobileBlocks(source){
 let out='';
 const re=/@media\s*\([^)]*max-width:\s*740px[^)]*\)\s*\{/g;
 let m;
 while((m=re.exec(source))){
  let i=re.lastIndex,depth=1;
  while(i<source.length&&depth){if(source[i]==='{')depth++;else if(source[i]==='}')depth--;i++;}
  out+=source.slice(re.lastIndex,i);
 }
 return out;
}
const mobile=mobileBlocks(css);

test('every panel the desktop gained is also placed on a phone',()=>{
 for(const cls of ['.dj-detail-pane','.dj-detail-head','.dj-detail-scroll','.dj-detail-actions','.dj-panel-tabs','.dj-place-main','.dj-row-actions','.dj-place-symbol'])
  assert.ok(mobile.includes(cls),cls+' has no rule inside a max-width:740px block');
});

test('the detail card is not left pinned to a desktop offset',()=>{
 const desktop=/\.daejeon-app:not\(\.panel-collapsed\)\s*\.dj-detail-pane\{[^}]*left:\s*444px/.test(css);
 assert.ok(desktop,'the desktop offset should still exist');
 const block=mobile.slice(mobile.indexOf('.dj-detail-pane'));
 const rule=block.slice(0,block.indexOf('}'));
 assert.match(rule,/left:\s*10px/,'the phone rule must override the 444px offset');
 assert.match(rule,/right:\s*10px/);
 assert.match(rule,/max-width:\s*none/);
});

test('picking an endpoint still shows what was searched',()=>{
 // Route mode hides the browse list. Without the override, a destination typed on a phone would
 // produce results that exist in the DOM and are invisible on screen.
 const hides=/\.mobile-route\s+\.dj-browse-results[^{]*\{[^}]*display:\s*none/.test(css);
 assert.ok(hides,'route mode is expected to hide the browse list');
 const restores=/\.is-picking\.mobile-route\s+\.dj-browse-results[^{]*\{[^}]*display:\s*block/.test(mobile);
 assert.ok(restores,'picking an endpoint must bring the browse list back');
});

test('the phone nav drives the same panel switch the rail does',()=>{
 const tsx=readFileSync('src/CityExplorer.tsx','utf8');
 const nav=tsx.slice(tsx.indexOf('dj-mobile-nav'));
 const bar=nav.slice(0,nav.indexOf('</nav>'));
 assert.equal((bar.match(/setPanelMode\('search'\)/g)||[]).length,2,'지도 and 검색 both return to the search side');
 assert.ok(bar.includes("setPanelMode('route')"),'길찾기 must switch the panel, not only the mobile mode');
});

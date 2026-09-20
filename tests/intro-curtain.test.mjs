// The opening is the first thing anyone sees and the film that belongs in it does not exist yet, so
// these pin the contract the placeholder is standing in for.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

const intro = readFileSync('src/IntroCurtain.tsx', 'utf8');
const explorer = readFileSync('src/CityExplorer.tsx', 'utf8');
const css = readFileSync('src/experience.css', 'utf8');

test('a film dropped in at the documented path is used without a code change', () => {
  assert.match(intro, /const VIDEO='\/assets\/intro\.mp4'/);
  assert.ok(existsSync('public/assets/INTRO.md'), 'the swap has to be written down for whoever makes the film');
  const doc = readFileSync('public/assets/INTRO.md', 'utf8');
  assert.ok(doc.includes('intro.mp4'), 'the document names the file it is asking for');
});

test('a missing or unplayable film falls through to the placeholder', () => {
  assert.match(intro, /onError=\{\(\)=>setHasFilm\(false\)\}/);
  assert.match(intro, /el\.play\(\)\.catch\(\(\)=>setHasFilm\(false\)\)/, 'a refused autoplay must not leave a dead screen');
  assert.match(intro, /\{!hasFilm&&/, 'the placeholder renders in its place');
});

test('the film is muted and inline, because a browser blocks one that is not', () => {
  assert.match(intro, /muted/);
  assert.match(intro, /playsInline/);
});

test('the call to action waits for the end, and can always be reached early', () => {
  assert.match(intro, /onEnded=\{\(\)=>setDone\(true\)\}/);
  assert.match(intro, /intro-skip/, 'there is a way past it');
  assert.match(intro, /onSimulate/);
  assert.match(intro, /onExplore/);
});

test('dismissing it is remembered, and 마이 can bring it back', () => {
  assert.match(explorer, /localStorage\.setItem\('galsuissyu-intro-seen','1'\)/);
  assert.match(explorer, /localStorage\.removeItem\('galsuissyu-intro-seen'\)/, 'the replay path clears the flag');
  assert.match(explorer, /onReplayIntro=/);
});

test('the opening does not collide with the first-visit survey', () => {
  // Two full-screen things at once would fight; the survey waits for the curtain to lift.
  assert.match(explorer, /if\(wantSurvey&&coverage&&!intro\)/);
});

test('reduced motion is honoured', () => {
  assert.match(intro, /prefers-reduced-motion: reduce/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.intro-route/);
});

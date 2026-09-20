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

test('only a real media error falls through to the placeholder', () => {
  assert.match(intro, /onError=\{\(\)=>setHasFilm\(false\)\}/, 'a broken or missing file gives up');
  assert.match(intro, /\{!hasFilm&&/, 'the placeholder renders in its place');
});

test('a refused autoplay is retried, not treated as a missing film', () => {
  // A tab opened in the background refuses play() every time. Giving up on it swapped the film for
  // the placeholder on exactly the visit that matters most.
  assert.ok(!/play\(\)\.catch\(\(\)=>setHasFilm\(false\)\)/.test(intro), 'a refused play must not discard the film');
  assert.match(intro, /visibilitychange/, 'it should try again once the tab is looked at');
});

test('the film is muted and inline, because a browser blocks one that is not', () => {
  assert.match(intro, /muted/);
  assert.match(intro, /playsInline/);
});

test('the call to action waits for the end, and can always be reached early', () => {
  assert.match(intro, /onEnded=/, 'the end of the film is what reveals it');
  assert.match(intro, /currentTarget\.pause\(\)/, 'the last frame is held under the finale rather than cutting to black');
  assert.match(intro, /setDone\(true\)/);
  assert.match(intro, /intro-skip/, 'there is a way past it');
  assert.match(intro, /onSimulate/);
  assert.match(intro, /onExplore/);
});

test('dismissing it is remembered, and 마이 can bring it back', () => {
  assert.match(explorer, /localStorage\.setItem\('galsuissyu-intro-seen','1'\)/);
  assert.match(explorer, /history\.pushState\(null,'','\/intro'\)/, 'the replay path opens the film by its own address');
  assert.match(explorer, /onReplayIntro=/);
});

test('the opening does not collide with the first-visit survey', () => {
  // Two full-screen things at once would fight; the survey waits for the curtain to lift.
  assert.match(explorer, /if\(wantSurvey&&coverage&&!intro&&!showcase\)/,
    'and it must not cover the run someone was just sent into');
});

test('reduced motion is honoured', () => {
  assert.match(intro, /prefers-reduced-motion: reduce/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.intro-route/);
});

test('the finale arrives rather than stopping', () => {
  // The film used to end on a caption and hand over to bare buttons. It now darkens, resolves the
  // name out of the held frame, and lands the buttons last.
  assert.match(intro, /intro-dim/);
  assert.match(intro, /intro-wordmark/);
  assert.match(intro, /갈수있슈/);
  const css = readFileSync('src/experience.css', 'utf8');
  assert.match(css, /@keyframes intro-dim-in/);
  assert.match(css, /@keyframes intro-mark-in/);
  assert.match(css, /\.intro-actions\.is-ready \.intro-secondary\{[^}]*animation:intro-pop[^}]*\}/, 'the buttons land after the name');
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.intro-dim/, 'and none of it moves for anyone who asked it not to');
});

test('the chime is attempted but never required', () => {
  // A page nobody has touched is not allowed to make noise. It has to fail silently.
  assert.match(intro, /AudioContext/);
  assert.match(intro, /ctx\.state!=='running'/, 'a suspended context is dropped rather than forced');
  assert.match(intro, /catch\{/, 'and any refusal is swallowed');
});

test('the film has an address of its own', () => {
  // Without one there was no way back to it: a refresh always landed on the map, and replaying
  // meant clearing storage by hand.
  assert.match(explorer, /location\.pathname.*'\/intro'/, '/intro opens the film');
  assert.match(explorer, /has\('intro'\)/, 'and ?intro works where paths cannot be rewritten');
  assert.match(explorer, /popstate/, 'back and forward move between the two');
  assert.match(explorer, /history\.replaceState\(null,'','\/'\)/, 'leaving it puts the map in the address bar');
});

test('taking the run from the film clears the screen for it', () => {
  assert.match(explorer, /onSimulate=\{\(\)=>\{closeIntro\(\);runDemo\(true\);\}\}/);
  assert.match(explorer, /setPanelOpen\(!focused\);setShowcase\(focused\)/, 'the panel gets out of the way');
  const css = readFileSync('src/experience.css', 'utf8');
  assert.match(css, /\.daejeon-app\.is-showcase [^{]*\{display:none\}/, 'and so does the map furniture');
  assert.match(explorer, /showcase-exit/, 'with one way back to the app');
});

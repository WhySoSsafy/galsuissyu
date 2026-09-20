// The opening is the first thing anyone sees. These pin how it behaves: it waits to be started, it
// is heard when it is, it survives a browser that refuses either, and it ends somewhere.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

const intro = readFileSync('src/IntroCurtain.tsx', 'utf8');
const explorer = readFileSync('src/CityExplorer.tsx', 'utf8');
const css = readFileSync('src/experience.css', 'utf8');

test('a film dropped in at the documented path is used without a code change', () => {
  assert.match(intro, /const VIDEO='\/film\/intro\.mp4'/);
  assert.ok(existsSync('docs/INTRO-FILM.md'), 'the swap has to be written down for whoever makes the film');
  const doc = readFileSync('docs/INTRO-FILM.md', 'utf8');
  assert.ok(doc.includes('intro.mp4'), 'the document names the file it is asking for');
  assert.ok(doc.includes('public/film/'), 'and says where it goes');
});

test('the film is not served from the year-immutable path', () => {
  // It was, and it cost the whole opening in production. /assets/ is served
  // `max-age=31536000, immutable` for Vite's content-hashed bundles. intro.mp4 has a fixed name, so
  // a browser that requested it before it shipped got the SPA fallback — index.html — and cached
  // that HTML under this URL for a year. The <video> then failed with DEMUXER_ERROR_COULD_NOT_OPEN
  // and the placeholder stood in, on a URL no redeploy could ever correct.
  assert.ok(!intro.includes('/assets/intro'), 'the film has a path of its own');
  assert.ok(existsSync('public/film/intro.mp4'), 'and the file is there to be shipped');

  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const rule = (vercel.headers ?? []).find((h) => h.source.startsWith('/film/'));
  assert.ok(rule, 'the fixed-name film states its own cache policy');
  const cache = rule.headers.find((h) => h.key === 'Cache-Control').value;
  assert.ok(!cache.includes('immutable'), `a file whose name never changes cannot be immutable: ${cache}`);
  assert.match(cache, /must-revalidate/, 'a replacement film has to be able to reach people');
});

test('only a real media error falls through to the placeholder', () => {
  assert.match(intro, /onError=\{\(\)=>setHasFilm\(false\)\}/, 'a broken or missing file gives up');
  assert.match(intro, /\{!hasFilm&&/, 'the placeholder renders in its place');
});

test('the film waits for a press, which is what lets it be heard', () => {
  // A page nobody has touched may not make noise, so an autoplaying film would have to be silent.
  // The press on the gate is the gesture the browser wants.
  assert.match(intro, /intro-gate/, 'there is a gate in front of the film');
  assert.match(intro, /intro-play/, 'with something to press');
  assert.ok(!/<video[^>]*autoPlay/.test(intro), 'the film must not start on its own');
  assert.match(intro, /el\.muted=false;/, 'and it starts with its sound');
  assert.match(intro, /playsInline/, 'inline, so a phone does not take it fullscreen');
});

test('a browser that still refuses sound plays the film anyway', () => {
  assert.match(intro, /el\.muted=true;setMuted\(true\)/, 'it falls back to silent rather than to nothing');
  assert.match(intro, /intro-sound/, 'and the control reports what actually happened');
});

test('the gate offers a way past the film', () => {
  assert.match(intro, /intro-gate-skip/);
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

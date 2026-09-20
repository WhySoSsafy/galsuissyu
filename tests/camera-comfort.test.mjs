// This app is used by people managing dizziness, so the camera's own motion is part of the product,
// not decoration. These pin the choices that keep it watchable.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source = readFileSync('src/DaejeonMap.tsx', 'utf8');
const followLoop = (() => {
  const from = source.indexOf('const tick=(now:number)=>{');
  const to = source.indexOf('frame=requestAnimationFrame(tick);', from);
  return source.slice(from, to).replace(/\/\/.*$/gm, '');
})();

test('the camera never rotates with the traveller', () => {
  // Turning the world while it moves under the viewer is a standard trigger for motion sickness.
  // Framing may change between legs; the bearing the viewer chose may not.
  assert.ok(!/bearing/.test(followLoop), 'the follow loop must not touch bearing');
});

test('zoom and tilt ease more slowly than the camera tracks position', () => {
  // Position has to keep up with the traveller. Everything else changing at that rate is what
  // makes a run lurch, so those are damped.
  assert.match(followLoop, /const slow=blend\*\.(\d+)/, 'a slower rate should exist for framing');
  const rate = Number('0.' + followLoop.match(/const slow=blend\*\.(\d+)/)[1]);
  assert.ok(rate > 0 && rate < 0.5, `framing should ease well under the tracking rate, got ${rate}`);
  assert.match(followLoop, /pitch\+\(targetPitch-pitch\)\*slow/);
  assert.match(followLoop, /zoom\+\(targetZoom-zoom\)\*slow/);
});

test('the tilt stays within a narrow band', () => {
  // A big pitch swing reads as the ground tipping. Boarding leans in a little; that is the limit.
  const pitches = [...source.matchAll(/targetPitch=boarding\?(\d+):(\d+)/g)][0];
  assert.ok(pitches, 'boarding and cruising pitches should be stated together');
  const [, boarding, cruising] = pitches.map(Number);
  assert.ok(Math.abs(boarding - cruising) <= 6, `tilt swing of ${Math.abs(boarding - cruising)}° is too much`);
});

test('reduced motion is honoured by the panels that animate', () => {
  const css = readFileSync('src/experience.css', 'utf8');
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{[^}]*\.dj-detail-pane\{animation:none\}/);
});

// The first thing a visitor is asked to do. It was four steps of text: you had to read each one to
// find out what it wanted, the box resized under the cursor between them, and the opening step
// stated a figure nobody had context for yet. These pin the shape it was rebuilt into.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const survey = readFileSync('src/MobilitySurvey.tsx', 'utf8');
const explorer = readFileSync('src/CityExplorer.tsx', 'utf8');
const css = readFileSync('src/experience.css', 'utf8');

test('every question is recognisable before it is read', () => {
  // Each step carries its own picture beside the title, and each option is a card with one.
  const steps = survey.match(/image:'step-[a-z]+'/g) ?? [];
  assert.equal(steps.length, 3, 'three steps, three title images');
  assert.match(survey, /survey-head-art/);
  assert.match(css, /\.survey-head-art\{/);
});

test('the last step has pictures like the others', () => {
  // It was the one screen made of bare checkboxes.
  assert.match(survey, /surfaceChoices/);
  assert.match(survey, /image:'slope'/);
  assert.match(survey, /image:'surface'/);
  assert.ok(!survey.includes('type="checkbox"'), 'no step is a checkbox list any more');
  assert.ok(!survey.includes('survey-refine'));
});

test('the box does not resize between questions', () => {
  const rule = css.slice(css.indexOf('.mobility-survey{'), css.indexOf('}', css.indexOf('.mobility-survey{')));
  assert.match(rule, /height:min\(/, 'one fixed height for every step');
  assert.match(css, /\.survey-body\{[^}]*flex:1/, 'the question area absorbs the difference');
});

test('the questions are not crowded by asides', () => {
  for (const line of ['고르지 않아도 괜찮아요', '선택은 이 기기에 저장돼요', '소개 영상 다시 보기',
                      '서두르지 않아도 괜찮아요', '나의 속도로 만나는 대전']) {
    assert.ok(!survey.includes(line), `"${line}" was noise around the question`);
  }
});

test('the opening figure moved to where it makes sense', () => {
  // "대전의 길은 아직 기록되지 않았어요" was the first thing anyone saw, before they knew what the
  // app did. The number itself still matters, so it sits with the rest of the sourcing.
  assert.ok(!survey.includes('coverage'), 'the survey no longer opens on it');
  assert.match(explorer, /dj-coverage/, 'the panel states it beside the places it counts');
  assert.match(explorer, /coverage\.documented\.toLocaleString\(\)/);
  assert.match(explorer, /coverage\.snapshot/, 'with its source and date');
});

test('the art panel faces the questions', () => {
  assert.match(survey, /art\('family'\)/, 'a family, not one person alone');
  assert.match(css, /\.survey-art\{/);
});

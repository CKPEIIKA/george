import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STRINGS, t, setLanguage, translateMessage } from '../web/src/i18n.js';
import { readPreferences, savePreferences, applyTheme } from '../web/src/preferences.js';
import { TUTORIALS, tutorialForm } from '../web/src/tutorials.js';
import { guideHTML, GUIDE_SOURCES } from '../web/src/guide.js';
import { TASKS, ORDERS, FAMILIES, buildJob } from '../web/src/bergman-syntax.js';
import { EXAMPLES } from '../web/src/examples.js';

test('every static and dynamic interface key has an EN/RU translation', () => {
  assert.equal(STRINGS.en['brand.subPrefix']+STRINGS.en['brand.more'], 'an interface to bergman and more…');
  assert.equal(STRINGS.ru['brand.subPrefix']+STRINGS.ru['brand.more'], 'интерфейс к bergman и не только…');
  assert.deepEqual(Object.keys(STRINGS.en).sort(), Object.keys(STRINGS.ru).sort());
  const html = fs.readFileSync('web/index.html', 'utf8');
  const keys = [...html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)].map(m => m[1]);
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g)) for (const pair of m[1].split(';')) keys.push(pair.split(':')[1]);
  const app = ['app','console'].map(n=>fs.readFileSync(`web/src/${n}.js`, 'utf8')).join('\n');
  for (const m of app.matchAll(/\bt\('([^']+)'(?=[,)])/g)) keys.push(m[1]);
  for (const task of TASKS) for (const suffix of ['', '.d', '.b']) keys.push(`task.${task.id}${suffix}`);
  for (const order of Object.values(ORDERS).flat()) keys.push('order.' + order.id);
  for (const id of Object.keys(FAMILIES)) keys.push('fam.' + id);
  for (const example of EXAMPLES) keys.push('ex.' + example.id);
  for (const key of keys) for (const lang of ['en', 'ru']) assert.ok(STRINGS[lang][key], `${lang}: ${key}`);
});

test('localization interpolates errors without changing parser input', () => {
  setLanguage('ru');
  assert.match(t('status.done', { seconds: '0,01' }), /0,01 с/);
  assert.match(translateMessage('“hello” is not one of the generators'), /hello.*образующ/);
  assert.match(translateMessage('The modulus must be a prime at most 2147483647.'), /простым/);
  assert.equal(translateMessage('***** original Lisp diagnostic'), '***** original Lisp diagnostic');
  setLanguage('invalid');
  assert.equal(t('nav.guide'), 'User guide');
});

test('preferences tolerate blocked storage and validate stored values', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.deepEqual(readPreferences(blocked, 'ru-RU'), { language: 'ru', theme: 'auto' });
  assert.doesNotThrow(() => savePreferences(blocked, { language: 'en', theme: 'dark' }));
  assert.deepEqual(readPreferences({ getItem: () => '{invalid' }, 'en'), { language: 'en', theme: 'auto' });
  assert.deepEqual(readPreferences({ getItem: () => '{"language":"fr","theme":"purple"}' }, 'en'), { language: 'en', theme: 'auto' });
  const root = { dataset: {} };
  applyTheme('dark', root); assert.equal(root.dataset.theme, 'dark');
  applyTheme('light', root); assert.equal(root.dataset.theme, 'light');
  applyTheme('auto', root); assert.equal(root.dataset.theme, undefined);
});

test('both guides contain equations, source references and all shared examples', () => {
  for (const lang of ['en', 'ru']) {
    const guide = guideHTML(lang);
    assert.match(guide, /id="guideTitle"/);
    assert.match(guide, /\\operatorname\{rank\}/);
    assert.match(guide, /homology\.json/);
    for (const item of TUTORIALS) assert.ok(guide.includes(`data-tutorial="${item.id}"`));
    for (const [source] of GUIDE_SOURCES) { assert.ok(fs.existsSync('vendor/bergman-1.001/' + source), source); assert.ok(guide.includes(source)); }
  }
});

test('guided examples build valid deterministic production jobs', () => {
  assert.equal(TUTORIALS.length, 13);
  for (const item of TUTORIALS) {
    const form = tutorialForm(item.id);
    assert.equal(form.legacy, false);
    assert.ok(buildJob(form).script, item.id);
    assert.deepEqual(tutorialForm(item.id), form);
  }
  assert.equal(tutorialForm('monoid').augmentation, 'monoid');
  assert.equal(tutorialForm('nonhomogeneous').augmentation, 'graded');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { tokenize, balance, matchAt, symbolBefore, enclosingHead, complete, indentAt } from '../web/src/lisp.js';
import { COMMANDS, COMPLETIONS, expandShortcut, parseHelp, parseHelpTexts } from '../web/src/console-commands.js';
import { highlight } from '../web/src/console.js';

test('the reader follows bergman syntax: % comments, ! escapes, strings', () => {
  const types = (s) => tokenize(s).filter((t) => t.type !== 'space').map((t) => t.type);
  assert.deepEqual(types('(a "x)" 12) % c)'), ['open', 'symbol', 'string', 'number', 'close', 'comment']);
  assert.deepEqual(types('(a!) b)'), ['open', 'symbol', 'symbol', 'close']);
  assert.deepEqual(types("'(x)"), ['quote', 'open', 'symbol', 'close']);
});

test('balance reports open, stray and unterminated input', () => {
  assert.equal(balance('(setmaxdeg 5)').complete, true);
  assert.equal(balance('(list 1 (+ 2').open, 2);
  assert.deepEqual(balance('(a))').stray, [3]);
  assert.equal(balance('(show "a)').unterminated, true);
  assert.equal(balance('% only a comment').empty, true);
  assert.equal(balance('(a ")" ; )\n)').complete, true);
});

test('bracket matching, completion context and indentation', () => {
  const src = '(list 1 (+ 2 3))';
  assert.deepEqual(matchAt(src, 8), [8, 14]);
  assert.deepEqual(matchAt(src, 16), [15, 0]);
  assert.equal(matchAt(src, 3), null);
  assert.deepEqual(symbolBefore('(setm)', 5), { start: 1, text: 'setm' });
  assert.equal(symbolBefore('(setm)', 3), null);
  assert.equal(enclosingHead('(setmaxdeg (+ 1 ', 16), '+');
  assert.equal(enclosingHead('(setmaxdeg (+ 1 ', 16, undefined, (n) => n !== '+'), 'setmaxdeg');
  assert.equal(complete('setma', COMPLETIONS), 'setmaxdeg');
  assert.equal(complete('SIMP', COMPLETIONS), 'simple');
  assert.equal(complete('s', COMPLETIONS), null);
  assert.equal(indentAt('(a (b', 5), '    ');
});

test('help and shortcuts are recognised', () => {
  assert.deepEqual(parseHelp('(help)'), { name: null });
  assert.deepEqual(parseHelp('(HELP SetMaxDeg)'), { name: 'setmaxdeg' });
  assert.deepEqual(parseHelp('?simple'), { name: 'simple' });
  assert.equal(parseHelp('(helpme)'), null);
  assert.match(expandShortcut('(files)'), /cl:directory/);
  assert.match(expandShortcut('(show "out.gb")'), /with-open-file \(s "out.gb"\)/);
  assert.equal(expandShortcut('(show out.gb)'), null);
});

test('every catalogued command is defined by bergman or George', () => {
  const roots = ['vendor/bergman-1.001/src', 'vendor/bergman-1.001/auxil', 'ports/common'];
  const files = roots.flatMap((r) => fs.readdirSync(r, { recursive: true }).map((f) => `${r}/${f}`))
    .filter((f) => /\.(sl|lsp)$/.test(f) && fs.statSync(f).isFile());
  const text = files.map((f) => fs.readFileSync(f, 'latin1')).join('\n').toLowerCase();
  for (const c of COMMANDS) {
    if (['help', 'files', 'show'].includes(c.name)) continue;
    const name = c.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(text, new RegExp(`\\((de|df|dm|defun|defmacro|definesw\\w*|copyd) +'?${name}[\\s)(]`), c.name);
    assert.ok(c.en && c.ru && c.ex.startsWith(`(${c.name}`), c.name);
  }
});

test("bergman's help file parses into topics, and the web copy is unmodified", () => {
  const text = fs.readFileSync('vendor/bergman-1.001/doc/helptexts', 'latin1');
  assert.equal(fs.readFileSync('web/vendor/bergman/helptexts', 'latin1'), text);
  const topics = parseHelpTexts(text);
  assert.ok(topics.size >= 55);
  assert.match(topics.get('setmodulus'), /modulus|characteristic/i);
  assert.ok(!topics.has('nil'));
});

test('highlighting escapes the source and marks the matching pair', () => {
  const html = highlight('(show "<b>")', { cursor: 0 });
  assert.ok(!html.includes('<b>'));
  assert.equal((html.match(/br-pair/g) || []).length, 2);
  assert.match(highlight('(setm)', { cursor: 5, ghost: 'axdeg' }), /setm<span class="ghost">axdeg<\/span>/);
});

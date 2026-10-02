import test from 'node:test';
import assert from 'node:assert/strict';
import {mathClipboardText} from '../web/src/math-copy.js';

const text=value=>({nodeType:3,textContent:value});
const element=(tag,children,source=null)=>({nodeType:1,tagName:tag.toUpperCase(),childNodes:children,
  textContent:children.map(node=>node.textContent).join(''),getAttribute:name=>name==='data-math-source'?source:null});
test('copying typeset math keeps carets and separates compact rows',()=>{
  const a=element('span',[text('a'),element('sup',[text('2')])]);
  const b=element('span',[text('b'),element('sup',[text('12')])]);
  const list=element('ol',[element('li',[a]),element('li',[b])]);
  assert.equal(mathClipboardText(list).trim(),'a^2,\nb^12,');
});
test('complete expressions copy source syntax, while partial expressions retain selection',()=>{
  const sources=new Map([['a*b-a^2','ab−a2']]);
  const whole=element('span',[text('ab−a'),element('sup',[text('2')])],'a*b-a^2');
  assert.equal(mathClipboardText(whole,sources),'a*b-a^2');
  const partial=element('span',[text('a'),element('sup',[text('2')])],'a*b-a^2');
  assert.equal(mathClipboardText(partial,sources),'a^2');
});

// Reproducible quadratic FK6-shaped presentation over Q.
import {fominKirillov} from './fomin-kirillov.mjs';
import {parseRelation,toBergman} from '../../web/src/bergman-syntax.js';
export function randomBigForm(seed = 0x47423036) {
  if (!Number.isInteger(seed)) throw new TypeError('Seed must be an integer.');
  let state = seed >>> 0;
  const random = () => {state = (state + 0x6d2b79f5) >>> 0; let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;};
  const vars = ['a','b','c','d','e','f','g','h','k','m','n','p','q','r','s'];
  const fk=fominKirillov(6),names=new Map(fk.vars.map((v,i)=>[v,vars[i]]));
  const coefficients=[-2,-1,1,2];
  const rels=fk.rels.map(source=>toBergman(parseRelation(source,fk.vars).map((term,index)=>{
    const coefficient=index===0?1:coefficients[Math.floor(random()*coefficients.length)];
    return {...term,sign:coefficient<0?-1:1,coef:String(Math.abs(coefficient)),factors:term.factors.map(f=>({...f,v:names.get(f.v)}))};
  })));
  return {description:'Fixed-seed random FK6-shaped presentation: 15 generators, 15 squares, 45 disjoint-pair binomials and 40 oriented-triangle trinomials. First listed term has coefficient 1; other coefficients sampled independently from {-2,-1,1,2} over Q. Canonical FK6 monomial supports are preserved.',
    generator:'test/support/random-big-form.mjs', seed:seed >>> 0, construction:'random-FK6-shaped-coefficients',
    inputText:`vars ${vars.join(',')};\n${rels.join(',')};\n`};
}

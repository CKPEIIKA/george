import assert from 'node:assert/strict';import {rationalTerms} from '../tools/oracle-format.mjs';
assert.deepEqual(rationalTerms('1/2*x*y-17/3*y^2+x',['x','y']),[
 {numerator:1n,denominator:2n,word:['x','y']},{numerator:-17n,denominator:3n,word:['y','y']},{numerator:1n,denominator:1n,word:['x']}]);
assert.deepEqual(rationalTerms('0',['x']),[]);
for(const s of ['1/0*x','x;quit','x++x','z','2**x','1/(2)*x','x+'])assert.throws(()=>rationalTerms(s,['x']));
console.log('Exact Singular interchange parsing passed');

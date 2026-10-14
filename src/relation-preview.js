// Display grouping preserves each relation's original input position.
export function groupRelations(rows) {
  const groups=new Map();
  for(const row of rows){
    const count=row.termCount??'error';
    if(!groups.has(count))groups.set(count,[]);
    groups.get(count).push(row);
  }
  return [...groups].sort(([a],[b])=>a===b?0:a==='error'?1:b==='error'?-1:a-b)
    .map(([termCount,relations])=>({termCount,relations}));
}

// Basis rows can contain rational coefficients and long powers.
export function polynomialTermCount(source) {
  let count = 0, depth = 0, atStart = true;
  for (const character of source.replace(/\s/g, '')) {
    if (character === '(') depth++;
    else if (character === ')') depth--;
    else if ((character === '+' || character === '-') && depth === 0) {
      if (!atStart) { count++; atStart = true; }
      continue;
    }
    atStart = false;
  }
  return count + (atStart ? 0 : 1);
}

// SPDX-License-Identifier: MIT
export function renderMonomialPoincare(container,result,translate){
  const defaults={
    'series.monomialPB':'Poincaré–Betti series of the associated monomial algebra',
    'series.monomialPBHint':'Exact for the leading-word monomial algebra; upper bounds for the original algebra’s Betti numbers. Original differentials and a minimal resolution have not been computed.',
    'series.internalDegree':'Internal degree','series.homologicalDegree':'Homological degree','series.monomialBetti':'Monomial Betti number','series.monomialPBRange':'Internal degrees 0..{d}; z = homological degree, t = internal degree.','series.monomialPBPreview':'Showing the first 512 nonzero coefficients; complete table in poincare.json and poincare.csv.'
  };
  const tr=(key,args={})=>translate?translate(key,args):defaults[key].replace(/\{(\w+)\}/g,(_,name)=>String(args[name]));
  const title=document.createElement('h3');title.textContent=tr('series.monomialPB');container.append(title);
  const note=document.createElement('p');note.textContent=result.available?tr('series.monomialPBHint'):'Poincaré–Betti output unavailable: '+result.error;container.append(note);
  if(!result.available)return;
  const bound=document.createElement('p');bound.textContent=tr('series.monomialPBRange',{d:result.certifiedThroughDegree});container.append(bound);
  const wrap=document.createElement('div');wrap.className='table-wrap';const table=document.createElement('table');table.className='betti monomial-poincare';
  const head=document.createElement('thead'),hr=document.createElement('tr');
  for(const key of ['series.internalDegree','series.homologicalDegree','series.monomialBetti']){const th=document.createElement('th');th.scope='col';th.textContent=tr(key);hr.append(th);}head.append(hr);table.append(head);
  const body=document.createElement('tbody');
  for(const row of [...result.coefficients].sort((a,b)=>a.internal-b.internal||a.homological-b.homological).slice(0,512)){
    const tr=document.createElement('tr');for(const value of [row.internal,row.homological,row.dimension]){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}body.append(tr);
  }table.append(body);wrap.append(table);container.append(wrap);
  if(result.coefficients.length>512){const more=document.createElement('p');more.textContent=tr('series.monomialPBPreview');container.append(more);}
}

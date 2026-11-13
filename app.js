'use strict';
const page=({'benchmarks.html':'benchmarks','analysis.html':'analysis','download.html':'download'})[location.pathname.split('/').pop()]||'home';
document.querySelectorAll('[data-view]').forEach(e=>e.hidden=e.dataset.view!==page);
document.querySelectorAll('[data-page]').forEach(e=>{if(e.dataset.page===page){e.classList.add('active');e.setAttribute('aria-current','page')}});
document.title=({home:'EnzyArena · Enzyme evolution benchmarks',benchmarks:'Benchmarks · EnzyArena',analysis:'Paper & analysis · EnzyArena',download:'Download · EnzyArena'})[page];
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={kcat:'kcat',km:'Km','kcat/Km':'kcat/Km',Fitness:'Normalized fitness',DMS:'DMS score'};
const classes={'Zero-shot fitness':'fitness','Kinetic parameters':'kinetic',Stability:'stability','Binding affinity':'binding'};
let DATA,current=[];
function summary(records){
 if(!records.length)return null;
 const sorted=records.map(r=>r.r).sort((a,b)=>a-b), l=sorted.length;
 const w=records.reduce((s,r)=>s+r.n-3,0);
 return {pooled:Math.tanh(records.reduce((s,r)=>s+(r.n-3)*Math.atanh(Math.max(-.999999,Math.min(.999999,r.r))),0)/w),median:l%2?sorted[(l-1)/2]:(sorted[l/2-1]+sorted[l/2])/2,groups:l,n:records.reduce((s,r)=>s+r.n,0)};
}
function results(source,endpoint){return DATA.models.map(m=>({...m,...(summary(DATA.records.filter(r=>r.source===source&&r.endpoint===endpoint&&r.model===m.id))||{})})).filter(m=>m.groups)}
function rank(){
 const source=$('#source').value,endpoint=$('#endpoint').value,family=$('#family').value,metric=$('#metric').value;
 current=results(source,endpoint).filter(m=>family==='all'||m.group===family).sort((a,b)=>b[metric]-a[metric]||a.name.localeCompare(b.name));
 const groups=DATA.datasets.filter(d=>d.source===source&&d.endpoint===endpoint);
 $('#result-title').textContent=source+' / '+labels[endpoint];
 $('#result-info').textContent=`${current.length} models · ${groups.length} source groups · Ranked by ${metric==='pooled'?'Fisher-z pooled ρ':'median Spearman ρ'}`;
 $('#leaderboard tbody').innerHTML=current.length?current.map((m,i)=>`<tr><td class="rank">${String(i+1).padStart(2,'0')}</td><td class="modelname">${esc(m.name)}</td><td><span class="category ${classes[m.group]}">${esc(m.group)}</span></td><td class="num"><span class="score">${m.pooled.toFixed(3)}<span class="scorebar" aria-hidden="true"><i style="width:${Math.abs(m.pooled)*100}%;background:${m.pooled<0?'#a87564':'#2463ad'}"></i></span></span></td><td class="num">${m.median.toFixed(3)}</td><td class="num">${m.groups}</td><td class="num">${m.n.toLocaleString()}</td></tr>`).join(''):'<tr><td colspan="7">No eligible results for this selection. Try another endpoint or strategy.</td></tr>';
 $('#export').disabled=!current.length;
}
function compare(){
 const endpoint=$('#compare-endpoint').value;
 const sources=['Literature','BRENDA','SABIO-RK'],colors=['#2463ad','#38a3a0','#a5b7ca'];
 const maps=sources.map(s=>new Map(results(s,endpoint).map(m=>[m.id,m])));
 const order=DATA.models.filter(m=>maps.some(map=>map.has(m.id))).sort((a,b)=>(maps[0].get(b.id)?.pooled??-2)-(maps[0].get(a.id)?.pooled??-2));
 $('#comparison').innerHTML=order.map(m=>`<div class="compare-row"><div class="compare-name">${esc(m.name)}<small>${esc(m.group)}</small></div><div class="bars">${maps.map((map,i)=>{const r=map.get(m.id),v=r?.pooled;return `<div class="barrow" title="${sources[i]}: ${r?`${v.toFixed(3)}; ${r.groups} valid groups`:'not available'}"><div class="track" aria-hidden="true">${r?`<i style="left:${v<0?50+v*50:50}%;width:${Math.abs(v)*50}%;background:${colors[i]}"></i>`:''}</div><span><span class="sr-only">${sources[i]}: </span>${r?v.toFixed(3):'N/A'}</span></div>`}).join('')}</div></div>`).join('');
}
function catalog(){
 const query=$('#catalog-search').value.toLowerCase().trim();
 const list=DATA.datasets.filter(d=>[d.source,d.name,d.reference,labels[d.endpoint],d.ec].join(' ').toLowerCase().includes(query));
 $('#catalog-count').textContent=`${list.length} of ${DATA.datasets.length} groups · Record counts refer to the experimental Value vector.`;
 $('#catalog').innerHTML=list.length?list.map(d=>`<tr><td>${esc(d.source)}</td><td>${esc(d.name)}</td><td>${esc(labels[d.endpoint])}</td><td class="num">${d.n}</td><td>${esc(d.reference||'—')}</td><td class="num">${d.row}</td></tr>`).join(''):'<tr><td colspan="6">No matching groups. Try a different search.</td></tr>';
}
async function init(){
 try{const response=await fetch('benchmark-data.json');if(!response.ok)throw new Error('Data unavailable');DATA=await response.json();
 if(page==='benchmarks'){
  const requested=new URLSearchParams(location.search).get('source');if(['BRENDA','SABIO-RK','Literature'].includes(requested))$('#source').value=requested;
  ['source','endpoint','family','metric'].forEach(id=>$('#'+id).addEventListener('change',rank));rank();
  $('#export').addEventListener('click',()=>{const source=$('#source').value,endpoint=$('#endpoint').value;const rows=[['source','endpoint','rank','model','strategy','fisher_z_pooled_rho','median_rho','valid_groups','paired_records','source_commit'],...current.map((m,i)=>[source,endpoint,i+1,m.name,m.group,m.pooled.toFixed(8),m.median.toFixed(8),m.groups,m.n,DATA.source_commit])];const blob=new Blob([rows.map(r=>r.map(c=>'"'+String(c).replaceAll('"','""')+'"').join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`EnzyArena-${source}-${endpoint.replace('/','-')}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
 }
 if(page==='analysis'){
  $('#compare-endpoint').addEventListener('change',compare);compare();
  $('#copy-citation').addEventListener('click',async()=>{const bib='@article{zeng2026enzyarena,\n  title={Benchmarking and Experimental Validation of Machine Learning Strategies for Enzyme Engineering},\n  author={Zeng, Zishuo and Jin, Jiao and Xu, Rufang and Wu, Yuzhen and Luo, Xiaozhou},\n  journal={Journal of Chemical Information and Modeling},\n  year={2026},\n  doi={10.1021/acs.jcim.6c01200}\n}';try{await navigator.clipboard.writeText(bib);$('#copy-status').textContent='BibTeX copied.'}catch{$('#copy-status').textContent=bib;$('#copy-status').style.whiteSpace='pre-wrap'}});
 }
 if(page==='download'){
  $('#downloads').innerHTML=DATA.files.map(f=>`<article class="downloadrow"><div><h3>${esc(f.source)}</h3><p>${f.rows} experimental groups · ${(f.bytes/1024/1024).toFixed(2)} MB · CSV</p><p>${esc(f.name)}</p></div><a class="button" href="https://raw.githubusercontent.com/zishuozeng/EnzyArena/${DATA.source_commit}/${f.name}">Download CSV ↓</a></article>`).join('');
  $('#catalog-search').addEventListener('input',catalog);catalog();
 }
 }catch(error){$('#load-error').hidden=false;console.error('Benchmark data unavailable',error)}
}
init();

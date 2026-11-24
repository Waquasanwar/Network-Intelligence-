(function(){
const $=(s)=>document.querySelector(s), NS='http://www.w3.org/2000/svg';
const el=(t,c,...kids)=>{const e=document.createElement(t);if(c)e.className=c;kids.forEach((k)=>{if(k!==undefined&&k!==null)e.append(k)});return e};
const sv=(t,a={},x)=>{const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);if(x!==undefined)e.textContent=x;return e};
const W=DATA.weekly,n=W.length,L=W[n-1],P=W[n-2],FC=6;
const dstr=(d)=>d.toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC'});
const day=(s)=>dstr(new Date(s)),ahead=(j)=>dstr(new Date(new Date(L.week_ending).getTime()+j*7*864e5));
const f0=(v)=>Math.round(v).toLocaleString('en-GB'),f1=(v)=>v.toFixed(1),fx=(v,dec)=>dec?f1(v):f0(v);
const sgn=(v,d=0)=>(v>0?'+':v<0?'−':'')+Math.abs(v).toFixed(d);
const r1=(v)=>Math.round(v*10)/10,sum=(a,f)=>a.reduce((s,r)=>s+f(r),0),col=(k)=>W.map((r)=>r[k]);
const slope=(vals,k=6)=>{const a=vals.slice(-k),m=a.length,xm=(m-1)/2,ym=a.reduce((s,v)=>s+v,0)/m;let s=0,d=0;a.forEach((v,i)=>{s+=(i-xm)*(v-ym);d+=(i-xm)*(i-xm)});return s/d};
const streak=(vals)=>{let c=0;for(let i=vals.length-1;i>0;i--){if(vals[i]<vals[i-1])c++;else break}return c};
const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
let uid=0;

const S={open:W.map((r)=>r.open_critical+r.open_high),crit:col('open_critical'),sla:col('sla_pct'),mttr:col('mttr_critical_days'),opened:col('opened'),closed:col('closed'),
  inc:col('incidents'),mttd:col('mttd_minutes'),del:col('phish_delivered'),clk:col('phish_clicked'),rate:W.map((r)=>r1(r.phish_clicked/r.phish_delivered*100))};
const Q=DATA.soc;Object.assign(S,{alerts:Q.alerts,tri:Q.triaged,sevC:Q.critical,sevH:Q.high,fp:Q.false_positive_pct,mtta:Q.mtta_minutes,cont:Q.contain_hours,rsla:Q.response_sla_pct,oinc:Q.open_incidents});
const last=(a)=>a[a.length-1],prev=(a)=>a[a.length-2],chg=(a)=>r1(last(a)-prev(a));
const od=sum(DATA.owners,(r)=>r.overdue),newest=DATA.tools.map((t)=>t.extracted).sort().pop(),lateT=DATA.tools.filter((t)=>t.extracted<newest);
const tool=(name)=>DATA.tools.find((t)=>t.system===name);
const better=(t)=>t.value===t.previous?0:((t.better==='higher'?t.value>t.previous:t.value<t.previous)?1:-1);

function count(node,to,dec){node.textContent=fx(to,dec);return;const t0=performance.now();
  const step=(t)=>{const p=Math.min(1,(t-t0)/800),e=1-Math.pow(1-p,3);node.textContent=fx(to*e,dec);if(p<1)requestAnimationFrame(step);else node.textContent=fx(to,dec)};requestAnimationFrame(step)}
function deltaEl(c,betterDir,dec){const d=el('span','delta'+(c===0?'':((betterDir==='lower'?c<0:c>0)?' good':' bad')),sgn(c,dec?1:0));return d}
const seen=new Map();
const ro=new ResizeObserver((es)=>es.forEach((e)=>{const s=seen.get(e.target),w=Math.round(e.contentRect.width);if(s&&w&&w!==s.w){s.w=w;s.fn()}}));
function watch(box,fn){if(!seen.has(box)){seen.set(box,{w:Math.round(box.clientWidth),fn});ro.observe(box)}}
function spark(box,vals,color){
  const draw=()=>{box.replaceChildren();const w=Math.max(60,box.clientWidth),h=44,lo=Math.min(...vals),hi=Math.max(...vals),id='g'+(++uid);
    const x=(i)=>3+i*(w-9)/(vals.length-1),y=(v)=>h-7-(hi===lo?.5:(v-lo)/(hi-lo))*(h-14),pts=vals.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    const s=sv('svg',{viewBox:`0 0 ${w} ${h}`,width:'100%',height:h,role:'img','aria-label':`Trend over ${vals.length} weeks, from ${vals[0]} to ${last(vals)}`}),d=sv('defs'),g=sv('linearGradient',{id,x1:0,y1:0,x2:0,y2:1});
    g.append(sv('stop',{offset:'0','stop-color':color,'stop-opacity':.35}),sv('stop',{offset:'1','stop-color':color,'stop-opacity':0}));d.append(g);
    s.append(d,sv('path',{d:`M${pts.join('L')}L${x(vals.length-1)},${h}L${x(0)},${h}Z`,fill:`url(#${id})`}),sv('path',{d:`M${pts.join('L')}`,fill:'none',stroke:color,'stroke-width':2,'stroke-linejoin':'round','stroke-linecap':'round',pathLength:1,class:'draw'}),sv('circle',{cx:x(vals.length-1),cy:y(last(vals)),r:3.5,fill:color}));box.append(s)};
  draw();watch(box,draw)}
function nice(v){const p=Math.pow(10,Math.floor(Math.log10(v))),f=v/p;for(const s of[1,1.5,2,2.5,3,4,5,6,8,10])if(f<=s)return s*p;return 10*p}
function outlier(vals){const m=vals.reduce((a,b)=>a+b,0)/vals.length,sd=Math.sqrt(vals.reduce((a,b)=>a+(b-m)*(b-m),0)/vals.length);let k=-1,z=2;vals.forEach((v,i)=>{const s=(v-m)/sd;if(s>z){z=s;k=i}});return k}

/* chart: lines/areas, stacked areas or paired bars; fc = weeks of straight-line projection drawn dashed */
function chart(box,cfg){
  if(!cfg.onPick)cfg.onPick=(i)=>weekDrill(cfg,cfg.title||cfg.label,i);
  const fc=cfg.fc||0,N=n+fc,dec=cfg.dec,lo=cfg.clamp?cfg.clamp[0]:0,hi=cfg.clamp?cfg.clamp[1]:Infinity;
  const proj=cfg.series.map((q)=>{const b=slope(q.vals),a=[];for(let j=1;j<=fc;j++)a.push(Math.min(hi,Math.max(lo,last(q.vals)+b*j)));return a});
  const date=(i)=>i<n?day(W[i].week_ending):ahead(i-n+1);
  const draw=()=>{
    box.replaceChildren();
    const w=Math.max(280,box.clientWidth),h=cfg.h||250,m={l:40,r:cfg.end||fc?46:12,t:22,b:26},id='c'+(++uid);
    const tops=cfg.stacked?cfg.series.map((s,k)=>s.vals.map((v,i)=>cfg.series.slice(0,k+1).reduce((a,q)=>a+q.vals[i],0))):cfg.series.map((s)=>s.vals);
    const min=cfg.min||0,rawMax=Math.max(...tops.flat(),...proj.flat(),cfg.target?cfg.target.value:0),max=cfg.max||min+nice(rawMax-min),bars=cfg.type==='bars';
    const x=(i)=>bars?m.l+(i+.5)*(w-m.l-m.r)/N:m.l+6+i*(w-m.l-m.r-12)/(N-1),y=(v)=>h-m.b-(v-min)/(max-min)*(h-m.t-m.b);
    const s=sv('svg',{viewBox:`0 0 ${w} ${h}`,width:'100%',height:h,role:'img','aria-label':cfg.label}),defs=sv('defs');s.append(defs);
    for(let k=0;k<=4;k++){const v=min+(max-min)*k/4;s.append(sv('line',{x1:m.l,x2:w-m.r,y1:y(v),y2:y(v),stroke:'var(--grid)'}),sv('text',{x:m.l-8,y:y(v)+3.5,'text-anchor':'end',class:'tick'},fx(v,dec&&(max-min)<8)))}
    const every=Math.max(1,Math.ceil(N/Math.max(2,Math.floor((w-m.l-m.r)/62))));
    for(let i=N-1;i>=0;i-=every)s.append(sv('text',{x:x(i),y:h-6,'text-anchor':'middle',class:'tick'},date(i)));
    if(fc){s.append(sv('rect',{x:x(n-1),y:m.t,width:x(N-1)-x(n-1),height:h-m.b-m.t,fill:'var(--glass)'}),sv('line',{x1:x(n-1),x2:x(n-1),y1:m.t-6,y2:h-m.b,stroke:'var(--line2)'}),sv('text',{x:x(n-1)+6,y:m.t-8,class:'nowl'},'projection →'))}
    if(cfg.target){s.append(sv('line',{x1:m.l,x2:w-m.r,y1:y(cfg.target.value),y2:y(cfg.target.value),stroke:'var(--ok)','stroke-dasharray':'2 5','stroke-width':1.5}),sv('text',{x:m.l+6,y:y(cfg.target.value)-6,class:'nowl'},cfg.target.label))}
    if(cfg.flag>=0){s.append(sv('line',{x1:x(cfg.flag),x2:x(cfg.flag),y1:m.t-4,y2:h-m.b,stroke:'var(--a2)','stroke-dasharray':'3 4'}),sv('text',{x:x(cfg.flag),y:m.t-8,'text-anchor':'middle',class:'flagl'},'Unusual week'))}
    if(bars){const bw=Math.min(13,(w-m.l-m.r)/N/2.6),g=sv('linearGradient',{id,x1:0,y1:0,x2:0,y2:1});g.append(sv('stop',{offset:'0','stop-color':'var(--a2)'}),sv('stop',{offset:'1','stop-color':'var(--a1)'}));defs.append(g);
      cfg.series.forEach((q,k)=>q.vals.forEach((v,i)=>s.append(sv('rect',{x:x(i)+(k?1.5:-bw-1.5),y:y(v),width:bw,height:Math.max(0,y(min)-y(v)),rx:Math.min(4,bw/2),fill:q.grad?`url(#${id})`:q.color}))));
    }else{
      const path=(a,o=0)=>'M'+a.map((v,i)=>`${x(i+o).toFixed(1)},${y(v).toFixed(1)}`).join('L');
      cfg.series.forEach((q,k)=>{const gid=id+'_'+k,g=sv('linearGradient',{id:gid,x1:0,y1:0,x2:0,y2:1});g.append(sv('stop',{offset:'0','stop-color':q.color,'stop-opacity':.32}),sv('stop',{offset:'1','stop-color':q.color,'stop-opacity':.02}));defs.append(g);
        const base=cfg.stacked&&k?tops[k-1]:tops[k].map(()=>min);
        if(q.fill!==false)s.append(sv('path',{d:path(tops[k])+'L'+base.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).reverse().join('L')+'Z',fill:`url(#${gid})`}))});
      cfg.series.forEach((q,k)=>{s.append(sv('path',{d:path(tops[k]),fill:'none',stroke:q.color,'stroke-width':2.25,'stroke-linejoin':'round','stroke-linecap':'round',pathLength:1,class:'draw'}));
        if(fc){s.append(sv('path',{d:path([last(q.vals),...proj[k]],n-1),fill:'none',stroke:q.color,'stroke-width':2,'stroke-dasharray':'2 6','stroke-linecap':'round'}),sv('circle',{cx:x(N-1),cy:y(last(proj[k])),r:4,fill:'var(--solid)',stroke:q.color,'stroke-width':2}))}
        s.append(sv('circle',{cx:x(n-1),cy:y(tops[k][n-1]),r:4,fill:q.color,stroke:'var(--solid)','stroke-width':2}))});
      if(cfg.end||fc){const ev=cfg.series.map((q,k)=>fc?last(proj[k]):(cfg.stacked?tops[k][n-1]:q.vals[n-1]));let ys=cfg.series.map((q,k)=>y(fc?last(proj[k]):tops[k][n-1]));
        if(ys.length>1&&Math.abs(ys[0]-ys[1])<14)ys=ys[0]<ys[1]?[ys[0],ys[0]+14]:[ys[1]+14,ys[1]];
        cfg.series.forEach((q,k)=>s.append(sv('text',{x:x(N-1)+9,y:ys[k]+4,class:'endl'},(fc?'≈':'')+fx(ev[k],dec))))}
    }
    const rule=sv('line',{y1:m.t,y2:h-m.b,stroke:'var(--line2)',visibility:'hidden'}),hit=sv('rect',{x:m.l,y:0,width:Math.max(0,w-m.l-m.r),height:h,fill:'transparent'}),tip=el('div','tip');
    tip.hidden=true;s.append(rule,hit);box.append(s,tip);
    const move=(ev)=>{const b=s.getBoundingClientRect(),px=(ev.clientX-b.left)*w/b.width;let i=0,best=1e9;for(let k=0;k<N;k++){const d=Math.abs(x(k)-px);if(d<best){best=d;i=k}}
      rule.setAttribute('x1',x(i));rule.setAttribute('x2',x(i));rule.setAttribute('visibility','visible');
      tip.replaceChildren(el('div','',(i<n?'Week ending ':'Projected, week ending ')+date(i)));
      cfg.series.forEach((q,k)=>{const sw=el('span','sw');sw.style.background=q.grad?'var(--a2)':q.color;tip.append(el('div','',sw,el('span','',q.label),el('b','',i<n?fx(q.vals[i],dec)+(cfg.unit||''):'≈'+fx(proj[k][i-n],dec)+(cfg.unit||''))))});
      if(cfg.extra&&i<n)cfg.extra(i).forEach(([a,v])=>tip.append(el('div','',el('span','',a),el('b','',v))));
      tip.hidden=false;const k=b.width/w,tw=tip.offsetWidth;let left=x(i)*k+14;if(left+tw>box.clientWidth)left=x(i)*k-tw-14;tip.style.left=Math.max(0,left)+'px'};
    hit.addEventListener('pointermove',move);hit.addEventListener('pointerdown',move);hit.addEventListener('click',(ev)=>{if(!cfg.onPick)return;const b=s.getBoundingClientRect(),px=(ev.clientX-b.left)*w/b.width;let i=0,best=1e9;for(let k=0;k<N;k++){const d=Math.abs(x(k)-px);if(d<best){best=d;i=k}}cfg.onPick(i)});hit.addEventListener('pointerleave',()=>{tip.hidden=true;rule.setAttribute('visibility','hidden')});
  };
  draw();watch(box,draw)}

/* building blocks */
const after=[];
const band=(t)=>el('h2','band',t);
const legend=(items)=>{const u=el('ul','legend');items.forEach(([name,color])=>{const s=el('span','sw');s.style.background=color;u.append(el('li','',s,name))});return u};
/* Drill-down: every major chart, bar list and ranked table opens this panel with the figures behind what was selected. */
let drawerBack=null;
function drill(title,sub,pairs,extra,go){let d=$('#drill');if(!d){d=el('aside','drill');d.id='drill';d.setAttribute('role','dialog');d.setAttribute('aria-modal','false');d.tabIndex=-1;document.body.append(d);
    addEventListener('keydown',(e)=>{if(e.key==='Escape'&&!d.hidden)closeDrill()})}
  drawerBack=document.activeElement;const x=el('button','link sm','Close');x.type='button';x.addEventListener('click',closeDrill);
  const dl=el('dl','dpairs');pairs.forEach(([k,v,tone])=>dl.append(el('dt','',k),el('dd',tone||'',v)));
  const foot=el('div','dfoot');if(go&&go!==CURRENT&&V[go]){const b=el('button','btn primary','Open '+((NAV.find((q)=>q[0]===go)||[])[1]||'page'));b.type='button';b.addEventListener('click',()=>{closeDrill();show(go,true)});foot.append(b)}
  if(CL&&pairs.length){const q=el('button','btn','Ask Claude about this');q.type='button';q.addEventListener('click',()=>askClaude(title,sub,`Explain what is behind this item, the likely cause, how it compares with the rest of the figures, and the next step with an owner. Item: ${title}${sub?' ('+sub+')':''}: ${pairs.map((p)=>p[0].trim()+' '+p[1]).join('; ')}.`));foot.prepend(q)}
  d.replaceChildren(el('div','dhead',el('div','',el('h2','',title),sub?el('p','cap',sub):null),x),dl,...(extra||[]),foot);d.setAttribute('aria-label',title);d.hidden=false;d.focus()}
function closeDrill(){const d=$('#drill');if(d)d.hidden=true;if(drawerBack&&drawerBack.focus)drawerBack.focus()}
function weekDrill(cfg,title,i){const dec=cfg.dec,u=cfg.unit||'';
  if(i>=n){const j=i-n+1,lo=cfg.clamp?cfg.clamp[0]:0,hi=cfg.clamp?cfg.clamp[1]:Infinity;drill(title,`Week ending ${ahead(j)}, projected`,cfg.series.map((q)=>[q.label,'≈'+fx(Math.min(hi,Math.max(lo,last(q.vals)+slope(q.vals)*j)),dec)+u]),
    [el('p','note','Projected from the trend of the last six weeks. A projection, not a forecast: it assumes nothing changes.')],cfg.go||CURRENT);return}
  const pairs=[];cfg.series.forEach((q)=>{const v=q.vals[i],pv=i>0?q.vals[i-1]:null,av=q.vals.reduce((a,b)=>a+b,0)/q.vals.length;
    pairs.push([q.label,fx(v,dec)+u]);if(pv!=null)pairs.push(['  on the week before',sgn(v-pv,dec?1:0)+(u==='%'?' pts':u)]);pairs.push(['  12-week average',fx(av,dec)+u])});
  if(cfg.extra)cfg.extra(i).forEach((e)=>pairs.push([e[0],e[1]]));
  const rk=cfg.series.map((q)=>[...q.vals].sort((a,b)=>b-a).indexOf(q.vals[i])+1)[0];
  drill(title,`Week ending ${day(W[i].week_ending)}`,pairs,[el('p','note',`${cfg.series[0].label}: ${rk===1?'highest':rk===n?'lowest':'number '+rk+' highest'} of the last ${n} weeks.`)],cfg.go||CURRENT)}
function dataPanel(cfg){const fc=cfg.fc||0,dec=cfg.dec,u=cfg.unit||'',lo=cfg.clamp?cfg.clamp[0]:0,hi=cfg.clamp?cfg.clamp[1]:Infinity;
  const hr=el('tr','',el('th','','Week ending'));cfg.series.forEach((q)=>hr.append(el('th','',q.label)));const extra=cfg.extra?cfg.extra(0).map((e)=>e[0]):[];extra.forEach((e)=>hr.append(el('th','',e)));
  const body=el('tbody'),rows=[];
  for(let i=n-1;i>=0;i--){const tr=el('tr','',el('td','',day(W[i].week_ending)));cfg.series.forEach((q)=>tr.append(el('td','',fx(q.vals[i],dec)+u)));if(cfg.extra)cfg.extra(i).forEach((e)=>tr.append(el('td','',e[1])));rows[i]=tr;body.append(tr)}
  for(let j=1;j<=fc;j++){const tr=el('tr','pj',el('td','',ahead(j)+' (projected)'));cfg.series.forEach((q)=>tr.append(el('td','','≈'+fx(Math.min(hi,Math.max(lo,last(q.vals)+slope(q.vals)*j)),dec)+u)));extra.forEach(()=>tr.append(el('td','','')));rows[n-1+j]=tr;body.prepend(tr)}
  const wrap=el('div','dwrap',el('table','data',el('thead','',hr),body)),btn=el('button','link sm','View data');btn.type='button';btn.setAttribute('aria-expanded','false');wrap.hidden=true;
  const open=(on)=>{wrap.hidden=!on;btn.textContent=on?'Hide data':'View data';btn.setAttribute('aria-expanded',on?'true':'false')};
  btn.addEventListener('click',()=>open(wrap.hidden));
  cfg.onPick=(i)=>{open(true);rows.forEach((r)=>r&&r.classList.remove('on'));if(rows[i]){rows[i].classList.add('on');wrap.scrollTop=Math.max(0,rows[i].offsetTop-60)}};
  return[el('div','cfoot',el('span','cap','Select a week on the chart for its figures'),btn),wrap]}
function chartCard(title,cfg){const box=el('div','chart'),c=el('section','card',el('div','ph',el('h2','h',title),legend(cfg.series.map((q)=>[q.label,q.grad?'linear-gradient(var(--a2),var(--a1))':q.color]))),box,...dataPanel(cfg));const base=cfg.onPick;cfg.onPick=(i)=>{base(i);weekDrill(cfg,title,i)};after.push(()=>chart(box,cfg));return c}
function stat(label,value,unit,dec,c,betterDir,vals,color,go){
  const v=el('span'),num=el('div','num',v,unit?el('span','unit',unit):null),sp=null;
  const card=el(go?'button':'div','card kpi'+(go?' lift':''),el('div','cap',label),num,c===null?el('div','cap',' '):el('div','',deltaEl(c,betterDir,dec),' ',el('span','cap','on last week')),sp);
  if(go){card.type='button';card.addEventListener('click',()=>show(go,true))}
  after.push(()=>{count(v,value,dec);if(sp)spark(sp,vals,color||'var(--a1)')});return card}
const AREA_NAMES={detection:'SOC operations',vulnerabilities:'Vulnerabilities',remediation:'Remediation',email:'Email and phishing',people:'Users and apps',controls:'Control areas'};
function areaLinks(r){const f=el('div','sig-go');(r.areas||[]).forEach((a)=>{const nm=AREA_NAMES[a]||(AREAS[a]&&AREAS[a].name);if(!nm)return;const b=el('button','link sm','Open '+nm);b.type='button';b.addEventListener('click',()=>show(a,true));f.append(b)});return f}
function signal(r,compact){
  const conf=el('span','pill '+({High:'bad',Medium:'warn'}[r.confidence]||''),r.confidence+' confidence');
  if(compact){const b=el('button','sig-row',el('span','sig-t',el('b','',r.title),el('small','',r.systems)),conf);b.type='button';b.addEventListener('click',()=>show('signals',true));return el('li','',b)}
  return el('article','card signal',el('div','sig-head',el('h3','',r.title),conf),el('p','sig-sys',r.systems),
    el('div','sig-body',el('div','',el('h4','','What we see'),el('p','',r.pattern)),el('div','',el('h4','','Where to look'),el('p','',r.look))),areaLinks(r))}
const signalsFor=(area)=>DATA.notes.filter((r)=>r.areas.includes(area));
function heading(title,cfg,points,note){const box=el('div','chart'),dp=dataPanel(cfg),base=cfg.onPick;cfg.onPick=(i)=>{base(i);weekDrill(cfg,title,i)};const ul=el('ul','proj');points.forEach(([a,b])=>ul.append(el('li','',el('b','',a),el('span','',b))));after.push(()=>chart(box,cfg));
  return el('div','head',el('section','card',el('div','ph',el('h2','h',title),legend(cfg.series.map((q)=>[q.label,q.color]))),box,...dp),el('section','card edge',el('h2','h','Where it is heading'),el('div','',''),ul,el('p','note',note||`A straight line through the last six weeks, carried forward to ${ahead(FC)}. A guide to direction, not a forecast.`)))}
function vhead(title,text,tone,state){const p=el('p');text.forEach((t)=>p.append(typeof t==='string'?t:el('b','',t[0])));return el('header','vh',el('div','vtitle',el('h1','',title),state?el('span','pill '+tone,state):null),p)}
function aiBlock(area){const s=signalsFor(area);if(!s.length)return[];const g=el('section','signals');s.forEach((r)=>g.append(signal(r)));return[band('Signals for this area'),g]}


const bigNum=(v,dec,unit)=>{const s=el('span');after.push(()=>count(s,v,dec));return el('div','num',s,unit?el('span','unit',unit):null)};
function funnelCard(steps,cls){const c=el('section','card funnel'+(cls?' '+cls:''));steps.forEach(([label,v,d,sub,dir])=>c.append(el('div','fstep',el('span','cap',label),bigNum(v,0),el('div','',deltaEl(d,dir||'lower',false),' ',el('span','cap','on last week')),el('span','cap',sub))));return c}
function funnel(){const a=last(S.alerts),t=last(S.tri),i=last(S.inc),c=last(S.sevC);
  return funnelCard([['Alerts received',a,a-prev(S.alerts),'From Sentinel, SentinelOne, Mimecast and Netskope'],['Investigated by an analyst',t,t-prev(S.tri),`${Math.round(t/a*100)}% of alerts. The rest closed automatically.`],['Incidents raised',i,chg(S.inc),`${f1(i/t*100)}% of those investigated`],['Critical incidents',c,chg(S.sevC),`${last(S.sevH)} more rated high`]])}
const M=DATA.mail,AS=DATA.assets;
S.blocked=M.phish_blocked;S.rep=M.reported_by_users;S.ttr=M.minutes_to_first_report;S.creds=M.credentials_entered;S.catch=S.blocked.map((b,i)=>r1(b/(b+S.del[i])*100));
const worstPatch=[...AS].sort((a,b)=>a.patched_pct-b.patched_pct)[0];
const socTiles=()=>el('section','stats six',stat('Time to detect',last(S.mttd),'min',0,chg(S.mttd),'lower',S.mttd),stat('Time to acknowledge',last(S.mtta),'min',0,chg(S.mtta),'lower',S.mtta,'var(--a3)'),stat('Time to contain',last(S.cont),'hrs',1,chg(S.cont),'lower',S.cont,'var(--a2)'),
  stat('Contained inside the agreed time',last(S.rsla),'%',0,chg(S.rsla),'higher',S.rsla,'var(--a3)'),stat('Alerts that were false alarms',last(S.fp),'%',0,chg(S.fp),'lower',S.fp,'var(--a2)'),stat('Incidents still open',last(S.oinc),'',0,chg(S.oinc),'lower',S.oinc));
const lowTac=[...Q.attack].sort((a,b)=>a.coverage-b.coverage)[0];
function rowsBars(items,max,color,o={}){const b=el('div','bars'),tot=items.reduce((a,r)=>a+(Number(r[1])||0),0);items.forEach(([name,val,note,col,go,more],k)=>{const tr=el('div','track'),i=el('i');i.style.width=Math.max(2,val/max*100)+'%';i.style.background=col||color;tr.append(i);tr.setAttribute('aria-hidden','true');
  const row=el('button','barbtn',el('div','bar-top',el('span','',name),el('span','',note)),tr);row.type='button';row.setAttribute('aria-label',`${name}: ${note||val}. Show details`);
  row.addEventListener('click',()=>drill(name,o.title||'',[[o.label||'Value',note||String(val)],['Share of total',tot?f1(val/tot*100)+'%':'—'],['Rank',`${k+1} of ${items.length}`],...(more||[])],o.note?[el('p','note',o.note)]:[],go||o.go||CURRENT));b.append(row)});return b}


const T=DATA.top;
S.rsign=T.weekly.risky_signins;S.mfa=T.weekly.mfa_failures;S.shadow=T.weekly.shadow_apps;S.dlp=DATA.trend.Netskope;S.unv=DATA.trend.CyberArk;
/* ranked list: head = column names (first is the name column), rows = [[name,sub],v1,v2...]; bar = index of the column that gets a bar; hot(row) marks its bar red */
function rank(title,sub,head,rows,o={}){const bi=o.bar||1,max=Math.max(...rows.map((r)=>r[bi])),hr=el('tr','',el('th','',''));head.forEach((h)=>hr.append(el('th','',h)));const body=el('tbody');
  rows.forEach((r,i)=>{const nm=el('td','nm',el('b','',r[0][0]),el('small','',r[0][1])),tr=el('tr','',el('td','rk',String(i+1)),nm);
    tr.className='pick';tr.tabIndex=0;tr.setAttribute('role','button');const open=()=>drill(r[0][0],[r[0][1],title].filter(Boolean).join(' · '),head.slice(1).map((h,j)=>{const v=r[j+1];return[h,typeof v==='number'?f0(v)+((o.units||{})[j+1]||''):String(v),o.flag&&o.flag(r,j+1)?'alert':'']}),o.note?[el('p','note',o.note)]:[],o.go||CURRENT);
    tr.addEventListener('click',open);tr.addEventListener('keydown',(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});
    r.slice(1).forEach((v,j)=>{const k=j+1,txt=typeof v==='number'?f0(v)+((o.units||{})[k]||''):v;if(k===bi){const me=el('div','meter'),f=el('i'),hot=o.hot&&o.hot(r);f.style.width=Math.max(3,v/max*100)+'%';f.style.background=hot?'var(--crit)':'linear-gradient(90deg,var(--a2),var(--a1))';me.append(f);me.setAttribute('aria-hidden','true');tr.append(el('td','br'+(hot?' alert':''),txt,me))}else tr.append(el('td',o.flag&&o.flag(r,k)?'alert':'',txt))});body.append(tr)});
  return el('section','card',el('div','ph',el('h2','h',title),el('span','cap',sub)),el('div','scroll',el('table','rank',el('thead','',hr),body)),o.note?el('p','note',o.note):null)}
const R={
  hostsAlert:()=>rank('Hosts raising the most alerts','This week',['Host','Alerts','Incidents'],T.alert_hosts.map((h)=>[[h.host,h.type],h.alerts,h.incidents])),
  rules:()=>rank('Detection rules making the most noise','This week',['Rule','Alerts','False alarms'],T.rules.map((r)=>[[r.rule,r.source],r.alerts,r.false_pct]),{units:{2:'%'},flag:(r,k)=>k===2&&r[2]>=60,note:'A rule in red is wrong more than six times in ten and is a candidate for tuning.'}),
  hostsVuln:()=>rank('Most exposed hosts','Critical and high findings open',['Host','Critical','High','Oldest'],T.vuln_hosts.map((h)=>[[h.host,[h.type,h.team].filter(Boolean).join(' · ')],h.critical,h.high,h.oldest_days]),{units:{3:' days'},flag:(r,k)=>k===3&&r[3]>90}),
  common:()=>rank('Most common weaknesses','Assets affected',['Weakness','Assets','Severity'],T.common.map((c)=>[[c.title,c.where],c.assets,c.severity]),{flag:(r,k)=>k===2&&r[2]==='Critical'}),
  targets:()=>rank('Most targeted people','Phishing emails aimed at them this month',['Person','Received','Clicked','Reported'],T.targets.map((u)=>[[u.id,`${u.role} · ${u.dept}`],u.received,u.clicked,u.reported]),{flag:(r,k)=>k===2&&r[2]>0}),
  clickers:()=>rank('Repeat clickers','Real and simulated phishing, last 90 days',['Person','Clicks','Training'],T.repeat_clickers.map((u)=>[[u.id,u.dept],u.clicks,u.training]),{hot:(r)=>r[1]>=4,flag:(r,k)=>k===2&&r[2]==='Overdue'}),
  appUsers:()=>rank('People using the most risky apps','This month',['Person','Risky apps','Uploaded','Violations'],T.app_users.map((u)=>[[u.id,u.dept],u.apps,u.upload_mb,u.violations]),{bar:3,units:{2:' MB'}}),
  apps:()=>rank('Risky apps in use','Unapproved apps, this month',['App type','People','Uploaded','Risk'],T.apps.map((a)=>[[a.name,a.action],a.users,a.upload_gb+' GB',a.risk]),{flag:(r,k)=>k===3&&r[3]==='High'}),
  priv:()=>rank('Busiest privileged users','Sessions this month',['Account','Sessions','Out of hours','Unvaulted'],T.priv_users.map((u)=>[[u.id,u.team],u.sessions,u.out_of_hours,u.unvaulted]),{flag:(r,k)=>(k===2&&r[2]>=14)||(k===3&&r[3]>0)}),
};
/* names that turn up on more than one list */
function crossList(){const m=new Map(),add=(id,what,sub,go)=>{const e=m.get(id)||{id,sub,lists:[],go};e.lists.push(what);m.set(id,e)};
  T.targets.forEach((u)=>add(u.id,'Most targeted',u.dept,'email'));T.repeat_clickers.forEach((u)=>add(u.id,'Repeat clicker',u.dept,'email'));T.app_users.forEach((u)=>add(u.id,'Risky apps',u.dept,'people'));
  T.alert_hosts.forEach((h)=>add(h.host,'Most alerts',h.type,'detection'));T.vuln_hosts.forEach((h)=>add(h.host,'Most exposed',h.type,'vulnerabilities'));
  return[...m.values()].filter((e)=>e.lists.length>1).sort((a,b)=>b.lists.length-a.lists.length)}

/* area summaries, shared by the overview and each section */
const bOpen=slope(S.open),bSla=slope(S.sla),bMttr=slope(S.mttr),bInc=slope(S.inc),bMttd=slope(S.mttd),bDel=slope(S.del),bRate=slope(S.rate);
const toTarget=bSla>0?Math.ceil((L.sla_target-last(S.sla))/bSla):null,improved=DATA.tools.filter((t)=>better(t)>0).length,lowCov=[...DATA.tools].sort((a,b)=>a.coverage_pct-b.coverage_pct)[0];
const AREAS={
 vulnerabilities:{name:'Vulnerabilities',tone:chg(S.open)<=0?'ok':'bad',state:chg(S.open)<=0?'Falling':'Rising',
  what:`${f0(last(S.open))} critical and high open, ${sgn(chg(S.open))} on last week. ${od} are past their deadline.`,
  go:bOpen<0?`Down about ${f0(-bOpen)} a week. Near ${f0(last(S.open)+bOpen*FC)} by ${ahead(FC)}.`:`Up about ${f0(bOpen)} a week. Near ${f0(last(S.open)+bOpen*FC)} by ${ahead(FC)}.`},
 remediation:{name:'Remediation',tone:last(S.sla)>=L.sla_target?'ok':'bad',state:last(S.sla)>=L.sla_target?'On target':'Off target',
  what:`${f1(last(S.sla))}% of fixes landed in time, ${sgn(chg(S.sla),1)} points. ${L.closed} closed against ${L.opened} opened.`,
  go:toTarget?`Up ${f1(bSla)} points a week. Meets the ${L.sla_target}% target around ${ahead(toTarget)}.`:`Not closing on the ${L.sla_target}% target at the current pace.`},
 detection:{name:'SOC operations',tone:last(S.rsla)>=Q.response_target?'ok':'bad',state:last(S.rsla)>=Q.response_target?'Inside target':'Off target',
  what:`${f0(last(S.alerts))} alerts, ${L.incidents} incidents, ${last(S.sevC)} critical. Detected in ${L.mttd_minutes} minutes and contained in ${f1(last(S.cont))} hours.`,
  go:`Time to contain is moving ${sgn(slope(S.cont),1)} hours a week. Near ${f1(Math.max(0,last(S.cont)+slope(S.cont)*FC))} hours by ${ahead(FC)}.`},
 email:{name:'Email and phishing',tone:chg(S.rate)>0?'warn':'ok',state:chg(S.rate)>0?'Watch':'Improving',
  what:`${L.phish_delivered} phishing emails reached inboxes, ${sgn(chg(S.del))}. ${L.phish_clicked} were clicked, a rate of ${f1(last(S.rate))}%.`,
  go:`Volume is moving ${sgn(bDel,1)} a week. Near ${f0(Math.max(0,last(S.del)+bDel*FC))} by ${ahead(FC)}.`},
 people:{name:'Users and apps',tone:chg(S.dlp)<=0?'ok':'warn',state:chg(S.dlp)<=0?'Improving':'Watch',
  what:`${last(S.dlp)} data loss violations, ${sgn(chg(S.dlp))} on last week. ${last(S.rsign)} risky sign-ins and ${last(S.shadow)} unapproved apps in use.`,
  go:`Violations are moving ${sgn(slope(S.dlp),1)} a week. Near ${f0(Math.max(0,last(S.dlp)+slope(S.dlp)*FC))} by ${ahead(FC)}.`},
 controls:{name:'Control areas',tone:lateT.length?'warn':'ok',state:lateT.length?`${lateT.length} late`:'All current',
  what:`${DATA.tools.length-lateT.length} of ${DATA.tools.length} systems sent current data. ${improved} of ${DATA.tools.length} headline measures improved.`,
  go:`${lowCov.system} has the weakest coverage at ${lowCov.coverage_pct}%.`}
};

/* views */
const V={};
const prevOpen0=S.open[0]-S.opened[0]+S.closed[0];
S.rem=W.map((r,i)=>r1(r.closed/((i?S.open[i-1]:prevOpen0)+r.opened)*100));
const needFix=prev(S.open)+L.opened,pct12=Math.round((last(S.open)-S.open[0])/S.open[0]*100);
const arrow=(down)=>{const s=sv('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':2.6,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'});s.append(sv('path',{d:down?'M6 7l11 11M17 9v9H8':'M6 17 17 6M8 6h9v9'}));return s};
const trendPill=(text,good,down)=>el('span','trend '+(good?'good':'bad'),arrow(down),text);
function risks(){
  const H=DATA.hot,out=[];let pk={v:-1};H.cells.forEach((row,i)=>row.forEach((v,j)=>{if(v>pk.v)pk={v,i,j}}));
  out.push([`${H.teams[pk.i]} and ${H.scanners[pk.j]}`,`${pk.v} of the ${od} overdue findings (${Math.round(pk.v/od*100)}%) sit with one team in one scanner.`,'High','bad','remediation']);
  const cs=streak(S.closed);if(cs>=2)out.push([`Closure has slowed ${cs} weeks running`,`From ${S.closed[n-1-cs]} to ${L.closed} findings a week. The backlog is falling because less is arriving.`,'High','bad','remediation']);
  const m=new Map();DATA.vulns.forEach((r)=>{if(r.severity==='Medium')return;const s=m.get(r.source)||{s:r.source,o:0,d:0};s.o+=r.open;s.d+=r.overdue;m.set(r.source,s)});
  const ws=[...m.values()].sort((a,b)=>b.d/b.o-a.d/a.o)[0];out.push([`${ws.s}: ${Math.round(ws.d/ws.o*100)}% of open findings are overdue`,`Against ${Math.round(od/last(S.open)*100)}% across all scanners.`,'Medium','warn','vulnerabilities']);
  out.push([`Detection gap: ${lowTac.tactic}`,`Only ${lowTac.coverage}% of known attack techniques in this stage have a detection rule, the lowest of the ${Q.attack.length} stages.`,'Medium','warn','detection']);
  out.push([`${worstPatch.type}: ${worstPatch.patched_pct}% patched in time`,`The lowest of the ${AS.length} asset types, and its open findings are ${worstPatch.avg_age_days} days old on average.`,'Medium','warn','vulnerabilities']);
  const under=DATA.owners.filter((r)=>r.sla_pct<L.sla_target).length;out.push([`${under} of ${DATA.owners.length} teams are under the fix-time target`,`The ${L.sla_target}% target cannot be met until they are.`,'Medium','warn','remediation']);
  out.push([`${lowCov.system} sees ${lowCov.coverage_pct}% of the estate`,lateT.some((t)=>t.system===lowCov.system)?'The weakest coverage of the eight systems, and its data is a week old.':'The weakest coverage of the eight systems.','Medium','warn','controls']);
  if(chg(S.rate)>0)out.push([`Phishing click rate rose to ${f1(last(S.rate))}%`,`Up from ${f1(prev(S.rate))}% while volume fell. One week only.`,'Low','','email']);
  return out}
V.overview=()=>{
  const worstT=[...DATA.owners].sort((a,b)=>b.overdue-a.overdue)[0],minInc=last(S.inc)===Math.min(...S.inc),H0=DATA.hot;let pk0={v:-1};H0.cells.forEach((row,i)=>row.forEach((v,j)=>{if(v>pk0.v)pk0={v,i,j}}));
  const h1=el('h1','',el('em','',String(L.incidents)),' incidents this week, contained in ',el('em','',f1(last(S.cont))+' hours'),'.');
  const sumRow=(k,t)=>el('li','',el('b','',k+'. '),el('span','',t));
  const head=el('header','heroband rise',h1,el('ul','sum',
    sumRow('Operations',`${f0(last(S.alerts))} alerts came in and ${f0(last(S.tri))} needed an analyst. ${L.incidents} became incidents, ${last(S.sevC)} of them critical${minInc?', the quietest week of the last 12':''}.`),
    sumRow('Response',`Detected in ${L.mttd_minutes} minutes, acknowledged in ${last(S.mtta)} and contained in ${f1(last(S.cont))} hours. ${last(S.rsla)}% were contained inside the agreed time, against a ${Q.response_target}% target.`),
    sumRow('Vulnerabilities and remediation',`Critical and high findings are ${pct12<=0?'down':'up'} ${Math.abs(pct12)}% in 12 weeks at ${f0(last(S.open))}. ${f1(last(S.rem))}% was remediated this week and ${f1(last(S.sla))}% of fixes met their deadline, against ${L.sla_target}%.`),
    sumRow('Watch',`Closure has slowed for ${streak(S.closed)} weeks. ${H0.teams[pk0.i]} holds ${pk0.v} overdue findings in ${H0.scanners[pk0.j]}. Detection rules cover ${lowTac.coverage}% of ${lowTac.tactic} techniques.`)));
  const big=(v,dec,unit)=>{const s=el('span');after.push(()=>count(s,v,dec));return el('div','num',s,unit?el('span','unit',unit):null)};
  const c1box=el('div','chart'),c2=el('div','spark'),me=el('div','meter'),fill=el('i'),mark=el('u'),met=last(S.sla)>=L.sla_target;
  after.push(()=>{chart(c1box,{go:'vulnerabilities',title:'Open critical and high findings',h:150,label:`Open critical and high findings, from ${S.open[0]} to ${last(S.open)} over 12 weeks`,end:true,series:[{vals:S.open,color:'var(--a1)',label:'Critical and high open'}]});spark(c2,S.rem,'var(--a2)')});
  fill.style.width=last(S.sla)+'%';fill.style.background=met?'var(--ok)':'linear-gradient(90deg,var(--a1),var(--a2))';mark.style.left=`calc(${L.sla_target}% - 1px)`;me.append(fill,mark);me.setAttribute('role','img');me.setAttribute('aria-label',`${last(S.sla)}% against a target of ${L.sla_target}%`);
  const say=(...k)=>{const p=el('p','say');k.forEach((x)=>p.append(x));return p};
  const answers=el('section','answers',
    el('article','card answer',el('div','rhead',el('h2','h','Are vulnerabilities going down?'),trendPill(`${Math.abs(pct12)}% in 12 weeks`,pct12<=0,pct12<=0)),big(last(S.open),0),say('critical and high findings open, ',el('b','',sgn(chg(S.open))),' on last week.'),c1box),
    el('article','card answer',el('div','rhead',el('h2','h','How much are we remediating?'),trendPill(sgn(chg(S.rem),1)+' pts',chg(S.rem)>=0,chg(S.rem)<0)),big(last(S.rem),1,'%'),say(el('b','',String(L.closed)),' closed out of ',el('b','',f0(needFix)),' that needed fixing this week.'),c2),
    el('article','card answer',el('div','rhead',el('h2','h','Are fixes landing in time?'),trendPill(sgn(chg(S.sla),1)+' pts',chg(S.sla)>=0,chg(S.sla)<0)),big(last(S.sla),1,'%'),say(`Target ${L.sla_target}%. `,toTarget?el('b','',`On pace for ${ahead(toTarget)}.`):el('b','','Not in reach at this pace.')),me,el('p','note','The mark is the target.')));
  const H=DATA.hot,rt=H.cells.map((r)=>r.reduce((a,b)=>a+b,0)),order=H.teams.map((t,i)=>i).sort((a,b)=>rt[b]-rt[a]),ct=H.scanners.map((s,j)=>H.cells.reduce((a,r)=>a+r[j],0)),cord=H.scanners.map((s,j)=>j).sort((a,b)=>ct[b]-ct[a]),mx=Math.max(...H.cells.flat());
  const tb=el('table','heat'),hr=el('tr','',el('th','',''));cord.forEach((j)=>{const th=el('th','',H.scanners[j]);th.scope='col';hr.append(th)});const tt=el('th','','All');tt.scope='col';hr.append(tt);tb.append(el('thead','',hr));const body=el('tbody');
  order.forEach((i)=>{const th=el('th','',H.teams[i]);th.scope='row';const tr=el('tr','',th);cord.forEach((j)=>{const v=H.cells[i][j],td=el('td',v===mx?'peak':'',v?String(v):'');td.style.background=`color-mix(in srgb,var(--crit) ${Math.round(4+v/mx*62)}%,#fff)`;tr.append(td)});tr.append(el('td','tot',String(rt[i])));body.append(tr)});tb.append(body);
  const rl=el('ul','risks');risks().slice(0,6).forEach(([t,d,lvl,tone,go],i)=>{const b=el('button','risk',el('span','n',String(i+1)),el('span','',el('b','',t),el('span','d',d)),el('span','pill '+tone,lvl));b.type='button';b.addEventListener('click',()=>show(go,true));rl.append(el('li','',b))});
  const hot=el('div','hot',el('section','card',el('div','ph',el('h2','h','Overdue findings by team and scanner'),el('div','scale','fewer',el('i'),'more')),el('div','scroll',tb),el('p','note','Critical and high findings past their deadline. The outlined cell is the largest.')),
    el('section','card',el('div','ph',el('h2','h','Risk areas, ranked'),el('span','cap','Select one to open it')),rl));
  const xl=el('ul','risks');crossList().slice(0,5).forEach((e)=>{const tg=el('span','tags');e.lists.forEach((l)=>tg.append(el('span','pill warn',l)));const b=el('button','xrow',el('span','',el('b','',e.id),el('small','',e.sub)),tg);b.type='button';b.addEventListener('click',()=>show(e.go,true));xl.append(el('li','',b))});
  const tl=el('ul','risks'),t1=T.targets[0],t2=T.app_users[0],t3=T.vuln_hosts[0],t4=T.rules[0];
  [['Most targeted by phishing',t1.id,`${t1.role}, ${t1.dept}`,`${t1.received} emails`,'email'],['Most risky app use',t2.id,t2.dept,`${t2.violations} violations`,'people'],['Most exposed host',t3.host,`${t3.type}, ${t3.team}`,`${t3.critical+t3.high} findings`,'vulnerabilities'],['Noisiest detection rule',t4.rule,t4.source,`${t4.false_pct}% false`,'detection']]
   .forEach(([k,n,s,v,go])=>{const b=el('button','xrow',el('span','',el('b','',n),el('small','',`${k} · ${s}`)),el('span','big',v));b.type='button';b.addEventListener('click',()=>show(go,true));tl.append(el('li','',b))});
  const tops=el('div','two',el('section','card',el('div','ph',el('h2','h','On more than one list'),el('span','cap','The same name in several places is rarely chance')),xl),el('section','card',el('div','ph',el('h2','h','Top of each list'),el('span','cap','Select one to open it')),tl));
  const areas=el('section','areas');['detection','vulnerabilities','remediation','email','people','controls',...DOMS.map((d)=>d.id)].map((k)=>[k,AREAS[k]]).forEach(([k,a])=>{const b=el('button','card areac lift',el('div','rhead',el('span','name',a.name),el('span','pill '+a.tone,a.state)),el('p','',a.what),el('div','go',el('b','','Heading: '),a.go));b.type='button';b.addEventListener('click',()=>show(k,true));areas.append(b)});
  return[head,band('Security operations centre this week'),funnel(),socTiles(),band('Vulnerabilities and remediation'),answers,band('Hotspots and risk areas'),hot,band('People and hosts that keep coming up'),tops,band('Area by area: what happened and where it is heading'),areas]};

V.vulnerabilities=()=>{const A=AREAS.vulnerabilities,cs=streak(S.closed),m=new Map();
  DATA.vulns.forEach((r)=>{const s=m.get(r.source)||{source:r.source,c:0,h:0,o:0};if(r.severity==='Critical'){s.c+=r.open;s.o+=r.overdue}if(r.severity==='High'){s.h+=r.open;s.o+=r.overdue}m.set(r.source,s)});
  const rows=[...m.values()].sort((a,b)=>b.c+b.h-(a.c+a.h)),max=Math.max(...rows.map((r)=>r.c+r.h)),bars=el('div','bars');
  rows.forEach((r)=>{const tr=el('div','track');[['c','var(--crit)'],['h','var(--warn)']].forEach(([k,c])=>{const i=el('i');i.style.width=r[k]/max*100+'%';i.style.background=c;tr.append(i)});tr.setAttribute('role','img');tr.setAttribute('aria-label',`${r.source}: ${r.c} critical and ${r.h} high open, ${r.o} overdue`);
    bars.append(el('div','',el('div','bar-top',el('span','',r.source),el('span','',`${r.c+r.h} open · ${r.o} overdue (${Math.round(r.o/(r.c+r.h)*100)}%)`)),tr))});
  return[vhead('Vulnerabilities',[A.what],A.tone,A.state),band('What happened this week'),
   el('section','stats',stat('Critical and high open',last(S.open),'',0,chg(S.open),'lower',S.open),stat('Critical open',last(S.crit),'',0,chg(S.crit),'lower',S.crit,'var(--crit)'),stat('New findings this week',L.opened,'',0,chg(S.opened),'lower',S.opened,'var(--a2)'),stat('Past their deadline',od,'',0,null)),
   band('Pattern over 12 weeks'),el('div','two wide',chartCard('Critical and high findings open',{label:`Critical and high findings open by week, from ${S.open[0]} to ${last(S.open)}`,stacked:true,end:true,series:[{vals:S.crit,color:'var(--crit)',label:'Critical'},{vals:col('open_high'),color:'var(--warn)',label:'High'}],extra:(i)=>[['Both',f0(S.open[i])]]}),
     el('section','card',el('div','ph',el('h2','h','Open findings by scanner'),legend([['Critical','var(--crit)'],['High','var(--warn)']])),bars)),
   band('By type of asset: servers, workstations, endpoints and the rest'),(()=>{const g=el('section','sys-grid three');
     [...AS].sort((a,b)=>b.critical+b.high-(a.critical+a.high)).forEach((t)=>{const v=el('span'),sp=el('div','spark'),me=el('div','meter'),f=el('i'),tot=t.critical+t.high,b=slope(t.trend),low=t===worstPatch;
       f.style.width=t.patched_pct+'%';f.style.background=low?'var(--crit)':'linear-gradient(90deg,var(--a2),var(--a1))';me.append(f);me.setAttribute('aria-hidden','true');
       const sp2=el('div','split');sp2.append(el('b','',String(t.critical)),' critical · ',el('b','',String(t.high)),' high · ',el('b','',t.avg_age_days+' days'),' average age');
       g.append(el('article','card sysc',el('div','top',el('div','name',t.type),el('span','pill '+(t.overdue/tot>0.2?'bad':'warn'),`${t.overdue} overdue`)),el('div','area',`${f0(t.in_scope)} in scope`),el('div','num',v),el('div','',deltaEl(last(t.trend)-prev(t.trend),'lower',false),' ',el('span','cap','on last week')),sp2,sp,
         el('div','heading',el('b','','Heading: '),`about ${f0(Math.max(0,tot+b*FC))} by ${ahead(FC)}`),el('div','cov',el('span','','Patched inside the agreed time'),el('b','',t.patched_pct+'%')),me));
       after.push(()=>{count(v,tot,false);spark(sp,t.trend,b>0?'var(--crit)':'var(--a1)')})});return g})(),
   el('p','note','Each card counts critical and high findings open on that type of asset. The sparkline is 12 weeks; a red line means the count is rising.'),
   band('Most exposed, and most common'),el('div','two',R.hostsVuln(),R.common()),
   band('Where it is heading'),heading('Open findings, carried forward',{label:'Open critical and high findings with a six-week projection',fc:FC,clamp:[0,1e9],series:[{vals:S.open,color:'var(--a1)',label:'Critical and high'},{vals:S.crit,color:'var(--crit)',label:'Critical',fill:false}]},
    [[`About ${f0(last(S.open)+bOpen*FC)} open by ${ahead(FC)}`,`The backlog has moved ${sgn(bOpen,1)} a week over the last six weeks.`],[`Critical near ${f0(Math.max(0,last(S.crit)+slope(S.crit)*FC))} by the same date`,`Critical findings are moving ${sgn(slope(S.crit),1)} a week.`],
     [cs>=2?`Closure has fallen ${cs} weeks running`:'Closure is holding',cs>=2?`From ${S.closed[n-1-cs]} to ${L.closed} a week. The backlog is shrinking because intake is low, so this line bends if intake recovers.`:`${L.closed} closed this week against ${P.closed} last week.`]]),
   ...aiBlock('vulnerabilities')]};

V.remediation=()=>{const A=AREAS.remediation,teams=el('div','teams');
  [...DATA.owners].sort((a,b)=>b.overdue-a.overdue).forEach((r)=>{const cell=(v,l)=>el('div','m',v,el('small','',l)),me=el('div','meter'),fill=el('i'),mark=el('u'),short=r.sla_pct<L.sla_target;
    fill.style.width=r.sla_pct+'%';fill.style.background=short?'linear-gradient(90deg,var(--warn),var(--crit))':'linear-gradient(90deg,var(--a2),var(--ok))';mark.style.left=`calc(${L.sla_target}% - 1px)`;me.append(fill,mark);me.setAttribute('role','img');me.setAttribute('aria-label',`${r.sla_pct}% fixed in time against a ${L.sla_target}% target`);
    const pc=el('div','m',f1(r.sla_pct)+'%');pc.style.color=short?'var(--crit)':'var(--ok)';teams.append(el('div','team',el('strong','',r.team),cell(f0(r.open_critical_high),'open'),cell(f0(r.overdue),'overdue'),el('div','sla',me,pc),cell(f1(r.mttr_critical_days),'days to fix')))});
  return[vhead('Remediation',[A.what],A.tone,A.state),band('What happened this week'),
   el('section','stats',stat('Remediated this week',last(S.rem),'%',1,chg(S.rem),'higher',S.rem,'var(--a2)'),stat('Fixed inside the agreed time',last(S.sla),'%',1,chg(S.sla),'higher',S.sla,'var(--a3)'),stat('Average time to fix a critical',last(S.mttr),'days',1,chg(S.mttr),'lower',S.mttr,'var(--a2)'),stat('Findings closed',L.closed,'',0,chg(S.closed),'higher',S.closed)),
   band('Pattern over 12 weeks'),el('div','two',chartCard('Opened against closed',{type:'bars',label:'Findings opened and closed each week',flag:outlier(S.opened),series:[{vals:S.opened,color:'var(--dim)',label:'Opened'},{vals:S.closed,grad:true,label:'Closed'}],extra:(i)=>[['Net change',sgn(S.opened[i]-S.closed[i])]]}),
     chartCard('Share remediated each week',{label:'Share of findings that needed fixing which were closed, by week',end:true,dec:true,unit:'%',series:[{vals:S.rem,color:'var(--a2)',label:'Remediated'}]})),
   el('section','card',el('div','ph',el('h2','h','By owning team'),el('span','cap','Sorted by overdue. The mark on each bar is the target.')),teams),
   band('Where it is heading'),heading('Fixed in time against target',{label:'Share of fixes made in time with a six-week projection and the target',fc:FC,min:80,max:100,dec:true,unit:'%',clamp:[0,100],target:{value:L.sla_target,label:`target ${L.sla_target}%`},series:[{vals:S.sla,color:'var(--a3)',label:'Fixed in time'}]},
    [[toTarget?`Target met around ${ahead(toTarget)}`:'Target not in reach at this pace',`Rising ${f1(bSla)} points a week, with ${f1(L.sla_target-last(S.sla))} points still to go.`],[`Fix time near ${f1(Math.max(0,last(S.mttr)+bMttr*FC))} days by ${ahead(FC)}`,`Days to fix a critical are moving ${sgn(bMttr,1)} a week.`],
     ['Two teams decide the date',`${[...DATA.owners].sort((a,b)=>a.sla_pct-b.sla_pct).slice(0,2).map((r)=>r.team).join(' and ')} are furthest from target. The line above moves only as fast as they do.`]]),
   ...aiBlock('remediation')]};

V.detection=()=>{const A=AREAS.detection,k=outlier(S.inc),other=S.inc.map((v,i)=>v-S.sevC[i]-S.sevH[i]),bCont=slope(S.cont),bFp=slope(S.fp),bR=slope(S.rsla);
  const cmax=Math.max(...Q.categories.map((c)=>c.now)),qmax=Math.max(...Q.queue.map((q)=>q.count));
  const grid=el('div','attack');Q.attack.forEach((t)=>{const me=el('div','meter'),f=el('i');f.style.width=t.coverage+'%';f.style.background=t.coverage<50?'var(--crit)':'linear-gradient(90deg,var(--a2),var(--a1))';me.append(f);me.setAttribute('aria-hidden','true');
    grid.append(el('div','tac'+(t===lowTac?' low':''),el('span','tn',t.tactic),el('span','tv',t.coverage+'%'),me,el('span','cap',`${t.incidents} incident${t.incidents===1?'':'s'} this quarter`)))});
  return[vhead('SOC operations',[A.what],A.tone,A.state),band('What happened this week'),funnel(),socTiles(),
   band('Pattern over 12 weeks'),el('div','two',
     chartCard('Incidents by severity',{label:'Incidents raised each week by severity',stacked:true,end:false,flag:k,series:[{vals:S.sevC,color:'var(--crit)',label:'Critical'},{vals:S.sevH,color:'var(--warn)',label:'High'},{vals:other,color:'var(--a1)',label:'Medium and low'}],extra:(i)=>[['All incidents',f0(S.inc[i])]]}),
     chartCard('Alerts received',{label:'Alerts received each week',end:true,flag:outlier(S.alerts),series:[{vals:S.alerts,color:'var(--a1)',label:'Alerts'},{vals:S.tri,color:'var(--a2)',label:'Investigated',fill:false}]}),
     chartCard('Minutes to detect and to acknowledge',{label:'Average minutes to detect and to acknowledge by week',end:true,series:[{vals:S.mttd,color:'var(--a1)',label:'Detect'},{vals:S.mtta,color:'var(--a3)',label:'Acknowledge',fill:false}]}),
     chartCard('Alerts that were false alarms',{label:'Share of investigated alerts that were false alarms, by week',end:true,unit:'%',series:[{vals:S.fp,color:'var(--a2)',label:'False alarms'}]})),
   band('What the incidents were, and what is still open'),el('div','two',
     el('section','card',el('div','ph',el('h2','h','Incidents by type'),el('span','cap','This week, with last week in brackets')),rowsBars(Q.categories.map((c)=>[c.name,c.now,`${c.now} (${c.previous})`]),cmax,'linear-gradient(90deg,var(--a2),var(--a1))')),
     el('section','card',el('div','ph',el('h2','h','Open incidents by age'),el('span','cap',`${last(S.oinc)} still open`)),rowsBars(Q.queue.map((q)=>[q.age,q.count,String(q.count),q.breach?'var(--crit)':null]),qmax,'linear-gradient(90deg,var(--a2),var(--a1))'),el('p','note','Red is older than the agreed time to close.'))),
   band('Where the alerts come from'),el('div','two',R.hostsAlert(),R.rules()),
   band('Where detection is thin'),el('section','card',el('div','ph',el('h2','h','Detection coverage by attack stage'),el('span','cap','Share of known techniques in each MITRE ATT&CK stage that have a detection rule')),grid),
   band('Where it is heading'),heading('Hours to contain, carried forward',{label:'Average hours to contain an incident with a six-week projection',fc:FC,dec:true,clamp:[0,1e9],series:[{vals:S.cont,color:'var(--a1)',label:'Hours to contain'}]},
    [[`Containment near ${f1(Math.max(0,last(S.cont)+bCont*FC))} hours by ${ahead(FC)}`,`Moving ${sgn(bCont,1)} hours a week, down from ${f1(S.cont[0])} twelve weeks ago.`],[`False alarms near ${f0(Math.max(0,last(S.fp)+bFp*FC))}% of investigated alerts`,`Moving ${sgn(bFp,1)} points a week. Each point is analyst time returned to real incidents.`],
     [k>=0?`One week stands out: ${day(W[k].week_ending)}`:'No week stands out',k>=0?`${S.inc[k]} incidents, ${S.sevC[k]} critical, and ${f0(S.alerts[k])} alerts. Containment slowed to ${f1(S.cont[k])} hours.`:'Volumes have stayed inside their usual range.']]),
   ...aiBlock('detection')]};

V.email=()=>{const A=AREAS.email,tmax=Math.max(...M.types.map((t)=>t.share)),lmax=Math.max(...M.lures.map((t)=>t.share)),dmax=Math.max(...M.simulation.departments.map((d)=>d.click_pct)),sim=M.simulation,cmax=Math.max(...sim.campaign_click_pct),bar='linear-gradient(90deg,var(--a2),var(--a1))';
  return[vhead('Email and phishing',[A.what],A.tone,A.state),band('What happened this week'),
   funnelCard([['Phishing emails blocked',last(S.blocked),chg(S.blocked),`${f1(last(S.catch))}% of all phishing was stopped before delivery`],['Reached an inbox',last(S.del),chg(S.del),'Judged to be phishing after delivery'],['Reported by staff',last(S.rep),chg(S.rep),'Suspicious emails sent to the SOC','higher'],['Clicked',last(S.clk),chg(S.clk),`${f1(last(S.rate))}% of those that reached an inbox`],['Entered a password',last(S.creds),chg(S.creds),'Accounts reset the same day']],'five'),
   el('section','stats',stat('Stopped before delivery',last(S.catch),'%',1,chg(S.catch),'higher',S.catch,'var(--a3)'),stat('Click rate',last(S.rate),'%',1,chg(S.rate),'lower',S.rate,'var(--a2)'),stat('Reported by staff',last(S.rep),'',0,chg(S.rep),'higher',S.rep),stat('Minutes to the first report',last(S.ttr),'min',0,chg(S.ttr),'lower',S.ttr,'var(--a3)')),
   band('Pattern over 12 weeks'),el('div','two',chartCard('Reached inboxes and clicked',{label:'Phishing emails that reached inboxes and clicks by week',end:true,flag:outlier(S.del),series:[{vals:S.del,color:'var(--a1)',label:'Reached an inbox'},{vals:S.clk,color:'var(--crit)',label:'Clicked',fill:false}]}),
     chartCard('Click rate',{label:'Share of delivered phishing emails that were clicked, by week',end:true,dec:true,unit:'%',series:[{vals:S.rate,color:'var(--a2)',label:'Click rate'}]}),
     chartCard('Phishing blocked',{label:'Phishing emails blocked before delivery, by week',end:true,flag:outlier(S.blocked),series:[{vals:S.blocked,color:'var(--a1)',label:'Blocked'}]}),
     chartCard('Reported by staff, and how fast',{label:'Suspicious emails reported by staff and minutes to the first report, by week',end:true,series:[{vals:S.rep,color:'var(--a1)',label:'Reports'},{vals:S.ttr,color:'var(--a3)',label:'Minutes to first report',fill:false}]})),
   band('What the phishing looked like'),el('div','two',
     el('section','card',el('div','ph',el('h2','h','By technique'),el('span','cap','Share of this week’s phishing')),rowsBars(M.types.map((t)=>[t.name,t.share,t.share+'%']),tmax,bar)),
     el('section','card',el('div','ph',el('h2','h','What it pretended to be'),el('span','cap','Share of this week’s phishing')),rowsBars(M.lures.map((t)=>[t.name,t.share,t.share+'%']),lmax,bar))),
   band('Who is being targeted'),el('div','two',R.targets(),R.clickers()),
   band('Staff awareness: simulated phishing'),el('div','two',
     el('section','card',el('div','ph',el('h2','h','Who clicked, by department'),el('span','cap',`${sim.name}: ${f0(sim.sent)} sent, ${sim.reported_pct}% reported it`)),rowsBars([...sim.departments].sort((a,b)=>b.click_pct-a.click_pct).map((d)=>[d.name,d.click_pct,d.click_pct+'%',d.click_pct>sim.target_pct?'var(--crit)':null]),dmax,bar),el('p','note',`Red is above the ${sim.target_pct}% target for clicks.`)),
     el('section','card',el('div','ph',el('h2','h','Click rate, last six campaigns'),el('span','cap','Oldest first')),rowsBars(sim.campaign_click_pct.map((v,i)=>[sim.campaign_names[i],v,v+'%']),cmax,bar))),
   band('Where it is heading'),heading('Volume, carried forward',{label:'Phishing emails that reached inboxes with a six-week projection',fc:FC,clamp:[0,1e9],series:[{vals:S.del,color:'var(--a1)',label:'Reached an inbox'}]},
    [[`About ${f0(Math.max(0,last(S.del)+bDel*FC))} a week by ${ahead(FC)}`,`Volume is moving ${sgn(bDel,1)} a week, down from ${S.del[0]} twelve weeks ago.`],[`Click rate near ${f1(Math.max(0,last(S.rate)+bRate*FC))}%`,`The rate is moving ${sgn(bRate,2)} points a week over six weeks, but rose this week from ${f1(prev(S.rate))}% to ${f1(last(S.rate))}%.`],
     [`Staff report in ${last(S.ttr)} minutes`,`Down from ${S.ttr[0]} twelve weeks ago, with ${last(S.rep)} reports this week against ${S.rep[0]} then.`]]),
   ...aiBlock('email')]};

V.people=()=>{const A=AREAS.people,dmax=Math.max(...T.dlp_types.map((d)=>d.count)),bar='linear-gradient(90deg,var(--a2),var(--a1))',bD=slope(S.dlp),bS=slope(S.rsign),bU=slope(S.unv);
  return[vhead('Users and apps',[A.what],A.tone,A.state),band('What happened this week'),
   el('section','stats five',stat('Data loss violations',last(S.dlp),'',0,chg(S.dlp),'lower',S.dlp),stat('Risky sign-ins',last(S.rsign),'',0,chg(S.rsign),'lower',S.rsign,'var(--a3)'),stat('Failed second-factor checks',last(S.mfa),'',0,chg(S.mfa),'lower',S.mfa,'var(--a2)'),stat('Unapproved apps in use',last(S.shadow),'',0,chg(S.shadow),'lower',S.shadow,'var(--a3)'),stat('Privileged accounts not vaulted',last(S.unv),'',0,chg(S.unv),'lower',S.unv,'var(--a2)')),
   band('Pattern over 12 weeks'),el('div','two tri',chartCard('Data loss violations',{label:'Data loss policy violations by week',end:true,flag:outlier(S.dlp),series:[{vals:S.dlp,color:'var(--a1)',label:'Violations'}]}),
     chartCard('Risky sign-ins and failed second-factor checks',{label:'Risky sign-ins and failed second-factor checks by week',end:true,flag:outlier(S.rsign),series:[{vals:S.mfa,color:'var(--a2)',label:'Failed second factor',fill:false},{vals:S.rsign,color:'var(--a1)',label:'Risky sign-ins'}]}),
     chartCard('Unapproved apps and unvaulted accounts',{label:'Unapproved apps in use and privileged accounts not vaulted, by week',end:true,series:[{vals:S.shadow,color:'var(--a1)',label:'Unapproved apps'},{vals:S.unv,color:'var(--a3)',label:'Not vaulted',fill:false}]})),
   band('Who and what'),el('div','two',R.appUsers(),R.apps()),
   el('div','two',R.priv(),el('section','card',el('div','ph',el('h2','h','What kind of data was involved'),el('span','cap','Data loss violations this week')),rowsBars(T.dlp_types.map((d)=>[d.name,d.count,String(d.count)]),dmax,bar))),
   el('p','note','People appear as an identifier with their department. Names are held back so the page can be shared; the SOC can look up an identifier in the source system.'),
   band('Where it is heading'),heading('Data loss violations, carried forward',{label:'Data loss violations with a six-week projection',fc:FC,clamp:[0,1e9],series:[{vals:S.dlp,color:'var(--a1)',label:'Violations'}]},
    [[`About ${f0(Math.max(0,last(S.dlp)+bD*FC))} a week by ${ahead(FC)}`,`Violations are moving ${sgn(bD,1)} a week, down from ${S.dlp[0]} twelve weeks ago.`],[`Risky sign-ins near ${f0(Math.max(0,last(S.rsign)+bS*FC))}`,`Moving ${sgn(bS,1)} a week.`],[`Unvaulted privileged accounts near ${f0(Math.max(0,last(S.unv)+bU*FC))}`,`Moving ${sgn(bU,1)} a week. CyberArk data is a week old, so read this as last week's position.`]]),
   ...aiBlock('people')]};
V.controls=()=>{const A=AREAS.controls,grid=el('section','sys-grid');
  DATA.tools.forEach((t)=>{const late=t.extracted<newest,hist=DATA.trend[t.system],b=slope(hist),pj=t.unit==='%'?Math.min(100,hist[n-1]+b*FC):Math.max(0,hist[n-1]+b*FC),v=el('span'),sp=el('div','spark'),me=el('div','meter'),fill=el('i');
    fill.style.width=t.coverage_pct+'%';fill.style.background='linear-gradient(90deg,var(--a1),var(--a2))';me.append(fill);me.setAttribute('aria-hidden','true');
    grid.append(el('article','card sysc lift',el('div','top',el('div','name',t.system),el('span','pill '+(late?'warn':'ok'),(late?'Late · ':'Current · ')+day(t.extracted))),el('div','area',t.watches),el('div','num',v,t.unit?el('span','unit',t.unit):null),
      el('div','',deltaEl(t.value-t.previous,t.better,false),' ',el('span','cap',`from ${f0(t.previous)}${t.unit} last week`)),el('div','mlabel',t.measure),sp,el('div','heading',el('b','','Heading: '),`about ${f0(pj)}${t.unit} by ${ahead(FC)}`),el('div','cov',el('span','','Coverage'),el('b','',t.coverage_pct+'%')),me));
    after.push(()=>{count(v,t.value,false);spark(sp,hist,t.better==='higher'?'var(--a3)':'var(--a2)')})});
  const CT=95,cov=[...DATA.tools].sort((a,b)=>a.coverage_pct-b.coverage_pct),rings=el('div','rings'),unseen=(t)=>Math.round(t.in_scope*(100-t.coverage_pct)/100),under=cov.filter((t)=>t.coverage_pct<CT);
  cov.forEach((t,i)=>{const R=46,C=2*Math.PI*R,col=t.coverage_pct<90?'var(--crit)':t.coverage_pct<CT?'var(--warn)':'var(--a1)',a=(CT/100)*2*Math.PI-Math.PI/2,gap=unseen(t);
    const s=sv('svg',{viewBox:'0 0 112 112',role:'img','aria-label':`${t.system} covers ${t.coverage_pct}% of ${f0(t.in_scope)} ${t.scope_unit}`});
    const arc=sv('circle',{cx:56,cy:56,r:R,fill:'none',stroke:col,'stroke-width':10,'stroke-linecap':'round','stroke-dasharray':`${C*t.coverage_pct/100} ${C}`,transform:'rotate(-90 56 56)'});
    s.append(sv('circle',{cx:56,cy:56,r:R,fill:'none',stroke:'color-mix(in srgb,var(--fg) 9%,transparent)','stroke-width':10}),arc,sv('line',{x1:56+38*Math.cos(a),y1:56+38*Math.sin(a),x2:56+54*Math.cos(a),y2:56+54*Math.sin(a),stroke:'var(--fg)','stroke-width':2.5,'stroke-linecap':'round'}));
    const g=el('span','gap');if(gap)g.append(el('b','',f0(gap)),` of ${f0(t.in_scope)} ${t.scope_unit} not covered`);else g.append(`All ${f0(t.in_scope)} ${t.scope_unit} covered`);
    rings.append(el('div','ringc'+(i===0&&t.coverage_pct<CT?' low':t.coverage_pct<CT?' mid':''),el('figure','',s,el('figcaption','',t.coverage_pct+'%')),el('span','rn',t.system),g))});
  const sw=(c)=>{const x=el('span','sw');x.style.background=c;return x};
  const covCard=el('section','card',el('div','covhead',
    el('div','covsum',el('span','cap','Systems under the coverage target'),el('div','num',`${under.length} of ${cov.length}`),(()=>{const p=el('p');p.append(el('b','',cov[0].system),` has the largest gap: ${f0(unseen(cov[0]))} ${cov[0].scope_unit} it cannot see. `,under.length>1?`${under.slice(1).map((t)=>t.system).join(', ')} ${under.length>2?'are':'is'} also under ${CT}%.`:'');return p})()),
    rings),el('div','keyrow',el('span','',sw('var(--a1)'),`At or above ${CT}%`),el('span','',sw('var(--warn)'),`Under ${CT}%`),el('span','',sw('var(--crit)'),'Under 90%'),el('span','','The mark on each ring is the target.')));
  return[vhead('Control areas',[A.what],A.tone,A.state),band('What happened, the 12-week pattern and where each is heading'),grid,el('p','note',`Each projection is a straight line through that system's last six weeks, carried forward to ${ahead(FC)}.`),
   band('Blind spots: what each system cannot see'),covCard,...aiBlock('controls')]};

V.signals=()=>{const g=el('section','signals');const order={High:0,Medium:1,Low:2};[...DATA.notes].sort((a,b)=>(order[a.confidence]??3)-(order[b.confidence]??3)).forEach((r)=>g.append(signal(r)));
  return[vhead('Signals',['Patterns across systems that no single rule or report would show, with the figures behind each and where to look next. Prepared each week from the latest figures; treat them as leads to check, not conclusions. Week ending '+day(DATA.notes[0].based_on_week)+'.'],'',''),g]};
V.build=()=>{const t=$('#build-tpl').content.cloneNode(true),ch=t.querySelector('#sys-chips');DATA.tools.forEach((x)=>ch.append(el('li','',x.system)));
  return[vhead('How it is built and secured',['None of the systems is connected yet. This is the route from sample data to live.'],'',''),t]};

/* shell */
/* Pages fed from Sentinel queries (domains.json): cloud, DevSecOps, SAP and any added later. */
const DOMS=DATA.domains||[];
DOMS.forEach((d)=>{
  const ms=d.measures.filter((m)=>m.values&&m.values.length>1);
  if(d.status!=='live'){AREAS[d.id]={name:d.title,tone:'',state:'Planned',what:'Not connected yet.',go:d.intro}}
  else if(ms.length){const m=ms[0],v=m.values.map(Number),c=r1(last(v)-prev(v)),b=slope(v),up=(m.better||'lower')==='higher',good=up?c>=0:c<=0,u=m.unit||'';
    AREAS[d.id]={name:d.title,tone:good?'ok':'bad',state:good?'Improving':'Worsening',what:`${m.label}: ${f0(last(v))}${u}, ${sgn(c)} on last week.`,go:`Moving ${sgn(b,1)} a week. Near ${f0(Math.max(0,last(v)+b*FC))}${u} by ${ahead(FC)}.`}}
  V[d.id]=()=>domainView(d)});
function domainView(d){
  const A=AREAS[d.id]||{};
  if(d.status!=='live'){const ul=el('ul','list');(d.will_show||[]).forEach((t)=>ul.append(el('li','',t)));
    return[vhead(d.title,[d.intro],'warn','Planned'),el('section','card',el('h2','h','Not connected yet'),el('p','sub',d.needs),el('h3','h','What this page will show'),ul)]}
  const ms=d.measures.filter((m)=>m.values&&m.values.length>1),tiles=el('section','stats'),charts=el('div','two'),from=el('div','two');
  ms.slice(0,4).forEach((m)=>{const v=m.values.map(Number);tiles.append(stat(m.label,last(v),m.unit||'',m.decimals?1:0,r1(last(v)-prev(v)),m.better||'lower',v,'var(--a1)'))});
  ms.forEach((m)=>charts.append(chartCard(m.label,{label:`${m.label} by week`,end:true,flag:(m.better||'lower')==='lower'?outlier(m.values.map(Number)):-1,unit:m.unit==='%'?'%':'',series:[{vals:m.values.map(Number),color:'var(--a1)',label:m.label}]})));
  d.breakdowns.filter((b)=>b.rows.length).forEach((b)=>{const max=Math.max(...b.rows.map((r)=>Number(r[1])));from.append(el('section','card',el('div','ph',el('h2','h',b.title),el('span','cap',b.sub)),rowsBars(b.rows.map((r)=>[r[0],Number(r[1]),f0(Number(r[1]))]),max,'linear-gradient(90deg,var(--a2),var(--a1))')))});
  d.ranked.filter((r)=>r.rows.length).forEach((r)=>from.append(rank(r.title,r.sub,r.columns,r.rows.map((x)=>[[x[0],x[1]],...x.slice(2).map(Number)]))));
  const out=[vhead(d.title,[d.intro],A.tone,A.state)];
  if(d.state!=='live')out.push(el('p','sample',`Some figures on this page are sample data until the matching feed reaches Sentinel. Needed: ${d.needs}`));
  out.push(band('What happened this week'),tiles,band('Pattern over 12 weeks'),charts);
  if(from.children.length)out.push(band('Where it comes from'),from);
  if(ms.length){const m=ms[0],v=m.values.map(Number),b=slope(v),u=m.unit||'';
    out.push(band('Where it is heading'),heading(`${m.label}, carried forward`,{label:`${m.label} with a six-week projection`,fc:FC,clamp:u==='%'?[0,100]:[0,1e9],unit:u==='%'?'%':'',series:[{vals:v,color:'var(--a1)',label:m.label}]},
      [[`About ${f0(Math.max(0,last(v)+b*FC))}${u} by ${ahead(FC)}`,`Moving ${sgn(b,1)} a week over the last six weeks.`],...ms.slice(1,3).map((x)=>{const w=x.values.map(Number),bb=slope(w);return[`${x.label}: about ${f0(Math.max(0,last(w)+bb*FC))}${x.unit||''}`,`Moving ${sgn(bb,1)} a week.`]})]))}
  return[...out,...aiBlock(d.id)]}

/* Executive view: outcomes against targets, the week in brief, top risks and signals. */
const OC=(DATA.outcomes&&DATA.outcomes.outcomes)||[];
const lcFirst=(t)=>/^[A-Z][a-z]/.test(t)?t[0].toLowerCase()+t.slice(1):t;
const fmtNow=(m)=>typeof m.now==='number'?(Number.isInteger(m.now)?f0(m.now):f1(m.now))+(m.unit==='%'?'%':m.unit?' '+m.unit:''):(m.now??'—');
const fmtTarget=(m)=>m.text?'—':m.target==null?'To be agreed':(m.better==='higher'?'≥ ':'≤ ')+(m.unit==='%'?m.target+'%':m.target+(m.unit?' '+m.unit:''));
function against(m){if(m.text)return el('span','pill ok','In place');if(m.target==null)return el('span','pill','Target to be set');if(m.meets==null)return el('span','pill','No data yet');
  if(m.meets)return el('span','pill ok','Met');const gap=Math.abs(m.now-m.target),u=m.unit==='%'?' pts':m.unit?' '+m.unit:'';return el('span','pill bad',`${Number.isInteger(gap)?gap:f1(gap)}${u} to go`)}
function scorecard(){const tb=el('tbody');
  ['Business','Technical'].forEach((type)=>{const rows=OC.filter((o)=>o.type===type);if(!rows.length)return;
    const gh=el('tr','grp');const th=el('th','',type+' outcomes');th.colSpan=7;th.scope='colgroup';gh.append(th);tb.append(gh);
    rows.forEach((o)=>o.measures.forEach((m,i)=>{const tr=el('tr',i?'cont':'');
      if(!i){const td=el('td','oc',el('b','',o.outcome));td.rowSpan=o.measures.length;tr.append(td)}
      const now=el('td','num',fmtNow(m));if(m.source==='sample')now.append(el('small','smp',' sample'));
      tr.append(el('td','',m.label),el('td','num',fmtTarget(m)),now,el('td','',against(m)));
      if(!i){const st=el('td','',el('span','pill '+(o.status==='Realised'?'ok':''),o.status));st.rowSpan=o.measures.length;const ev=el('td','ev',o.evidence);ev.rowSpan=o.measures.length;tr.append(st,ev)}
      if(m.note)tr.title=m.note;tb.append(tr)}))});
  const hr=el('tr');['Outcome','Measure','Target','Now','Against target','Status','Evidence'].forEach((h)=>{const t=el('th','',h);t.scope='col';hr.append(t)});
  return el('section','card',el('div','ph',el('h2','h',(DATA.outcomes&&DATA.outcomes.title)||'Outcomes'),el('span','cap','Hover a measure to see how it is calculated')),el('div','scroll',el('table','score',el('thead','',hr),tb)))}
/* Any period, against the period before: totals, verdicts and the actions they lead to. */
const DY=DATA.daily||[],DYS=DATA.daily_sources||{};
const addDays=(iso,n)=>{const d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const spanDays=(a,b)=>Math.round((new Date(b)-new Date(a))/864e5)+1;
const ocTarget=(label,dflt)=>{for(const o of OC)for(const m of o.measures)if(m.label===label&&m.target!=null)return m.target;return dflt};
function agg(rows){const s=(k)=>rows.reduce((a,r)=>a+(Number(r[k])||0),0),inc=s('incidents'),cl=s('closed'),del=s('phish_delivered');
  return{incidents:inc,high:s('high'),alerts:s('alerts'),mtta:inc?s('mtta_sum')/inc:null,contain:cl?s('contain_sum_h')/cl:null,sla:cl?100*s('within_sla')/cl:null,
    missed:cl-s('within_sla'),fp:inc?100*s('false_positive')/inc:null,blocked:s('phish_blocked'),clickrate:del?100*s('phish_clicked')/del:null,dlp:s('dlp_violations'),net:s('findings_closed')-s('findings_opened')}}
const PM=[['incidents','Incidents','', 'lower',null,0],['high','High-severity incidents','','lower',null,0],['mtta','Average time to acknowledge',' min','lower',ocTarget('Acknowledge an alert',15),0],
  ['contain','Average time to contain',' h','lower',ocTarget('Median containment',24),1],['sla','Closed inside the agreed time','%','higher',ocTarget('Adherence to SOC service levels',98),1],
  ['fp','Incidents that were false alarms','%','lower',null,0],['clickrate','Phishing click rate','%','lower',null,1],['dlp','Data loss violations','','lower',null,0],
  ['net','Findings closed minus opened','','higher',0,0],['blocked','Phishing emails blocked','','neutral',null,0]];
function verdict(v,pv,better,target){
  if(v==null)return['No data','',''];
  if(target!=null){const ok=better==='lower'?v<=target:v>=target;return ok?['On target','ok',`target ${better==='lower'?'≤':'≥'} ${target}`]:['Off target','bad',`target ${better==='lower'?'≤':'≥'} ${target}`]}
  if(better==='neutral'||pv==null||pv===0)return['','',''];
  const ch=(v-pv)/Math.abs(pv);if(Math.abs(ch)<0.03)return['Steady','',''];
  return(better==='lower'?ch<0:ch>0)?['Better than before','ok','']:['Worse than before','warn','']}
function periodActions(c,p,from,to){const out=[],worstT=[...DATA.owners].sort((a,b)=>b.overdue-a.overdue)[0];
  const t=(k)=>PM.find((m)=>m[0]===k)[4];
  if(c.sla!=null&&c.sla<t('sla'))out.push({d:true,t:'Raise the service-level shortfall with the managed SOC provider',w:`${f1(c.sla)}% of incidents closed inside the agreed time against ${t('sla')}%; ${c.missed} missed it.`,o:'SOC service owner',go:'detection'});
  if(c.mtta!=null&&c.mtta>t('mtta'))out.push({t:'Review alert routing and out-of-hours cover',w:`Alerts took ${f0(c.mtta)} minutes on average to acknowledge against ${t('mtta')}.`,o:'SOC lead',go:'detection'});
  if(c.contain!=null&&c.contain>t('contain'))out.push({t:'Review containment playbooks for the slowest incident types',w:`Containment averaged ${f1(c.contain)} hours against ${t('contain')}.`,o:'Incident response lead',go:'detection'});
  if(c.net<0)out.push({d:true,t:`Agree extra remediation capacity, starting with ${worstT.team}`,w:`${-c.net} more findings were opened than closed. ${worstT.team} holds ${worstT.overdue} overdue findings.`,o:'Heads of the owning teams',go:'remediation'});
  if(p.high&&c.high>p.high*1.2&&c.high-p.high>=3)out.push({t:'Brief leadership on the rise in high-severity incidents',w:`${c.high} high-severity incidents against ${p.high} in the period before.`,o:'Head of security operations',go:'detection'});
  if(c.clickrate!=null&&p.clickrate!=null&&c.clickrate>p.clickrate+0.5){const sim=DATA.mail.simulation,hi=sim.departments.filter((x)=>x.click_pct>sim.target_pct).map((x)=>x.name);
    out.push({t:'Run a targeted phishing simulation'+(hi.length?' for '+hi.join(', '):''),w:`Click rate rose to ${f1(c.clickrate)}% from ${f1(p.clickrate)}%.`,o:'Security awareness lead',go:'email'})}
  if(p.dlp&&c.dlp>p.dlp*1.1)out.push({t:'Review the top data loss policies with data owners',w:`${f0(c.dlp)} violations against ${f0(p.dlp)} in the period before.`,o:'Data protection lead',go:'people'});
  if(c.fp!=null&&c.fp>35)out.push({t:'Tune the noisiest detection rules',w:`${f0(c.fp)}% of incidents were false alarms, taking analyst time from real ones.`,o:'Detection engineering',go:'detection'});
  OC.forEach((o)=>o.measures.forEach((m)=>{if(m.meets===false&&!['Acknowledge an alert','Median containment','Adherence to SOC service levels'].includes(m.label))
    out.push({d:true,t:`Close the gap on ${lcFirst(m.label)}`,w:`${fmtNow(m)} against ${fmtTarget(m).replace('≥ ','').replace('≤ ','')} (${o.outcome}).`,o:'Programme sponsor',go:'exec'})}));
  return out.sort((a,b)=>(b.d?1:0)-(a.d?1:0))}
function periodChart(box,cur,prev,labels,onPick){
  const draw=()=>{box.replaceChildren();const w=Math.max(280,box.clientWidth),h=220,m={l:36,r:10,t:14,b:26},n=cur.length,max=nice(Math.max(1,...cur,...prev.filter((v)=>v!=null)));
    const bw=(w-m.l-m.r)/n,x=(i)=>m.l+i*bw+bw/2,y=(v)=>h-m.b-v/max*(h-m.t-m.b),svg=sv('svg',{viewBox:`0 0 ${w} ${h}`,width:'100%',height:h,role:'img','aria-label':`Incidents per ${labels.unit} in the period, with the period before as a dashed line`});
    for(let k=0;k<=4;k++){const v=max*k/4;svg.append(sv('line',{x1:m.l,x2:w-m.r,y1:y(v),y2:y(v),stroke:'var(--grid)'}),sv('text',{x:m.l-6,y:y(v)+3.5,'text-anchor':'end',class:'tick'},f0(v)))}
    cur.forEach((v,i)=>svg.append(sv('rect',{x:x(i)-Math.max(1,bw*0.32),y:y(v),width:Math.max(2,bw*0.64),height:Math.max(0,y(0)-y(v)),rx:Math.min(3,bw*0.2),fill:'var(--a1)'})));
    const pts=prev.map((v,i)=>v==null?null:`${x(i).toFixed(1)},${y(v).toFixed(1)}`).filter(Boolean);if(pts.length>1)svg.append(sv('path',{d:'M'+pts.join('L'),fill:'none',stroke:'var(--dim)','stroke-width':1.6,'stroke-dasharray':'4 4'}));
    const every=Math.max(1,Math.ceil(n/Math.max(2,Math.floor((w-m.l-m.r)/64))));for(let i=n-1;i>=0;i-=every)svg.append(sv('text',{x:x(i),y:h-7,'text-anchor':'middle',class:'tick'},labels.at[i]));
    const tip=el('div','tip');tip.hidden=true;const hit=sv('rect',{x:m.l,y:0,width:w-m.l-m.r,height:h,fill:'transparent'});svg.append(hit);box.append(svg,tip);
    const mv=(ev)=>{const b=svg.getBoundingClientRect(),i=Math.max(0,Math.min(n-1,Math.floor(((ev.clientX-b.left)*w/b.width-m.l)/bw)));tip.replaceChildren(el('div','',labels.at[i]),el('div','',el('span','','Incidents'),el('b','',f0(cur[i]))),el('div','',el('span','','Period before'),el('b','',prev[i]==null?'—':f0(prev[i]))));
      tip.hidden=false;const k=b.width/w,tw=tip.offsetWidth;let left=x(i)*k+12;if(left+tw>box.clientWidth)left=x(i)*k-tw-12;tip.style.left=Math.max(0,left)+'px'};
    hit.addEventListener('pointermove',mv);hit.addEventListener('pointerdown',mv);hit.addEventListener('pointerleave',()=>{tip.hidden=true});
    if(onPick){hit.style.cursor='pointer';hit.addEventListener('click',(ev)=>{const b=svg.getBoundingClientRect();onPick(Math.max(0,Math.min(n-1,Math.floor(((ev.clientX-b.left)*w/b.width-m.l)/bw))))})}};
  draw();watch(box,draw)}
function bucket(rows,size){const out=[];for(let i=0;i<rows.length;i+=size)out.push(rows.slice(i,i+size));return out}
function periodSection(){
  const wrap=el('section','period'),body=el('div','pbody');
  const lastDay=DY.length?DY[DY.length-1].date:null,firstDay=DY.length?DY[0].date:null;
  const P={day:1,week:7,month:30,quarter:90,year:365};const cur=FILTER.period;
  const render=()=>{body.replaceChildren();if(!DY.length){body.append(el('p','note','No daily figures yet.'));return}
    let to=lastDay,from;if(cur==='custom'){from=FILTER.from;to=FILTER.to;if(!from||!to||from>to){body.append(el('p','note','Choose a start and end date.'));return}}else from=addDays(to,-(P[cur]-1));
    const len=spanDays(from,to),pf=addDays(from,-len),pt=addDays(from,-1),rows=DY.filter((r)=>r.date>=from&&r.date<=to),prow=DY.filter((r)=>r.date>=pf&&r.date<=pt),c=agg(rows),p=agg(prow),hasPrev=prow.length===len;
    const yr=from.slice(0,4)!==to.slice(0,4),dfmt=(iso)=>new Date(iso+'T00:00:00Z').toLocaleDateString('en-GB',{day:'numeric',month:'short',timeZone:'UTC',...(yr?{year:'numeric'}:{})});
    const withT=PM.filter((m)=>m[4]!=null&&c[m[0]]!=null),onT=withT.filter((m)=>(m[3]==='lower'?c[m[0]]<=m[4]:c[m[0]]>=m[4])).length,acts=periodActions(c,hasPrev?p:{},from,to);
    const lead=el('p','plead');const before=len===1?'the day before':len===365?'the 12 months before':`the ${len} days before`;
    lead.append(el('b','',len===1?dfmt(to):`${dfmt(from)} to ${dfmt(to)}`),` (${len===1?'1 day':len+' days'}). `,el('b','',f0(c.incidents)),` incidents`,hasPrev&&p.incidents?` (${sgn(Math.round((c.incidents-p.incidents)/p.incidents*100))}% on ${before})`:'',
      `, contained in ${c.contain==null?'—':f1(c.contain)} hours on average. `,el('b','',`${onT} of ${withT.length}`),' measures with a target are on target. ',el('b','',`${acts.length} action${acts.length===1?'':'s'}`),acts.filter((a)=>a.d).length?`, ${acts.filter((a)=>a.d).length} needing a decision.`:'.');
    const tiles=el('div','ptiles');
    const bsize=len<=92?1:7,src=len<=1?DY.filter((r)=>r.date>addDays(to,-14)&&r.date<=to):rows,bk=bucket(src,len<=1?1:bsize);
    PM.forEach(([k,label,u,better,target,dec])=>{const v=c[k],pv=hasPrev?p[k]:null,[vt,tone,tn]=verdict(v,pv,better,target),sp=el('div','spark');
      const val=v==null?'—':(dec?f1(v):f0(v))+u,cmp=pv==null||v==null?'':`${dec?f1(pv):f0(pv)}${u} in the period before`;
      tiles.append(el('div','card ptile'+(tiles.children.length>=5?' xtra':''),el('span','cap',label),el('div','num',val),el('div','pcmp',cmp),el('div','pv',vt?el('span','pill '+tone,vt):null,tn?el('span','cap',' '+tn):null)));
      const series=bk.map((g)=>{const a=agg(g);return a[k]==null?0:a[k]});});
    const cbox=el('div','chart'),curV=bk.map((g)=>agg(g).incidents),prevRows=len<=1?[]:prow,pv=bucket(prevRows,bsize).map((g)=>agg(g).incidents);
    const labels={unit:len<=1||bsize===1?'day':'week',at:bk.map((g)=>bsize===1||len<=1?dfmt(g[0].date):'w/c '+dfmt(g[0].date))};const pickB=(i)=>{const g=bk[i],a=agg(g),pa=bucket(prevRows,bsize)[i];const pr=pa?agg(pa):{};drill(`Incidents, ${labels.at[i]}`,g.length>1?`${dfmt(g[0].date)} to ${dfmt(g[g.length-1].date)}`:dfmt(g[0].date),
      PM.map(([k,label,u,bt,tg,dec])=>[label,a[k]==null?'—':(dec?f1(a[k]):f0(a[k]))+u+(pr[k]!=null&&a[k]!=null?`  (before: ${dec?f1(pr[k]):f0(pr[k])}${u})`:''),tg!=null&&a[k]!=null&&(bt==='lower'?a[k]>tg:a[k]<tg)?'alert':'']),[el('p','note','Bracketed figures are the matching '+labels.unit+' of the period before.')],'detection')};
    after.push(()=>periodChart(cbox,curV,curV.map((_,i)=>pv[i]??null),labels,pickB));
    const al=el('ul','actions');if(!acts.length)al.append(el('li','',el('span','pill ok','No action'),el('div','',el('b','','Every measure is on target or improving.'))));
    acts.forEach((a)=>{const go=el('button','link sm','Open');go.type='button';go.addEventListener('click',()=>show(a.go,true));al.append(el('li','',el('span','pill '+(a.d?'bad':'warn'),a.d?'Decision needed':'Action'),el('div','',el('b','',a.t),el('p','',a.w)),el('div','aowner',el('span','cap',a.o),go)))});
    body.append(lead,tiles,el('div','two wide',el('section','card',el('div','ph',el('h2','h',`Incidents per ${labels.unit}`),el('span','cap','Bars: this period. Dashed: the period before. Select a bar for its figures.')),cbox),
      el('section','card',el('div','ph',el('h2','h','Decisions and actions'),el('span','cap','From the figures above')),al)));
    if(Object.values(DYS).includes('sample'))body.append(el('p','note',`Sample figures: ${Object.keys(DYS).filter((k)=>DYS[k]==='sample').length} of ${Object.keys(DYS).length} daily measures are sample data until their source is connected.`));
    if(wrap.isConnected)after.splice(0).forEach((f)=>f())};
  wrap.append(body);render();return wrap}

/* V.exec is defined with the dashboard components further down. */

/* ---------- Role views: executive insights, SOC director, Infrastructure, Engineering (see AUDIENCES.md) ---------- */
const RO=DATA.roles||{},MS=RO.mssp,SI=RO.siem,AI=RO.ai,IN=RO.infra,EN=RO.eng;
const avg=(a)=>a.length?a.reduce((s,v)=>s+v,0)/a.length:0;
const srcNote=(...b)=>b.some((x)=>x&&x.source==='sample')?el('p','note','Some figures on this page are sample data until their source is connected. See AUDIENCES.md for where each comes from.'):null;

/* ---------- Insights: what the figures mean, why it matters, the next step and who owns it ---------- */
const TONE={bad:0,warn:1,ok:2},TAG={bad:'Act now',warn:'Watch',ok:'Going well'};
const etaW=(vals,target,better)=>{const v=last(vals),b=slope(vals);if(better==='higher'?v>=target:v<=target)return 0;if(better==='higher'?b<=0:b>=0)return null;return Math.ceil((target-v)/b)};
const inDays=(d)=>dstr(new Date(Date.now()+d*864e5));
function insights(items,max){const ul=el('ol','ins');[...items].filter(Boolean).sort((a,b)=>TONE[a.tone]-TONE[b.tone]).slice(0,max||4).forEach((it)=>{
    const go=it.go&&it.go!==CURRENT?el('button','link sm','Open'):null;if(go){go.type='button';go.addEventListener('click',()=>show(it.go,true))}
    ul.append(el('li','ins-i',el('span','pill '+it.tone,TAG[it.tone]),el('div','ins-b',el('b','',it.t),el('p','',it.w),it.a?el('p','ins-do',el('span','','Next step. '),it.a):null),el('div','aowner',it.o?el('span','cap',it.o):null,go)))});
  return el('section','card dsays',el('div','ph',el('h2','h','What the data says'),el('span','cap','Worked out from the figures on this page'),CL?briefBtn():null),ul)}

const IX={
 exposure:()=>{const ex=IN.exploitable_exposed;if(!ex.length)return{tone:'ok',t:'No exploitable weakness is open on an internet-facing system.',w:'The highest-risk class of finding is clear.',go:'infra'};
   const byT={};ex.forEach((r)=>byT[r.team]=(byT[r.team]||0)+1);const [tm,c]=Object.entries(byT).sort((a,b)=>b[1]-a[1])[0],ow=DATA.owners.find((o)=>o.team===tm),old=[...ex].sort((a,b)=>b.days_open-a.days_open)[0];
   return{tone:'bad',t:`${ex.length} weaknesses with a public exploit are open on internet-facing systems; the oldest, on ${old.host}, for ${old.days_open} days.`,
     w:`${c} of ${ex.length} sit with ${tm}${ow?`, the team that also holds ${ow.overdue} overdue findings and fixes ${ow.sla_pct}% in time`:''}. This is where an attacker would start.`,
     a:`Agree a fix date with ${tm} this week, or record a formal risk acceptance.`,o:'Security leadership',go:'infra'}},
 provider:()=>{const v=last(MS.sla_pct),k=etaW(MS.sla_pct,98,'higher'),worst=[...MS.by_severity].sort((a,b)=>a.within_pct-b.within_pct)[0];
   if(k===0)return{tone:'ok',t:`The managed SOC met its 98% target last week (${v}%).`,w:`${last(MS.escalations_real_pct)}% of its escalations needed action.`,go:'socdir'};
   return{tone:k==null?'bad':'warn',t:`The managed SOC closed ${v}% of incidents in time against 98%${k?`, and at its current rate of improvement reaches the target around ${ahead(k)}`:', and is not improving'}.`,
     w:`${worst.severity} severity is the gap at ${worst.within_pct}% in time. The figures are from Sentinel's timestamps, not the provider's report.`,
     a:k?`Hold the provider to ${ahead(k)} at the next service review and ask for the ${worst.severity.toLowerCase()}-severity root cause.`:'Raise it formally at the next service review.',o:'Head of security operations',go:'socdir'}},
 siem:()=>{const d=SI.daily_gb,v=avg(d.slice(-7)),b=slope(d,14),low=SI.by_source.filter((s)=>s.detection_value==='Low'),lowGb=sum(low,(s)=>s.gb_per_day),tot=sum(SI.by_source,(s)=>s.gb_per_day),k=b>0?Math.ceil((SI.threshold_gb-v)/b):null;
   return{tone:v>SI.threshold_gb?'bad':k!=null&&k<90?'warn':'ok',t:`SIEM ingestion averages ${f1(v)} GB a day against the ${SI.threshold_gb} GB design threshold${k!=null&&k>0?`, rising about ${f1(b*7)} GB a week; it crosses the threshold around ${inDays(k)}`:''}.`,
     w:`${low.map((s)=>s.source).join(' and ')||'No source'} carry ${Math.round(lowGb/tot*100)}% of the volume and little detection value.`,
     a:low.length?`Move ${low[0].source.toLowerCase()} to a cheaper log tier or filter it before ingestion.`:null,o:'SIEM owner',go:'socdir'}},
 ai:()=>{const d=AI.data_to_ai_mb_week,g=Math.round((last(d)/d[0]-1)*100),top=[...AI.top_apps].filter((a)=>!a.approved).sort((a,b)=>b.upload_mb-a.upload_mb)[0],ok=AI.top_apps.filter((a)=>a.approved);
   return{tone:g>25?'warn':'ok',t:`Data sent to AI apps is up ${g}% in 12 weeks; ${AI.unapproved} of ${AI.apps_in_use} AI apps in use are not approved.`,
     w:`${top.app} is the largest route, with ${f0(top.users)} people uploading ${f0(top.upload_mb)} MB this month, while approved tools (${ok.map((a)=>a.app).join(', ')}) are already available.`,
     a:`Agree the AI use policy and steer people to the approved tools; block uploads to personal accounts.`,o:'Security and technology leadership',go:'ai'}},
 estate:()=>{const eos=sum(IN.end_of_support,(r)=>r.devices),big=[...IN.end_of_support].sort((a,b)=>b.devices-a.devices)[0];
   return{tone:eos>100?'warn':'ok',t:`${f0(eos)} devices run software that no longer gets security fixes.`,w:`${big.software} accounts for ${big.devices} of them (${big.service}). Their weaknesses can only be contained, not fixed.`,
     a:'Fund the replacement or buy extended support, with a date per service.',o:'Technology leadership',go:'infra'}},
 rules:()=>{const r=[...T.rules].sort((a,b)=>b.alerts*b.false_pct-a.alerts*a.false_pct)[0];return{tone:r.false_pct>=60?'warn':'ok',t:`One rule, "${r.rule}", raised ${f0(r.alerts)} alerts this week and ${r.false_pct}% were false alarms.`,
   w:`Tuning it would remove about ${f0(r.alerts*r.false_pct/100)} wasted triage steps a week.`,a:'Tune or suppress the known-good cases in this rule.',o:'Detection engineering',go:'detection'}},
 escal:()=>{const v=last(MS.escalations_real_pct),e=last(MS.escalations),b=slope(MS.escalations_real_pct);return{tone:v<75?'warn':'ok',t:`${v}% of the provider's escalations needed action last week, ${b>0?'up':'down'} ${f1(Math.abs(b))} points a week.`,
   w:`About ${Math.round(e*(100-v)/100)} of ${e} escalations were noise for the internal team.`,a:v<75?'Share the false escalations with the provider and agree tuning.':null,o:'Head of security operations',go:'socdir'}},
 automation:()=>{const a=MS.closed_by_automation_pct;return{tone:slope(a)>0?'ok':'warn',t:`Automation closed ${last(a)}% of incidents last week, up from ${a[0]}% twelve weeks ago.`,w:'Each automated closure is an analyst hour back for real incidents.',go:'socdir'}},
 edr:()=>{const e=IN.edr;return{tone:e.no_agent>0?'warn':'ok',t:`${f0(e.no_agent)} devices (${f1(e.no_agent/e.devices*100)}%) have no EDR agent and ${f0(e.outdated_agent)} run an outdated one.`,w:'The SOC cannot see or stop an attack on these devices.',a:'Deploy the agent through the device management tool and report the remainder by owner.',o:'Infrastructure',go:'infra'}},
 teams:()=>{const t=[...DATA.owners].sort((a,b)=>b.overdue-a.overdue)[0],sh=Math.round(t.overdue/od*100);return{tone:t.sla_pct<L.sla_target?'bad':'warn',t:`${t.team} holds ${t.overdue} of ${od} overdue findings (${sh}%) and fixes ${t.sla_pct}% in time against ${L.sla_target}%.`,
   w:'One team is the bottleneck for the whole fix-time target.',a:`Agree extra capacity or a patch window with ${t.team}.`,o:'Infrastructure leadership',go:'remediation'}},
 sap:()=>{const s=IN.sap;return{tone:s.critical_config_findings?'warn':'ok',t:`${s.critical_config_findings} critical SAP configuration findings and ${s.missing_security_notes} missing security notes across ${s.systems} systems.`,w:`Bowbridge blocked ${s.malware_uploads_blocked_30d} malware uploads into SAP in 30 days.`,a:'Plan the missing notes into the next SAP maintenance window.',o:'SAP basis team',go:'sap'}},
 flow:()=>{const i=sum(EN.introduced.slice(-4),(v)=>v),f=sum(EN.fixed.slice(-4),(v)=>v);return{tone:f>=i?'ok':'warn',t:`In four weeks merge requests introduced ${i} findings and fixed ${f}.`,w:f>=i?'The backlog is shrinking from the code side.':'The backlog is growing from the code side.',go:'eng'}},
 laggard:()=>{const p=[...EN.projects].sort((a,b)=>(b.scanning?0:100)+b.mttr_days+b.secrets*5-((a.scanning?0:100)+a.mttr_days+a.secrets*5))[0];return{tone:'bad',t:`${p.project} has ${p.critical} critical findings, ${p.secrets} committed secrets, a ${p.mttr_days}-day fix time${p.scanning?'':' and no security scanning'}.`,
   w:'It is the riskiest project in the estate and is blind to new problems.',a:`Add the security scanning template to ${p.project}'s pipeline and rotate its secrets.`,o:'Engineering lead',go:'eng'}},
 secrets:()=>{const ps=EN.projects.filter((p)=>p.secrets);return{tone:ps.length?'bad':'ok',t:`${sum(ps,(p)=>p.secrets)} secrets are committed in ${ps.length} projects.`,w:'A committed secret is usable by anyone with read access to the code, including former staff.',a:'Rotate each one now, then turn on push protection.',o:'Engineering lead',go:'eng'}},
 cwe:()=>{const c=EN.top_cwes[0],t=sum(EN.top_cwes,(x)=>x.count);return{tone:'warn',t:`${c.cwe.replace(/^CWE-\d+ /,'')} makes up ${Math.round(c.count/t*100)}% of the most common weaknesses (${c.count} findings).`,w:'A repeated weakness is usually one missing control in a shared framework, not many separate bugs.',a:'Fix it once in the shared component and add a lint rule.',o:'Engineering lead',go:'eng'}},
 mttr:()=>{const v=last(EN.mttr_critical);return{tone:v<=15?'ok':'warn',t:`Critical code findings are fixed in ${v} days on average, against a 15-day policy.`,w:`High findings take ${last(EN.mttr_high)} days.`,go:'eng'}},
 aiFiles:()=>{const f=AI.top_apps.find((a)=>/converter/i.test(a.app));return f?{tone:'warn',t:`${f.app} received ${f0(f.upload_mb)} MB from ${f.users} people this month.`,w:'Files uploaded to free converters leave the company with no contract and no deletion.',a:'Block the category and offer an approved converter.',o:'Security leadership',go:'ai'}:null},
 phish:()=>{const r=S.rate,b=slope(r),rc=T.repeat_clickers.filter((u)=>u.clicks>=4);return{tone:last(r)>prev(r)?'warn':'ok',t:`${last(r)}% of people who received a phishing email that got through clicked it last week, ${b>0?'rising':'falling'} ${f1(Math.abs(b))} points a week.`,
   w:`${rc.length} people clicked four or more times in 90 days${rc.length?`, led by ${rc[0].id} (${rc[0].dept})`:''}. Repeat clickers carry most of the risk.`,a:'Give repeat clickers targeted training and stronger sign-in protection.',o:'Security awareness',go:'email'}},
 delivered:()=>{const d=S.del,c=chg(d);return{tone:c>0?'warn':'ok',t:`${last(d)} phishing emails reached inboxes last week, ${c>0?'up':'down'} ${Math.abs(c)} on the week before.`,w:'Every delivered phishing email is a filter miss; the trend shows whether email security is keeping up.',a:c>0?'Review the delivered samples with the email security provider.':null,o:'Email security',go:'email'}},
 aiViol:()=>{const v=AI.violations;return{tone:slope(v)>0?'warn':'ok',t:`AI policy violations ran at ${last(v)} last week, ${slope(v)>0?'rising':'falling'} about ${f1(Math.abs(slope(v)))} a week.`,w:'The EU AI Act high-risk obligations apply from 2 August 2026; an inventory of AI use is now a compliance matter.',a:'Keep a register of approved AI use and owners.',o:'Risk and compliance',go:'ai'}},
};

V.socdir=()=>{const autos=MS.closed_by_automation_pct,gb=avg(SI.daily_gb.slice(-7)),tot=sum(SI.by_source,(s)=>s.gb_per_day);
  const head=vhead('SOC director',[`The managed service closed `,[`${last(MS.sla_pct)}%`],` of incidents inside the agreed time last week, against 98%. `,[`${last(MS.true_positive_pct)}%`],` of incidents were real, and `,[`${last(MS.escalations_real_pct)}%`],` of escalations to us needed action. SIEM ingestion is `,[`${f1(gb)} GB a day`],` against the ${SI.threshold_gb} GB design threshold.`],last(MS.sla_pct)>=98?'ok':'warn',last(MS.sla_pct)>=98?'On target':'Under target');
  const stats=el('section','stats six',stat('Provider inside agreed time',last(MS.sla_pct),'%',1,chg(MS.sla_pct),'higher',MS.sla_pct),stat('Time to acknowledge',last(MS.ack_minutes),' min',1,chg(MS.ack_minutes),'lower',MS.ack_minutes),
    stat('Incidents that were real',last(MS.true_positive_pct),'%',1,chg(MS.true_positive_pct),'higher',MS.true_positive_pct),stat('Escalations that needed action',last(MS.escalations_real_pct),'%',1,chg(MS.escalations_real_pct),'higher',MS.escalations_real_pct),
    stat('Closed by automation',last(autos),'%',1,chg(autos),'higher',autos),stat('SIEM GB a day',gb,'',1,null,'lower',SI.daily_gb.slice(-12)));
  const sev=el('tbody');MS.by_severity.forEach((r)=>sev.append(el('tr','',el('td','',el('b','',r.severity)),el('td','',f0(r.incidents)),el('td',r.within_pct<98?'alert':'',f1(r.within_pct)+'%'),el('td','',f1(r.ack_minutes)+' min'))));
  const sevT=el('section','card',el('div','ph',el('h2','h','Provider by severity'),el('span','cap','Last 12 weeks')),el('div','scroll',el('table','rank',el('thead','',el('tr','',...['Severity','Incidents','Inside agreed time','Acknowledged in'].map((h)=>el('th','',h)))),sev)),
    el('p','note','Figures are worked out from Sentinel incident timestamps, not taken from the provider\'s report. Escalation outcomes need the provider\'s ticket export.'));
  const mx=Math.max(...SI.by_source.map((s)=>s.gb_per_day)),tone={High:'var(--a1)',Medium:'var(--a2)',Low:'var(--warn)'};
  const ing=el('section','card',el('div','ph',el('h2','h','SIEM ingestion by source'),el('span','cap',`${f1(tot)} GB a day · colour shows detection value`)),rowsBars(SI.by_source.map((s)=>[s.source,s.gb_per_day,`${f1(s.gb_per_day)} GB${s.detection_value?' · '+s.detection_value+' value':''}`,tone[s.detection_value]||'var(--a1)']),mx),
    el('p','note','A large source with low detection value is the first candidate for basic logs, filtering or a transformation rule.'));
  return[head,insights([IX.provider(),IX.escal(),IX.rules(),IX.siem(),IX.automation()]),stats,el('div','two',chartCard('Managed service inside agreed time',{label:'Percent of incidents closed inside the agreed time, by week',end:true,dec:true,unit:'%',target:{value:98,label:'98% target'},series:[{vals:MS.sla_pct,color:'var(--a1)',label:'Inside agreed time'}]}),
    chartCard('Quality of what reaches us',{label:'Real incidents and escalations needing action, by week',end:true,dec:true,unit:'%',series:[{vals:MS.true_positive_pct,color:'var(--a1)',label:'Incidents that were real'},{vals:MS.escalations_real_pct,color:'var(--a2)',label:'Escalations needing action'}]})),
    el('div','two',sevT,ing),band('Detection'),R.rules(),srcNote(MS,SI)].filter(Boolean)};

V.infra=()=>{const e=IN.edr,eos=sum(IN.end_of_support,(r)=>r.devices);
  const head=vhead('Infrastructure',[[`${IN.exploitable_exposed.length} exploitable weaknesses`],` are open on internet-facing systems and come first. `,[`${f0(od)} findings`],` are past their deadline, `,[`${f0(eos)} devices`],` run unsupported software and `,[`${f0(e.no_agent)} devices`],` have no EDR agent.`],IN.exploitable_exposed.length?'bad':'ok',IN.exploitable_exposed.length?'Act now':'Clear');
  const ex=rank('Fix first: exploitable and internet-facing','Public exploit, reachable from the internet',['Host','Weakness','Days open','Team'],IN.exploitable_exposed.map((r)=>[[r.host,r.cve],r.what,r.days_open,r.team]),{bar:2,units:{2:' days'},hot:(r)=>r[2]>14});
  const eosT=rank('Unsupported software','By business service',['Software','Devices','Service'],IN.end_of_support.map((r)=>[[r.software,''],r.devices,r.service]));
  const cov=el('section','stats six',stat('No EDR agent',e.no_agent,'',0,null,'lower',null,null,'controls'),stat('Agent out of date',e.outdated_agent,'',0,null,'lower'),stat('Infected devices',e.infected,'',0,null,'lower'),
    stat('SAP security notes missing',IN.sap.missing_security_notes,'',0,null,'lower'),stat('SAP critical configuration',IN.sap.critical_config_findings,'',0,null,'lower'),stat('Overdue findings',od,'',0,null,'lower',null,null,'remediation'));
  return[head,insights([IX.exposure(),IX.teams(),IX.edr(),IX.estate(),IX.sap()]),ex,cov,el('div','two',R.hostsVuln(),eosT),R.common(),srcNote(IN)]};

V.eng=()=>{const P=EN.projects,crit=sum(P,(p)=>p.critical),sec=sum(P,(p)=>p.secrets),noScan=P.filter((p)=>!p.scanning),intro=sum(EN.introduced.slice(-4),(v)=>v),fixed=sum(EN.fixed.slice(-4),(v)=>v);
  const head=vhead('Engineering',[[`${crit} critical findings`],` are open across ${P.length} projects, with `,[`${sec} committed secrets`],`. In the last four weeks merge requests introduced ${intro} findings and fixed ${fixed}. `,noScan.length?[`${noScan.length} projects have no security scanning`]:'Every project has security scanning','.'],fixed>=intro?'ok':'warn',fixed>=intro?'Fixing faster than adding':'Adding faster than fixing');
  const stats=el('section','stats five',stat('Time to fix, critical',last(EN.mttr_critical),' days',1,chg(EN.mttr_critical),'lower',EN.mttr_critical),stat('Time to fix, high',last(EN.mttr_high),' days',1,chg(EN.mttr_high),'lower',EN.mttr_high),
    stat('Critical open',crit,'',0,null,'lower'),stat('Secrets committed',sec,'',0,null,'lower'),stat('Projects scanning',P.length-noScan.length,` of ${P.length}`,0,null,'higher'));
  const pr=rank('Findings by project','Open now',['Project','Critical','High','Secrets','Dependencies','Code','Containers','Templates','Time to fix'],
    [...P].sort((a,b)=>b.critical*10+b.high-(a.critical*10+a.high)).map((p)=>[[p.project,p.scanning?'Scanning in pipeline':'No security scanning'],p.critical,p.high,p.secrets,p.dependency,p.code,p.container,p.iac,p.mttr_days+' days']),
    {flag:(r,k)=>(k===1&&r[1]>0)||(k===3&&r[3]>0)||(k===8&&parseFloat(r[8])>30)});
  const cw=el('section','card',el('div','ph',el('h2','h','Most common weakness types'),el('span','cap','Open findings')),rowsBars(EN.top_cwes.map((c)=>[c.cwe,c.count,String(c.count)]),Math.max(...EN.top_cwes.map((c)=>c.count)),'var(--a1)'));
  return[head,insights([IX.laggard(),IX.secrets(),IX.flow(),IX.cwe(),IX.mttr()]),stats,el('div','two',chartCard('Introduced against fixed',{label:'Findings introduced and fixed in merge requests, by week',end:true,series:[{vals:EN.introduced,color:'var(--warn)',label:'Introduced'},{vals:EN.fixed,color:'var(--a1)',label:'Fixed'}]}),
    chartCard('Time to fix',{label:'Average days to fix, by week',end:true,dec:true,series:[{vals:EN.mttr_critical,color:'var(--crit)',label:'Critical'},{vals:EN.mttr_high,color:'var(--a2)',label:'High'}]})),pr,cw,srcNote(EN)]};

V.ai=()=>{const d=AI.data_to_ai_mb_week;
  const head=vhead('AI use',[[`${AI.unapproved} of ${AI.apps_in_use} AI apps`],` in use are not approved, used by `,[`${f0(AI.users)} people`],`. Data sent to AI apps is `,[`${sgn(Math.round((last(d)/d[0]-1)*100))}% in 12 weeks`],`. AI policy violations: ${last(AI.violations)} last week.`],'warn','Needs policy');
  const apps=rank('AI apps in use','This month',['App','People','Uploaded','Approved'],AI.top_apps.map((a)=>[[a.app,a.approved?'Approved':'Not approved'],a.users,a.upload_mb,a.approved?'Yes':'No']),{units:{2:' MB'},flag:(r,k)=>k===3&&r[3]==='No'});
  return[head,insights([IX.ai(),IX.aiFiles(),IX.aiViol()]),el('div','two',chartCard('Data sent to AI apps',{label:'MB uploaded to AI apps per week',end:true,fc:FC,series:[{vals:d,color:'var(--a1)',label:'MB uploaded'}]}),chartCard('AI policy violations',{label:'Violations per week',end:true,series:[{vals:AI.violations,color:'var(--warn)',label:'Violations'}]})),apps,
    el('p','note','From Netskope\'s generative AI category and Defender for Cloud AI posture. The EU AI Act\'s high-risk obligations apply from 2 August 2026, so keep an inventory of approved AI use.'),srcNote(AI)].filter(Boolean)};

/* ---------- Red team, pen tests and attack simulation ---------- */
const OF=RO.offsec,AG=RO.agents;
Object.assign(IX,{
 redteam:()=>{const r=OF.engagements.find((e)=>e.type==='Red team');return{tone:r.reached?'bad':'ok',t:`The red team ${r.reached?'reached':'did not reach'} its objective (${r.objective.toLowerCase()})${r.reached?` in ${r.days_to_objective} days`:''}. The SOC saw ${r.detected_steps} of ${r.steps} steps, the first at step ${r.first_detected_step}.`,
   w:`${r.steps-r.detected_steps-r.blocked_steps} steps went unseen. Detection started after the attacker already had a foothold.`,a:'Close the unseen steps first: lateral movement and credential access rules, then retest.',o:'Head of security operations',go:'offsec'}},
 purple:()=>{const t=OF.tactics,tot=sum(t,(x)=>x.tested),miss=sum(t,(x)=>x.missed),w=[...t].sort((a,b)=>b.missed/b.tested-a.missed/a.tested)[0];return{tone:miss/tot>0.3?'bad':'warn',t:`Of ${tot} attack techniques tested, ${Math.round(sum(t,(x)=>x.blocked)/tot*100)}% were blocked, ${Math.round(sum(t,(x)=>x.detected)/tot*100)}% detected and ${Math.round(miss/tot*100)}% missed.`,
   w:`${w.tactic} is the weakest stage: ${w.missed} of ${w.tested} techniques went unnoticed. Attack simulation detection is ${last(OF.bas_detected_pct)}%, up from ${OF.bas_detected_pct[0]}% twelve weeks ago.`,a:`Give the detection agent's ${w.tactic.toLowerCase()} rule drafts priority review.`,o:'Detection engineering',go:'offsec'}},
 pentest:()=>{const f=OF.open_findings.filter((x)=>x.severity==='Critical'),old=[...f].sort((a,b)=>b.days_open-a.days_open)[0],failed=OF.open_findings.filter((x)=>x.retest==='Failed');return{tone:f.length?'bad':'ok',t:`${f.length} critical findings from testing are still open; the oldest, "${old.title}", for ${old.days_open} days.`,
   w:`${failed.length} fixes failed their retest, so the weakness is still there although the ticket may say done.`,a:'Hold a retest within two weeks of every fix, and report failed retests to the risk owner.',o:'Security leadership',go:'offsec'}},
 overlap:()=>({tone:'bad',t:'The weakness the red team used to get in (no MFA on the legacy VPN profile) sits on the same edge gateway as an exploitable vulnerability open for 19 days.',
   w:'Two independent sources point at the same door. This is the most likely route for a real attacker this month.',a:'Retire the legacy VPN profile and patch the gateway in the same change window.',o:'Infrastructure leadership',go:'offsec'}),
});
V.offsec=()=>{const r=OF.engagements.find((e)=>e.type==='Red team'),t=OF.tactics;
  const head=vhead('Red team and testing',[`The last red team `,[r.reached?`reached its objective in ${r.days_to_objective} days`:'did not reach its objective'],`. `,[`${OF.open_findings.filter((f)=>f.severity==='Critical').length} critical findings`],` from testing are open, and attack simulation detection is `,[`${last(OF.bas_detected_pct)}%`],`.`],'bad','Gaps open');
  const chain=el('ol','chain2');for(let i=1;i<=r.steps;i++){const st=i===r.steps?'reached':i<=r.blocked_steps?'blocked':[6,7,9,10].includes(i)?'detected':'missed';chain.append(el('li',st,el('span','',String(i))))}
  const legend2=el('p','cap','Each square is one step of the attack, in order. Filled: seen by the SOC. Outline: not seen. The last square is the objective.');
  const tb=el('tbody');t.forEach((x)=>{const bar=el('div','stack');[['blocked',x.blocked],['detected',x.detected],['missed',x.missed]].forEach(([k,v])=>{const i=el('i',k);i.style.width=(v/x.tested*100)+'%';bar.append(i)});
    const tr=el('tr','pick',el('td','',x.tactic),el('td','num',String(x.tested)),el('td','num',String(x.blocked)),el('td','num',String(x.detected)),el('td','num'+(x.missed/x.tested>0.5?' alert':''),String(x.missed)),el('td','sb',bar));tr.tabIndex=0;
    tr.addEventListener('click',()=>drill(x.tactic,'Techniques tested by the red team and attack simulation',[['Tested',String(x.tested)],['Blocked',String(x.blocked)],['Detected',String(x.detected)],['Missed',String(x.missed),x.missed?'alert':'']],[el('p','note','Missed means the technique ran with no alert. The detection agent drafts a rule for each miss.')],'detection'));tb.append(tr)});
  const tac=el('section','card',el('div','ph',el('h2','h','Blocked, detected or missed, by attack stage'),el('span','cap','Red team and attack simulation, last 90 days')),el('div','scroll',el('table','rank tac',el('thead','',el('tr','',...['Stage','Tested','Blocked','Detected','Missed',''].map((h)=>el('th','',h)))),tb)));
  const eng=rank('Engagements','Last 12 months',['Engagement','Critical','High','Open','Retests passed'],OF.engagements.map((e)=>[[e.name,`${e.type} · ${e.provider} · ended ${day(e.ended)}`],e.findings.critical,e.findings.high,e.open,`${e.retest_passed} of ${e.retested}`]),{bar:3,flag:(row,k)=>k===1&&row[1]>0});
  const of=rank('Open findings from testing','Oldest first within severity',['Finding','Severity','Owner','Days open','Retest'],[...OF.open_findings].sort((a,b)=>(a.severity==='Critical'?0:1)-(b.severity==='Critical'?0:1)||b.days_open-a.days_open).map((f)=>[[f.title,`${f.id} · ${f.source}`],f.severity,f.owner,f.days_open,f.retest]),{bar:4,units:{4:' days'},flag:(row,k)=>(k===1&&row[1]==='Critical')||(k===5&&row[5]==='Failed')});
  return[head,insights([IX.overlap(),IX.redteam(),IX.pentest(),IX.purple()]),el('section','card',el('div','ph',el('h2','h',`${r.name}: the attack path`),el('span','cap',r.objective)),chain,legend2),tac,of,
    chartCard('Attack simulation results',{label:'Percent of simulated attack steps detected and blocked, by week',end:true,dec:true,unit:'%',series:[{vals:OF.bas_detected_pct,color:'var(--a1)',label:'Detected'},{vals:OF.bas_blocked_pct,color:'var(--ok)',label:'Blocked'}]}),eng,srcNote(OF)]};

/* ---------- Agents: what each one checked, found and wants to do ---------- */
const EVERY={'Triage agent':'Every 5 minutes','Exposure agent':'Every hour','Detection agent':'Daily, and after each attack simulation','Phishing agent':'On every reported email','Provider agent':'Daily at 06:00','Reporting agent':'Mondays at 07:00'};
const AUTO={'Triage agent':'Closes duplicates and known-good alerts','Exposure agent':'Nothing; ranks and proposes','Detection agent':'Nothing; drafts rules for review','Phishing agent':'Pulls confirmed phishing from mailboxes','Provider agent':'Nothing; reports','Reporting agent':'Nothing; drafts for approval'};
const PROPOSALS=[
 {agent:'Exposure agent',title:'Patch NET-FW-EDGE-02 and retire the legacy VPN profile in one change',team:'Infrastructure',why:'Exploitable gateway weakness open 19 days, and the red team got in through the same gateway.',risk:'High',state:'waiting'},
 {agent:'Detection agent',title:'Review two draft rules for lateral movement over SMB',team:'Detection engineering',why:'The red team moved laterally unseen; the drafts fire on all 4 replayed steps in the lab.',risk:'Medium',state:'waiting'},
 {agent:'Provider agent',title:'Raise six late high-severity closures at the service review',team:'Head of security operations',why:'High severity is 95.2% in time against 98%.',risk:'Medium',state:'waiting'}];
function proposalsCard(){const ul=el('ul','props');const draw=()=>{ul.replaceChildren();const w=PROPOSALS.filter((p)=>p.state==='waiting');if(!w.length)ul.append(el('li','note','Nothing waiting.'));
    PROPOSALS.forEach((p,i)=>{const ok=el('button','btn primary','Approve'),no=el('button','btn','Dismiss');ok.type=no.type='button';
      const act=(yes)=>{p.state=yes?'approved':'dismissed';toast(yes?(HOSTED?`Approved: ${p.title}.`:`Approved. On the hosted system this raises the ticket for ${p.team} and posts to its Teams channel.`):'Dismissed.');draw()};
      ok.addEventListener('click',()=>act(true));no.addEventListener('click',()=>act(false));
      ul.append(el('li','prop '+p.state,el('span','pill '+(p.risk==='High'?'bad':'warn'),p.risk),el('div','',el('b','',p.title),el('p','',p.why),el('p','cap',`${p.agent} · for ${p.team}`)),p.state==='waiting'?el('div','pbtn',ok,no):el('span','cap',p.state==='approved'?'Approved':'Dismissed')))})};
  draw();PROPOSALS.redraw=draw;return el('section','card',el('div','ph',el('h2','h','Waiting for approval'),el('span','cap','Nothing that writes runs without a person approving it')),ul)}
function runAgent(a,btn,out){if(!CL)return;btn.disabled=true;out.textContent='Working through the figures…';
  const prompt=`${RULES}\n\nYou are the ${a.agent}. Your job: ${a.does}\nWork through the figures below as that agent and propose at most 3 specific actions a person must approve. Reply with only a JSON array of objects: {"title": short imperative action, "team": owning team, "why": one sentence citing the figures, "risk": "High" or "Medium"}.\n\nFigures:\n${figures()}`;
  CL.json(prompt,{cache:false}).then((arr)=>{const got=(Array.isArray(arr)?arr:[]).filter((x)=>x&&x.title).slice(0,3);
      got.forEach((x)=>PROPOSALS.unshift({agent:a.agent,title:String(x.title),team:String(x.team||'Security operations'),why:String(x.why||''),risk:x.risk==='High'?'High':'Medium',state:'waiting'}));
      out.textContent=got.length?`Proposed ${got.length} action${got.length===1?'':'s'}; see Waiting for approval.`:'Nothing new to propose.';if(PROPOSALS.redraw)PROPOSALS.redraw()})
    .catch((e)=>{out.textContent=e.code==='cancelled'?'':(COPY[e.code]||'The agent could not finish just now.')}).finally(()=>{btn.disabled=false})}
V.agents=()=>{const g=el('div','agents');AG.runs.forEach((a)=>{const b=el('button','link sm',`Review proposals`);b.type='button';b.addEventListener('click',()=>{const t=$('#agents .props');if(t)t.scrollIntoView({block:'center'})});
    const run=el('button','btn ai-only','Run now'),out=el('p','cap ag-out');run.type='button';run.addEventListener('click',()=>runAgent(a,run,out));
    g.append(el('article','card agent',el('div','ph',el('h2','h',a.agent),el('span','cap',a.last_run)),el('p','ag-does',a.does),
      el('dl','dpairs',el('dt','','Runs'),el('dd','ag-f',EVERY[a.agent]||'On demand'),el('dt','','Acts alone'),el('dd','ag-f',AUTO[a.agent]||'Nothing'),el('dt','','Checked'),el('dd','',f0(a.checked)),el('dt','','Found'),el('dd','ag-f',a.found)),
      el('div','ag-btns',run,b),out))});
  const head=vhead('Agents',[`Six agents work through the data on a schedule. Today they checked `,[f0(sum(AG.runs,(a)=>a.checked))+' items'],`, acted alone on low-risk work and are waiting on `,[`${PROPOSALS.filter((p)=>p.state==='waiting').length} decisions`],` from people.`],'ok','Running');
  return[head,proposalsCard(),g,el('p','note','In the hosted system the agents run inside your tenant on the schedule shown, with read-only identities. Anything that writes (a ticket, an email, a block) waits here for approval and is then carried out by the workflow engine. In this preview, Run now asks Claude to do the agent\'s work on the sample figures.'),srcNote(AG)].filter(Boolean)};

/* ---------- Claude in the page (preview on claude.ai): ask, brief, investigate. Hidden wherever it is unavailable. ---------- */
let CL=null;const onClaude=[];
try{if(window.claude&&window.claude.use)window.claude.use('sample').then((s)=>{if(!s)return;CL=s;onClaude.splice(0).forEach((f)=>{try{f()}catch(e){}})}).catch(()=>{})}catch(e){}
function figures(){const L2=[];const add=(s)=>L2.push(s);
  Object.keys(IX).forEach((k)=>{try{const i=IX[k]();if(i)add(`- [${TAG[i.tone]}] ${i.t} ${i.w||''}${i.a?' Next step: '+i.a:''} (page: ${i.go||''})`)}catch(e){}});
  const s6=(a)=>a.slice(-6).join(', ');
  add(`Weekly series, oldest to newest, last 6 weeks ending ${L.week_ending}:`);
  add(`incidents ${s6(S.inc)}; critical+high incidents ${s6(S.sevC.map((v,i)=>v+S.sevH[i]))}; fixes in time % ${s6(S.sla)} (target ${L.sla_target}); response in time % ${s6(S.rsla)} (target ${Q.response_target}); days to fix a critical ${s6(S.mttr)}; hours to contain ${s6(S.cont)}; findings found ${s6(S.opened)}; fixed ${s6(S.closed)}; phishing click rate % ${s6(S.rate)}; managed SOC in time % ${s6(MS.sla_pct)}; attack simulation detected % ${s6(OF.bas_detected_pct)}.`);
  add('Teams: '+DATA.owners.map((o)=>`${o.team} ${o.overdue} overdue, ${o.sla_pct}% in time`).join('; ')+'.');
  add('Agents: '+AG.runs.map((a)=>`${a.agent}: ${a.found}`).join('; ')+'.');
  add('Pages: '+NAV.map((n)=>`${n[0]}=${n[1]}`).join(', ')+'.');
  return L2.join('\n')}
const RULES='You are the security operations analyst for this company, briefing a senior reader. Use only the figures below; do not invent numbers. Plain British English, short sentences, no headings, no emoji, no bold. If the figures cannot answer the question, say which data is missing.';
const COPY={not_granted:'Claude is turned off for this page.',sampling_disabled:'Claude is not available on this account.',rate_limited:'Too many requests just now. Try again in a minute.',refused:'Claude declined that one. Try asking it differently.'};
function askClaude(title,sub,task,opts={}){if(!CL)return;const out=el('div','ai-out','Thinking…'),stop=el('button','link sm','Stop'),ctl=new AbortController(),go=el('div','dfoot');stop.type='button';stop.addEventListener('click',()=>ctl.abort());
  drill(title,sub,[],[el('p','cap','Written by Claude from the figures on this dashboard. Check before acting.'),out,el('div','ai-ctl',stop),go]);
  const prompt=`${RULES}\n\n${task}\n\nAfter your answer, on its own last line, write "Open: <page id>" naming the one page that shows the detail, or "Open: none".\n\nFigures:\n${figures()}${opts.extra?'\n\n'+opts.extra:''}`;
  const clean=(t)=>t.replace(/\n?Open:\s*([a-z]+)\s*$/i,'').trim();
  CL(prompt,{signal:ctl.signal,modelTier:opts.tier||'default',cache:opts.cache===false?false:true,onText:({text})=>{out.textContent=clean(text)}})
    .then(({text})=>{out.textContent=clean(text);stop.remove();const m=text.match(/Open:\s*([a-z]+)\s*$/i);if(m&&V[m[1]]&&m[1]!==CURRENT){const b=el('button','btn primary','Open '+((NAV.find((q)=>q[0]===m[1])||[])[1]||m[1]));b.type='button';b.addEventListener('click',()=>{closeDrill();show(m[1],true)});go.append(b)}})
    .catch((e)=>{stop.remove();out.textContent=e.text?clean(e.text):'';if(e.code!=='cancelled')out.append(el('p','note',COPY[e.code]||'Claude could not answer just now.'))})}
function briefBtn(){const b=el('button','link sm ai-only','Write the brief');b.type='button';b.addEventListener('click',()=>askClaude('Brief',`Week ending ${day(L.week_ending)}`,'Write a five-point brief for the executive team: what changed, what is at risk, what is going well, and the two decisions needed this week with owners.'));return b}
onClaude.push(()=>{document.body.classList.add('has-claude');document.querySelectorAll('.dsays .ph').forEach((ph)=>{if(!ph.querySelector('.ai-only'))ph.append(briefBtn())});
  const c=$('#cmd');if(c)c.placeholder='Ask a question about the figures, or give a command';});

/* ---------- Executive dashboard: visual components (SVG, redrawn on resize, every mark clickable) ---------- */
const C={navy:'#14387a',ink:'#0b1f44',gold:'#c9a227',teal:'#1c7c7d',red:'#b42318',amber:'#c4620c',green:'#2e7d4f',mist:'#e9ecf3',sky:'#7f9ccf'};
function viz(box,fn){const d=()=>{box.replaceChildren();fn(box,Math.max(200,Math.floor(box.clientWidth)))};after.push(()=>{d();watch(box,d)})}
const wk=(i)=>day(W[i].week_ending);
function hitDrill(node,fn){node.style.cursor='pointer';node.addEventListener('click',(e)=>{e.stopPropagation();fn()})}
function miniArea(box,vals,color,h=54){viz(box,(b,w)=>{const mn=Math.min(...vals),mx=Math.max(...vals),r=mx-mn||1,x=(i)=>2+i*(w-8)/(vals.length-1),y=(v)=>h-4-(v-mn)/r*(h-12);
  const s=sv('svg',{viewBox:`0 0 ${w} ${h}`,width:w,height:h,'aria-hidden':'true'}),id='m'+(++uid),g=sv('linearGradient',{id,x1:0,y1:0,x2:0,y2:1});g.append(sv('stop',{offset:0,'stop-color':color,'stop-opacity':.45}),sv('stop',{offset:1,'stop-color':color,'stop-opacity':0}));
  const d=vals.map((v,i)=>`${i?'L':'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');s.append(sv('defs',{},undefined),sv('path',{d:d+`L${x(vals.length-1)},${h}L${x(0)},${h}Z`,fill:`url(#${id})`,stroke:'none'}),sv('path',{d,fill:'none',stroke:color,'stroke-width':2,'stroke-linejoin':'round'}),sv('circle',{cx:x(vals.length-1),cy:y(last(vals)),r:3.2,fill:color}));s.firstChild.append(g);b.append(s)})}
function ring(box,pct,target,color,label){viz(box,(b,w)=>{const S=Math.min(w,62),r=S/2-6,c=2*Math.PI*r,s=sv('svg',{viewBox:`0 0 ${S} ${S}`,width:S,height:S,role:'img','aria-label':`${label}: ${pct}%`});
  s.append(sv('circle',{cx:S/2,cy:S/2,r,fill:'none',stroke:'rgba(255,255,255,.14)','stroke-width':8}),sv('circle',{cx:S/2,cy:S/2,r,fill:'none',stroke:color,'stroke-width':8,'stroke-linecap':'round','stroke-dasharray':`${c*Math.min(1,pct/100)} ${c}`,transform:`rotate(-90 ${S/2} ${S/2})`}));
  if(target!=null){const a=(target/100)*2*Math.PI-Math.PI/2;s.append(sv('line',{x1:S/2+(r-7)*Math.cos(a),y1:S/2+(r-7)*Math.sin(a),x2:S/2+(r+7)*Math.cos(a),y2:S/2+(r+7)*Math.sin(a),stroke:'#fff','stroke-width':2}))}
  b.append(s)})}
function gauge(box,v,trend){viz(box,(b,w)=>{const W2=Math.min(w,300),H=W2*0.62,cx=W2/2,cy=H-14,r=W2/2-18,s=sv('svg',{viewBox:`0 0 ${W2} ${H}`,width:W2,height:H,role:'img','aria-label':`Security posture index ${v} out of 100`});
  const arc=(a0,a1,col,wd)=>{const p=(a)=>[cx+r*Math.cos(Math.PI*(1-a)),cy-r*Math.sin(Math.PI*(1-a))],[x0,y0]=p(a0),[x1,y1]=p(a1);return sv('path',{d:`M${x0},${y0}A${r},${r} 0 0 1 ${x1},${y1}`,fill:'none',stroke:col,'stroke-width':wd,'stroke-linecap':'butt'})};
  s.append(arc(0,.5,'rgba(180,35,24,.55)',14),arc(.5,.7,'rgba(196,98,12,.6)',14),arc(.7,1,'rgba(46,125,79,.65)',14),arc(0,v/100,C.gold,5));
  const a=Math.PI*(1-v/100);s.append(sv('line',{x1:cx,y1:cy,x2:cx+(r-24)*Math.cos(a),y2:cy-(r-24)*Math.sin(a),stroke:'#fff','stroke-width':3,'stroke-linecap':'round'}),sv('circle',{cx,cy,r:6,fill:C.gold}),
    sv('text',{x:cx,y:cy-30,'text-anchor':'middle',class:'gv'},String(v)),sv('text',{x:18,y:H-2,class:'gl'},'0'),sv('text',{x:W2-18,y:H-2,'text-anchor':'end',class:'gl'},'100'));b.append(s)})}
function combo(box,bars,line,target,o){viz(box,(b,w)=>{const h=o.h||260,m={l:34,r:40,t:16,b:26},n2=bars.length,bw=(w-m.l-m.r)/n2,mx=nice(Math.max(...bars)),x=(i)=>m.l+i*bw+bw/2,y=(v)=>h-m.b-v/mx*(h-m.t-m.b),yp=(v)=>h-m.b-(v-o.pmin)/(100-o.pmin)*(h-m.t-m.b);
  const s=sv('svg',{viewBox:`0 0 ${w} ${h}`,width:w,height:h,role:'img','aria-label':o.label}),id='cb'+(++uid),g=sv('linearGradient',{id,x1:0,y1:0,x2:0,y2:1});g.append(sv('stop',{offset:0,'stop-color':C.navy}),sv('stop',{offset:1,'stop-color':C.sky}));s.append(sv('defs',{}),);s.firstChild.append(g);
  for(let k=0;k<=4;k++){const v=mx*k/4;s.append(sv('line',{x1:m.l,x2:w-m.r,y1:y(v),y2:y(v),stroke:'var(--grid)'}),sv('text',{x:m.l-6,y:y(v)+4,'text-anchor':'end',class:'tick'},f0(v)),sv('text',{x:w-m.r+6,y:yp(o.pmin+(100-o.pmin)*k/4)+4,class:'tick'},Math.round(o.pmin+(100-o.pmin)*k/4)+'%'))}
  bars.forEach((v,i)=>{const r=sv('rect',{x:x(i)-bw*0.3,y:y(v),width:bw*0.6,height:y(0)-y(v),rx:3,fill:`url(#${id})`});r.append(sv('title',{},`${wk(i)}: ${v} incidents, ${line[i]}% in time`));hitDrill(r,()=>o.pick(i));s.append(r)});
  s.append(sv('line',{x1:m.l,x2:w-m.r,y1:yp(target),y2:yp(target),stroke:C.gold,'stroke-dasharray':'4 4','stroke-width':1.5}),sv('text',{x:w-m.r-4,y:yp(target)-6,'text-anchor':'end',class:'tick gold'},`${target}% target`));
  const d=line.map((v,i)=>`${i?'L':'M'}${x(i)},${yp(v)}`).join('');s.append(sv('path',{d,fill:'none',stroke:C.teal,'stroke-width':2.5,'stroke-linejoin':'round'}));line.forEach((v,i)=>s.append(sv('circle',{cx:x(i),cy:yp(v),r:3,fill:'#fff',stroke:C.teal,'stroke-width':2})));
  const ev=Math.max(1,Math.ceil(n2/Math.floor((w-m.l-m.r)/70)));for(let i=n2-1;i>=0;i-=ev)s.append(sv('text',{x:x(i),y:h-8,'text-anchor':'middle',class:'tick'},wk(i)));b.append(s)})}
function donut(box,parts,colors,center,onPick){viz(box,(b,w)=>{const S=Math.min(w,210),r=S/2-6,ir=r*0.62,tot=sum(parts,(p)=>p.v),s=sv('svg',{viewBox:`0 0 ${S} ${S}`,width:S,height:S,role:'img','aria-label':center[1]});let a=-Math.PI/2;
  parts.forEach((p,i)=>{const a1=a+p.v/tot*2*Math.PI,lg=a1-a>Math.PI?1:0,P=(rr,an)=>`${S/2+rr*Math.cos(an)},${S/2+rr*Math.sin(an)}`;
    const path=sv('path',{d:`M${P(r,a)}A${r},${r} 0 ${lg} 1 ${P(r,a1)}L${P(ir,a1)}A${ir},${ir} 0 ${lg} 0 ${P(ir,a)}Z`,fill:colors[i%colors.length],stroke:'#fff','stroke-width':2});path.append(sv('title',{},`${p.name}: ${p.v}`));hitDrill(path,()=>onPick(p,i));s.append(path);a=a1});
  s.append(sv('text',{x:S/2,y:S/2+4,'text-anchor':'middle',class:'dv'},String(center[0])),sv('text',{x:S/2,y:S/2+24,'text-anchor':'middle',class:'tick'},center[1]));b.append(s)})}
function radar(box,axes,series,onPick){viz(box,(b,w)=>{const S=Math.min(w,380),cx=S/2,cy=S/2,r=S/2-78,N=axes.length,P=(i,v)=>{const a=-Math.PI/2+i*2*Math.PI/N;return[cx+r*v/100*Math.cos(a),cy+r*v/100*Math.sin(a)]};
  const s=sv('svg',{viewBox:`0 0 ${S} ${S}`,width:S,height:S,role:'img','aria-label':'Detection coverage by attack stage'});
  [25,50,75,100].forEach((v)=>s.append(sv('polygon',{points:axes.map((_,i)=>P(i,v).join(',')).join(' '),fill:'none',stroke:'var(--grid)'})));
  axes.forEach((t,i)=>{const [x2,y2]=P(i,100),[lx,ly]=P(i,118);s.append(sv('line',{x1:cx,y1:cy,x2,y2,stroke:'var(--grid)'}));const tx=sv('text',{x:lx,y:ly+3,'text-anchor':lx<cx-5?'end':lx>cx+5?'start':'middle',class:'tick rl'},t.replace('Command and Control','C2').replace('Privilege Escalation','Privilege').replace('Credential Access','Credentials').replace('Lateral Movement','Lateral movement').replace('Defense Evasion','Evasion').replace('Persistence','Persistence').replace('Initial Access','Initial access'));hitDrill(tx,()=>onPick(i));s.append(tx)});
  series.forEach((q)=>{s.append(sv('polygon',{points:q.vals.map((v,i)=>P(i,v).join(',')).join(' '),fill:q.color,'fill-opacity':.18,stroke:q.color,'stroke-width':2}));q.vals.forEach((v,i)=>{const [px,py]=P(i,v),c=sv('circle',{cx:px,cy:py,r:3.2,fill:q.color});c.append(sv('title',{},`${axes[i]}: ${q.label} ${v}%`));hitDrill(c,()=>onPick(i));s.append(c)})});b.append(s)})}
function heatmap(box,rows,cols,cells,onPick){viz(box,(b,w)=>{const lw=Math.min(150,w*0.34),cw=(w-lw)/cols.length,ch=34,h=26+rows.length*(ch+4),mx=Math.max(...cells.flat()),s=sv('svg',{viewBox:`0 0 ${w} ${h}`,width:w,height:h,role:'img','aria-label':'Overdue findings by team and scanner'});
  cols.forEach((c,j)=>s.append(sv('text',{x:lw+j*cw+cw/2,y:14,'text-anchor':'middle',class:'tick'},c.replace('Defender for Cloud','Defender'))));
  rows.forEach((r,i)=>{const yy=24+i*(ch+4);s.append(sv('text',{x:0,y:yy+ch/2+4,class:'hl'},r));cells[i].forEach((v,j)=>{const t=v/mx,rect=sv('rect',{x:lw+j*cw+2,y:yy,width:cw-4,height:ch,rx:4,fill:v?`rgba(180,35,24,${0.08+t*0.85})`:'#f1efe8'});rect.append(sv('title',{},`${r} · ${cols[j]}: ${v} overdue`));hitDrill(rect,()=>onPick(i,j));
    s.append(rect,sv('text',{x:lw+j*cw+cw/2,y:yy+ch/2+5,'text-anchor':'middle',class:'hv'+(t>0.5?' inv':''),'pointer-events':'none'},String(v)))})});b.append(s)})}
function stacked(box,series,o){viz(box,(b,w)=>{const h=o.h||220,m={l:36,r:44,t:12,b:24},N=series[0].vals.length,tops=series.map((q,k)=>q.vals.map((_,i)=>series.slice(0,k+1).reduce((a,qq)=>a+qq.vals[i],0))),mx=nice(Math.max(...tops.flat())),x=(i)=>m.l+i*(w-m.l-m.r)/(N-1),y=(v)=>h-m.b-v/mx*(h-m.t-m.b);
  const s=sv('svg',{viewBox:`0 0 ${w} ${h}`,width:w,height:h,role:'img','aria-label':o.label});for(let k=0;k<=4;k++){const v=mx*k/4;s.append(sv('line',{x1:m.l,x2:w-m.r,y1:y(v),y2:y(v),stroke:'var(--grid)'}),sv('text',{x:m.l-6,y:y(v)+4,'text-anchor':'end',class:'tick'},f0(v)))}
  for(let k=series.length-1;k>=0;k--){const up=tops[k],dn=k?tops[k-1]:up.map(()=>0),d=up.map((v,i)=>`${i?'L':'M'}${x(i)},${y(v)}`).join('')+dn.map((v,i)=>[i,v]).reverse().map(([i,v])=>`L${x(i)},${y(v)}`).join('')+'Z';
    s.append(sv('path',{d,fill:series[k].color,'fill-opacity':.85}));s.append(sv('text',{x:w-m.r+6,y:y(up[N-1]-(up[N-1]-dn[N-1])/2)+4,class:'tick'},f0(series[k].vals[N-1])))}
  const hit=sv('rect',{x:m.l,y:0,width:w-m.l-m.r,height:h,fill:'transparent'});hitDrill(hit,()=>{});hit.addEventListener('click',(e)=>{const bb=s.getBoundingClientRect(),i=Math.round(((e.clientX-bb.left)*w/bb.width-m.l)/((w-m.l-m.r)/(N-1)));o.pick(Math.max(0,Math.min(N-1,i)))});s.append(hit);
  const ev=Math.max(1,Math.ceil(N/Math.floor((w-m.l-m.r)/70)));for(let i=N-1;i>=0;i-=ev)s.append(sv('text',{x:x(i),y:h-6,'text-anchor':'middle',class:'tick'},wk(i)));b.append(s)})}
function funnelViz(box,steps,onPick){viz(box,(b,w)=>{const h=steps.length*48,mx=Math.log10(steps[0].v+1),s=sv('svg',{viewBox:`0 0 ${w} ${h}`,width:w,height:h,role:'img','aria-label':'From alert to incident'});
  steps.forEach((st,i)=>{const bwid=Math.max(18,Math.log10(st.v+1)/mx*w),yy=i*48,r=sv('rect',{x:0,y:yy+18,width:bwid,height:22,rx:3,fill:[C.sky,C.navy,C.teal,C.gold][i%4]});r.append(sv('title',{},`${st.label}: ${f0(st.v)}`));hitDrill(r,()=>onPick(st));
    s.append(sv('text',{x:0,y:yy+12,class:'hl'},st.label),sv('text',{x:w,y:yy+12,'text-anchor':'end',class:'hv'},f0(st.v)+(i?`  (${f1(st.v/steps[i-1].v*100)}%)`:'')),r)});b.append(s)})}
function bullets(items){const box=el('div','bullets');items.forEach((m)=>{const hiB=m.better==='higher',mx=hiB?Math.max(100,m.now,m.target)*1.0:Math.max(m.now,m.target)*1.6,met=hiB?m.now>=m.target:m.now<=m.target;
  const bar=el('div','bbar'),f=el('i'),t=el('u');f.style.width=Math.min(100,m.now/mx*100)+'%';f.style.background=met?C.teal:C.gold;t.style.left=Math.min(100,m.target/mx*100)+'%';bar.append(f,t);
  const row=el('button','brow',el('span','bl',m.label),bar,el('span','bv',`${fx(m.now,m.now%1?1:0)}${m.unit||''}`),el('span','bt',`target ${hiB?'≥':'≤'} ${m.target}${m.unit||''}`));row.type='button';
  row.addEventListener('click',()=>drill(m.label,m.outcome||'Phase 2 outcome',[['Now',`${m.now}${m.unit||''}`],['Target',`${hiB?'≥':'≤'} ${m.target}${m.unit||''}`,met?'':'alert'],['Against target',met?'Met':'Not yet met',met?'':'alert']],[],'exec'));box.append(row)});return box}
function tile(title,value,unit,delta,good,vizEl,go,dark){const c=el(go?'button':'div','dtile'+(dark?' dark':''),el('div','dt-h',title),el('div','dt-v',el('b','',value),unit?el('small','',unit):null),delta?el('div','dt-d '+(good?'up':'down'),delta):null,vizEl);if(go){c.type='button';c.addEventListener('click',()=>show(go,true))}return c}
function panel(title,sub,body,go,cls){const ph=el('div','ph',el('div','',el('h2','h',title),sub?el('p','cap',sub):null));if(CL&&cls&&cls.includes('dsays'))ph.append(briefBtn());if(go){const a=el('button','link sm','Open');a.type='button';a.addEventListener('click',()=>show(go,true));ph.append(a)}return el('section','card panel'+(cls?' '+cls:''),ph,body)}
function postureSeries(){const rs=S.rsla,sl=S.sla,mt=S.mttr,bd=OF.bas_detected_pct,rt=S.rate;
  return rs.map((_,i)=>Math.round(100*(0.25*Math.min(1,rs[i]/Q.response_target)+0.25*Math.min(1,sl[i]/L.sla_target)+0.2*(1-Math.min(1,mt[i]/30))+0.15*Math.min(1,bd[i]/80)+0.15*(1-Math.min(1,rt[i]/15)))))}
function attention(items){const ul=el('ul','attn');[...items].filter(Boolean).sort((a,b)=>TONE[a.tone]-TONE[b.tone]).slice(0,4).forEach((it)=>{const b=el('button','attn-i',el('span','pill '+it.tone,TAG[it.tone]),el('span','at',it.t),el('span','cap',it.o||''));b.type='button';
  b.addEventListener('click',()=>drill(TAG[it.tone],it.o||'',[['What',it.t],['Why it matters',it.w||'—'],['Next step',it.a||'—']],[],it.go));ul.append(el('li','',b))});return ul}
V.exec=()=>{const ps=postureSeries(),pv=last(ps),pd=pv-prev(ps),hi=S.sevC.map((v,i)=>v+S.sevH[i]),gbs=SI.daily_gb,gb=avg(gbs.slice(-7)),rtm=OF.engagements.find((e)=>e.type==='Red team');
  const T2=(t,v,u,d,g,viz2,go)=>tile(t,v,u,d,g,viz2,go,true);
  const sp=(vals,col)=>{const b=el('div','dt-c');miniArea(b,vals,col);return b},rg=(p,t,col,l)=>{const b=el('div','dt-r');ring(b,p,t,col,l);return b};
  const gbox=el('div','gauge'),gwrap=el('div','dtile dark gtile',el('div','dt-h','Security posture index'),gbox,el('div','dt-d '+(pd>=0?'up':'down'),`${sgn(pd)} on last week · ${sgn(last(ps)-ps[0])} in 12 weeks`),el('p','gnote','From response and fix times, time to fix, attack simulation and phishing.'));
  gauge(gbox,pv);hitDrill(gwrap,()=>drill('Security posture index',`Week ending ${wk(n-1)}`,[['Index now',String(pv)],['12 weeks ago',String(ps[0])],['Responses in time',`${last(S.rsla)}% (25%)`],['Fixes in time',`${last(S.sla)}% (25%)`],['Days to fix a critical',`${last(S.mttr)} (20%)`],['Attack simulation detected',`${last(OF.bas_detected_pct)}% (15%)`],['Phishing click rate',`${last(S.rate)}% (15%)`]],[el('p','note','Weights in brackets. Each measure is scored against its target and combined into one number out of 100.')],'exec'));
  const band2=el('section','kband keep',gwrap,
    T2('Incidents this week',String(L.incidents),'',`${sgn(chg(S.inc))} on last week`,chg(S.inc)<=0,sp(S.inc,C.gold),'detection'),
    T2('Time to contain',f1(last(S.cont)),'h',`${sgn(chg(S.cont),1)} h`,chg(S.cont)<=0,sp(S.cont,C.gold),'detection'),
    T2('Responses in time',`${last(S.rsla)}`,'%',`target ${Q.response_target}%`,last(S.rsla)>=Q.response_target,rg(last(S.rsla),Q.response_target,'#5fc3b9','Responses in time'),'detection'),
    T2('Critical and high open',f0(last(S.open)),'',`${sgn(Math.round((last(S.open)/S.open[0]-1)*100))}% in 12 weeks`,last(S.open)<=S.open[0],sp(S.open,C.gold),'vulnerabilities'),
    T2('Fixes in time',`${last(S.sla)}`,'%',`target ${L.sla_target}%`,last(S.sla)>=L.sla_target,rg(last(S.sla),L.sla_target,C.gold,'Fixes in time'),'remediation'),
    T2('Red team steps seen',`${rtm.detected_steps} of ${rtm.steps}`,'',rtm.reached?'objective reached':'objective stopped',!rtm.reached,rg(Math.round(rtm.detected_steps/rtm.steps*100),null,'#e07a6e','Red team steps seen'),'offsec'));
  const cbox=el('div','viz');combo(cbox,S.inc,S.rsla,Q.response_target,{h:270,pmin:60,label:'Incidents per week with the share responded to in time',pick:(i)=>drill(`Week ending ${wk(i)}`,'Threat activity and response',[['Incidents',String(S.inc[i])],['Critical and high',String(hi[i])],['Responded in time',`${S.rsla[i]}%`,S.rsla[i]<Q.response_target?'alert':''],['Hours to contain',f1(S.cont[i])]],[],'detection')});
  const dbox=el('div','viz donutw'),cats=Q.categories.map((c)=>({name:c.name,v:c.now})),cols=[C.navy,C.gold,C.teal,C.sky,'#b9a36a','#9aa3b2'];
  donut(dbox,cats,cols,[L.incidents,'incidents this week'],(p)=>drill(p.name,'Incidents this week',[['This week',String(p.v)],['Last week',String(Q.categories.find((c)=>c.name===p.name).previous)],['Share',Math.round(p.v/L.incidents*100)+'%']],[],'detection'));
  const lg=el('ul','dleg');cats.forEach((c,i)=>{const sw=el('i');sw.style.background=cols[i];lg.append(el('li','',sw,el('span','',c.name),el('b','',String(c.v))))});
  const rbox=el('div','viz'),tac=Q.attack.map((a)=>a.tactic),rtDet=tac.map((t)=>{const x=OF.tactics.find((o)=>o.tactic===t);return x?Math.round((x.blocked+x.detected)/x.tested*100):0});
  radar(rbox,tac,[{vals:Q.attack.map((a)=>a.coverage),color:C.navy,label:'Rules in place'},{vals:rtDet,color:C.gold,label:'Caught in testing'}],(i)=>{const a=Q.attack[i],x=OF.tactics.find((o)=>o.tactic===a.tactic)||{};drill(a.tactic,'Detection coverage',[['Techniques with a rule',a.coverage+'%'],['Caught in red team and simulation',rtDet[i]+'%',rtDet[i]<50?'alert':''],['Missed in testing',String(x.missed??'—')],['Incidents at this stage, 12 weeks',String(a.incidents)]],[],'offsec')});
  const hbox=el('div','viz');heatmap(hbox,DATA.hot.teams,DATA.hot.scanners,DATA.hot.cells,(i,j)=>drill(`${DATA.hot.teams[i]} · ${DATA.hot.scanners[j]}`,'Overdue critical and high findings',[['Overdue',String(DATA.hot.cells[i][j])],['Team total',String(sum(DATA.hot.cells[i],(v)=>v))],['Scanner total',String(sum(DATA.hot.cells,(r)=>r[j]))]],[],'remediation'));
  const fbox=el('div','viz');funnelViz(fbox,[{label:'alerts',v:last(Q.alerts)},{label:'triaged',v:last(Q.triaged)},{label:'incidents',v:L.incidents},{label:'critical or high',v:last(hi)}],(st)=>drill(st.label,'Alert to incident, this week',[['Count',f0(st.v)],['Share of alerts',f1(st.v/last(Q.alerts)*100)+'%']],[],'detection'));
  const sbox=el('div','viz');stacked(sbox,[{vals:col('open_high'),color:C.sky},{vals:col('open_critical'),color:C.navy}],{h:230,label:'Open critical and high findings by week',pick:(i)=>drill(`Week ending ${wk(i)}`,'Open findings',[['Critical',String(W[i].open_critical)],['High',String(W[i].open_high)],['Found that week',String(W[i].opened)],['Fixed that week',String(W[i].closed)]],[],'vulnerabilities')});
  const ms=OC.flatMap((o)=>o.measures.map((m)=>({...m,outcome:o.outcome}))).filter((m)=>typeof m.now==='number'&&typeof m.target==='number');
  const units={'Acknowledge an alert':' min','Resolve a P1':' h','Resolve a P2':' h','Median containment':' h','Tier-1 systems monitored':'%','Telemetry coverage':'%','Adherence to SOC service levels':'%','Log ingestion per day':' GB'};ms.forEach((m)=>m.unit=units[m.label]||'');
  const met=ms.filter((m)=>m.better==='higher'?m.now>=m.target:m.now<=m.target).length;
  const legend2=(items)=>el('ul','legend',...items.map(([l,c])=>{const sw=el('span','sw');sw.style.background=c;return el('li','',sw,l)}));
  return[band2,
    el('div','dgrid keep',
      panel('Threat activity and response','Incidents per week (bars) and share responded to in time (line)',el('div','',legend2([['Incidents',C.navy],['Responded in time',C.teal],['Target',C.gold]]),cbox),'detection','span8'),
      panel('Incidents by type','This week',el('div','donutbox',dbox,lg),'detection','span4'),
      panel('Detection coverage','Rules in place against what testing caught, by attack stage',el('div','',legend2([['Rules in place',C.navy],['Caught in testing',C.gold]]),rbox),'offsec','span4'),
      panel('Where fixes are overdue','Critical and high findings past deadline, team by scanner',hbox,'remediation','span5'),
      panel('Alert to incident','This week',fbox,'detection','span3'),
      panel('Exposure over time','Open critical and high findings',el('div','',legend2([['Critical',C.navy],['High',C.sky]]),sbox),'vulnerabilities','span6'),
      panel(`Phase 2 targets: ${met} of ${ms.length} met`,'Bar: now. Mark: target. Select a row for detail.',bullets(ms),null,'span6'),
      panel('Needs attention','Worked out from the figures',attention([IX.overlap(),IX.redteam(),IX.exposure(),IX.provider(),IX.siem(),IX.ai()]),null,'span12 dsays')),
    band('Performance over the period'),(()=>{const p=periodSection();p.classList.add('xtra');return p})(),band('Phase 2 outcomes'),scorecard(),
    el('div','two',el('section','card',el('div','ph',el('h2','h','Top risks'),el('span','cap','Select one to open it')),(()=>{const rl=el('ul','risks');risks().slice(0,5).forEach(([t,d,lvl,tone,go],i)=>{const b=el('button','risk',el('span','n',String(i+1)),el('span','',el('b','',t),el('span','d',d)),el('span','pill '+tone,lvl));b.type='button';b.addEventListener('click',()=>show(go,true));rl.append(el('li','',b))});return rl})()),
      el('section','card',el('div','ph',el('h2','h','Signals')),(()=>{const sl=el('ul','sig-list');[...DATA.notes].filter((r)=>r.confidence==='High').slice(0,4).forEach((r)=>sl.append(signal(r,true)));return sl})()))]};

/* ---------- Operations: shared filters, live board, threat paths, workflows, reports, commands ---------- */
const HOSTED=!!window.SECOPS_HOSTED;
const FILTER={detail:'summary',period:'month',from:null,to:null,severity:'all',team:'all',source:'all'};
const APPLIES={exec:['period'],threats:['period','severity','source'],live:['severity','team','source'],workflows:['team']};
let CURRENT='exec';
const SEVS=['High','Medium','Low'];
const LV=DATA.live||{queue:[],health:[],alert_rate:[],sla:{acknowledge_minutes:15,resolve_hours:{High:4,Medium:24,Low:72},at_risk_share:0.75}};
const TH=DATA.threats||{stages:[],paths:[]};
const WF=DATA.workflows||{workflows:[],teams:{},log:[],actions_enabled:false};
/* Preview copies carry the time they were built; move every timestamp so the board reads as now. */
if(!HOSTED&&LV.generated_at){const shift=Date.now()-new Date(LV.generated_at).getTime(),mv=(t)=>t?new Date(new Date(t).getTime()+shift).toISOString():t;
  LV.queue.forEach((q)=>{q.created=mv(q.created);q.acknowledged=mv(q.acknowledged)});LV.health.forEach((h)=>{h.last_seen=mv(h.last_seen)});LV.generated_at=new Date().toISOString()}
const ms2=(ms)=>{const neg=ms<0,a=Math.abs(ms),m=Math.floor(a/6e4),h=Math.floor(m/60);return(neg?'−':'')+(h?`${h} h ${String(m%60).padStart(2,'0')} min`:m>=10?`${m} min`:`${m}:${String(Math.floor(a/1e3)%60).padStart(2,'0')}`)};
const ago=(t)=>{const m=Math.round((Date.now()-new Date(t))/6e4);return m<1?'just now':m<60?`${m} min ago`:m<1440?`${Math.round(m/60)} h ago`:`${Math.round(m/1440)} days ago`};
function clocks(q){const sla=LV.sla,now=Date.now(),c=new Date(q.created).getTime(),ackDue=c+sla.acknowledge_minutes*6e4,resDue=c+(sla.resolve_hours[q.severity]||72)*36e5;
  const acked=q.acknowledged?new Date(q.acknowledged).getTime():null;
  const ack={due:ackDue,done:acked,left:acked?null:ackDue-now,share:acked?1:Math.min(1.2,(now-c)/(ackDue-c))};
  const res={due:resDue,left:resDue-now,share:Math.min(1.2,(now-c)/(resDue-c)),done:q.status==='Contained'};
  const breached=(!acked&&ack.left<0)||(!res.done&&res.left<0),risk=!breached&&((!acked&&ack.share>=sla.at_risk_share)||(!res.done&&res.share>=sla.at_risk_share));
  return{ack,res,breached,risk,rank:breached?0:risk?1:q.status==='New'?2:3}}
function passes(q,keys){return(!keys.includes('severity')||FILTER.severity==='all'||q.severity===FILTER.severity)&&(!keys.includes('team')||FILTER.team==='all'||q.team===FILTER.team)&&(!keys.includes('source')||FILTER.source==='all'||q.source===FILTER.source)}
function toast(msg,tone){let t=$('#toast');if(!t){t=el('div','toast');t.id='toast';t.setAttribute('role','status');t.setAttribute('aria-live','polite');document.body.append(t)}
  t.textContent=msg;t.className='toast show '+(tone||'');clearTimeout(toast.h);toast.h=setTimeout(()=>{t.className='toast'},4200)}

/* Live operations: a control-room board. Clocks tick every second; data refreshes every minute when hosted. */
function liveInsights(rows){const out=[],cl=rows.map((q)=>[q,clocks(q)]),un=cl.filter(([q,c])=>!c.ack.done),soon=un.filter(([q,c])=>c.ack.left>0&&c.ack.left<5*6e4);
  if(soon.length)out.push(['bad',`${soon.length} alert${soon.length>1?'s':''} will miss the ${LV.sla.acknowledge_minutes}-minute acknowledgement target within 5 minutes.`]);
  const br=cl.filter(([q,c])=>c.breached);if(br.length)out.push(['bad',`${br.length} incident${br.length>1?'s are':' is'} past a service-level target, longest ${ms2(-Math.min(...br.map(([q,c])=>Math.min(c.ack.done?Infinity:c.ack.left,c.res.done?Infinity:c.res.left))))} over.`]);
  const deep=rows.filter((q)=>q.path&&q.path.length>=3);if(deep.length)out.push(['warn',`${deep.length} open incident${deep.length>1?'s have':' has'} reached ${deep.map((q)=>q.path[q.path.length-1]).join(', ')}: the deepest stages on the board.`]);
  const stale=LV.health.filter((h)=>Date.now()-new Date(h.last_seen)>36e5*6);if(stale.length)out.push(['warn',`${stale.map((h)=>h.system).join(', ')} ${stale.length>1?'have':'has'} sent no data for over 6 hours. Incidents from ${stale.length>1?'them':'it'} cannot be seen.`]);
  const r=LV.alert_rate.map((x)=>x.alerts);if(r.length>6){const lastH=r[r.length-1],avg=r.slice(0,-1).reduce((a,b)=>a+b,0)/(r.length-1);if(lastH>avg*1.4)out.push(['warn',`Alert volume in the last hour is ${Math.round((lastH/avg-1)*100)}% above the 24-hour average.`])}
  if(!out.length)out.push(['ok','Every incident is inside its service-level targets and every source is reporting.']);return out}
V.live=()=>{
  const rows=LV.queue.filter((q)=>passes(q,APPLIES.live)).map((q)=>[q,clocks(q)]).sort((a,b)=>a[1].rank-b[1].rank||(a[1].ack.left??a[1].res.left)-(b[1].ack.left??b[1].res.left));
  const qs=rows.map((r)=>r[0]),unacked=rows.filter(([q,c])=>!c.ack.done).length,risk=rows.filter(([q,c])=>c.risk).length,br=rows.filter(([q,c])=>c.breached).length,rate=LV.alert_rate.map((x)=>x.alerts);
  const cnt=(label,val,tone,sub)=>el('div','card lcount '+(tone||''),el('span','cap',label),el('div','num',String(val)),el('span','cap',sub||''));
  const sp=el('div','spark');after.push(()=>spark(sp,rate.length>1?rate:[0,0],'var(--a1)'));
  const head=el('section','lcounts',cnt('Incidents in flight',qs.length,'',`${qs.filter((q)=>q.severity==='High').length} high severity`),cnt('Waiting to be acknowledged',unacked,unacked?'warn':'',`target ${LV.sla.acknowledge_minutes} min`),
    cnt('At risk of breach',risk,risk?'warn':'','within the next stretch'),cnt('Past a target',br,br?'bad':'ok',br?'needs action now':'none'),el('div','card lcount',el('span','cap','Alerts in the last hour'),el('div','num',f0(rate[rate.length-1]||0)),sp));
  const lanes=el('div','lanes');[['New','New'],['Active','Being worked'],['Contained','Contained']].forEach(([k,l])=>{const n=qs.filter((q)=>q.status===k).length;const d=el('div','lane',el('b','',String(n)),el('span','',l));d.style.flex=String(Math.max(1,n));lanes.append(d)});
  const board=el('div','strips');
  rows.forEach(([q,c])=>{const st=c.breached?'breach':c.risk?'risk':'';const path=el('span','chain');(q.path||[]).forEach((p,i)=>{if(i)path.append(el('span','arr','→'));path.append(el('span','node',p))});
    const ackCell=el('div','clock'),resCell=el('div','clock');ackCell.dataset.q=q.id;ackCell.dataset.kind='ack';resCell.dataset.q=q.id;resCell.dataset.kind='res';
    const esc=el('button','link sm',c.breached||c.risk?'Escalate':'Notify team');esc.type='button';esc.addEventListener('click',()=>escalate(q,c));
    board.append(el('article','strip '+st,el('span','sev s-'+q.severity.toLowerCase(),q.severity),el('div','who',el('b','',q.title),el('small','',`${q.id} · ${q.source} · ${q.team}${q.owner?' · '+q.owner:''}`),path),
      el('span','pill '+(q.status==='New'?'warn':q.status==='Contained'?'ok':''),q.status==='Active'?'Being worked':q.status),ackCell,resCell,esc))});
  if(!rows.length)board.append(el('p','note','No incidents in flight match the filters.'));
  const health=el('ul','health');LV.health.forEach((h)=>{const m=(Date.now()-new Date(h.last_seen))/6e4,tone=m<30?'ok':m<360?'warn':'bad';health.append(el('li','',el('span','dot '+tone),el('span','',h.system),el('small','',ago(h.last_seen))))});
  const ins=el('ul','insights');liveInsights(qs).forEach(([tone,t])=>ins.append(el('li','',el('span','dot '+tone),el('span','',t))));
  const feed=el('ul','feed');const ev=[];LV.queue.forEach((q)=>{ev.push([q.created,`${q.id} raised: ${q.title}`]);if(q.acknowledged)ev.push([q.acknowledged,`${q.id} acknowledged${q.owner?' by '+q.owner:''}`])});
  ev.sort((a,b)=>new Date(b[0])-new Date(a[0])).slice(0,10).forEach(([t,x])=>feed.append(el('li','',el('small','',new Date(t).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})),el('span','',x))));
  const clock=el('span','liveclock');clock.dataset.clock='1';
  const top=el('header','vh',el('div','vtitle',el('h1','','Live operations'),el('span','livepill',el('span','pulse'),HOSTED&&LV.source==='live'?'Live':'Sample board'),clock),el('p','',`Incidents in flight against their service-level clocks: acknowledge within ${LV.sla.acknowledge_minutes} minutes, resolve High within ${LV.sla.resolve_hours.High} hours and Medium within ${LV.sla.resolve_hours.Medium}. ${HOSTED?'Refreshes every minute.':'Times on this preview are relative to now.'}`));
  return[top,head,el('div','lanewrap',el('span','cap','Queue'),lanes),el('div','livegrid',el('section','card',el('div','ph',el('h2','h','Flight board'),el('span','cap','Most urgent first')),el('div','striphead',el('span','',''),el('span','','Incident and path'),el('span','','Status'),el('span','','Acknowledge'),el('span','','Resolve'),el('span','','')),board),
    el('div','livecol',el('section','card',el('h2','h','What needs attention'),ins),el('section','card',el('h2','h','Sources reporting'),health),el('section','card',el('h2','h','Latest events'),feed)))]};
function paintClocks(){const v=$('#live');if(!v||v.hidden)return;const byId=Object.fromEntries(LV.queue.map((q)=>[q.id,q]));
  v.querySelectorAll('.clock').forEach((elc)=>{const q=byId[elc.dataset.q];if(!q)return;const c=clocks(q),k=elc.dataset.kind,x=c[k];
    let txt,tone='',share=Math.min(1,x.share);if(k==='ack'&&x.done){txt='in '+ms2(x.done-new Date(q.created));tone='ok';share=1}else if(k==='res'&&x.done){txt='contained';tone='ok';share=1}
    else{txt=x.left>=0?ms2(x.left)+' left':ms2(-x.left)+' over';tone=x.left<0?'bad':x.share>=LV.sla.at_risk_share?'warn':''}
    elc.replaceChildren(el('span','ct '+tone,txt),(()=>{const b=el('span','cbar '+tone),i=el('i');i.style.width=Math.max(3,share*100)+'%';b.append(i);return b})())});
  v.querySelectorAll('[data-clock]').forEach((e)=>{e.textContent=new Date().toLocaleTimeString('en-GB')})}
setInterval(paintClocks,1000);
if(HOSTED)setInterval(()=>{fetch('api/live',{credentials:'same-origin'}).then((r)=>r.ok?r.json():null).then((d)=>{if(!d)return;Object.assign(LV,d);if(CURRENT==='live'){built.live=false;$('#live').replaceChildren();show('live',false)}}).catch(()=>{})},60000);
function escalate(q,c){const wf=c.breached?'resolve_breach':'ack_at_risk';const msg=`${q.title} (${q.id})`;
  if(!HOSTED){toast(`Preview: on the hosted system this sends "${msg}" to the SOC channel through the ${wf==='resolve_breach'?'resolution breach':'acknowledgement'} workflow.`);return}
  toast(`Escalation for ${q.id} is queued. The workflow check runs within five minutes; see Workflows.`)}

/* Threat paths: how far attacks got through the stages, where they were stopped, and the near misses. */
function periodWindow(){const P={day:1,week:7,month:30,quarter:90,year:365},end=new Date();if(FILTER.period==='custom'&&FILTER.from&&FILTER.to)return[new Date(FILTER.from+'T00:00:00Z'),new Date(FILTER.to+'T23:59:59Z')];return[new Date(end-P[FILTER.period||'month']*864e5),end]}
V.threats=()=>{const[a,b]=periodWindow(),ps=TH.paths.filter((p)=>{const t=new Date(p.created);return t>=a&&t<=b&&passes(p,APPLIES.threats)}),near=ps.filter((p)=>p.near_miss),end=ps.filter((p)=>p.reached_end);
  const stages=TH.stages.filter((s)=>ps.some((p)=>p.path.includes(s)));
  const reach={},stop={},link={};ps.forEach((p)=>{p.path.forEach((s,i)=>{reach[s]=(reach[s]||0)+1;if(i){const k=p.path[i-1]+'|'+s;link[k]=(link[k]||0)+1}});if(p.stopped_at)stop[p.stopped_at]=(stop[p.stopped_at]||0)+1});
  const depth=ps.length?ps.reduce((s,p)=>s+p.depth,0)/ps.length:0,entry=Object.entries(ps.reduce((m,p)=>{m[p.path[0]]=(m[p.path[0]]||0)+1;return m},{})).sort((x,y)=>y[1]-x[1])[0];
  const cnt=(l,v,s,tone)=>el('div','card lcount '+(tone||''),el('span','cap',l),el('div','num',String(v)),el('span','cap',s||''));
  const box=el('div','flow');after.push(()=>drawFlow(box,stages,reach,stop,link));
  const nl=el('div','nearlist');near.slice(0,12).forEach((p)=>{const ch=el('span','chain');p.path.forEach((s,i)=>{if(i)ch.append(el('span','arr','→'));ch.append(el('span','node'+(i===p.path.length-1?' stop':''),s))});
    const t=el('button','link sm','Raise review ticket');t.type='button';t.addEventListener('click',()=>toast(HOSTED?`Review ticket for ${p.id} proposed. Approve it on the Workflows page.`:`Preview: on the hosted system this proposes a Jira review for ${p.id} to Detection engineering.`));
    nl.append(el('article','card near',el('div','sig-head',el('h3','',p.title),el('span','pill '+(p.severity==='High'?'bad':'warn'),p.severity)),el('p','sig-sys',`${p.id} · ${new Date(p.created).toLocaleDateString('en-GB',{day:'numeric',month:'short'})} · stopped by ${p.stopped_by}${p.contain_hours!=null?' after '+f1(p.contain_hours)+' h':''}`),ch,t))});
  if(!near.length)nl.append(el('p','note','No near misses in this period.'));
  const stoppedBy=Object.entries(ps.reduce((m,p)=>{m[p.stopped_by]=(m[p.stopped_by]||0)+1;return m},{})).sort((x,y)=>y[1]-x[1]);
  return[vhead('Threat paths',['How far each attack got through the stages of an intrusion (MITRE ATT&CK), where it was stopped, and the near misses: real attacks that got deep before being stopped. Near misses show both what the controls are worth and where detection fires too late.'],near.length>3?'warn':'ok',near.length?`${near.length} near misses`:'No near misses'),
    el('section','lcounts',cnt('Attacks in the period',ps.length,`median depth ${f1(depth)} stages`),cnt('Near misses',near.length,'stopped late in the chain',near.length?'warn':''),cnt('Reached the final stage',end.length,'data left or damage done',end.length?'bad':'ok'),cnt('Most common way in',entry?entry[0]:'—',entry?`${entry[1]} attacks`:'','txt'),cnt('Stopped at the first stage',ps.filter((p)=>p.depth===1).length,`${ps.length?Math.round(100*ps.filter((p)=>p.depth===1).length/ps.length):0}% of attacks`,'ok')),
    el('section','card',el('div','ph',el('h2','h','Paths through the stages'),el('span','cap','Width shows how many attacks moved between stages. Under each stage: how many reached it, and how many were stopped there.')),box),
    band('Near misses'),nl,
    el('div','two',el('section','card',el('div','ph',el('h2','h','What stopped them'),el('span','cap','Attacks in the period')),rowsBars(stoppedBy.map(([k,v])=>[k,v,String(v)]),Math.max(1,...stoppedBy.map((x)=>x[1])),'linear-gradient(90deg,var(--a2),var(--a1))')),
      el('section','card',el('div','ph',el('h2','h','Where they were stopped'),el('span','cap','Furthest stage reached')),rowsBars(stages.filter((s)=>stop[s]).map((s)=>[s,stop[s],String(stop[s]),['Credential Access','Privilege Escalation','Lateral Movement','Command and Control','Exfiltration','Impact'].includes(s)?'var(--crit)':null]),Math.max(1,...Object.values(stop)),'linear-gradient(90deg,var(--a2),var(--a1))')))]};
function drawFlow(box,stages,reach,stop,link){const draw=()=>{box.replaceChildren();if(!stages.length){box.append(el('p','note','No attacks in this period.'));return}
  const w=Math.min(1600,Math.max(640,box.getBoundingClientRect().width||0)),h=300,pad=70,colW=(w-pad*2)/Math.max(1,stages.length-1),max=Math.max(...Object.values(reach)),y0=110,hmax=150;
  const svg=sv('svg',{viewBox:`0 0 ${w} ${h}`,width:w,height:h,role:'img','aria-label':`Attack paths across ${stages.length} stages`}),X=(i)=>stages.length===1?w/2:pad+i*colW,Hh=(v)=>Math.max(6,v/max*hmax);
  Object.entries(link).forEach(([k,v])=>{const[a,b]=k.split('|'),i=stages.indexOf(a),j=stages.indexOf(b);if(i<0||j<0)return;const x1=X(i)+10,x2=X(j)-10,yc=y0+Hh(reach[a])/2,yd=y0+Hh(reach[b])/2,th=Math.max(2,v/max*hmax*0.9);
    svg.append(sv('path',{d:`M${x1},${yc} C${(x1+x2)/2},${yc} ${(x1+x2)/2},${yd} ${x2},${yd}`,fill:'none',stroke:'var(--a1)','stroke-opacity':0.22,'stroke-width':th}),sv('title',{},`${a} to ${b}: ${v}`))});
  stages.forEach((s,i)=>{const hh=Hh(reach[s]),deep=['Credential Access','Privilege Escalation','Lateral Movement','Command and Control','Exfiltration','Impact'].includes(s);
    svg.append(sv('rect',{x:X(i)-10,y:y0,width:20,height:hh,rx:6,fill:deep?'var(--crit)':'var(--a1)'}));
    const lines=s.split(' ');lines.forEach((t,k)=>svg.append(sv('text',{x:X(i),y:y0-34+k*13-(lines.length-1)*13,'text-anchor':'middle',class:'flowlbl'},t)));
    svg.append(sv('text',{x:X(i),y:y0-10,'text-anchor':'middle',class:'flownum'},String(reach[s])));
    if(stop[s])svg.append(sv('text',{x:X(i),y:y0+hh+18,'text-anchor':'middle',class:'flowstop'},`${stop[s]} stopped`))});
  box.append(svg)};draw();watch(box,draw)}

/* Workflows: who gets told, which tickets are raised, and what waits for approval. */
V.workflows=()=>{const waiting=WF.log.filter((r)=>r.status==='waiting for approval'&&(FILTER.team==='all'||r.actions.some((a)=>a.team===FILTER.team))),done=WF.log.filter((r)=>r.status!=='waiting for approval').slice(0,15);
  const typeName={teams:'Teams message',servicenow:'ServiceNow ticket',jira:'Jira issue',email:'Email',webhook:'Webhook'};
  const wl=el('div','approvals');waiting.forEach((r)=>{const acts=el('ul','alist');r.actions.forEach((a)=>acts.append(el('li','',el('b','',`${typeName[a.type]||a.type} to ${a.team}`),el('small','',a.target?`(${a.target})`:'(no route set)'),el('p','',a.summary&&a.type!=='teams'?a.summary+': '+a.text:a.text))));
    const ok=el('button','btn primary','Approve and send'),no=el('button','btn','Dismiss');ok.type=no.type='button';
    const act=(verb)=>{if(!HOSTED){r.status=verb==='approve'?'dry run':'dismissed';r.done_by='you (preview)';toast(verb==='approve'?'Preview: nothing was sent. On the hosted system this sends the actions above.':'Dismissed in this preview.');built.workflows=false;$('#workflows').replaceChildren();show('workflows',false);return}
      fetch(`api/workflows/${r.uid}/${verb}`,{method:'POST',credentials:'same-origin',headers:{'X-Requested-With':'secops-dashboard'}}).then((x)=>x.json()).then((rec)=>{Object.assign(r,rec);toast(rec.status?`${r.name}: ${rec.status}.`:rec.error,'');built.workflows=false;$('#workflows').replaceChildren();show('workflows',false)}).catch(()=>toast('Could not reach the server. Try again.','bad'))};
    ok.addEventListener('click',()=>act('approve'));no.addEventListener('click',()=>act('dismiss'));
    wl.append(el('article','card appr',el('div','sig-head',el('h3','',r.name),el('span','cap',ago(r.created))),acts,el('div','sig-go',ok,no)))});
  if(!waiting.length)wl.append(el('p','note','Nothing is waiting for approval.'));
  const rows=WF.workflows.map((w)=>[w.name,w.trigger.replace('.',': ').replace(/_/g,' '),w.actions.join(', '),w.mode==='auto'?'Runs automatically':'Needs approval']);
  const tb=el('tbody');rows.forEach((r)=>{const tr=el('tr');r.forEach((c,i)=>tr.append(el('td',i===3?'':'',i===3?el('span','pill '+(c==='Needs approval'?'warn':''),c):c)));tb.append(tr)});
  const hr=el('tr');['Workflow','Watches','Does','Mode'].forEach((h)=>hr.append(el('th','',h)));
  const lg=el('ul','feed');done.forEach((r)=>lg.append(el('li','',el('small','',new Date(r.done_at||r.created).toLocaleString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})),el('span','',`${r.name}: ${r.status}${r.done_by&&r.done_by!=='automatic'?' by '+r.done_by:''}`))));
  const routes=el('tbody');Object.entries(WF.teams).forEach(([t,c])=>routes.append(el('tr','',el('td','',t),el('td','',c.teams_webhook_env?'Teams channel':'—'),el('td','',c.servicenow_group||'—'),el('td','',c.jira_project||'—'))));
  const rh=el('tr');['Team','Teams','ServiceNow group','Jira project'].forEach((h)=>rh.append(el('th','',h)));
  return[vhead('Workflows',['Who is alerted, which tickets are raised, and when. Notifications can run automatically; tickets and anything sent to leadership wait here for a person to approve.'],WF.actions_enabled?'ok':'warn',WF.actions_enabled?'Sending on':'Dry run'),
    WF.actions_enabled?null:el('p','sample','Sending is switched off, so approved actions are recorded as dry runs showing exactly what would be sent. Turn it on with SECOPS_ACTIONS_ENABLED once the Teams, ServiceNow and Jira connections are tested.'),
    band(`Waiting for approval (${waiting.length})`),wl,
    el('div','two wide',el('section','card',el('h2','h','Automations'),el('div','scroll',el('table','score wf',el('thead','',hr),tb))),el('section','card',el('h2','h','Recently done'),lg.children.length?lg:el('p','note','Nothing yet.'))),
    el('section','card',el('h2','h','Where each team is reached'),el('div','scroll',el('table','score wf',el('thead','',rh),routes)))].filter(Boolean)};

/* Reports and decks, built from the same figures. */
V.reports=()=>{const sched=WF.workflows.find((w)=>w.trigger==='schedule.weekly');
  const card=(title,desc,items,btn,href)=>{const b=el(HOSTED?'a':'button','btn primary',btn);if(HOSTED){b.href=href;b.setAttribute('download','')}else{b.type='button';b.addEventListener('click',()=>toast('Downloads work on the hosted system. This preview cannot save files.'))}
    const ul=el('ul','list');items.forEach((t)=>ul.append(el('li','',t)));return el('section','card rep',el('h2','h',title),el('p','sub',desc),ul,el('div','sig-go',b))};
  return[vhead('Reports',['Board decks and the weekly report are built from the same figures as these pages, so every channel says the same thing.'],'',''),
    el('div','two',card('Board deck','PowerPoint, last 30 days. Editable charts and tables.',['Outcome targets met and realised','Phase 2 outcomes table','Performance against the period before','Threat paths and near misses','Decisions and actions with owners','Signals'],'Download the deck','api/report.pptx?days=30'),
      card('Weekly report','One page for email or Teams, last 7 days.',['Headline and decisions needed','Every measure against the week before','Near misses','Which sections are still on sample data'],'Open the weekly report','api/report.html?days=7')),
    el('section','card',el('h2','h','Schedule'),el('p','',sched?`${sched.name}: ${sched.schedule||'weekly'}, sent to ${sched.actions.join(', ')}. ${sched.mode==='auto'?'Runs automatically.':'Waits for approval.'}`:'No scheduled report is set up.'),el('p','note','Change the schedule and recipients in ops.json. In Claude, ask for "the board deck for the last 90 days" to get the same deck with a different period.'))]};

/* Command bar and voice. */
const CMDS=[[/(red team|pen ?test|penetration|attack simulation|purple)/,'offsec'],[/agent/,'agents'],[/(executive|exec|board|summary)/,'exec'],[/(live|control|flight|board view|now)/,'live'],[/(operations overview|overview)/,'overview'],[/(soc|incident|detection)/,'detection'],
  [/(vuln)/,'vulnerabilities'],[/(remediat|fix)/,'remediation'],[/(email|phish)/,'email'],[/(user|app|dlp|data loss)/,'people'],[/(control area|coverage|blind)/,'controls'],
  [/(threat|path|near miss|kill chain)/,'threats'],[/cloud/,'cloud'],[/(devsecops|code|pipeline)/,'devsecops'],[/sap/,'sap'],[/signal/,'signals'],[/(workflow|approval|ticket|automation)/,'workflows'],[/(report|deck|slides)/,'reports'],[/(build|security setup)/,'build']];
function speak(t){try{if('speechSynthesis' in window){speechSynthesis.cancel();speechSynthesis.speak(new SpeechSynthesisUtterance(t))}}catch(e){}}
function briefing(){const oc=(DATA.outcomes&&DATA.outcomes.outcomes)||[],ms=oc.flatMap((o)=>o.measures),meas=ms.filter((m)=>m.meets!=null),met=meas.filter((m)=>m.meets).length,
  rows=LV.queue.map((q)=>clocks(q)),br=rows.filter((c)=>c.breached).length,near=TH.paths.filter((p)=>p.near_miss&&Date.now()-new Date(p.created)<7*864e5).length;
  return `${met} of ${meas.length} outcome targets are met. ${LV.queue.length} incidents are in flight, ${br} past a service-level target. ${near} near miss${near===1?"":"es"} in the last seven days. ${risks().length?'Top risk: '+risks()[0][0]+'.':''}`}
function runCommand(raw){const t=raw.toLowerCase().trim();if(!t)return;
  if(CL&&(/\?$/.test(t)||/^(what|why|how|which|who|where|when|should|is|are|can|do|does|did|give|explain|compare|tell|summari[sz]e|draft|write)\b/.test(t))){askClaude('Answer',raw,'Question from the reader: '+raw,{cache:false});return}
  const per=[[/yesterday|today/,'day'],[/(7 days|week)/,'week'],[/(30 days|month)/,'month'],[/(90 days|quarter)/,'quarter'],[/(12 months|year)/,'year']].find(([r])=>r.test(t));
  const sev=/(high|critical)/.test(t)?'High':/medium/.test(t)?'Medium':/(all severit|any severit)/.test(t)?'all':null;
  if(/(brief|read|summar|how are we|status)/.test(t)&&!/report/.test(t)){const b=briefing();speak(b);toast(b);return}
  if(/(deck|powerpoint|slides)/.test(t)&&/(download|make|create|build|get)/.test(t)){if(HOSTED){location.href='api/report.pptx?days='+({day:1,week:7,month:30,quarter:90,year:365}[per?per[1]:'month'])}else toast('Preview: the hosted system downloads the deck here.');return}
  if(/(clear|reset) filter/.test(t)){Object.assign(FILTER,{severity:'all',team:'all',source:'all'});syncBar();rebuild();toast('Filters cleared.');return}
  let did=[];if(per){FILTER.period=per[1];did.push('period set')}if(sev){FILTER.severity=sev;did.push(sev==='all'?'all severities':sev+' severity only')}
  const team=Object.keys(WF.teams).concat((DATA.owners||[]).map((o)=>o.team)).find((n)=>t.includes(n.toLowerCase()));if(team){FILTER.team=team;did.push(team)}
  const dest=CMDS.find(([r])=>r.test(t));if(did.length)syncBar();if(dest&&dest[1]!==CURRENT){show(dest[1],true);did.unshift('opened '+(NAV.find((n)=>n[0]===dest[1])||[])[1])}else if(did.length)rebuild();
  if(!did.length&&CL){askClaude('Answer',raw,'Request from the reader: '+raw,{cache:false});return}
  toast(did.length?did.join(', ')+'.':`Not sure what to do with "${raw}". Try "show live operations", "near misses last 90 days", "high severity only" or "brief me".`)}
function rebuild(){Object.keys(built).forEach((k)=>{built[k]=false;const v=$('#'+k);if(v)v.replaceChildren()});show(CURRENT,false)}
const BAR=el('div','toolbar');
function syncBar(){BAR.querySelectorAll('select').forEach((s)=>{s.value=FILTER[s.dataset.f]});const c=BAR.querySelector('.tcustom');if(c)c.hidden=FILTER.period!=='custom';
  BAR.querySelectorAll('select[data-f]').forEach((s)=>{const on=(APPLIES[CURRENT]||[]).includes(s.dataset.f);s.disabled=!on;s.closest('label').hidden=!on});if(c&&!(APPLIES[CURRENT]||[]).includes('period'))c.hidden=true;
  const v=$('#'+CURRENT),seg=BAR.querySelector('.seg');if(seg){seg.parentElement.hidden=!(v&&v.querySelector('.xtra'));seg.querySelectorAll('button').forEach((b)=>b.setAttribute('aria-pressed',b.dataset.d===FILTER.detail?'true':'false'))}
  const t=BAR.querySelector('.ptitle');if(t){const n=NAV.find((q)=>q[0]===CURRENT);t.textContent=n?n[1]:''}}
(function makeBar(){const cmd=el('input');cmd.type='search';cmd.id='cmd';cmd.placeholder='Ask or command: "near misses last 90 days", "brief me"';cmd.setAttribute('aria-label','Command');
  cmd.addEventListener('keydown',(e)=>{if(e.key==='Enter'){runCommand(cmd.value);cmd.value=''}});
  const mic=el('button','mic');mic.type='button';mic.setAttribute('aria-label','Speak a command');const mi=sv('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':1.8,'stroke-linecap':'round','aria-hidden':'true'});mi.append(sv('path',{d:'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9a7 7 0 0 0 14 0M12 19v3'}));mic.append(mi);
  mic.addEventListener('click',()=>{const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){toast('Voice needs Chrome or Edge on the hosted system. Type the command instead.');return}
    try{const r=new SR();r.lang='en-GB';r.interimResults=false;mic.classList.add('on');toast('Listening…');r.onresult=(e)=>{const said=e.results[0][0].transcript;cmd.value=said;runCommand(said);cmd.value=''};r.onerror=()=>toast('Voice is not available here. Type the command instead.');r.onend=()=>mic.classList.remove('on');r.start()}catch(e){toast('Voice is not available here. Type the command instead.')}});
  const sel=(f,label,opts)=>{const s=el('select','dash-sel');s.dataset.f=f;s.id='f-'+f;opts.forEach(([v,l])=>s.append(new Option(l,v)));s.addEventListener('change',()=>{FILTER[f]=s.value;if(f==='period'&&s.value==='custom'&&!FILTER.from){const last=DY.length?DY[DY.length-1].date:new Date().toISOString().slice(0,10);FILTER.to=last;FILTER.from=addDays(last,-59);fi.value=FILTER.from;ti.value=FILTER.to}syncBar();rebuild()});return el('label','tf',el('span','',label),s)};
  const fi=el('input'),ti=el('input');fi.type=ti.type='date';fi.id='f-from';ti.id='f-to';[fi,ti].forEach((i)=>i.addEventListener('change',()=>{if(fi.value&&ti.value&&fi.value<=ti.value){FILTER.from=fi.value;FILTER.to=ti.value;rebuild()}}));
  const sources=[...new Set(LV.queue.map((q)=>q.source).concat(TH.paths.map((p)=>p.source)))].sort(),teams=[...new Set(LV.queue.map((q)=>q.team).concat(Object.keys(WF.teams)))].sort();
  const seg=el('div','seg');seg.setAttribute('role','group');seg.setAttribute('aria-label','Detail');[['summary','Summary'],['full','Full detail']].forEach(([d,l])=>{const b=el('button','',l);b.type='button';b.dataset.d=d;b.addEventListener('click',()=>{FILTER.detail=d;applyDetail();syncBar()});seg.append(b)});
  BAR.append(el('h2','ptitle',''),el('div','cmdbox',cmd,mic),el('div','tf tseg',el('span','','Detail'),seg),sel('period','Period',[['day','Yesterday'],['week','Last 7 days'],['month','Last 30 days'],['quarter','Last 90 days'],['year','Last 12 months'],['custom','Custom dates']]),
    el('span','tcustom',el('label','tf',el('span','','From'),fi),el('label','tf',el('span','','To'),ti)),sel('severity','Severity',[['all','All'],...SEVS.map((s)=>[s,s])]),sel('team','Team',[['all','All teams'],...teams.map((t)=>[t,t])]),sel('source','Source',[['all','All systems'],...sources.map((s)=>[s,s])]));
  $('#main').prepend(BAR);addEventListener('keydown',(e)=>{if(e.key==='/'&&document.activeElement.tagName!=='INPUT'){e.preventDefault();cmd.focus()}})})();

const NAV=[['exec','Executive view','M3 20h18M6 16V9m6 7V5m6 11v-4'],['socdir','SOC director','M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm-7 18c0-3.900 3.100-7 7-7s7 3.100 7 7'],['live','SOC team','M3 12h3l2-5 3 10 2-5h8M12 3v2m0 14v2'],['overview','Operations overview','M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z'],['detection','SOC operations','M3 12h4l2-6 4 12 2-6h6'],['vulnerabilities','Vulnerabilities','M12 3 3 19h18L12 3Zm0 6v5m0 3v.5'],['remediation','Remediation','M4 12a8 8 0 1 0 2.300-5.600M4 4v4h4m3 4 2 2 4-4'],['email','Email and phishing','M3 6h18v12H3V6Zm0 1 9 6 9-6'],['people','Users and apps','M8 11a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7Zm-6 9c0-3.300 2.700-6 6-6s6 2.700 6 6M17 11a3 3 0 1 0 0-6M22 20c0-2.800-2-5.100-4.500-5.800'],['controls','Control areas','M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z'],['signals','Signals','M12 3c.600 5 2.400 6.800 7.500 7.500-5.100.700-6.900 2.500-7.500 7.500-.600-5-2.400-6.800-7.500-7.500C9.600 9.800 11.400 8 12 3Z'],['build','Build and security','M12 3 5 6v5c0 4.500 3 8 7 10 4-2 7-5.500 7-10V6l-7-3Z']];
const nav=$('#nav'),main=$('#main'),built={};
NAV.splice(NAV.findIndex((n)=>n[0]==='signals'),0,['threats','Threat paths','M4 18c3-8 6-8 8-4s5 4 8-4M4 18h.01M20 10h.01'],...DOMS.map((d)=>[d.id,d.nav||d.title,d.icon]));
NAV.splice(NAV.findIndex((n)=>n[0]==='overview'),0,['infra','Infrastructure','M4 5h16v5H4zM4 14h16v5H4zM8 7.500h.01M8 16.500h.01'],['eng','Engineering','m8 8-4 4 4 4m8-8 4 4-4 4M14 5l-4 14']);
NAV.splice(NAV.findIndex((n)=>n[0]==='signals'),0,['offsec','Red team and testing','M12 3v4M12 17v4M3 12h4M17 12h4M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z'],['agents','Agents','M8 4h8v5H8zM5 9h14v11H5zM9 14h.01M15 14h.01M12 4V2'],['ai','AI use','M9 4h6v4H9zM5 10h14v10H5zM9 14h.01M15 14h.01M10 17h4']);
NAV.splice(NAV.findIndex((n)=>n[0]==='build'),0,['workflows','Workflows','M5 6h6v4H5zM13 14h6v4h-6zM8 10v4h8'],['reports','Reports','M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6']);
/* Sidebar: three short groups. "Areas" folds away and opens by itself when one of its pages is shown. */
const GROUPS=[['Views',['exec','socdir','live','infra','eng'],false],['Areas',null,true],['Operations',['agents','offsec','threats','signals','workflows','reports','build'],false]];
{const taken=new Set(GROUPS.filter((g)=>g[1]).flatMap((g)=>g[1]));GROUPS[1][1]=NAV.map((n)=>n[0]).filter((k)=>!taken.has(k))}
const byId=Object.fromEntries(NAV.map((n)=>[n[0],n]));
NAV.forEach(([k,label])=>{const v=el('section','view');v.id=k;v.hidden=true;v.setAttribute('aria-label',label);main.append(v)});
GROUPS.forEach(([name,ids,fold],gi)=>{const box=el('div','ngroup');box.id='ng-'+gi;
  ids.forEach((k)=>{const [,label,d]=byId[k],ic=sv('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':1.7,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'});ic.append(sv('path',{d}));
    const b=el('button','nv',ic,el('span','',label));b.type='button';b.dataset.v=k;b.addEventListener('click',()=>show(k,true));box.append(b)});
  if(fold){const h=el('button','ngh fold',el('span','',name),el('span','cnt',String(ids.length)));h.type='button';h.setAttribute('aria-expanded','false');h.setAttribute('aria-controls',box.id);box.classList.add('shut');
    h.addEventListener('click',()=>{const open=box.classList.toggle('shut');h.setAttribute('aria-expanded',open?'false':'true')});nav.append(h)}
  else nav.append(el('div','ngh',name));nav.append(box)});
const SRC=DATA._sources||{},onSample=Object.keys(SRC).filter((k)=>SRC[k]==='sample');
$('#meta').append(el('span','badge'+(onSample.length?' sample':''),onSample.length?`Sample data: ${onSample.length} of ${Object.keys(SRC).length} sections`:'All sections live'),el('span','badge',el('span','dot'),'Week ending '+day(L.week_ending)),el('span','badge',el('span','dot'+(lateT.length?' w':'')),`${DATA.tools.length-lateT.length} of ${DATA.tools.length} systems current`));

/* Measures added in metrics.json. Each has 12 weekly values and lands on the view it names. */
function customFor(k){const list=(DATA.custom||[]).filter((m)=>m.view===k&&Array.isArray(m.values)&&m.values.length>1);if(!list.length)return[];
  const tiles=el('section','stats'),charts=el('div','two');
  list.forEach((m)=>{const vals=m.values.map(Number),dec=!!m.decimals,c=r1(last(vals)-prev(vals));
    tiles.append(stat(m.label,last(vals),m.unit||'',dec?1:0,c,m.better||'lower',vals,'var(--a1)'));
    if(m.chart!==false)charts.append(chartCard(m.label,{label:`${m.label} by week`,end:true,dec,unit:m.unit==='%'?'%':'',series:[{vals,color:'var(--a1)',label:m.label}]}));
    if(m.note)tiles.title=m.note});
  return[band('More measures'),tiles,charts.children.length?charts:null].filter(Boolean)}
/* Summary or full detail, per page: summary keeps the insights, the headline figures, the first chart and the tables. */
const NODETAIL=['live','threats','workflows','reports','build','agents'];
function markDetail(v){if(NODETAIL.includes(v.id))return;const KEEP=v.id==='exec'?0:4,skip='header,.keep,.dsays,.stats,.heroband,.period,.funnel,.signals,.band,.note,.more-detail';let shown=0,hid=0,charts=0;
  const kids=[...v.children].filter((x)=>!x.matches(skip));
  kids.forEach((x)=>{const cards=x.matches('section.card')?[x]:[...x.children].filter((c)=>c.matches('section.card,article.card'));if(!cards.length)return;
    cards.forEach((c)=>{const ch=!!c.querySelector('.chart');if(shown<KEEP&&!(ch&&charts>=2)){shown++;if(ch)charts++}else{c.classList.add('xtra');hid++}});if(cards.every((c)=>c.classList.contains('xtra')))x.classList.add('xtra')});
  const all=[...v.children];all.forEach((x,i)=>{if(!x.matches('.band'))return;let j=i+1,any=false;while(j<all.length&&!all[j].matches('.band')){if(!all[j].classList.contains('xtra')&&!all[j].matches('.note'))return;any=true;j++}if(any)x.classList.add('xtra')});
  if(hid){const b=el('button','btn more-detail',`Show ${hid} more section${hid===1?'':'s'}`);b.type='button';b.addEventListener('click',()=>{FILTER.detail='full';applyDetail();syncBar()});v.append(b)}}
const AREA_IX={detection:['rules','provider','escal','automation'],vulnerabilities:['exposure','teams','estate','edr'],remediation:['teams','exposure','estate'],email:['phish','delivered'],people:['ai','aiFiles'],controls:['edr','siem'],overview:['exposure','provider','phish','teams']};
function areaInsights(v){const ks=AREA_IX[v.id];if(!ks||v.querySelector('.dsays')||!MS)return;const box=insights(ks.map((k)=>IX[k]()));const h=v.querySelector(':scope > header');if(h)h.after(box);else v.prepend(box)}
function applyDetail(){document.querySelectorAll('.view').forEach((v)=>v.classList.toggle('summary',FILTER.detail!=='full'))}
function show(k,push){if(!V[k])k='exec';CURRENT=k;if(typeof syncBar==='function')syncBar();
  NAV.forEach(([id])=>{$('#'+id).hidden=id!==k});nav.querySelectorAll('.nv').forEach((b)=>{if(b.dataset.v===k){b.setAttribute('aria-current','page');if(b.scrollIntoView&&innerWidth<1000)b.scrollIntoView({block:'nearest',inline:'center'})}else b.removeAttribute('aria-current')});
  const nb=nav.querySelector(`.nv[data-v="${k}"]`),grp=nb&&nb.parentElement;if(grp&&grp.classList.contains('shut')){grp.classList.remove('shut');const h=nav.querySelector(`[aria-controls="${grp.id}"]`);if(h)h.setAttribute('aria-expanded','true')}
  if(!built[k]){built[k]=true;const v=$('#'+k);V[k]().forEach((x)=>v.append(x));customFor(k).forEach((x)=>v.append(x));areaInsights(v);markDetail(v);after.splice(0).forEach((f)=>f())}
  applyDetail();syncBar();
  if(push){if(location.hash!=='#'+k)location.hash=k;scrollTo(0,0)}}
addEventListener('hashchange',()=>show(location.hash.slice(1),false));
show(location.hash.slice(1)||'exec',false);
})();

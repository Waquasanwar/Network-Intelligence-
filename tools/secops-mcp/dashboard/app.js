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
    if(cfg.flag>=0){s.append(sv('line',{x1:x(cfg.flag),x2:x(cfg.flag),y1:m.t-4,y2:h-m.b,stroke:'var(--a2)','stroke-dasharray':'3 4'}),sv('text',{x:x(cfg.flag),y:m.t-8,'text-anchor':'middle',class:'flagl'},'AI flag'))}
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
function dataPanel(cfg){const fc=cfg.fc||0,dec=cfg.dec,u=cfg.unit||'',lo=cfg.clamp?cfg.clamp[0]:0,hi=cfg.clamp?cfg.clamp[1]:Infinity;
  const hr=el('tr','',el('th','','Week ending'));cfg.series.forEach((q)=>hr.append(el('th','',q.label)));const extra=cfg.extra?cfg.extra(0).map((e)=>e[0]):[];extra.forEach((e)=>hr.append(el('th','',e)));
  const body=el('tbody'),rows=[];
  for(let i=n-1;i>=0;i--){const tr=el('tr','',el('td','',day(W[i].week_ending)));cfg.series.forEach((q)=>tr.append(el('td','',fx(q.vals[i],dec)+u)));if(cfg.extra)cfg.extra(i).forEach((e)=>tr.append(el('td','',e[1])));rows[i]=tr;body.append(tr)}
  for(let j=1;j<=fc;j++){const tr=el('tr','pj',el('td','',ahead(j)+' (projected)'));cfg.series.forEach((q)=>tr.append(el('td','','≈'+fx(Math.min(hi,Math.max(lo,last(q.vals)+slope(q.vals)*j)),dec)+u)));extra.forEach(()=>tr.append(el('td','','')));rows[n-1+j]=tr;body.prepend(tr)}
  const wrap=el('div','dwrap',el('table','data',el('thead','',hr),body)),btn=el('button','link sm','View data');btn.type='button';btn.setAttribute('aria-expanded','false');wrap.hidden=true;
  const open=(on)=>{wrap.hidden=!on;btn.textContent=on?'Hide data':'View data';btn.setAttribute('aria-expanded',on?'true':'false')};
  btn.addEventListener('click',()=>open(wrap.hidden));
  cfg.onPick=(i)=>{open(true);rows.forEach((r)=>r&&r.classList.remove('on'));if(rows[i]){rows[i].classList.add('on');wrap.scrollTop=Math.max(0,rows[i].offsetTop-60)}};
  return[el('div','cfoot',el('span','cap','Select a week on the chart to see its figures'),btn),wrap]}
function chartCard(title,cfg){const box=el('div','chart'),c=el('section','card',el('div','ph',el('h2','h',title),legend(cfg.series.map((q)=>[q.label,q.grad?'linear-gradient(var(--a2),var(--a1))':q.color]))),box,...dataPanel(cfg));after.push(()=>chart(box,cfg));return c}
function stat(label,value,unit,dec,c,betterDir,vals,color,go){
  const v=el('span'),num=el('div','num',v,unit?el('span','unit',unit):null),sp=vals?el('div','spark'):null;
  const card=el(go?'button':'div','card kpi'+(go?' lift':''),el('div','cap',label),num,c===null?el('div','cap',' '):el('div','',deltaEl(c,betterDir,dec),' ',el('span','cap','on last week')),sp);
  if(go){card.type='button';card.addEventListener('click',()=>show(go,true))}
  after.push(()=>{count(v,value,dec);if(sp)spark(sp,vals,color||'var(--a1)')});return card}
function signal(r){return el('article','card sig lift',el('h3','',r.title),el('p','meta',`${r.systems} · ${r.confidence} confidence`),el('p','',r.pattern),el('div','look',el('strong','','Where to look'),el('span','',r.look)))}
const signalsFor=(area)=>DATA.notes.filter((r)=>r.areas.includes(area));
function heading(title,cfg,points,note){const box=el('div','chart'),ul=el('ul','proj');points.forEach(([a,b])=>ul.append(el('li','',el('b','',a),el('span','',b))));after.push(()=>chart(box,cfg));
  return el('div','head',el('section','card',el('div','ph',el('h2','h',title),legend(cfg.series.map((q)=>[q.label,q.color]))),box,...dataPanel(cfg)),el('section','card edge',el('h2','h','Where it is heading'),el('div','',''),ul,el('p','note',note||`A straight line through the last six weeks, carried forward to ${ahead(FC)}. A guide to direction, not a forecast.`)))}
function vhead(title,text,tone,state){const p=el('p');text.forEach((t)=>p.append(typeof t==='string'?t:el('b','',t[0])));return el('header','vh',el('div','vtitle',el('h1','',title),state?el('span','pill '+tone,state):null),p)}
function aiBlock(area){const s=signalsFor(area);if(!s.length)return[];const g=el('section','ai');s.forEach((r)=>g.append(signal(r)));return[band('AI signals for this area'),g]}


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
function rowsBars(items,max,color){const b=el('div','bars');items.forEach(([name,val,note,col])=>{const tr=el('div','track'),i=el('i');i.style.width=Math.max(2,val/max*100)+'%';i.style.background=col||color;tr.append(i);tr.setAttribute('role','img');tr.setAttribute('aria-label',`${name}: ${val}`);b.append(el('div','',el('div','bar-top',el('span','',name),el('span','',note)),tr))});return b}


const T=DATA.top;
S.rsign=T.weekly.risky_signins;S.mfa=T.weekly.mfa_failures;S.shadow=T.weekly.shadow_apps;S.dlp=DATA.trend.Netskope;S.unv=DATA.trend.CyberArk;
/* ranked list: head = column names (first is the name column), rows = [[name,sub],v1,v2...]; bar = index of the column that gets a bar; hot(row) marks its bar red */
function rank(title,sub,head,rows,o={}){const bi=o.bar||1,max=Math.max(...rows.map((r)=>r[bi])),hr=el('tr','',el('th','',''));head.forEach((h)=>hr.append(el('th','',h)));const body=el('tbody');
  rows.forEach((r,i)=>{const nm=el('td','nm',el('b','',r[0][0]),el('small','',r[0][1])),tr=el('tr','',el('td','rk',String(i+1)),nm);
    r.slice(1).forEach((v,j)=>{const k=j+1,txt=typeof v==='number'?f0(v)+((o.units||{})[k]||''):v;if(k===bi){const me=el('div','meter'),f=el('i'),hot=o.hot&&o.hot(r);f.style.width=Math.max(3,v/max*100)+'%';f.style.background=hot?'var(--crit)':'linear-gradient(90deg,var(--a2),var(--a1))';me.append(f);me.setAttribute('aria-hidden','true');tr.append(el('td','br'+(hot?' alert':''),txt,me))}else tr.append(el('td',o.flag&&o.flag(r,k)?'alert':'',txt))});body.append(tr)});
  return el('section','card',el('div','ph',el('h2','h',title),el('span','cap',sub)),el('div','scroll',el('table','rank',el('thead','',hr),body)),o.note?el('p','note',o.note):null)}
const R={
  hostsAlert:()=>rank('Hosts raising the most alerts','This week',['Host','Alerts','Incidents'],T.alert_hosts.map((h)=>[[h.host,h.type],h.alerts,h.incidents])),
  rules:()=>rank('Detection rules making the most noise','This week',['Rule','Alerts','False alarms'],T.rules.map((r)=>[[r.rule,r.source],r.alerts,r.false_pct]),{units:{2:'%'},flag:(r,k)=>k===2&&r[2]>=60,note:'A rule in red is wrong more than six times in ten and is a candidate for tuning.'}),
  hostsVuln:()=>rank('Most exposed hosts','Critical and high findings open',['Host','Critical','High','Oldest'],T.vuln_hosts.map((h)=>[[h.host,`${h.type} · ${h.team}`],h.critical,h.high,h.oldest_days]),{units:{3:' days'},flag:(r,k)=>k===3&&r[3]>90}),
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
  after.push(()=>{chart(c1box,{h:150,label:`Open critical and high findings, from ${S.open[0]} to ${last(S.open)} over 12 weeks`,end:true,series:[{vals:S.open,color:'var(--a1)',label:'Critical and high open'}]});spark(c2,S.rem,'var(--a2)')});
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
  const areas=el('section','areas');['detection','vulnerabilities','remediation','email','people','controls'].map((k)=>[k,AREAS[k]]).forEach(([k,a])=>{const b=el('button','card areac lift',el('div','rhead',el('span','name',a.name),el('span','pill '+a.tone,a.state)),el('p','',a.what),el('div','go',el('b','','Heading: '),a.go));b.type='button';b.addEventListener('click',()=>show(k,true));areas.append(b)});
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

V.signals=()=>{const g=el('section','ai');DATA.notes.forEach((r)=>g.append(signal(r)));
  return[vhead('AI signals',['Patterns across systems that no fixed rule was written for, each with the figures behind it and where to look next. Written by Claude from the data for the week ending '+day(DATA.notes[0].based_on_week)+'. Leads to check, not verdicts.'],'','' ),g]};
V.build=()=>{const t=$('#build-tpl').content.cloneNode(true),ch=t.querySelector('#sys-chips');DATA.tools.forEach((x)=>ch.append(el('li','',x.system)));
  return[vhead('How it is built and secured',['None of the systems is connected yet. This is the route from sample data to live.'],'',''),t]};

/* shell */
const NAV=[['overview','Overview','M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z'],['detection','SOC operations','M3 12h4l2-6 4 12 2-6h6'],['vulnerabilities','Vulnerabilities','M12 3 3 19h18L12 3Zm0 6v5m0 3v.5'],['remediation','Remediation','M4 12a8 8 0 1 0 2.300-5.600M4 4v4h4m3 4 2 2 4-4'],['email','Email and phishing','M3 6h18v12H3V6Zm0 1 9 6 9-6'],['people','Users and apps','M8 11a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7Zm-6 9c0-3.300 2.700-6 6-6s6 2.700 6 6M17 11a3 3 0 1 0 0-6M22 20c0-2.800-2-5.100-4.500-5.800'],['controls','Control areas','M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z'],['signals','AI signals','M12 3c.600 5 2.400 6.800 7.500 7.500-5.100.700-6.900 2.500-7.500 7.500-.600-5-2.400-6.800-7.500-7.500C9.600 9.800 11.400 8 12 3Z'],['build','Build and security','M12 3 5 6v5c0 4.500 3 8 7 10 4-2 7-5.500 7-10V6l-7-3Z']];
const nav=$('#nav'),main=$('#main'),built={};
NAV.forEach(([k,label,d],i)=>{if(i===1||i===7)nav.append(el('div','gap'));
  const ic=sv('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':1.7,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'});ic.append(sv('path',{d}));
  const b=el('button','nv',ic,el('span','',label),AREAS[k]?el('span','st '+AREAS[k].tone):null);b.type='button';b.dataset.v=k;b.addEventListener('click',()=>show(k,true));nav.append(b);
  const v=el('section','view');v.id=k;v.hidden=true;v.setAttribute('aria-label',label);main.append(v)});
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
function show(k,push){if(!V[k])k='overview';
  NAV.forEach(([id])=>{$('#'+id).hidden=id!==k});nav.querySelectorAll('.nv').forEach((b)=>{if(b.dataset.v===k){b.setAttribute('aria-current','page');if(b.scrollIntoView&&innerWidth<1000)b.scrollIntoView({block:'nearest',inline:'center'})}else b.removeAttribute('aria-current')});
  if(!built[k]){built[k]=true;const v=$('#'+k);V[k]().forEach((x)=>v.append(x));customFor(k).forEach((x)=>v.append(x));after.splice(0).forEach((f)=>f())}
  if(push){if(location.hash!=='#'+k)location.hash=k;scrollTo(0,0)}}
addEventListener('hashchange',()=>show(location.hash.slice(1),false));
show(location.hash.slice(1)||'overview',false);
})();

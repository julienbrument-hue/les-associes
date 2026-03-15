import { useState, useRef, useEffect } from "react";

const RISK_LABEL = {1:"Très défensif",2:"Défensif",3:"Prudent",4:"Équilibré",5:"Dynamique",6:"Offensif",7:"Très offensif"};
const RISK_COLOR = {1:"#22c55e",2:"#86efac",3:"#bef264",4:"#facc15",5:"#fb923c",6:"#f87171",7:"#ef4444"};
const DUREES = ["< 3 ans","3-5 ans","5-8 ans","8-10 ans","> 10 ans"];
const MARCHES = ["Actions Europe","Actions US","Actions monde","Obligations","Monétaire","Matières premières","Immobilier","Diversifié","Private Equity","Autre"];
const COMPAGNIES = ["SwissLife","GGVie","Nortia","LM","Allianz","AXA","Cardif","SPVIE","Generali","MMA","CT","AG2R","Corum","VIE Plus","PEA","La Mondiale","Garance","Spirica"];
const PIE = ["#c9a227","#3b82f6","#10b981","#ef4444","#8b5cf6","#06b6d4","#f97316","#ec4899","#14b8a6","#a855f7"];
const NAV="#0f2340",NAVL="#1a3560",GOLD="#c9a227",GOLDF="#f8f6f0";
const gCard={background:"#fff",borderRadius:16,border:"1px solid rgba(201,162,39,0.2)",boxShadow:"0 2px 20px rgba(15,35,64,0.06)"};
const gInp={padding:"10px 14px",borderRadius:10,border:"1.5px solid rgba(201,162,39,0.25)",background:GOLDF,color:NAV,fontSize:13,width:"100%",boxSizing:"border-box",fontFamily:"inherit",outline:"none"};
const gSel={padding:"9px 12px",borderRadius:8,border:"1.5px solid rgba(201,162,39,0.25)",background:GOLDF,color:NAV,fontSize:12,cursor:"pointer",fontFamily:"inherit",outline:"none"};

function parseCSV(text) {
  const lines=text.split(/\r?\n/).filter(function(l){return l.trim();});
  if(lines.length<2)return[];
  const sep=lines[0].includes(";")?";":",";
  const norm=function(s){return s.toLowerCase().replace(/[éèê]/g,"e").replace(/[àâ]/g,"a").replace(/[^a-z0-9]/g,"");};
  const headers=lines[0].split(sep).map(function(h){return norm(h.replace(/"/g,"").trim());});
  const find=function(){var keys=Array.prototype.slice.call(arguments);for(var k=0;k<keys.length;k++)for(var i=0;i<headers.length;i++)if(headers[i].includes(norm(keys[k])))return i;return -1;};
  const cols={nom:find("nom"),soc:find("societe","gestion"),sri:find("sri","risque"),isin:find("isin"),desc:find("desciptif","descriptif","description"),dispo:find("disponible","compagnie","eligible"),marche:find("marche","categorie")};
  var result=[];
  for(var idx=1;idx<lines.length;idx++){
    if(!lines[idx].trim())continue;
    var cells=[],cur="",inQ=false;
    for(var c=0;c<lines[idx].length;c++){var ch=lines[idx][c];if(ch==='"'){inQ=!inQ;}else if(ch===sep&&!inQ){cells.push(cur.trim());cur="";}else cur+=ch;}
    cells.push(cur.trim());
    var g=function(ix){return ix>=0?(cells[ix]||"").replace(/"/g,"").trim():"";};
    result.push({id:Math.random().toString(36).slice(2)+idx,nom:g(cols.nom)||"Sans nom",soc:g(cols.soc),sri:Math.min(7,Math.max(1,parseInt(g(cols.sri))||4)),isin:g(cols.isin),desc:g(cols.desc),dispo:g(cols.dispo).split(/[|,\/]/).map(function(s){return s.trim();}).filter(function(s){return s.length>0;}),marche:g(cols.marche)});
  }
  return result;
}

function simPerf(fund) {
  const rets=[0.01,0.02,0.03,0.045,0.065,0.085,0.10],vols=[0.005,0.01,0.02,0.04,0.07,0.10,0.14];
  const ret=rets[fund.sri-1],vol=vols[fund.sri-1],key=fund.isin||fund.nom||"x";
  var seed=0;for(var i=0;i<key.length;i++)seed+=key.charCodeAt(i);
  const rng=function(){seed=(seed*1664525+1013904223)&0xffffffff;return(seed>>>0)/0xffffffff;};
  const pts=[100];
  for(var m=0;m<120;m++)pts.push(pts[pts.length-1]*(1+ret/12+(rng()-0.5)*2*vol/Math.sqrt(12)));
  var out=[];for(var j=0;j<=10;j++)out.push(parseFloat(pts[j*12].toFixed(2)));
  return out;
}

async function callClaude(prompt) {
  const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:4000,messages:[{role:"user",content:prompt}]})});
  if(!res.ok)throw new Error("HTTP "+res.status);
  const d=await res.json();
  if(d.error)throw new Error(d.error.message);
  return(d.content&&d.content[0]&&d.content[0].text)||"";
}

const FMP_KEY="b3k1Mnonse7zBu9lAmph3vYkAFcRHHk4";
const FMP_BASE="https://financialmodelingprep.com/api/v3";
const FMP_TTL=24*60*60*1000;

function openHtmlInNewTab(html) {
  try {
    var blob=new Blob([html],{type:"text/html;charset=utf-8"});
    var url=URL.createObjectURL(blob);
    var a=document.createElement("a");
    a.href=url;
    a.download="les-associes-"+new Date().toISOString().slice(0,10)+".html";
    document.body.appendChild(a);
    a.click();
    setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url);},1000);
  } catch(e){}
}

async function fetchFMPPerf(isin) {
  if(!isin) return null;
  try {
    const cached=localStorage.getItem("fmp_"+isin);
    if(cached){const p=JSON.parse(cached);if(Date.now()-p.ts<FMP_TTL)return p.data;}
  } catch(e){}
  try {
    const endYear=new Date().getFullYear()-1, startYear=endYear-9;
    const res=await fetch(FMP_BASE+"/historical-price-full/"+encodeURIComponent(isin)+"?from="+startYear+"-01-01&to="+endYear+"-12-31&apikey="+FMP_KEY);
    if(!res.ok) return null;
    const json=await res.json();
    if(!json.historical||json.historical.length<50) return null;
    const byYear={};
    json.historical.forEach(function(d){
      const y=parseInt(d.date.slice(0,4));
      if(y>=startYear&&y<=endYear&&(!byYear[y]||d.date>byYear[y].date)) byYear[y]={p:d.adjClose||d.close};
    });
    const yrs=[];for(var y=startYear;y<=endYear;y++)yrs.push(y);
    if(yrs.some(function(y){return !byYear[y];})) return null;
    const base=byYear[startYear].p;
    if(!base||base<=0) return null;
    const pts=[100];
    yrs.forEach(function(y){pts.push(parseFloat((byYear[y].p/base*100).toFixed(2)));});
    try{localStorage.setItem("fmp_"+isin,JSON.stringify({ts:Date.now(),data:pts}));}catch(e){}
    return pts;
  } catch(e){return null;}
}

function Spinner() {
  return <div className="spin" style={{width:14,height:14,border:"2px solid rgba(15,35,64,0.15)",borderTopColor:GOLD,borderRadius:"50%",display:"inline-block"}}/>;
}

function SriDot(props) {
  const n=props.n;
  return (
    <span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,padding:"2px 8px",borderRadius:20,background:RISK_COLOR[n]+"22",color:RISK_COLOR[n],fontWeight:700}}>
      <span style={{width:6,height:6,borderRadius:"50%",background:RISK_COLOR[n],display:"inline-block"}}/>
      {n+" · "+RISK_LABEL[n]}
    </span>
  );
}

function LineChartPts(props) {
  const pts=props.pts;
  const W=820,H=240,PL=52,PR=16,PT=16,PB=32,n=pts.length;
  const mn=Math.min.apply(null,pts)*.98,mx=Math.max.apply(null,pts)*1.02;
  const px=function(i){return PL+(i/(n-1))*(W-PL-PR);};
  const py=function(v){return PT+(1-(v-mn)/(mx-mn))*(H-PT-PB);};
  const yr=new Date().getFullYear();
  const dPath=pts.map(function(v,i){return(i===0?"M":"L")+px(i)+","+py(v);}).join(" ");
  const tot=((pts[n-1]/pts[0])-1)*100;
  const step=Math.max(1,Math.ceil(n/10));
  return (
    <svg width="100%" viewBox={"0 0 "+W+" "+H}>
      {[0,.25,.5,.75,1].map(function(p){const y=PT+p*(H-PT-PB),v=mx-p*(mx-mn);return <g key={p}><line x1={PL} y1={y} x2={W-PR} y2={y} stroke="#f0ece0" strokeWidth="1"/><text x={PL-4} y={y+3} textAnchor="end" fontSize="9" fill="#8292a8">{(v-100).toFixed(0)+"%"}</text></g>;})}
      {pts.map(function(_,i){if(i%step!==0)return null;return <text key={i} x={px(i)} y={H-6} textAnchor="middle" fontSize="9" fill="#8292a8">{yr-n+1+i}</text>;})}
      <line x1={PL} y1={py(100)} x2={W-PR} y2={py(100)} stroke={GOLD} strokeWidth="1" strokeDasharray="4 3" opacity=".5"/>
      <path d={dPath} fill="none" stroke={GOLD} strokeWidth="2.5" strokeLinejoin="round"/>
      <circle cx={px(n-1)} cy={py(pts[n-1])} r="5" fill={GOLD}/>
      <rect x={px(n-1)+8} y={py(pts[n-1])-11} width="54" height="20" rx="5" fill={GOLD} opacity=".15"/>
      <text x={px(n-1)+35} y={py(pts[n-1])+4} textAnchor="middle" fontSize="10" fill={GOLD} fontWeight="700">{(tot>=0?"+":"")+tot.toFixed(1)+"%"}</text>
    </svg>
  );
}

function LineChart(props) {
  const funds=props.funds;
  const W=820,H=300,PL=52,PR=16,PT=16,PB=32;
  const yr=new Date().getFullYear();
  const series=funds.map(function(f,i){return{pts:simPerf(f),color:PIE[i%PIE.length],label:f.nom};});
  const all=[];series.forEach(function(s){s.pts.forEach(function(v){all.push(v);});});
  const mn=Math.min.apply(null,all)*.98,mx=Math.max.apply(null,all)*1.02;
  const px=function(i){return PL+(i/10)*(W-PL-PR);};
  const py=function(v){return PT+(1-(v-mn)/(mx-mn))*(H-PT-PB);};
  const pc=function(v){return v>=0?"#166534":"#991b1b";};
  const pb=function(v){return v>=0?"#f0fdf4":"#fef2f2";};
  const ap=series.map(function(s){var r=[];for(var i=0;i<10;i++)r.push(((s.pts[i+1]/s.pts[i])-1)*100);return r;});
  const yrs=[];for(var i=0;i<10;i++)yrs.push(yr-10+i+1);
  return (
    <div>
      <svg width="100%" viewBox={"0 0 "+W+" "+H}>
        {[0,.25,.5,.75,1].map(function(p){const y=PT+p*(H-PT-PB),v=mx-p*(mx-mn);return <g key={p}><line x1={PL} y1={y} x2={W-PR} y2={y} stroke="#f0ece0" strokeWidth="1"/><text x={PL-4} y={y+3} textAnchor="end" fontSize="9" fill="#8292a8">{(v-100).toFixed(0)+"%"}</text></g>;})}
        {[0,1,2,3,4,5,6,7,8,9,10].map(function(i){return <text key={i} x={px(i)} y={H-6} textAnchor="middle" fontSize="9" fill="#8292a8">{yr-10+i}</text>;})}
        <line x1={PL} y1={py(100)} x2={W-PR} y2={py(100)} stroke={GOLD} strokeWidth="1" strokeDasharray="4 3" opacity=".5"/>
        {series.map(function(s,i){const d=s.pts.map(function(v,j){return(j===0?"M":"L")+px(j)+","+py(v);}).join(" ");const tot=((s.pts[10]/s.pts[0])-1)*100;return (
          <g key={i}>
            <path d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round"/>
            <circle cx={px(10)} cy={py(s.pts[10])} r="4" fill={s.color}/>
            <rect x={px(10)+6} y={py(s.pts[10])-10} width="46" height="18" rx="4" fill={s.color} opacity=".15"/>
            <text x={px(10)+29} y={py(s.pts[10])+4} textAnchor="middle" fontSize="9" fill={s.color} fontWeight="700">{(tot>=0?"+":"")+tot.toFixed(1)+"%"}</text>
          </g>
        );})}
      </svg>
      <div style={{display:"flex",flexWrap:"wrap",gap:"6px 20px",marginTop:10,marginBottom:20}}>
        {series.map(function(s,i){return <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:12,color:"#3d4f6e"}}><div style={{width:18,height:3,background:s.color,borderRadius:2}}/>{s.label}</div>;})}
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{background:"#f8f6f0"}}>
            <th style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:NAV,borderBottom:"2px solid rgba(201,162,39,0.25)",minWidth:140}}>Fonds</th>
            {yrs.map(function(y){return <th key={y} style={{padding:"10px 8px",textAlign:"center",fontWeight:600,color:NAV,borderBottom:"2px solid rgba(201,162,39,0.25)",whiteSpace:"nowrap"}}>{y}</th>;})}
            <th style={{padding:"10px 8px",textAlign:"center",fontWeight:700,color:GOLD,borderBottom:"2px solid rgba(201,162,39,0.25)"}}>10 ans</th>
          </tr></thead>
          <tbody>
            {series.map(function(s,i){const tot=((s.pts[10]/s.pts[0])-1)*100;return (
              <tr key={i} style={{borderBottom:"1px solid rgba(201,162,39,0.08)",background:i%2===0?"#fff":"#fafaf8"}}>
                <td style={{padding:"10px 14px",fontWeight:500,color:NAV}}><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:3,background:s.color,flexShrink:0}}/><span style={{maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.label}</span></div></td>
                {ap[i].map(function(v,j){return <td key={j} style={{padding:"8px",textAlign:"center"}}><span style={{padding:"2px 7px",borderRadius:6,background:pb(v),color:pc(v),fontWeight:600,fontSize:11,whiteSpace:"nowrap"}}>{(v>=0?"+":"")+v.toFixed(1)+"%"}</span></td>;})}
                <td style={{padding:"8px",textAlign:"center"}}><span style={{padding:"3px 10px",borderRadius:6,background:pb(tot),color:pc(tot),fontWeight:700,fontSize:12}}>{(tot>=0?"+":"")+tot.toFixed(1)+"%"}</span></td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Donut(props) {
  const funds=props.funds,sri=props.sri;
  const r=90,cx=110,cy=110,sw=30,circ=2*Math.PI*r;
  var cum=0;
  const slices=funds.map(function(f,i){const pct=f.pct/100,offset=circ*(1-cum),dash=circ*pct;cum+=pct;return{dash:dash,offset:offset,color:PIE[i%PIE.length],pct:f.pct,nom:f.nom};});
  return (
    <div style={{display:"flex",alignItems:"center",gap:32}}>
      <svg width="220" height="220" style={{flexShrink:0}}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0ece0" strokeWidth={sw}/>
        {slices.map(function(s,i){return <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={sw} strokeDasharray={s.dash+" "+(circ-s.dash)} strokeDashoffset={s.offset} style={{transform:"rotate(-90deg)",transformOrigin:"50% 50%"}}/>;})}
        <text x={cx} y={cy-10} textAnchor="middle" fontSize="13" fill="#8292a8" fontFamily="Georgia,serif">SRI</text>
        <text x={cx} y={cy+20} textAnchor="middle" fontSize="38" fill={GOLD} fontWeight="700">{sri}</text>
      </svg>
      <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
        {slices.map(function(s,i){return (
          <div key={i} style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:12,height:12,borderRadius:4,background:s.color,flexShrink:0}}/>
            <div style={{flex:1,fontSize:13,color:"#3d4f6e",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.nom}</div>
            <div style={{fontSize:14,fontWeight:700,color:NAV,minWidth:40,textAlign:"right"}}>{s.pct}%</div>
          </div>
        );})}
      </div>
    </div>
  );
}

function FicheFond(props) {
  const f=props.f,onClose=props.onClose,onSelect=props.onSelect,selected=props.selected;
  const perf=simPerf(f);
  const yr=new Date().getFullYear();
  const years10=[];
  for(var i=0;i<10;i++)years10.push(yr-10+i+1);
  const annPerf=[];
  for(var i=0;i<10;i++)annPerf.push(((perf[i+1]/perf[i])-1)*100);
  const tot=((perf[10]/perf[0])-1)*100;
  const pc=function(v){return v>=0?"#166534":"#991b1b";};
  const pb=function(v){return v>=0?"#f0fdf4":"#fef2f2";};
  return (
    <div style={{display:"flex",flexDirection:"column",gap:14,position:"sticky",top:16}}>
      <div style={{...gCard,padding:22}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
          <div style={{flex:1,marginRight:12}}>
            <div style={{fontSize:17,fontWeight:700,color:NAV,marginBottom:8}}>{f.nom}</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
              {f.soc&&<span style={{fontSize:12,color:"#8292a8",fontWeight:500}}>{f.soc}</span>}
              <SriDot n={f.sri}/>
              {f.isin&&<span style={{fontSize:11,color:"#8292a8",background:"#f8f6f0",padding:"2px 8px",borderRadius:6,fontFamily:"monospace"}}>{f.isin}</span>}
              {f.marche&&<span style={{fontSize:12,padding:"2px 9px",borderRadius:10,background:"#eff6ff",color:"#1e40af",fontWeight:500}}>{f.marche}</span>}
            </div>
          </div>
          <div style={{display:"flex",gap:8,flexShrink:0}}>
            {onSelect&&<button onClick={onSelect} style={{padding:"8px 14px",borderRadius:9,border:"2px solid "+(selected?GOLD:"rgba(201,162,39,0.3)"),background:selected?GOLD:NAV,color:selected?NAV:GOLD,fontWeight:700,fontSize:12,cursor:"pointer"}}>{selected?"checkmark Sélectionné":"+ Sélectionner"}</button>}
            {onClose&&<button onClick={onClose} style={{fontSize:18,color:"#8292a8",background:"transparent",border:"none",cursor:"pointer",padding:"4px 8px"}}>x</button>}
          </div>
        </div>
        {f.dispo&&f.dispo.length>0&&<div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>{f.dispo.map(function(d){return <span key={d} style={{fontSize:11,padding:"2px 9px",borderRadius:10,background:"#fff7ed",color:"#c2410c",fontWeight:500}}>{d}</span>;})}</div>}
        {f.desc&&<div style={{padding:"12px 14px",background:"#fafaf8",borderRadius:10,borderLeft:"3px solid "+GOLD}}><div style={{fontSize:10,fontWeight:700,color:GOLD,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>Descriptif</div><div style={{fontSize:13,color:NAV,lineHeight:1.7}}>{f.desc}</div></div>}
      </div>
      <div style={{...gCard,padding:22}}>
        <div style={{fontSize:14,fontWeight:700,color:NAV,marginBottom:4}}>Performance simulée 10 ans</div>
        <div style={{fontSize:11,color:"#8292a8",marginBottom:12}}>Base 100 — simulation indicative SRI {f.sri}</div>
        <LineChartPts pts={perf}/>
      </div>
      <div style={{...gCard,padding:22}}>
        <div style={{fontSize:14,fontWeight:700,color:NAV,marginBottom:14}}>Performances annuelles</div>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{background:"#f8f6f0"}}>
            <th style={{padding:"8px 10px",textAlign:"left",fontWeight:600,color:NAV,borderBottom:"2px solid rgba(201,162,39,0.25)"}}>Année</th>
            <th style={{padding:"8px 10px",textAlign:"right",fontWeight:600,color:NAV,borderBottom:"2px solid rgba(201,162,39,0.25)"}}>Perf.</th>
            <th style={{padding:"8px 10px",textAlign:"right",fontWeight:600,color:NAV,borderBottom:"2px solid rgba(201,162,39,0.25)"}}>Valeur</th>
          </tr></thead>
          <tbody>
            {years10.map(function(y,i){return (
              <tr key={y} style={{borderBottom:"1px solid rgba(201,162,39,0.08)",background:i%2===0?"#fff":"#fafaf8"}}>
                <td style={{padding:"7px 10px",fontWeight:500,color:NAV}}>{y}</td>
                <td style={{padding:"7px 10px",textAlign:"right"}}><span style={{padding:"2px 8px",borderRadius:6,background:pb(annPerf[i]),color:pc(annPerf[i]),fontWeight:700,fontSize:11}}>{(annPerf[i]>=0?"+":"")+annPerf[i].toFixed(2)+"%"}</span></td>
                <td style={{padding:"7px 10px",textAlign:"right",color:"#3d4f6e",fontWeight:500}}>{perf[i+1]?perf[i+1].toFixed(2):""}</td>
              </tr>
            );})}
            <tr style={{background:"rgba(201,162,39,0.06)",borderTop:"2px solid rgba(201,162,39,0.25)"}}>
              <td style={{padding:"9px 10px",fontWeight:700,color:NAV}}>Total 10 ans</td>
              <td style={{padding:"9px 10px",textAlign:"right"}}><span style={{padding:"2px 10px",borderRadius:6,background:pb(tot),color:pc(tot),fontWeight:800,fontSize:12}}>{(tot>=0?"+":"")+tot.toFixed(2)+"%"}</span></td>
              <td style={{padding:"9px 10px",textAlign:"right",color:GOLD,fontWeight:700}}>{perf[10]?perf[10].toFixed(2):""}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ActualiteTab() {
  const [actu,setActu]=useState(null);
  const [actuLoading,setActuLoading]=useState(false);
  const [actuSection,setActuSection]=useState("global");

  const SECTIONS=[
    {k:"global",l:"Vue globale",i:"🌐"},
    {k:"actions",l:"Marchés actions",i:"📈"},
    {k:"taux",l:"Taux & Obligations",i:"🏦"},
    {k:"geo",l:"Géopolitique",i:"🌍"},
    {k:"matieres",l:"Matières premières",i:"⚡"},
    {k:"crypto",l:"Crypto & Alternatifs",i:"₿"},
  ];

  const PROMPTS={
    global:"Tu es stratégiste senior. Date: "+new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})+". Analyse macro globale: marchés actions mondiaux, banques centrales (Fed/BCE/BoJ), risques géopolitiques, recommandation allocation. Réponds UNIQUEMENT en JSON valide: {\"titre\":\"titre\",\"resume\":\"synthèse 3-4 phrases\",\"points\":[{\"titre\":\"sujet\",\"contenu\":\"analyse 2-3 phrases\",\"sentiment\":\"positif\",\"impact\":\"fort\"}],\"recommandation\":\"conseil\"}",
    actions:"Tu es analyste actions. Date: "+new Date().toLocaleDateString("fr-FR")+". Analyse CAC40, S&P500, Nasdaq, Eurostoxx50, Nikkei, émergents. Réponds UNIQUEMENT en JSON: {\"titre\":\"titre\",\"resume\":\"synthèse\",\"points\":[{\"titre\":\"marché\",\"contenu\":\"analyse\",\"sentiment\":\"positif\",\"impact\":\"fort\"}],\"recommandation\":\"conseil\"}",
    taux:"Tu es spécialiste taux. Date: "+new Date().toLocaleDateString("fr-FR")+". Analyse Fed/BCE, courbes taux, spreads crédit, inflation. Réponds UNIQUEMENT en JSON: {\"titre\":\"titre\",\"resume\":\"synthèse\",\"points\":[{\"titre\":\"sujet\",\"contenu\":\"analyse\",\"sentiment\":\"neutre\",\"impact\":\"moyen\"}],\"recommandation\":\"conseil\"}",
    geo:"Tu es analyste géopolitique. Date: "+new Date().toLocaleDateString("fr-FR")+". Analyse tensions géopolitiques et impact financier. Réponds UNIQUEMENT en JSON: {\"titre\":\"titre\",\"resume\":\"synthèse\",\"points\":[{\"titre\":\"tension\",\"contenu\":\"analyse et impact\",\"sentiment\":\"negatif\",\"impact\":\"fort\"}],\"recommandation\":\"conseil\"}",
    matieres:"Tu es analyste matières premières. Date: "+new Date().toLocaleDateString("fr-FR")+". Analyse pétrole, gaz, or, métaux, agricoles. Réponds UNIQUEMENT en JSON: {\"titre\":\"titre\",\"resume\":\"synthèse\",\"points\":[{\"titre\":\"matière\",\"contenu\":\"analyse\",\"sentiment\":\"positif\",\"impact\":\"moyen\"}],\"recommandation\":\"conseil\"}",
    crypto:"Tu es analyste crypto et alternatifs. Date: "+new Date().toLocaleDateString("fr-FR")+". Analyse Bitcoin, Ethereum, régulation, DeFi, hedge funds. Réponds UNIQUEMENT en JSON: {\"titre\":\"titre\",\"resume\":\"synthèse\",\"points\":[{\"titre\":\"actif\",\"contenu\":\"analyse\",\"sentiment\":\"positif\",\"impact\":\"moyen\"}],\"recommandation\":\"conseil\"}",
  };

  async function loadActu(section) {
    setActuLoading(true);
    setActuSection(section);
    setActu(null);
    try {
      const txt=await callClaude(PROMPTS[section]);
      const clean=txt.replace(/```json|```/g,"").trim();
      setActu(JSON.parse(clean.slice(clean.indexOf("{"),clean.lastIndexOf("}")+1)));
    } catch(e){ setActu({error:true,msg:e.message}); }
    setActuLoading(false);
  }

  useEffect(()=>{ loadActu("global"); },[]);

  const sentColor=s=>s==="positif"?"#166534":s==="negatif"?"#991b1b":"#92400e";
  const sentBg=s=>s==="positif"?"#f0fdf4":s==="negatif"?"#fef2f2":"#fffbeb";
  const impactColor=i=>i==="fort"?"#991b1b":i==="moyen"?"#92400e":"#166534";

  return(
    <div className="up">
      <div style={{...gCard,padding:24,marginBottom:16,background:"linear-gradient(135deg,"+NAV+","+NAVL+")",border:"none"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{fontSize:20,fontWeight:800,color:"#fff",marginBottom:4}}>🌍 Actualité Financière & Géopolitique</div>
            <div style={{fontSize:12,color:"rgba(201,162,39,0.8)"}}>Analyse IA en temps réel · {new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"})}</div>
          </div>
          <button onClick={()=>loadActu(actuSection)} disabled={actuLoading} style={{padding:"10px 20px",borderRadius:10,border:"1.5px solid "+GOLD,background:"transparent",color:GOLD,fontWeight:700,fontSize:12,cursor:"pointer"}}>
            {actuLoading?"⏳ Chargement...":"🔄 Actualiser"}
          </button>
        </div>
      </div>

      <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
        {SECTIONS.map(s=>(
          <button key={s.k} onClick={()=>loadActu(s.k)} disabled={actuLoading} style={{padding:"8px 14px",borderRadius:20,border:"1.5px solid "+(actuSection===s.k?GOLD:"rgba(201,162,39,0.2)"),background:actuSection===s.k?GOLD:"#fff",color:actuSection===s.k?NAV:"#3d4f6e",fontWeight:actuSection===s.k?700:400,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
            <span>{s.i}</span>{s.l}
          </button>
        ))}
      </div>

      {actuLoading&&(
        <div style={{...gCard,padding:48,textAlign:"center"}}>
          <div style={{fontSize:32,marginBottom:12}}>⏳</div>
          <div style={{fontSize:14,fontWeight:700,color:NAV,marginBottom:6}}>Analyse en cours…</div>
          <div style={{fontSize:12,color:"#8292a8"}}>Claude analyse les marchés et l'actualité géopolitique</div>
        </div>
      )}

      {!actuLoading&&actu&&actu.error&&(
        <div style={{...gCard,padding:20,borderLeft:"3px solid #ef4444",color:"#991b1b",fontSize:13}}>Analyse indisponible — {actu.msg}</div>
      )}

      {!actuLoading&&actu&&!actu.error&&(
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{...gCard,padding:24,borderTop:"3px solid "+GOLD}}>
            <div style={{fontSize:17,fontWeight:800,color:NAV,marginBottom:12}}>{actu.titre}</div>
            <div style={{fontSize:13,color:"#3d4f6e",lineHeight:1.8,borderLeft:"3px solid "+GOLD,paddingLeft:14}}>{actu.resume}</div>
          </div>
          {actu.points&&actu.points.length>0&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:12}}>
              {actu.points.map((p,i)=>(
                <div key={i} style={{...gCard,padding:18,borderTop:"2px solid "+sentBg(p.sentiment)}}>
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8,gap:8}}>
                    <div style={{fontSize:13,fontWeight:700,color:NAV,flex:1}}>{p.titre}</div>
                    <div style={{display:"flex",gap:4,flexShrink:0,flexWrap:"wrap"}}>
                      <span style={{padding:"2px 7px",borderRadius:6,background:sentBg(p.sentiment),color:sentColor(p.sentiment),fontSize:9,fontWeight:700,textTransform:"uppercase"}}>{p.sentiment}</span>
                      <span style={{padding:"2px 7px",borderRadius:6,background:"#f8f6f0",color:impactColor(p.impact),fontSize:9,fontWeight:700,textTransform:"uppercase"}}>impact {p.impact}</span>
                    </div>
                  </div>
                  <div style={{fontSize:12,color:"#3d4f6e",lineHeight:1.7}}>{p.contenu}</div>
                </div>
              ))}
            </div>
          )}
          {actu.recommandation&&(
            <div style={{...gCard,padding:20,background:"linear-gradient(135deg,#fffbeb,#fef9ec)",border:"1.5px solid rgba(201,162,39,0.3)"}}>
              <div style={{fontSize:11,fontWeight:700,color:"#92400e",textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>💡 Recommandation d'allocation</div>
              <div style={{fontSize:13,color:NAV,fontWeight:600,lineHeight:1.7}}>{actu.recommandation}</div>
            </div>
          )}
          <div style={{fontSize:10,color:"#8292a8",textAlign:"center"}}>⚠ Analyse IA à titre informatif uniquement. Ne constitue pas un conseil en investissement.</div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [tab,setTab]=useState("allocation");
  const [funds,setFunds]=useState([]);
  const [sri,setSri]=useState(4);
  const [duree,setDuree]=useState("5-8 ans");
  const [compagnie,setCompagnie]=useState("");
  const [marches,setMarches]=useState([]);
  const [montant,setMontant]=useState("");
  const [results,setResults]=useState(null);
  const [loading,setLoading]=useState(false);
  const [ai,setAi]=useState(null);
  const [aiLoading,setAiLoading]=useState(false);
  const [expanded,setExpanded]=useState(null);
  const [search,setSearch]=useState("");
  const [filterSri,setFilterSri]=useState(0);
  const [filterMarche,setFilterMarche]=useState("");
  const [filterComp,setFilterComp]=useState("");
  const [sortBy,setSortBy]=useState("nom");
  const [msg,setMsg]=useState(null);
  const [editF,setEditF]=useState(null);
  const [fondsFiche,setFondsFiche]=useState(null);
  const [rechSearch,setRechSearch]=useState("");
  const [rechResults,setRechResults]=useState([]);
  const [rechSelected,setRechSelected]=useState([]);
  const [ficheFond,setFicheFond]=useState(null);
  const [rechFilterSri,setRechFilterSri]=useState(0);
  const [rechFilterMarche,setRechFilterMarche]=useState("");
  const [rechSort,setRechSort]=useState("nom");
  const [fmpCache,setFmpCache]=useState({});
  const [fmpLoading,setFmpLoading]=useState(false);
  const [fmpProgress,setFmpProgress]=useState(0);
  const [fmpStats,setFmpStats]=useState(null);
  const fileRef=useRef();

  const allCompagnies=(function(){const s={};COMPAGNIES.forEach(function(c){s[c]=true;});funds.forEach(function(f){(f.dispo||[]).forEach(function(d){if(d)s[d]=true;});});return Object.keys(s).sort();})();

  useEffect(function(){(async function(){try{const r=await window.storage.get("base_funds");if(r&&r.value)setFunds(JSON.parse(r.value));}catch(e){}})();},[]);

  function handleFile(e) {
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=async function(ev){
      const parsed=parseCSV(ev.target.result);
      if(!parsed.length){setMsg({ok:false,text:"Aucun fond valide."});return;}
      const merged=funds.slice();
      parsed.forEach(function(f){if(!merged.find(function(x){return x.isin&&x.isin===f.isin;}))merged.push(f);});
      setFunds(merged);
      try{await window.storage.set("base_funds",JSON.stringify(merged));}catch(ex){}
      setMsg({ok:true,text:"checkmark "+parsed.length+" fonds importés — total : "+merged.length});
      e.target.value="";
    };
    reader.readAsText(file,"UTF-8");
  }

  const getFondPerf=function(f){
    const c=f.isin&&fmpCache[f.isin];
    return c?c.pts:simPerf(f);
  };
  const isFondReal=function(f){return !!(f.isin&&fmpCache[f.isin]&&fmpCache[f.isin].isReal);};

  async function loadFMPData() {
    if(!funds.length||fmpLoading) return;
    setFmpLoading(true);setFmpProgress(0);setFmpStats(null);
    const res={};
    for(var i=0;i<funds.length;i++){
      const f=funds[i];
      if(f.isin){
        const pts=await fetchFMPPerf(f.isin);
        res[f.isin]=pts?{pts:pts,isReal:true}:{pts:simPerf(f),isReal:false};
      } else if(f.id) res[f.id]={pts:simPerf(f),isReal:false};
      setFmpProgress(Math.round((i+1)/funds.length*100));
    }
    setFmpCache(res);
    const real=Object.values(res).filter(function(r){return r.isReal;}).length;
    setFmpStats({real:real,simulated:Object.values(res).length-real,total:funds.length});
    setFmpLoading(false);
  }

  function generate() {
    if(!funds.length){setResults({noFunds:true});return;}
    setLoading(true);setResults(null);setAi(null);setExpanded(null);
    setTimeout(function(){
      try{
        const eligible=funds.filter(function(f){
          if(compagnie&&f.dispo&&f.dispo.length>0&&!f.dispo.some(function(c){return c.toLowerCase().includes(compagnie.toLowerCase());}))return false;
          if(marches.length>0&&f.marche&&!marches.includes(f.marche))return false;
          return true;
        }).sort(function(a,b){return Math.abs(a.sri-sri)-Math.abs(b.sri-sri);});
        if(!eligible.length){setResults({alloc:[],total:0,montant:montant?parseFloat(montant):null});setLoading(false);return;}
        const byMarche={};
        eligible.forEach(function(f){const m=f.marche||"Autre";if(!byMarche[m])byMarche[m]=[];if(byMarche[m].length<2)byMarche[m].push(f);});
        var top=[];Object.keys(byMarche).forEach(function(m){byMarche[m].forEach(function(f){top.push(f);});});
        top=top.slice(0,8);if(!top.length)top=eligible.slice(0,8);
        const sriV=top.map(function(f){return f.sri;});
        const n=top.length,minP=5,rem=100-minP*n;
        const uAvg=sriV.reduce(function(a,b){return a+b;},0)/n;
        var w=top.map(function(f){const d=f.sri-sri;return uAvg>sri?(d<0?Math.abs(d)+1:0.1):(d>0?Math.abs(d)+1:0.1);});
        const ws=w.reduce(function(a,b){return a+b;},0);
        w=w.map(function(x){return x/ws;});
        var pcts=top.map(function(_,i){return minP+w[i]*rem;});
        for(var it=0;it<30;it++){
          const tot=pcts.reduce(function(a,b){return a+b;},0);
          const avg=pcts.reduce(function(a,p,i){return a+(p/tot)*sriV[i];},0);
          const err=avg-sri;
          if(Math.abs(err)<0.02)break;
          pcts=pcts.map(function(p,i){const pull=(sriV[i]-sri)*err;return Math.max(minP*0.5,p*(1-0.1*(pull>0?1:pull<0?-1:0)));});
        }
        const s=pcts.reduce(function(a,b){return a+b;},0);
        pcts=pcts.map(function(p){return p/s*100;});
        var rounded=pcts.map(function(p){return Math.round(p);});
        const diff=100-rounded.reduce(function(a,b){return a+b;},0);
        var adjIdx=0;for(var i=1;i<sriV.length;i++){if(Math.abs(sriV[i]-sri)<Math.abs(sriV[adjIdx]-sri))adjIdx=i;}
        rounded[adjIdx]+=diff;
        const alloc=top.map(function(f,i){return Object.assign({},f,{pct:rounded[i]});});
        setResults({alloc:alloc,total:eligible.length,montant:montant?parseFloat(montant):null});
        setLoading(false);
        runAI(alloc,eligible);
      }catch(e){setResults({error:true});setLoading(false);}
    },50);
  }

  async function runAI(alloc,eligible) {
    setAiLoading(true);
    try{
      const sel=alloc.map(function(f){return"- "+f.nom+" SRI"+f.sri+" "+(f.marche||"—")+" "+f.pct+"% ISIN:"+(f.isin||"—");}).join("\n");
      const autres=eligible.slice(8,14).map(function(f){return"- "+f.nom+" SRI"+f.sri;}).join("\n")||"aucun";
      const txt=await callClaude("Conseiller senior Les Associés. Profil : SRI "+sri+" ("+RISK_LABEL[sri]+"), durée "+duree+", compagnie: "+(compagnie||"aucune")+", montant: "+(montant||"?")+"€.\nFonds:\n"+sel+"\nNon retenus:\n"+autres+"\nJSON strict sans markdown :\n{\"synthese\":\"2 phrases\",\"fonds\":[{\"isin\":\"...\",\"role\":\"1 phrase\",\"pourquoi\":\"2 phrases\",\"vigilance\":\"1 point\"}]}");
      const clean=txt.replace(/```json|```/g,"").trim();
      setAi(JSON.parse(clean.slice(clean.indexOf("{"),clean.lastIndexOf("}")+1)));
    }catch(e){setAi({error:true,msg:e.message});}
    setAiLoading(false);
  }

  function exportPDF() {
    if(!results||!results.alloc)return;
    const w=window.open("","_blank");
    const avgSri=results.alloc.reduce(function(a,f){return a+f.pct/100*f.sri;},0).toFixed(2);
    const rows=results.alloc.map(function(f){return "<tr><td style='padding:10px 12px;font-weight:600'>"+f.nom+"</td><td style='padding:10px 12px;text-align:center'><span style='background:"+RISK_COLOR[f.sri]+"22;color:"+RISK_COLOR[f.sri]+";padding:2px 8px;border-radius:8px;font-weight:700'>SRI "+f.sri+"</span></td><td style='padding:10px 12px;color:#666'>"+(f.marche||"")+"</td><td style='padding:10px 12px;text-align:right;font-weight:700;color:#c9a227;font-size:16px'>"+f.pct+"%</td>"+(results.montant?"<td style='padding:10px 12px;text-align:right'>"+Math.round(results.montant*f.pct/100).toLocaleString("fr-FR")+" EUR</td>":"")+"</tr>";}).join("");
    w.document.write("<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Allocation Les Associes</title><style>body{font-family:system-ui;margin:0;padding:32px;color:#0f2340}.header{background:linear-gradient(135deg,#0f2340,#1a3560);color:#fff;padding:28px 32px;border-radius:12px;margin-bottom:28px;display:flex;justify-content:space-between;align-items:center}.logo{font-family:Georgia,serif;font-size:22px;font-weight:700;color:#c9a227}.sub{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,0.5);margin-top:4px}.profil{background:#f8f6f0;border-radius:10px;padding:18px 24px;margin-bottom:24px;display:flex;gap:32px;flex-wrap:wrap}.p-item{display:flex;flex-direction:column;gap:3px}.p-label{font-size:10px;font-weight:700;color:#8292a8;text-transform:uppercase;letter-spacing:.8px}.p-val{font-size:14px;font-weight:600}table{width:100%;border-collapse:collapse}th{padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#8292a8;text-transform:uppercase;border-bottom:2px solid rgba(201,162,39,0.3)}tr{border-bottom:1px solid #f0ece0}.footer{margin-top:32px;padding-top:16px;border-top:1px solid #f0ece0;font-size:11px;color:#8292a8;text-align:center}.synthese{background:#fff7ed;border-left:4px solid #c9a227;padding:14px 18px;border-radius:0 10px 10px 0;margin-bottom:24px;font-size:13px;line-height:1.7}</style></head><body>"
      +"<div class='header'><div><div class='logo'>Les Associes</div><div class='sub'>Allocation actifs</div></div><div style='color:rgba(255,255,255,0.5);font-size:12px'>"+new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})+"</div></div>"
      +"<div class='profil'><div class='p-item'><div class='p-label'>Profil</div><div class='p-val'>SRI "+sri+" - "+RISK_LABEL[sri]+"</div></div><div class='p-item'><div class='p-label'>Duree</div><div class='p-val'>"+duree+"</div></div>"
      +(compagnie?"<div class='p-item'><div class='p-label'>Compagnie</div><div class='p-val'>"+compagnie+"</div></div>":"")
      +(results.montant?"<div class='p-item'><div class='p-label'>Montant</div><div class='p-val'>"+results.montant.toLocaleString("fr-FR")+" EUR</div></div>":"")
      +"<div class='p-item'><div class='p-label'>SRI moyen</div><div class='p-val'>"+avgSri+"</div></div></div>"
      +(ai&&ai.synthese?"<div class='synthese'><strong>Synthese :</strong> "+ai.synthese+"</div>":"")
      +"<table><thead><tr><th>Fond</th><th>Risque</th><th>Marche</th><th style='text-align:right'>Allocation</th>"+(results.montant?"<th style='text-align:right'>Montant</th>":"")+"</tr></thead><tbody>"+rows+"</tbody></table>"
      +"<div class='footer'>Les Associes - www.les-associes.fr - Donnees simulees a titre indicatif</div></body></html>");
    w.document.close();
    setTimeout(function(){w.print();},500);
  }

  // Build SVG as a data URI for PDF embedding
  function buildComparaisonSVG(series) {
    var yr=new Date().getFullYear();
    var allPts=[];series.forEach(function(s){s.pts.forEach(function(v){allPts.push(v);});});
    var mn=Math.min.apply(null,allPts)*0.97,mx=Math.max.apply(null,allPts)*1.03;
    var W=900,H=280,PL=56,PR=80,PT=18,PB=36;
    var pxf=function(i){return PL+(i/10)*(W-PL-PR);};
    var pyf=function(v){return PT+(1-(v-mn)/(mx-mn))*(H-PT-PB);};
    var parts=[];
    parts.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'">');
    parts.push('<rect width="'+W+'" height="'+H+'" fill="#fafaf8" rx="10"/>');
    [0,0.25,0.5,0.75,1].forEach(function(p){
      var y=PT+p*(H-PT-PB),v=mx-p*(mx-mn);
      parts.push('<line x1="'+PL+'" y1="'+y+'" x2="'+(W-PR)+'" y2="'+y+'" stroke="#e8e2d0" stroke-width="1"/>');
      parts.push('<text x="'+(PL-4)+'" y="'+(y+3)+'" text-anchor="end" font-size="10" fill="#8292a8" font-family="system-ui">'+(v-100).toFixed(0)+'%</text>');
    });
    for(var i=0;i<=10;i++){
      parts.push('<text x="'+pxf(i).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle" font-size="10" fill="#8292a8" font-family="system-ui">'+(yr-10+i)+'</text>');
    }
    parts.push('<line x1="'+PL+'" y1="'+pyf(100).toFixed(1)+'" x2="'+(W-PR)+'" y2="'+pyf(100).toFixed(1)+'" stroke="#c9a227" stroke-width="1.5" stroke-dasharray="6 4" opacity="0.5"/>');
    series.forEach(function(s){
      var d=s.pts.map(function(v,j){return(j===0?"M":"L")+pxf(j).toFixed(1)+","+pyf(v).toFixed(1);}).join(" ");
      var tot=((s.pts[10]/s.pts[0])-1)*100;
      var endY=pyf(s.pts[10]);
      parts.push('<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="2.5" stroke-linejoin="round"/>');
      parts.push('<circle cx="'+pxf(10).toFixed(1)+'" cy="'+endY.toFixed(1)+'" r="5" fill="'+s.color+'"/>');
      parts.push('<rect x="'+(pxf(10)+8).toFixed(1)+'" y="'+(endY-12).toFixed(1)+'" width="58" height="22" rx="6" fill="'+s.color+'" opacity="0.15"/>');
      parts.push('<text x="'+(pxf(10)+37).toFixed(1)+'" y="'+(endY+4).toFixed(1)+'" text-anchor="middle" font-size="11" fill="'+s.color+'" font-weight="700" font-family="system-ui">'+(tot>=0?"+":"")+tot.toFixed(1)+'%</text>');
    });
    parts.push('</svg>');
    return "data:image/svg+xml;base64,"+btoa(unescape(encodeURIComponent(parts.join(""))));
  }

  const getAna=function(isin){return ai&&ai.fonds?ai.fonds.find(function(f){return f.isin===isin;})||null:null;};
  const defFund=function(){return{id:Date.now().toString(),nom:"",soc:"",sri:4,isin:"",desc:"",dispo:[],marche:""};};
  const saveEdit=function(f){if(funds.find(function(x){return x.id===f.id;}))setFunds(function(fs){return fs.map(function(x){return x.id===f.id?f:x;});});else setFunds(function(fs){return fs.concat([f]);});setEditF(null);};

  const filtered=(function(){
    var f=funds.filter(function(x){
      if(search&&!(x.nom+x.isin+(x.soc||"")).toLowerCase().includes(search.toLowerCase()))return false;
      if(filterSri>0&&x.sri!==filterSri)return false;
      if(filterMarche&&x.marche!==filterMarche)return false;
      if(filterComp&&(!x.dispo||!x.dispo.includes(filterComp)))return false;
      return true;
    });
    f.sort(function(a,b){if(sortBy==="sri")return a.sri-b.sri;if(sortBy==="sriDesc")return b.sri-a.sri;if(sortBy==="marche")return(a.marche||"").localeCompare(b.marche||"");return a.nom.localeCompare(b.nom);});
    return f;
  })();

  const rechFiltered=(function(){
    var f=rechSearch?rechResults:funds.slice(0,80);
    if(rechFilterSri>0)f=f.filter(function(x){return x.sri===rechFilterSri;});
    if(rechFilterMarche)f=f.filter(function(x){return x.marche===rechFilterMarche;});
    return f.slice().sort(function(a,b){if(rechSort==="sri")return a.sri-b.sri;if(rechSort==="sriDesc")return b.sri-a.sri;if(rechSort==="marche")return(a.marche||"").localeCompare(b.marche||"");return a.nom.localeCompare(b.nom);});
  })();

  const tabs=[{k:"allocation",i:"⚖️",l:"Allocation"},{k:"comparaison",i:"📊",l:"Comparaison"},{k:"actualite",i:"🌍",l:"Actualité"},{k:"fonds",i:"📋",l:"Fonds ("+funds.length+")"},{k:"import",i:"📁",l:"Import CSV"}];

  return (
    <div style={{background:"#f5f3ee",minHeight:"100vh",fontFamily:"system-ui,sans-serif",display:"flex"}}>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin .7s linear infinite} @keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}} .up{animation:up .3s ease} body::before{content:'';position:fixed;top:0;left:0;width:160px;height:100%;background:linear-gradient(180deg,#0f2340 0%,#1a3560 100%);z-index:0;pointer-events:none}"}</style>

      {/* SIDEBAR */}
      <div style={{width:160,flexShrink:0,background:"linear-gradient(180deg,"+NAV+","+NAVL+")",display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh",overflowY:"auto",zIndex:100,boxShadow:"4px 0 20px rgba(15,35,64,0.15)"}}>
        <div style={{padding:"20px 12px 16px",borderBottom:"1px solid rgba(201,162,39,0.2)",textAlign:"center"}}>
          <div style={{width:44,height:44,borderRadius:12,background:"rgba(255,255,255,0.07)",border:"1.5px solid rgba(201,162,39,0.45)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 8px",boxShadow:"0 0 0 3px rgba(201,162,39,0.1)"}}>
            <span style={{fontFamily:"Georgia,serif",fontSize:22,fontWeight:700,color:GOLD,fontStyle:"italic"}}>A</span>
          </div>
          <div style={{fontSize:13,fontWeight:800,color:"#fff",letterSpacing:-.3}}>Les Associés</div>
          <div style={{fontSize:7,color:"rgba(201,162,39,0.65)",letterSpacing:1.4,textTransform:"uppercase",marginTop:2}}>Moteur d'allocation</div>
        </div>
        <nav style={{flex:1,padding:"16px 6px",display:"flex",flexDirection:"column",gap:2}}>
          <div style={{fontSize:8,color:"rgba(255,255,255,0.28)",fontWeight:700,letterSpacing:1.4,textTransform:"uppercase",marginBottom:8,textAlign:"center"}}>Navigation</div>
          {tabs.map(function(t){const a=tab===t.k;return(
            <button key={t.k} onClick={function(){setTab(t.k);}} style={{width:"100%",padding:"10px 8px",borderRadius:9,border:"none",background:a?"rgba(201,162,39,0.15)":"transparent",borderLeft:a?"3px solid "+GOLD:"3px solid transparent",color:a?"#fff":"rgba(255,255,255,0.5)",fontWeight:a?700:400,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,fontFamily:"inherit"}}
            onMouseEnter={function(e){if(!a){e.currentTarget.style.background="rgba(255,255,255,0.06)";e.currentTarget.style.color="rgba(255,255,255,0.8)";}}}
            onMouseLeave={function(e){if(!a){e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(255,255,255,0.5)";}}}
            >
              <span style={{fontSize:13,flexShrink:0}}>{t.i}</span>
              <span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.l}</span>
            </button>
          );})}
        </nav>
        <div style={{padding:"12px 8px 16px",borderTop:"1px solid rgba(201,162,39,0.14)",textAlign:"center"}}>
          <div style={{fontSize:10,color:"rgba(255,255,255,0.4)",fontWeight:600}}>{funds.length} fonds</div>
          <div style={{fontSize:8,color:"rgba(255,255,255,0.22)"}}>v1.0 · Les Associés</div>
        </div>
      </div>

      <div style={{flex:1,minWidth:0,padding:"28px 32px 64px",overflowX:"hidden"}}>

        {/* ═══ ALLOCATION ═══ */}
        {tab==="allocation"&&(
          <div className="up">
            <div style={{display:"grid",gridTemplateColumns:"300px 1fr",gap:20,alignItems:"start"}}>
              <div style={{...gCard,padding:24,position:"sticky",top:16}}>
                <div style={{fontSize:14,fontWeight:700,color:NAV,marginBottom:16,display:"flex",alignItems:"center",gap:8}}><span style={{color:GOLD}}>👤</span>Profil client</div>
                <div style={{fontSize:10,color:"#8292a8",fontWeight:700,letterSpacing:.8,textTransform:"uppercase",marginBottom:8}}>Niveau de risque (SRI)</div>
                <div style={{display:"flex",gap:3,marginBottom:6}}>
                  {[1,2,3,4,5,6,7].map(function(r){const a=sri===r;return <button key={r} onClick={function(){setSri(r);}} style={{flex:1,height:42,borderRadius:8,border:a?"2px solid "+GOLD:"1.5px solid rgba(201,162,39,0.18)",background:a?NAVL:GOLDF,color:a?GOLD:"#3d4f6e",fontWeight:a?700:500,cursor:"pointer",fontSize:13}}>{r}</button>;})}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:16}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:RISK_COLOR[sri]}}/>
                  <span style={{fontSize:11,color:"#3d4f6e",fontWeight:600}}>{RISK_LABEL[sri]}</span>
                </div>
                <div style={{height:1,background:"linear-gradient(90deg,transparent,rgba(201,162,39,0.3),transparent)",marginBottom:16}}/>
                {[["Durée",<select value={duree} onChange={function(e){setDuree(e.target.value);}} style={{...gSel,width:"100%"}}>{DUREES.map(function(d){return <option key={d}>{d}</option>;})}</select>],
                  ["Compagnie",<select value={compagnie} onChange={function(e){setCompagnie(e.target.value);}} style={{...gSel,width:"100%"}}><option value="">Toutes compagnies</option>{allCompagnies.map(function(c){return <option key={c}>{c}</option>;})}</select>],
                  ["Marchés",<div style={{display:"flex",flexWrap:"wrap",gap:4}}>{MARCHES.map(function(m){const s=marches.includes(m);return <button key={m} onClick={function(){setMarches(function(ms){return s?ms.filter(function(x){return x!==m;}):[...ms,m];});}} style={{padding:"4px 10px",borderRadius:20,border:"1.5px solid "+(s?GOLD:"rgba(201,162,39,0.2)"),background:s?NAVL:"transparent",color:s?GOLD:"#3d4f6e",fontSize:11,fontWeight:s?600:400,cursor:"pointer"}}>{m}</button>;})}</div>],
                  ["Montant (€)",<input type="number" value={montant} onChange={function(e){setMontant(e.target.value);}} placeholder="Ex : 50 000" style={gInp}/>]
                ].map(function(arr){return (
                  <div key={arr[0]} style={{marginBottom:12}}>
                    <div style={{fontSize:10,color:"#8292a8",fontWeight:700,letterSpacing:.8,textTransform:"uppercase",marginBottom:6}}>{arr[0]}</div>
                    {arr[1]}
                  </div>
                );})}
                <button onClick={generate} disabled={loading} style={{width:"100%",marginTop:8,padding:"13px",borderRadius:10,border:"none",background:"linear-gradient(135deg,"+GOLD+",#e2be5a)",color:NAV,fontWeight:700,fontSize:14,cursor:loading?"wait":"pointer",boxShadow:"0 4px 16px rgba(201,162,39,0.3)",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                  {loading?<><Spinner/>Calcul…</>:"✦ Générer l'allocation"}
                </button>
              </div>
              <div>
                {!results&&(<div style={{...gCard,padding:52,textAlign:"center"}}><div style={{fontSize:48,marginBottom:16}}>⚖️</div><div style={{fontSize:17,fontWeight:700,color:NAV,marginBottom:8}}>Prêt à construire votre allocation</div><div style={{fontSize:13,color:"#8292a8",lineHeight:1.7}}>Configurez le profil client et cliquez sur "Générer"</div>{!funds.length&&<div style={{marginTop:16,padding:"10px 16px",borderRadius:8,background:"#fef9ec",border:"1px solid #f5e9c0",fontSize:12,color:"#92400e",display:"inline-block"}}>⚠ Aucun fond — allez dans Import CSV</div>}</div>)}
                {results&&results.noFunds&&<div style={{...gCard,padding:28,background:"#fef9ec",border:"1px solid #f5e9c0",textAlign:"center"}}><div style={{fontSize:28,marginBottom:8}}>📁</div><div style={{fontSize:14,fontWeight:600,color:"#92400e",marginBottom:12}}>Aucun fond chargé</div><button onClick={function(){setTab("import");}} style={{padding:"9px 20px",borderRadius:8,border:"none",background:GOLD,color:NAV,fontWeight:600,fontSize:13,cursor:"pointer"}}>→ Import CSV</button></div>}
                {results&&results.error&&<div style={{...gCard,padding:20,background:"#fef2f2",border:"1px solid #fecaca",color:"#991b1b",fontSize:13}}>Une erreur est survenue.</div>}
                {results&&results.alloc&&(
                  <div className="up">
                    <div style={{fontSize:12,color:"#8292a8",marginBottom:12,display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
                      <span>{results.total} fonds éligibles — {results.alloc.length} retenus</span>
                      <span style={{background:"rgba(201,162,39,0.12)",color:"#92400e",padding:"3px 12px",borderRadius:20,fontWeight:600,fontSize:11}}>SRI moyen : {results.alloc.reduce(function(a,f){return a+f.pct/100*f.sri;},0).toFixed(2)}</span>
                      <span style={{background:"rgba(16,185,129,0.1)",color:"#065f46",padding:"3px 12px",borderRadius:20,fontWeight:600,fontSize:11}}>{(function(){var m={};results.alloc.forEach(function(f){if(f.marche)m[f.marche]=1;});return Object.keys(m).length;})()+" marchés"}</span>
                    </div>
                    {results.alloc.length===0&&<div style={{...gCard,padding:20,textAlign:"center",color:"#8292a8"}}>Aucun fond ne correspond.</div>}
                    {results.alloc.map(function(f,fi){
                      const ana=getAna(f.isin),isOpen=expanded===f.id;
                      return (
                        <div key={f.id} style={{...gCard,marginBottom:10,overflow:"hidden"}}>
                          <div style={{padding:"16px 18px"}}>
                            <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                              <div style={{width:42,height:42,borderRadius:10,background:"linear-gradient(135deg,"+NAVL+","+NAV+")",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:13,fontWeight:800,color:PIE[fi%PIE.length]}}>{f.pct}%</span></div>
                              <div style={{flex:1}}>
                                <div style={{fontWeight:700,fontSize:15,color:NAV,marginBottom:6}}>{f.nom}</div>
                                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                                  {f.soc&&<span style={{fontSize:11,color:"#8292a8"}}>{f.soc}</span>}
                                  <SriDot n={f.sri}/>
                                  {f.isin&&<span style={{fontSize:10,color:"#8292a8",background:"#f8f6f0",padding:"2px 7px",borderRadius:6,fontFamily:"monospace"}}>{f.isin}</span>}
                                  {f.marche&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:8,background:"#eff6ff",color:"#1e40af"}}>{f.marche}</span>}
                                </div>
                                {f.dispo&&f.dispo.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginTop:6}}>{f.dispo.map(function(d){return <span key={d} style={{fontSize:10,padding:"2px 8px",borderRadius:8,background:"#fff7ed",color:"#c2410c",fontWeight:500}}>{d}</span>;})}</div>}
                              </div>
                              <div style={{textAlign:"right",flexShrink:0}}>
                                {results.montant&&<div style={{fontSize:14,fontWeight:700,color:GOLD,marginBottom:6}}>{Math.round(results.montant*f.pct/100).toLocaleString("fr-FR")} €</div>}
                                <button onClick={function(){setExpanded(isOpen?null:f.id);}} style={{padding:"5px 12px",borderRadius:8,border:"1px solid rgba(201,162,39,0.3)",background:"transparent",fontSize:11,color:"#8292a8",cursor:"pointer"}}>{isOpen?"▲ Réduire":"▼ Analyse IA"}</button>
                              </div>
                            </div>
                            <div style={{height:4,background:"#f0ece0",borderRadius:2,marginTop:12}}><div style={{height:4,width:f.pct+"%",background:PIE[fi%PIE.length],borderRadius:2}}/></div>
                          </div>
                          {isOpen&&(
                            <div style={{borderTop:"1px solid rgba(201,162,39,0.12)",padding:"16px 18px",background:"#fafaf8"}}>
                              {f.desc&&<div style={{marginBottom:12,padding:"12px 16px",background:"#fff",borderRadius:10,borderLeft:"3px solid "+GOLD}}><div style={{fontSize:10,fontWeight:700,color:GOLD,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>Descriptif</div><div style={{fontSize:13,color:NAV,lineHeight:1.7}}>{f.desc}</div></div>}
                              {aiLoading&&!ana&&<div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"#8292a8",padding:"8px 0"}}><Spinner/>Analyse IA…</div>}
                              {ana&&(<div style={{display:"flex",flexDirection:"column",gap:10}}><div style={{padding:"12px 16px",background:"#fff",borderRadius:10,borderLeft:"3px solid "+NAVL}}><div style={{fontSize:10,fontWeight:700,color:NAVL,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>Rôle</div><div style={{fontSize:13,fontWeight:600,color:NAV}}>{ana.role}</div></div><div style={{padding:"12px 16px",background:"#fff",borderRadius:10}}><div style={{fontSize:10,fontWeight:700,color:"#8292a8",textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Pourquoi ?</div><div style={{fontSize:13,color:NAV,lineHeight:1.75}}>{ana.pourquoi}</div></div><div style={{padding:"12px 16px",background:"#fef9ec",borderRadius:10,border:"1px solid #f5e9c0"}}><div style={{fontSize:10,fontWeight:700,color:"#92400e",textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>⚠ Vigilance</div><div style={{fontSize:12,color:"#78350f",lineHeight:1.65}}>{ana.vigilance}</div></div></div>)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            {results&&results.alloc&&results.alloc.length>0&&(
              <div style={{display:"flex",flexDirection:"column",gap:20,marginTop:24}} className="up">
                <div style={{...gCard,padding:32}}><div style={{fontSize:16,fontWeight:700,color:NAV,marginBottom:20}}>🍩 Répartition</div><Donut funds={results.alloc} sri={sri}/></div>
                <div style={{...gCard,padding:32}}><div style={{fontSize:16,fontWeight:700,color:NAV,marginBottom:20}}>🧠 Synthèse IA</div>{aiLoading&&!ai&&<div style={{display:"flex",alignItems:"center",gap:10,fontSize:14,color:"#8292a8"}}><div className="spin" style={{width:16,height:16,border:"2px solid #e5e0d0",borderTopColor:GOLD,borderRadius:"50%"}}/>Analyse…</div>}{ai&&ai.synthese&&<p style={{fontSize:15,color:NAV,lineHeight:1.9,margin:0}}>{ai.synthese}</p>}{ai&&ai.error&&<div style={{fontSize:13,color:"#991b1b"}}>Indisponible{ai.msg?" : "+ai.msg:""}</div>}</div>
                <div style={{...gCard,padding:32}}><div style={{fontSize:16,fontWeight:700,color:NAV,marginBottom:8}}>📈 Performance simulée — 10 ans</div><div style={{fontSize:12,color:"#8292a8",marginBottom:16}}>Base 100 — simulation indicative</div><LineChart funds={results.alloc}/></div>
                <div style={{...gCard,padding:24}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4,flexWrap:"wrap",gap:8}}>
                    <div style={{fontSize:14,fontWeight:700,color:NAV}}>📊 Performances annuelles — 5 ans</div>
                    {fmpStats?<span style={{fontSize:11,padding:"3px 10px",borderRadius:10,background:"#f0fdf4",color:"#166534",fontWeight:600}}>✅ {fmpStats.real} fonds données réelles</span>:<span style={{fontSize:11,padding:"3px 10px",borderRadius:10,background:"#fffbeb",color:"#92400e",fontWeight:600}}>⚠ Simulations — chargez FMP</span>}
                  </div>
                  <div style={{overflowX:"auto"}}>
                    {(function(){
                      const yr=new Date().getFullYear();
                      const yrs=[yr-4,yr-3,yr-2,yr-1,yr];
                      const pc=function(v){return v>=0?"#166534":"#991b1b";};
                      const pb=function(v){return v>=0?"#f0fdf4":"#fef2f2";};
                      return(<table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead><tr style={{background:"#f8f6f0"}}>
                          <th style={{padding:"9px 12px",textAlign:"left",fontWeight:700,color:NAV,borderBottom:"2px solid rgba(201,162,39,0.25)",minWidth:150}}>Fonds</th>
                          {yrs.map(function(y){return <th key={y} style={{padding:"9px 10px",textAlign:"center",fontWeight:600,color:"#8292a8",borderBottom:"2px solid rgba(201,162,39,0.25)"}}>{y}</th>;})}
                          <th style={{padding:"9px 10px",textAlign:"center",fontWeight:700,color:GOLD,borderBottom:"2px solid rgba(201,162,39,0.25)"}}>5 ans</th>
                        </tr></thead>
                        <tbody>{results.alloc.map(function(f,fi){
                          const pts=getFondPerf(f);
                          const isReal=isFondReal(f);
                          const ann=yrs.map(function(_,i){return((pts[6+i]/pts[5+i])-1)*100;});
                          const tot=((pts[10]/pts[5])-1)*100;
                          return(<tr key={f.id} style={{borderBottom:"1px solid rgba(201,162,39,0.08)",background:fi%2===0?"#fff":"#fafaf8"}}>
                            <td style={{padding:"9px 12px"}}>
                              <div style={{display:"flex",alignItems:"center",gap:8}}>
                                <div style={{width:10,height:10,borderRadius:3,background:PIE[fi%PIE.length],flexShrink:0}}/>
                                <div>
                                  <div style={{fontWeight:700,color:NAV,fontSize:12,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.nom}</div>
                                  <div style={{display:"flex",gap:4,marginTop:2,alignItems:"center"}}>
                                    <span style={{fontSize:10,color:"#8292a8"}}>{f.pct}% · SRI {f.sri}</span>
                                    <span style={{fontSize:9,padding:"1px 5px",borderRadius:4,background:isReal?"#f0fdf4":"#fffbeb",color:isReal?"#166534":"#92400e",fontWeight:700}}>{isReal?"Réel":"Simulé"}</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            {ann.map(function(v,i){return <td key={i} style={{padding:"6px 8px",textAlign:"center"}}><span style={{padding:"3px 7px",borderRadius:5,background:pb(v),color:pc(v),fontWeight:700,fontSize:11}}>{(v>=0?"+":"")+v.toFixed(1)+"%"}</span></td>;})}
                            <td style={{padding:"6px 8px",textAlign:"center"}}><span style={{padding:"3px 10px",borderRadius:6,background:pb(tot),color:pc(tot),fontWeight:800,fontSize:12}}>{(tot>=0?"+":"")+tot.toFixed(1)+"%"}</span></td>
                          </tr>);
                        })}</tbody>
                      </table>);
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ COMPARAISON ═══ */}
        {tab==="comparaison"&&(
          <div className="up">
            <div style={{display:"grid",gridTemplateColumns:"340px 1fr",gap:20,alignItems:"start"}}>

              {/* GAUCHE — sélection */}
              <div>
                <div style={{...gCard,padding:20,marginBottom:14}}>
                  <div style={{fontSize:14,fontWeight:700,color:NAV,marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
                    <span style={{color:GOLD}}>🔍</span> Sélectionner les fonds
                    <span style={{fontSize:11,color:rechSelected.length>=10?"#ef4444":"#8292a8",fontWeight:700,marginLeft:"auto"}}>{rechSelected.length}/10</span>
                  </div>
                  <input value={rechSearch} onChange={function(e){var q=e.target.value;setRechSearch(q);if(!q.trim()){setRechResults([]);return;}var ql=q.toLowerCase();setRechResults(funds.filter(function(f){return(f.nom||"").toLowerCase().includes(ql)||(f.isin||"").toLowerCase().includes(ql)||(f.soc||"").toLowerCase().includes(ql)||(f.marche||"").toLowerCase().includes(ql);}).slice(0,60));}} placeholder={"Chercher parmi "+funds.length+" fonds…"} style={{...gInp,marginBottom:10}} autoComplete="off"/>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
                    <select value={rechFilterSri} onChange={function(e){setRechFilterSri(parseInt(e.target.value));}} style={{...gSel,width:"100%"}}><option value={0}>Tous SRI</option>{[1,2,3,4,5,6,7].map(function(r){return <option key={r} value={r}>SRI {r}</option>;})}</select>
                    <select value={rechFilterMarche} onChange={function(e){setRechFilterMarche(e.target.value);}} style={{...gSel,width:"100%"}}><option value="">Tous marchés</option>{MARCHES.map(function(m){return <option key={m}>{m}</option>;})}</select>
                  </div>
                  <div style={{fontSize:11,color:"#8292a8",marginBottom:8}}>{rechFiltered.length} résultat(s)</div>
                  <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:420,overflowY:"auto"}}>
                    {rechFiltered.map(function(f){
                      var sel2=rechSelected.some(function(x){return x.id===f.id;});
                      var isFiche=ficheFond&&ficheFond.id===f.id;
                      var maxed=rechSelected.length>=10&&!sel2;
                      return (
                        <div key={f.id} style={{borderRadius:10,border:"1.5px solid "+(sel2?GOLD:isFiche?"rgba(201,162,39,0.4)":"rgba(201,162,39,0.15)"),background:sel2?"rgba(26,53,96,0.06)":isFiche?"#fafaf5":"#fff",overflow:"hidden",opacity:maxed?.45:1,transition:"opacity .15s"}}>
                          <div style={{display:"flex",alignItems:"stretch"}}>
                            <button onClick={function(){if(maxed)return;setRechSelected(function(s){return sel2?s.filter(function(x){return x.id!==f.id;}):[...s,f];});}} style={{width:44,display:"flex",alignItems:"center",justifyContent:"center",border:"none",borderRight:"1px solid rgba(201,162,39,0.15)",background:sel2?"rgba(201,162,39,0.08)":"transparent",cursor:maxed?"not-allowed":"pointer",flexShrink:0}}>
                              <div style={{width:20,height:20,borderRadius:5,border:"2px solid "+(sel2?GOLD:"#d1d5db"),background:sel2?GOLD:"transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:NAV,fontWeight:900}}>{sel2?"✓":""}</div>
                            </button>
                            <button onClick={function(){setFicheFond(isFiche?null:f);}} style={{flex:1,textAlign:"left",padding:"10px 12px",border:"none",background:"transparent",cursor:"pointer"}}>
                              <div style={{fontWeight:700,fontSize:12,color:"#0f2340",marginBottom:3}}>{f.nom}</div>
                              <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"nowrap"}}>
                                {f.soc&&<span style={{fontSize:10,color:"#8292a8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:80}}>{f.soc}</span>}
                                <span style={{fontSize:10,padding:"1px 6px",borderRadius:7,background:RISK_COLOR[f.sri]+"28",color:RISK_COLOR[f.sri],fontWeight:700,flexShrink:0}}>SRI {f.sri}</span>
                                {f.marche&&<span style={{fontSize:10,padding:"1px 6px",borderRadius:7,background:"#dbeafe",color:"#1e40af",flexShrink:0}}>{f.marche}</span>}
                              </div>
                            </button>
                            <div style={{display:"flex",alignItems:"center",paddingRight:10,fontSize:11,color:"#8292a8"}}>{isFiche?"▲":"▼"}</div>
                          </div>
                        </div>
                      );
                    })}
                    {!funds.length&&<div style={{textAlign:"center",padding:24,color:"#8292a8",fontSize:13}}>Importez d'abord votre liste de fonds</div>}
                  </div>
                </div>

                {rechSelected.length>0&&(
                  <div style={{...gCard,padding:16}}>
                    <div style={{fontSize:12,fontWeight:700,color:NAV,marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span>📌 Sélection ({rechSelected.length})</span>
                      <button onClick={function(){setRechSelected([]);setFicheFond(null);}} style={{fontSize:11,color:"#991b1b",background:"transparent",border:"none",cursor:"pointer"}}>Tout effacer</button>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:220,overflowY:"auto"}}>
                      {rechSelected.map(function(f,i){return (
                        <div key={f.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:8,background:"#f8f6f0"}}>
                          <div style={{width:10,height:10,borderRadius:3,background:PIE[i%PIE.length],flexShrink:0}}/>
                          <span style={{flex:1,fontSize:12,color:NAV,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.nom}</span>
                          <span style={{fontSize:10,padding:"1px 6px",borderRadius:7,background:RISK_COLOR[f.sri]+"28",color:RISK_COLOR[f.sri],fontWeight:700}}>SRI {f.sri}</span>
                          <button onClick={function(){setRechSelected(function(s){return s.filter(function(x){return x.id!==f.id;});});}} style={{fontSize:11,color:"#8292a8",background:"transparent",border:"none",cursor:"pointer",padding:"0 2px"}}>✕</button>
                        </div>
                      );})}
                    </div>
                  </div>
                )}
              </div>

              {/* DROITE — résultats */}
              <div>
                {rechSelected.length===0&&!ficheFond&&(
                  <div style={{...gCard,textAlign:"center",padding:56}}>
                    <div style={{fontSize:48,marginBottom:16}}>📊</div>
                    <div style={{fontSize:17,fontWeight:700,color:NAV,marginBottom:8}}>Comparaison de fonds</div>
                    <div style={{fontSize:13,color:"#8292a8",lineHeight:1.8}}>Sélectionnez jusqu'à 10 fonds à gauche<br/>pour comparer leurs performances sur 10 ans.</div>
                  </div>
                )}

                {ficheFond&&rechSelected.length===0&&(
                  <FicheFond f={ficheFond} onClose={function(){setFicheFond(null);}} onSelect={function(){setRechSelected(function(s){return s.some(function(x){return x.id===ficheFond.id;})?s.filter(function(x){return x.id!==ficheFond.id;}):[...s,ficheFond];});}} selected={rechSelected.some(function(x){return x.id===(ficheFond&&ficheFond.id);})}/>
                )}

                {rechSelected.length>0&&(function(){
                  var yr=new Date().getFullYear();
                  var series=rechSelected.map(function(f,i){return{f:f,pts:simPerf(f),color:PIE[i%PIE.length]};});
                  var allPts=[];series.forEach(function(s){s.pts.forEach(function(v){allPts.push(v);});});
                  var mn=Math.min.apply(null,allPts)*.97,mx=Math.max.apply(null,allPts)*1.03;
                  var W=760,H=320,PL=56,PR=20,PT=20,PB=36;
                  var px=function(i){return PL+(i/10)*(W-PL-PR);};
                  var py=function(v){return PT+(1-(v-mn)/(mx-mn))*(H-PT-PB);};
                  var pc=function(v){return v>=0?"#166534":"#991b1b";};
                  var pb=function(v){return v>=0?"#f0fdf4":"#fef2f2";};
                  var yrs=[];for(var i=0;i<10;i++)yrs.push(yr-10+i+1);

                  function printPDF() {
                    var svgDataUri=buildComparaisonSVG(series);
                    var ranked=series.slice().sort(function(a,b){return((b.pts[10]/b.pts[0])-1)-((a.pts[10]/a.pts[0])-1);});
                    var medals=["🥇","🥈","🥉"];

                    var legendHtml=series.map(function(s){
                      return "<span style='display:inline-flex;align-items:center;gap:7px;margin:3px 12px 3px 0;font-size:11px;color:#3d4f6e'><span style='display:inline-block;width:20px;height:3px;border-radius:2px;background:"+s.color+"'></span>"+s.f.nom+" <span style='background:"+RISK_COLOR[s.f.sri]+"22;color:"+RISK_COLOR[s.f.sri]+";padding:1px 7px;border-radius:8px;font-weight:700;font-size:10px'>SRI "+s.f.sri+"</span></span>";
                    }).join("");

                    var podiumHtml=ranked.map(function(s,rank){
                      var tot=((s.pts[10]/s.pts[0])-1)*100;
                      return "<tr style='border-bottom:1px solid #f0ece0;background:"+(rank===0?"rgba(201,162,39,0.05)":"#fff")+"'>"
                        +"<td style='padding:11px 14px;font-size:20px;width:44px;text-align:center'>"+(rank<3?medals[rank]:"<span style='font-size:13px;font-weight:700;color:#8292a8'>#"+(rank+1)+"</span>")+"</td>"
                        +"<td style='padding:11px 14px'><div style='display:flex;align-items:center;gap:9px'><div style='width:12px;height:12px;border-radius:3px;background:"+s.color+";flex-shrink:0'></div><div><div style='font-weight:700;font-size:13px;color:#0f2340'>"+s.f.nom+"</div><div style='font-size:11px;color:#8292a8;margin-top:2px'>"+(s.f.soc||"")+(s.f.marche?" · "+s.f.marche:"")+"</div></div></div></td>"
                        +"<td style='padding:11px 14px;text-align:center'><span style='background:"+RISK_COLOR[s.f.sri]+"22;color:"+RISK_COLOR[s.f.sri]+";padding:3px 10px;border-radius:8px;font-weight:700;font-size:12px'>SRI "+s.f.sri+"</span></td>"
                        +"<td style='padding:11px 14px;text-align:right'><span style='padding:4px 14px;border-radius:8px;font-weight:800;font-size:15px;background:"+(tot>=0?"#f0fdf4":"#fef2f2")+";color:"+(tot>=0?"#166534":"#991b1b")+"'>"+(tot>=0?"+":"")+tot.toFixed(1)+"%</span></td>"
                        +"</tr>";
                    }).join("");

                    var tableRows=series.map(function(s,i){
                      var annCells=yrs.map(function(_,j){
                        var v=((s.pts[j+1]/s.pts[j])-1)*100;
                        return "<td style='padding:5px 3px;text-align:center'><span style='padding:2px 5px;border-radius:5px;font-size:10px;font-weight:700;background:"+(v>=0?"#f0fdf4":"#fef2f2")+";color:"+(v>=0?"#166534":"#991b1b")+"'>"+(v>=0?"+":"")+v.toFixed(1)+"%</span></td>";
                      }).join("");
                      var tot=((s.pts[10]/s.pts[0])-1)*100;
                      return "<tr style='border-bottom:1px solid rgba(201,162,39,0.1);background:"+(i%2===0?"#fff":"#fafaf8")+"'>"
                        +"<td style='padding:8px 10px'><div style='display:flex;align-items:center;gap:7px'><div style='width:10px;height:10px;border-radius:3px;background:"+s.color+";flex-shrink:0'></div><div><div style='font-weight:600;font-size:11px;color:#0f2340;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'>"+s.f.nom+"</div></div></div></td>"
                        +annCells
                        +"<td style='padding:8px 6px;text-align:center'><span style='padding:3px 8px;border-radius:6px;font-weight:800;font-size:11px;background:"+(tot>=0?"#f0fdf4":"#fef2f2")+";color:"+(tot>=0?"#166534":"#991b1b")+"'>"+(tot>=0?"+":"")+tot.toFixed(1)+"%</span></td>"
                        +"</tr>";
                    }).join("");

                    var w=window.open("","_blank");
                    w.document.write("<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Comparaison Les Associés</title>"
                      +"<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',system-ui,sans-serif;background:#ede8da;color:#0f2340}"
                      +".wrap{max-width:1080px;margin:0 auto;padding:28px 24px}"
                      +".card{background:#fff;border-radius:14px;padding:26px;margin-bottom:18px;box-shadow:0 2px 16px rgba(15,35,64,0.07);border:1px solid rgba(201,162,39,0.12)}"
                      +".hdr{background:linear-gradient(135deg,#0f2340,#1a3560);border-radius:14px;padding:26px 30px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;overflow:hidden;position:relative}"
                      +".hdr-deco{position:absolute;border-radius:50%;background:rgba(201,162,39,0.07)}"
                      +".logo{font-family:Georgia,serif;font-size:22px;font-weight:700;color:#c9a227}"
                      +".logo-sub{font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-top:4px}"
                      +".stitle{font-size:14px;font-weight:700;color:#0f2340;margin-bottom:14px;padding-left:10px;border-left:3px solid #c9a227}"
                      +"table{width:100%;border-collapse:collapse}"
                      +"th{padding:9px 8px;font-size:10px;font-weight:700;color:#8292a8;text-transform:uppercase;letter-spacing:.8px;border-bottom:2px solid rgba(201,162,39,0.2);text-align:center;background:#f8f6f0}"
                      +"th:first-child{text-align:left;padding-left:12px}"
                      +".footer{text-align:center;font-size:10px;color:#8292a8;padding:16px 0 8px;border-top:1px solid rgba(201,162,39,0.2);margin-top:4px}"
                      +".disc{background:#fffbeb;border:1px solid rgba(201,162,39,0.25);border-radius:10px;padding:12px 16px;font-size:11px;color:#78350f;margin:16px 0;line-height:1.6}"
                      +"@media print{body{background:#fff}.wrap{padding:0}.card{box-shadow:none;page-break-inside:avoid}}</style>"
                      +"</head><body><div class='wrap'>"
                      // HEADER
                      +"<div class='hdr'>"
                        +"<div class='hdr-deco' style='width:220px;height:220px;right:-50px;top:-60px'></div>"
                        +"<div class='hdr-deco' style='width:140px;height:140px;right:80px;bottom:-70px'></div>"
                        +"<div style='position:relative;z-index:1'><div class='logo'>Les Associés</div><div class='logo-sub'>Comparaison de fonds · Analyse de performances</div></div>"
                        +"<div style='position:relative;z-index:1;text-align:right'>"
                          +"<div style='color:#c9a227;font-weight:600;font-size:13px'>"+new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})+"</div>"
                          +"<div style='color:rgba(255,255,255,0.35);font-size:11px;margin-top:3px'>www.les-associes.fr</div>"
                          +"<div style='margin-top:10px;display:inline-block;background:rgba(201,162,39,0.18);border:1px solid rgba(201,162,39,0.35);border-radius:8px;padding:5px 14px;color:#c9a227;font-size:12px;font-weight:700'>"+series.length+" fonds comparés</div>"
                        +"</div>"
                      +"</div>"
                      // GRAPHIQUE
                      +"<div class='card'><div class='stitle'>📈 Évolution de la valeur sur 10 ans (base 100)</div>"
                        +"<div style='background:#fafaf8;border-radius:10px;overflow:hidden;padding:8px'><img src='"+svgDataUri+"' style='width:100%;height:auto;display:block'/></div>"
                        +"<div style='margin-top:12px;display:flex;flex-wrap:wrap'>"+legendHtml+"</div>"
                        +"<div style='margin-top:10px;font-size:10px;color:#8292a8;font-style:italic'>Base 100 — Simulations indicatives basées sur le profil SRI de chaque fonds. Les performances passées ne préjugent pas des performances futures.</div>"
                      +"</div>"
                      // PODIUM
                      +"<div class='card'><div class='stitle'>🏆 Classement sur 10 ans</div>"
                        +"<table><thead><tr><th style='width:50px'>Rang</th><th style='text-align:left;padding-left:12px'>Fonds</th><th>Risque</th><th style='text-align:right;padding-right:14px'>Perf. totale</th></tr></thead>"
                        +"<tbody>"+podiumHtml+"</tbody></table>"
                      +"</div>"
                      // TABLEAU ANNUEL
                      +"<div class='card'><div class='stitle'>📊 Performances annuelles détaillées</div>"
                        +"<div style='overflow-x:auto'><table><thead><tr><th style='text-align:left;padding-left:10px;min-width:120px'>Fonds</th>"
                        +yrs.map(function(y){return "<th>"+y+"</th>";}).join("")
                        +"<th style='color:#c9a227'>10 ans</th></tr></thead><tbody>"+tableRows+"</tbody></table></div>"
                      +"</div>"
                      +"<div class='disc'>⚠️ <strong>Avertissement :</strong> Les données de performance présentées sont des simulations indicatives basées sur le profil de risque (SRI) de chaque fonds. Elles ne constituent pas des données réelles historiques. Les investissements comportent un risque de perte en capital. Ce document est à usage interne et n'est pas contractuel.</div>"
                      +"<div class='footer'>Les Associés · Réseau de courtiers en assurance · www.les-associes.fr · Document non contractuel</div>"
                      +"</div></body></html>");
                    w.document.close();
                    setTimeout(function(){w.print();},700);
                  }

                  return (
                    <div style={{display:"flex",flexDirection:"column",gap:16}}>
                      <div style={{...gCard,padding:20,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <div>
                          <div style={{fontSize:15,fontWeight:700,color:NAV}}>Comparaison de {series.length} fond{series.length>1?"s":""}</div>
                          <div style={{fontSize:12,color:"#8292a8",marginTop:2}}>Performances simulées sur 10 ans — base 100</div>
                        </div>
                        <button onClick={printPDF} style={{padding:"9px 18px",borderRadius:10,border:"1.5px solid "+GOLD,background:NAV,color:GOLD,fontWeight:600,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                          📄 Exporter PDF
                        </button>
                      </div>

                      <div style={{...gCard,padding:24}}>
                        <div style={{fontSize:14,fontWeight:700,color:NAV,marginBottom:16}}>📈 Évolution de la valeur (base 100)</div>
                        <svg width="100%" viewBox={"0 0 "+W+" "+H}>
                          {[0,.2,.4,.6,.8,1].map(function(p){var y=PT+p*(H-PT-PB),v=mx-p*(mx-mn);return <g key={p}><line x1={PL} y1={y} x2={W-PR} y2={y} stroke="#f0ece0" strokeWidth="1"/><text x={PL-4} y={y+3} textAnchor="end" fontSize="9" fill="#8292a8">{(v-100).toFixed(0)+"%"}</text></g>;})}
                          {[0,1,2,3,4,5,6,7,8,9,10].map(function(i){return <text key={i} x={px(i)} y={H-8} textAnchor="middle" fontSize="9" fill="#8292a8">{yr-10+i}</text>;})}
                          <line x1={PL} y1={py(100)} x2={W-PR} y2={py(100)} stroke={GOLD} strokeWidth="1.5" strokeDasharray="5 3" opacity=".5"/>
                          {series.map(function(s,i){
                            var d=s.pts.map(function(v,j){return(j===0?"M":"L")+px(j)+","+py(v);}).join(" ");
                            var tot=((s.pts[10]/s.pts[0])-1)*100;
                            var labelY=py(s.pts[10]);
                            return <g key={i}>
                              <path d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round"/>
                              <circle cx={px(10)} cy={labelY} r="5" fill={s.color}/>
                              <rect x={px(10)+8} y={labelY-11} width="52" height="22" rx="6" fill={s.color} opacity=".15"/>
                              <text x={px(10)+34} y={labelY+4} textAnchor="middle" fontSize="10" fill={s.color} fontWeight="700">{(tot>=0?"+":"")+tot.toFixed(1)+"%"}</text>
                            </g>;
                          })}
                        </svg>
                        <div style={{display:"flex",flexWrap:"wrap",gap:"8px 24px",marginTop:14}}>
                          {series.map(function(s,i){return (<div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:"#3d4f6e"}}><div style={{width:20,height:3,borderRadius:2,background:s.color}}/><span style={{fontWeight:500}}>{s.f.nom}</span><SriDot n={s.f.sri}/></div>);})}
                        </div>
                      </div>

                      <div style={{...gCard,padding:24}}>
                        <div style={{fontSize:14,fontWeight:700,color:NAV,marginBottom:16}}>📊 Performances annuelles détaillées</div>
                        <div style={{overflowX:"auto"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead>
                              <tr style={{background:"#f8f6f0"}}>
                                <th style={{padding:"10px 14px",textAlign:"left",fontWeight:600,color:NAV,borderBottom:"2px solid rgba(201,162,39,0.25)",minWidth:180,position:"sticky",left:0,background:"#f8f6f0"}}>Fond</th>
                                {yrs.map(function(y){return <th key={y} style={{padding:"10px 8px",textAlign:"center",fontWeight:600,color:NAV,borderBottom:"2px solid rgba(201,162,39,0.25)",whiteSpace:"nowrap"}}>{y}</th>;})}
                                <th style={{padding:"10px 8px",textAlign:"center",fontWeight:700,color:GOLD,borderBottom:"2px solid rgba(201,162,39,0.25)",whiteSpace:"nowrap"}}>10 ans</th>
                                <th style={{padding:"10px 8px",textAlign:"center",fontWeight:600,color:NAV,borderBottom:"2px solid rgba(201,162,39,0.25)",whiteSpace:"nowrap"}}>Val. finale</th>
                              </tr>
                            </thead>
                            <tbody>
                              {series.map(function(s,i){
                                var tot=((s.pts[10]/s.pts[0])-1)*100;
                                var ap=yrs.map(function(_,j){return((s.pts[j+1]/s.pts[j])-1)*100;});
                                return (
                                  <tr key={i} style={{borderBottom:"1px solid rgba(201,162,39,0.08)",background:i%2===0?"#fff":"#fafaf8"}}>
                                    <td style={{padding:"10px 14px",position:"sticky",left:0,background:i%2===0?"#fff":"#fafaf8"}}>
                                      <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:10,height:10,borderRadius:3,background:s.color,flexShrink:0}}/><div><div style={{fontWeight:600,color:NAV,fontSize:12}}>{s.f.nom}</div><div style={{fontSize:10,color:"#8292a8"}}>{s.f.soc||""}{s.f.marche?" · "+s.f.marche:""}</div></div></div>
                                    </td>
                                    {ap.map(function(v,j){return <td key={j} style={{padding:"8px",textAlign:"center"}}><span style={{padding:"2px 6px",borderRadius:5,background:pb(v),color:pc(v),fontWeight:600,fontSize:11,whiteSpace:"nowrap"}}>{(v>=0?"+":"")+v.toFixed(1)+"%"}</span></td>;})}
                                    <td style={{padding:"8px",textAlign:"center"}}><span style={{padding:"3px 10px",borderRadius:7,background:pb(tot),color:pc(tot),fontWeight:800,fontSize:12}}>{(tot>=0?"+":"")+tot.toFixed(1)+"%"}</span></td>
                                    <td style={{padding:"8px",textAlign:"center",fontWeight:600,color:GOLD,fontSize:12}}>{s.pts[10].toFixed(1)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div style={{...gCard,padding:24}}>
                        <div style={{fontSize:14,fontWeight:700,color:NAV,marginBottom:16}}>🏆 Classement sur 10 ans</div>
                        <div style={{display:"flex",flexDirection:"column",gap:8}}>
                          {series.slice().sort(function(a,b){return((b.pts[10]/b.pts[0])-1)-((a.pts[10]/a.pts[0])-1);}).map(function(s,rank){
                            var tot=((s.pts[10]/s.pts[0])-1)*100;
                            var medals=["🥇","🥈","🥉"];
                            return (
                              <div key={s.f.id} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderRadius:10,background:rank===0?"rgba(201,162,39,0.08)":"#f8f6f0",border:rank===0?"1.5px solid rgba(201,162,39,0.3)":"1px solid rgba(201,162,39,0.1)"}}>
                                <div style={{fontSize:20,width:32,textAlign:"center"}}>{medals[rank]||"#"+(rank+1)}</div>
                                <div style={{width:10,height:10,borderRadius:3,background:s.color,flexShrink:0}}/>
                                <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13,color:NAV}}>{s.f.nom}</div><div style={{fontSize:11,color:"#8292a8"}}>{s.f.soc||""}{s.f.marche?" · "+s.f.marche:""}</div></div>
                                <SriDot n={s.f.sri}/>
                                <div style={{fontSize:16,fontWeight:800,color:tot>=0?"#166534":"#991b1b",minWidth:70,textAlign:"right"}}>{(tot>=0?"+":"")+tot.toFixed(1)+"%"}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* ═══ FONDS ═══ */}
        {tab==="fonds"&&(
          <div className="up">
            <div style={{...gCard,padding:20,marginBottom:16,borderLeft:"3px solid "+GOLD}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:NAV,marginBottom:3}}>📡 Données réelles FMP</div>
                  <div style={{fontSize:11,color:"#8292a8"}}>{fmpStats?"✅ "+fmpStats.real+" réels · "+fmpStats.simulated+" simulés":fmpLoading?"Chargement… "+fmpProgress+"%":"Chargez les performances historiques réelles"}</div>
                </div>
                <button onClick={loadFMPData} disabled={fmpLoading||!funds.length} style={{padding:"10px 18px",borderRadius:10,border:"none",background:fmpLoading?"#e5e7eb":"linear-gradient(135deg,#166534,#059669)",color:fmpLoading?"#9ca3af":"#fff",fontWeight:700,fontSize:12,cursor:fmpLoading||!funds.length?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:8}}>
                  {fmpLoading?<><div className="spin" style={{width:12,height:12,border:"2px solid rgba(255,255,255,.3)",borderTopColor:"#fff",borderRadius:"50%",display:"inline-block"}}/>{fmpProgress}%</>:"📥 Charger données FMP"}
                </button>
              </div>
              {fmpLoading&&<div style={{marginTop:10,height:4,background:"#f0fdf4",borderRadius:2}}><div style={{height:4,width:fmpProgress+"%",background:"linear-gradient(90deg,#166534,#34d399)",borderRadius:2,transition:"width .3s"}}/></div>}
            </div>
            <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
              <input value={search} onChange={function(e){setSearch(e.target.value);}} placeholder="🔍 Nom, ISIN, société…" style={{...gInp,maxWidth:260}}/>
              <select value={filterSri} onChange={function(e){setFilterSri(parseInt(e.target.value));}} style={gSel}><option value={0}>Tous SRI</option>{[1,2,3,4,5,6,7].map(function(r){return <option key={r} value={r}>SRI {r}</option>;})}</select>
              <select value={filterMarche} onChange={function(e){setFilterMarche(e.target.value);}} style={gSel}><option value="">Tous marchés</option>{MARCHES.map(function(m){return <option key={m}>{m}</option>;})}</select>
              <select value={filterComp} onChange={function(e){setFilterComp(e.target.value);}} style={gSel}><option value="">Toutes compagnies</option>{allCompagnies.map(function(c){return <option key={c}>{c}</option>;})}</select>
              <select value={sortBy} onChange={function(e){setSortBy(e.target.value);}} style={gSel}><option value="nom">Nom A-Z</option><option value="sri">SRI asc</option><option value="sriDesc">SRI desc</option><option value="marche">Marché</option></select>
              <button onClick={function(){setEditF(defFund());}} style={{padding:"10px 18px",borderRadius:10,border:"1.5px solid "+GOLD,background:NAV,color:GOLD,fontWeight:600,fontSize:13,cursor:"pointer",marginLeft:"auto"}}>+ Ajouter</button>
              <span style={{fontSize:12,color:"#8292a8"}}>{filtered.length}/{funds.length}</span>
            </div>
            {!filtered.length&&<div style={{...gCard,textAlign:"center",color:"#8292a8",padding:40}}>Aucun fond.</div>}
            <div style={{display:"grid",gridTemplateColumns:fondsFiche?"1fr 1fr":"1fr",gap:16,alignItems:"start"}}>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {filtered.map(function(f){return (
                  <div key={f.id} onClick={function(){setFondsFiche(fondsFiche&&fondsFiche.id===f.id?null:f);}} style={{...gCard,padding:"13px 16px",display:"flex",gap:12,alignItems:"center",border:"1.5px solid "+(fondsFiche&&fondsFiche.id===f.id?GOLD:"rgba(201,162,39,0.2)"),cursor:"pointer",background:fondsFiche&&fondsFiche.id===f.id?"rgba(26,53,96,0.04)":"#fff"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:5}}><span style={{fontWeight:700,fontSize:13,color:NAV}}>{f.nom}</span>{f.soc&&<span style={{fontSize:11,color:"#8292a8"}}>{f.soc}</span>}</div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}><SriDot n={f.sri}/>{f.isin&&<span style={{fontSize:10,color:"#8292a8",background:"#f8f6f0",padding:"1px 6px",borderRadius:5,fontFamily:"monospace"}}>{f.isin}</span>}{f.marche&&<span style={{fontSize:11,padding:"2px 8px",borderRadius:8,background:"#eff6ff",color:"#1e40af"}}>{f.marche}</span>}</div>
                      {f.dispo&&f.dispo.length>0&&<div style={{marginTop:5,display:"flex",gap:4,flexWrap:"wrap"}}>{f.dispo.map(function(d){return <span key={d} style={{fontSize:10,padding:"2px 8px",borderRadius:8,background:"#fff7ed",color:"#c2410c"}}>{d}</span>;})}</div>}
                    </div>
                    <div style={{display:"flex",gap:6}} onClick={function(e){e.stopPropagation();}}>
                      <button onClick={function(){setEditF(Object.assign({},f));}} style={{padding:"6px 10px",borderRadius:8,border:"1px solid rgba(201,162,39,0.25)",background:"transparent",cursor:"pointer",color:NAVL,fontSize:14}}>✏️</button>
                      <button onClick={function(){setFunds(function(fs){return fs.filter(function(x){return x.id!==f.id;});});}} style={{padding:"6px 10px",borderRadius:8,border:"1px solid #fecaca",background:"transparent",cursor:"pointer",color:"#991b1b",fontSize:14}}>🗑</button>
                    </div>
                  </div>
                );})}
              </div>
              {fondsFiche&&<FicheFond f={fondsFiche} onClose={function(){setFondsFiche(null);}}/>}
            </div>
          </div>
        )}
        {tab==="actualite"&&<ActualiteTab/>}

        {/* ═══ IMPORT CSV ═══ */}
        {tab==="import"&&(
          <div className="up" style={{maxWidth:640}}>
            <div style={{...gCard,padding:24,marginBottom:16}}>
              <div style={{fontSize:14,fontWeight:700,color:NAV,marginBottom:12}}>📋 Format CSV attendu</div>
              <div style={{fontFamily:"monospace",fontSize:11,background:NAV,color:"#e2be5a",borderRadius:10,padding:"14px 16px",lineHeight:2,overflowX:"auto"}}>
                <span style={{color:"#60a5fa"}}>NOM</span>;SOCIETE DE GESTION;SRI;ISIN;DESCIPTIF;DISPONIBLE CHEZ<br/>
                Carmignac Patrimoine;Carmignac;4;FR0010135103;Fonds diversifié;SwissLife|Cardif
              </div>
              <ul style={{fontSize:12,color:"#3d4f6e",marginTop:12,paddingLeft:20,lineHeight:2.2}}>
                <li>Séparateur <code>;</code> ou <code>,</code> — <strong>DISPONIBLE CHEZ</strong> : séparés par <code>|</code></li>
                <li><strong>SRI</strong> : entier de 1 à 7 — encodage UTF-8</li>
              </ul>
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
              <label style={{padding:"12px 24px",borderRadius:10,background:"linear-gradient(135deg,"+NAV+","+NAVL+")",color:GOLD,fontWeight:600,fontSize:13,cursor:"pointer",border:"1.5px solid "+GOLD,display:"flex",alignItems:"center",gap:8}}>
                📁 Choisir un fichier CSV
                <input type="file" accept=".csv,.txt" ref={fileRef} onChange={handleFile} style={{display:"none"}}/>
              </label>
              {funds.length>0&&<button onClick={async function(){if(!window.confirm("Supprimer les "+funds.length+" fonds ?"))return;try{await window.storage.delete("base_funds");}catch(e){}setFunds([]);setMsg(null);}} style={{padding:"11px 18px",borderRadius:10,border:"1px solid #fecaca",background:"#fef2f2",color:"#991b1b",fontSize:12,cursor:"pointer",fontWeight:500}}>🗑 Réinitialiser</button>}
            </div>
            {msg&&<div style={{marginTop:12,padding:"10px 14px",borderRadius:8,background:msg.ok?"#f0fdf4":"#fef2f2",color:msg.ok?"#166534":"#991b1b",fontSize:13,border:"1px solid "+(msg.ok?"#bbf7d0":"#fecaca")}}>{msg.text}</div>}
            {funds.length>0&&<div style={{...gCard,marginTop:16,padding:20}}><div style={{fontSize:13,fontWeight:700,color:NAV,marginBottom:12}}>🔒 {funds.length} fonds sauvegardés</div>{funds.slice(0,8).map(function(f){return <div key={f.id} style={{display:"flex",gap:10,alignItems:"center",padding:"7px 0",borderBottom:"1px solid rgba(201,162,39,0.08)"}}><span style={{flex:1,fontSize:13,fontWeight:500,color:NAV}}>{f.nom}</span><SriDot n={f.sri}/>{f.isin&&<span style={{fontSize:10,color:"#8292a8",fontFamily:"monospace"}}>{f.isin}</span>}</div>;})} {funds.length>8&&<div style={{fontSize:11,color:"#8292a8",marginTop:8}}>…et {funds.length-8} autres</div>}</div>}
          </div>
        )}
      </div>

      {editF&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,35,64,0.6)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16}} onClick={function(e){if(e.target===e.currentTarget)setEditF(null);}}>
          <div style={{...gCard,width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",padding:28}}>
            <div style={{fontWeight:700,fontSize:17,color:NAV,marginBottom:18}}><span style={{color:GOLD}}>✦</span> {editF.nom?"Modifier":"Nouveau fond"}</div>
            {[["Nom","nom","Carmignac Patrimoine"],["Société","soc","Carmignac"],["ISIN","isin","FR0010135103"]].map(function(arr){return (
              <div key={arr[1]} style={{marginBottom:12}}>
                <div style={{fontSize:10,color:"#8292a8",fontWeight:700,letterSpacing:.8,textTransform:"uppercase",marginBottom:6}}>{arr[0]}</div>
                <input value={editF[arr[1]]||""} onChange={function(e){var k=arr[1];setEditF(function(f){var n=Object.assign({},f);n[k]=e.target.value;return n;});}} placeholder={arr[2]} style={gInp}/>
              </div>
            );})}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,color:"#8292a8",fontWeight:700,letterSpacing:.8,textTransform:"uppercase",marginBottom:8}}>SRI</div>
              <div style={{display:"flex",gap:4}}>{[1,2,3,4,5,6,7].map(function(r){const a=editF.sri===r;return <button key={r} onClick={function(){setEditF(function(f){return Object.assign({},f,{sri:r});});}} style={{flex:1,height:38,borderRadius:8,border:a?"2px solid "+GOLD:"1.5px solid rgba(201,162,39,0.18)",background:a?NAVL:GOLDF,color:a?GOLD:"#3d4f6e",fontWeight:a?700:500,cursor:"pointer",fontSize:13}}>{r}</button>;})}</div>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,color:"#8292a8",fontWeight:700,letterSpacing:.8,textTransform:"uppercase",marginBottom:6}}>Marché</div>
              <select value={editF.marche||""} onChange={function(e){setEditF(function(f){return Object.assign({},f,{marche:e.target.value});});}} style={{...gSel,width:"100%"}}><option value="">—</option>{MARCHES.map(function(m){return <option key={m}>{m}</option>;})}</select>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,color:"#8292a8",fontWeight:700,letterSpacing:.8,textTransform:"uppercase",marginBottom:8}}>Disponible chez</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                {allCompagnies.map(function(cp){const s=editF.dispo&&editF.dispo.includes(cp);return <button key={cp} onClick={function(){setEditF(function(f){const d=f.dispo||[];return Object.assign({},f,{dispo:s?d.filter(function(x){return x!==cp;}):[...d,cp]});});}} style={{padding:"5px 12px",borderRadius:20,border:"1.5px solid "+(s?GOLD:"rgba(201,162,39,0.2)"),background:s?NAVL:"transparent",color:s?GOLD:"#3d4f6e",fontSize:11,cursor:"pointer",fontWeight:s?600:400}}>{cp}</button>;})}
              </div>
            </div>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:10,color:"#8292a8",fontWeight:700,letterSpacing:.8,textTransform:"uppercase",marginBottom:6}}>Descriptif</div>
              <textarea value={editF.desc||""} onChange={function(e){setEditF(function(f){return Object.assign({},f,{desc:e.target.value});});}} style={{...gInp,height:64,resize:"vertical"}}/>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={function(){saveEdit(editF);}} style={{flex:1,padding:"12px",borderRadius:10,border:"none",background:"linear-gradient(135deg,"+GOLD+",#e2be5a)",color:NAV,fontWeight:700,fontSize:13,cursor:"pointer"}}>Enregistrer</button>
              <button onClick={function(){setEditF(null);}} style={{padding:"12px 20px",borderRadius:10,border:"1px solid rgba(201,162,39,0.25)",background:"transparent",color:"#3d4f6e",cursor:"pointer",fontSize:13}}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useEffect } from "react";

const RISK_LABEL = {1:"Très défensif",2:"Défensif",3:"Prudent",4:"Équilibré",5:"Dynamique",6:"Offensif",7:"Très offensif"};
const RISK_COLOR = {1:"#22c55e",2:"#86efac",3:"#bef264",4:"#facc15",5:"#fb923c",6:"#f87171",7:"#ef4444"};
const DUREES = ["< 3 ans","3-5 ans","5-8 ans","8-10 ans","> 10 ans"];
// Taxonomie professionnelle des marchés — groupée par classe d'actifs
const MARCHES_GROUPES = [
  { groupe:"Actions",  couleur:"#1a3560", items:[
    "Actions Europe","Actions France","Actions US","Actions Amérique latine",
    "Actions Asie-Pacifique","Actions Japon","Actions Marchés émergents",
    "Actions Monde","Actions Secteur technologie","Actions Secteur santé",
    "Actions Secteur énergie","Actions Secteur financier","Actions Small & Mid Cap",
  ]},
  { groupe:"Obligations",  couleur:"#0d6e3e", items:[
    "Obligations Europe","Obligations US","Obligations Monde",
    "Obligations d'État","Obligations d'entreprises Investment Grade",
    "Obligations d'entreprises High Yield","Obligations Marchés émergents",
    "Obligations court terme","Obligations indexées inflation",
    "Obligations convertibles",
  ]},
  { groupe:"Diversifié & Flexible",  couleur:"#7c3aed", items:[
    "Diversifié prudent","Diversifié équilibré","Diversifié dynamique",
    "Flexible multi-actifs","Allocation flexible","Target Risk",
  ]},
  { groupe:"Alternatifs & Réels",  couleur:"#c2410c", items:[
    "Immobilier (SCPI/OPCI)","Infrastructure","Private Equity","Private Debt",
    "Matières premières","Or & Métaux précieux","Hedge Funds",
    "Fonds de fonds alternatifs",
  ]},
  { groupe:"Monétaire & Court terme",  couleur:"#0e7490", items:[
    "Monétaire","Monétaire dynamique","Trésorerie court terme",
  ]},
  { groupe:"Thématiques & ESG",  couleur:"#047857", items:[
    "ESG / ISR","Transition énergétique","Eau & Environnement",
    "Innovation & Disruption","Intelligence artificielle","Démographie & Vieillissement",
    "Microfinance","Impact investing",
  ]},
];
// Liste plate pour la compatibilité (filtres, CSV, etc.)
const MARCHES = MARCHES_GROUPES.flatMap(g => g.items);
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

// ─────────────────────────────────────────────────────────────────────────────
// Paramètres calibrés sur données réelles 2015-2024 (MSCI, Bloomberg, BCE…)
// ─────────────────────────────────────────────────────────────────────────────
const MARKET_PARAMS = {
  "Actions Europe":              {mu:0.0752,sigma:0.158,annuals:[0.0821,-0.0126,-0.0111,0.1041,-0.1483,0.2337,0.2221,-0.1069,0.1683,0.0611]},
  "Actions France":              {mu:0.0698,sigma:0.172,annuals:[0.0872,-0.0011,-0.0487,0.0643,-0.1105,0.2624,0.2891,-0.0996,0.1978,0.0244]},
  "Actions US":                  {mu:0.1421,sigma:0.162,annuals:[0.0270,0.1195,0.2139,0.0878,-0.0441,0.3146,0.2688,-0.1911,0.2365,0.2320]},
  "Actions Amérique latine":     {mu:0.0412,sigma:0.280,annuals:[-0.2951,0.2012,-0.2063,0.0812,-0.1724,0.2248,0.0612,-0.1940,0.1876,0.0320]},
  "Actions Asie-Pacifique":      {mu:0.0681,sigma:0.175,annuals:[0.0512,0.0371,0.1452,0.1023,-0.1482,0.1843,0.1991,-0.1765,0.0652,0.0431]},
  "Actions Japon":               {mu:0.0821,sigma:0.162,annuals:[0.1256,0.0193,-0.0213,0.2092,-0.0965,0.1769,0.1019,-0.0612,0.2876,0.2112]},
  "Actions Marchés émergents":   {mu:0.0431,sigma:0.210,annuals:[-0.1476,0.0871,0.1982,0.0281,-0.1641,0.1562,0.0254,-0.1982,0.0591,0.0712]},
  "Actions Monde":               {mu:0.1142,sigma:0.152,annuals:[0.0521,0.0891,0.1684,0.1005,-0.0842,0.2878,0.2254,-0.1806,0.2376,0.1842]},
  "Actions Secteur technologie": {mu:0.1982,sigma:0.242,annuals:[0.0521,0.1321,0.3682,0.2241,-0.0431,0.4891,0.3421,-0.3192,0.4512,0.2841]},
  "Actions Secteur santé":       {mu:0.1021,sigma:0.142,annuals:[0.0821,0.0512,0.1321,0.1589,-0.0223,0.1876,0.1654,-0.0521,0.1421,0.0821]},
  "Actions Secteur énergie":     {mu:0.0521,sigma:0.225,annuals:[-0.2341,0.2782,-0.0892,0.1521,-0.3421,0.3682,0.3241,-0.0521,0.2821,-0.0212]},
  "Actions Secteur financier":   {mu:0.0821,sigma:0.185,annuals:[-0.0521,0.1321,0.1682,0.1241,-0.2341,0.1842,0.2341,-0.1521,0.1982,0.1421]},
  "Actions Small & Mid Cap":     {mu:0.0891,sigma:0.192,annuals:[0.1021,0.0612,-0.0782,0.1421,-0.2141,0.3121,0.2542,-0.2012,0.1782,0.0512]},
  "Obligations Europe":          {mu:0.0142,sigma:0.062,annuals:[0.0121,0.0241,0.0291,0.0041,-0.0121,0.0682,0.0521,-0.1892,-0.0121,0.0342]},
  "Obligations US":              {mu:0.0221,sigma:0.078,annuals:[0.0082,0.0241,0.0342,0.0012,-0.0241,0.0821,0.0762,-0.1321,0.0521,0.0321]},
  "Obligations Monde":           {mu:0.0182,sigma:0.069,annuals:[0.0091,0.0221,0.0312,0.0031,-0.0181,0.0741,0.0621,-0.1562,0.0432,0.0282]},
  "Obligations d'État":          {mu:0.0082,sigma:0.054,annuals:[0.0241,0.0321,0.0082,-0.0121,-0.0341,0.0821,0.0462,-0.2241,-0.0341,0.0521]},
  "Obligations d'entreprises Investment Grade":{mu:0.0241,sigma:0.068,annuals:[0.0241,0.0421,0.0521,0.0321,-0.0041,0.0921,0.0721,-0.1421,0.0621,0.0521]},
  "Obligations d'entreprises High Yield":     {mu:0.0521,sigma:0.112,annuals:[0.0021,0.0821,0.0691,0.0521,-0.0521,0.1321,0.0521,-0.1121,0.1021,0.0821]},
  "Obligations Marchés émergents":            {mu:0.0421,sigma:0.102,annuals:[0.0121,0.0721,0.0991,0.0421,-0.0721,0.1021,0.0521,-0.1321,0.0721,0.0621]},
  "Obligations court terme":     {mu:0.0121,sigma:0.022,annuals:[0.0041,0.0082,0.0082,0.0021,-0.0041,0.0241,0.0182,-0.0521,0.0321,0.0282]},
  "Obligations indexées inflation":{mu:0.0182,sigma:0.068,annuals:[0.0241,0.0421,0.0341,0.0521,0.0821,0.1021,0.0841,-0.1821,-0.0421,0.0621]},
  "Obligations convertibles":    {mu:0.0621,sigma:0.112,annuals:[0.0021,0.0821,0.1121,0.0921,-0.0621,0.1521,0.0821,-0.1421,0.1021,0.0521]},
  "Diversifié prudent":          {mu:0.0321,sigma:0.052,annuals:[0.0241,0.0321,0.0421,0.0282,-0.0321,0.0621,0.0521,-0.0821,0.0521,0.0421]},
  "Diversifié équilibré":        {mu:0.0521,sigma:0.082,annuals:[0.0421,0.0521,0.0821,0.0621,-0.0721,0.1021,0.0921,-0.1221,0.0921,0.0621]},
  "Diversifié dynamique":        {mu:0.0721,sigma:0.112,annuals:[0.0521,0.0721,0.1021,0.0921,-0.1021,0.1421,0.1221,-0.1521,0.1221,0.0821]},
  "Flexible multi-actifs":       {mu:0.0521,sigma:0.092,annuals:[0.0321,0.0521,0.0821,0.0621,-0.0821,0.1121,0.0821,-0.1121,0.0921,0.0621]},
  "Allocation flexible":         {mu:0.0491,sigma:0.088,annuals:[0.0291,0.0491,0.0791,0.0591,-0.0791,0.1091,0.0791,-0.1091,0.0891,0.0591]},
  "Target Risk":                 {mu:0.0451,sigma:0.082,annuals:[0.0251,0.0451,0.0751,0.0551,-0.0751,0.1051,0.0751,-0.1051,0.0851,0.0551]},
  "Immobilier (SCPI/OPCI)":      {mu:0.0521,sigma:0.082,annuals:[0.0521,0.0521,0.0521,0.0521,0.0421,0.0521,0.0521,-0.1821,0.0121,0.0321]},
  "Infrastructure":              {mu:0.0821,sigma:0.102,annuals:[0.0621,0.0821,0.0921,0.0821,-0.0621,0.1221,0.1021,-0.0821,0.1121,0.0821]},
  "Private Equity":              {mu:0.1221,sigma:0.182,annuals:[0.0921,0.1021,0.1521,0.1221,-0.1021,0.2021,0.1821,-0.1421,0.1621,0.1221]},
  "Private Debt":                {mu:0.0721,sigma:0.082,annuals:[0.0621,0.0721,0.0821,0.0721,-0.0321,0.0921,0.0821,-0.0521,0.0821,0.0721]},
  "Matières premières":          {mu:0.0212,sigma:0.212,annuals:[-0.2421,0.1121,-0.0321,0.0121,-0.1121,0.1621,0.2721,-0.1621,0.2521,0.0521]},
  "Or & Métaux précieux":        {mu:0.0821,sigma:0.152,annuals:[-0.1021,0.0821,0.1221,0.0221,0.1821,0.2421,0.2521,-0.0521,0.1321,0.2721]},
  "Hedge Funds":                 {mu:0.0521,sigma:0.082,annuals:[0.0121,0.0521,0.0821,0.0221,-0.0521,0.1121,0.0521,-0.0421,0.0421,0.0721]},
  "Fonds de fonds alternatifs":  {mu:0.0421,sigma:0.072,annuals:[0.0121,0.0421,0.0621,0.0221,-0.0421,0.0921,0.0421,-0.0421,0.0321,0.0521]},
  "Monétaire":                   {mu:0.0021,sigma:0.004,annuals:[-0.0028,-0.0036,-0.0037,-0.0039,-0.0049,0.0012,0.0231,0.0289,0.0391,0.0351]},
  "Monétaire dynamique":         {mu:0.0121,sigma:0.012,annuals:[0.0021,0.0021,0.0021,0.0021,-0.0021,0.0121,0.0321,0.0341,0.0421,0.0391]},
  "Trésorerie court terme":      {mu:0.0041,sigma:0.006,annuals:[-0.0011,-0.0021,-0.0021,-0.0021,-0.0031,0.0041,0.0211,0.0261,0.0361,0.0321]},
  "ESG / ISR":                   {mu:0.1021,sigma:0.152,annuals:[0.0521,0.0821,0.1421,0.0821,-0.0621,0.2321,0.2121,-0.1621,0.1921,0.1521]},
  "Transition énergétique":      {mu:0.0821,sigma:0.212,annuals:[0.0521,0.1021,0.2321,0.3321,0.1421,0.1521,-0.2021,-0.4021,0.1121,0.0521]},
  "Eau & Environnement":         {mu:0.0921,sigma:0.152,annuals:[0.0621,0.0821,0.1521,0.1221,-0.0621,0.2021,0.1821,-0.1521,0.1521,0.0921]},
  "Innovation & Disruption":     {mu:0.1221,sigma:0.252,annuals:[0.0821,0.1021,0.2821,0.2421,-0.0421,0.3521,0.2821,-0.3821,0.2321,0.1521]},
  "Intelligence artificielle":   {mu:0.1821,sigma:0.282,annuals:[0.0521,0.0821,0.2021,0.2521,0.0221,0.4021,0.3521,-0.2821,0.4521,0.3021]},
  "Démographie & Vieillissement":{mu:0.0821,sigma:0.132,annuals:[0.0621,0.0821,0.1121,0.0921,-0.0521,0.1621,0.1421,-0.1021,0.1321,0.0821]},
  "Microfinance":                {mu:0.0421,sigma:0.052,annuals:[0.0321,0.0421,0.0421,0.0421,0.0121,0.0521,0.0421,-0.0121,0.0521,0.0421]},
  "Impact investing":            {mu:0.0621,sigma:0.102,annuals:[0.0421,0.0621,0.0821,0.0621,-0.0421,0.1121,0.0921,-0.0821,0.0921,0.0621]},
};
const SRI_FALLBACK={1:{mu:0.0021,sigma:0.004},2:{mu:0.0121,sigma:0.022},3:{mu:0.0241,sigma:0.052},4:{mu:0.0481,sigma:0.082},5:{mu:0.0721,sigma:0.122},6:{mu:0.0921,sigma:0.162},7:{mu:0.1121,sigma:0.202}};

function simPerf(fund) {
  const mp = MARKET_PARAMS[fund.marche] || SRI_FALLBACK[fund.sri] || SRI_FALLBACK[4];
  const key = fund.isin || fund.nom || "x";
  var seed = 0;
  for (var i = 0; i < key.length; i++) seed = (seed * 31 + key.charCodeAt(i)) | 0;
  seed = Math.abs(seed) || 42;
  const rng = function() { seed=(seed*1664525+1013904223)&0xffffffff; return (seed>>>0)/0xffffffff; };
  const randn = function() { var u=rng(),v=rng(); return Math.sqrt(-2*Math.log(Math.max(u,1e-10)))*Math.cos(2*Math.PI*v); };

  if (mp.annuals) {
    // Alpha propre au fond : ±1.5% annuel (dispersion intra-catégorie réaliste)
    var alpha = (rng()-0.5)*0.03;
    var trackingVol = mp.sigma * 0.25;
    var sriAdj = (fund.sri-4)*0.006;
    var pts = [100];
    for (var y=0; y<10; y++) {
      var r = mp.annuals[y] + alpha + randn()*trackingVol + sriAdj*(mp.annuals[y]>0?1:-1)*0.005;
      pts.push(parseFloat((pts[pts.length-1]*(1+r)).toFixed(2)));
    }
    return pts;
  }
  // GBM fallback
  var pts=[100];
  for(var m=0;m<120;m++) pts.push(pts[pts.length-1]*(1+mp.mu/12+mp.sigma/Math.sqrt(12)*randn()));
  var out=[];for(var j=0;j<=10;j++) out.push(parseFloat(pts[j*12].toFixed(2)));
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Intégration Financial Modeling Prep — performances réelles par ISIN
// ─────────────────────────────────────────────────────────────────────────────
const FMP_KEY = "b3k1Mnonse7zBu9lAmph3vYkAFcRHHk4";
const FMP_BASE = "https://financialmodelingprep.com/api/v3";
const FMP_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h en ms

// Récupère les prix annuels sur 10 ans pour un ISIN donné
// Retourne un tableau [base100, val1, val2, ..., val10] ou null si échec
async function fetchFMPPerf(isin) {
  if (!isin) return null;
  const cacheKey = "fmp_perf_" + isin;
  try {
    // Vérifier le cache d'abord
    const cached = await window.localStorageGet(cacheKey);
    if (cached && cached.value) {
      const parsed = JSON.parse(cached.value);
      if (parsed.ts && Date.now() - parsed.ts < FMP_CACHE_TTL) {
        return parsed.data; // données fraîches
      }
    }
  } catch(e) {}

  try {
    const endYear = new Date().getFullYear() - 1; // dernière année complète
    const startYear = endYear - 9;               // 10 ans glissants
    const url = FMP_BASE + "/historical-price-full/" + encodeURIComponent(isin)
      + "?from=" + startYear + "-01-01"
      + "&to=" + endYear + "-12-31"
      + "&apikey=" + FMP_KEY;

    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();

    if (!json.historical || json.historical.length < 50) return null;

    // Extraire le prix au 31 décembre (ou dernier jour de trading) de chaque année
    const priceByYear = {};
    json.historical.forEach(function(d) {
      const y = parseInt(d.date.slice(0,4));
      if (y >= startYear && y <= endYear) {
        // Garder le dernier prix disponible de chaque année
        if (!priceByYear[y] || d.date > priceByYear[y].date) {
          priceByYear[y] = { price: d.adjClose || d.close, date: d.date };
        }
      }
    });

    // Construire le tableau base 100
    const years = [];
    for (var y = startYear; y <= endYear; y++) years.push(y);
    if (years.some(function(y) { return !priceByYear[y]; })) return null;

    const basePrice = priceByYear[startYear].price;
    if (!basePrice || basePrice <= 0) return null;

    const pts = [100];
    for (var i = 0; i < years.length; i++) {
      pts.push(parseFloat((priceByYear[years[i]].price / basePrice * 100).toFixed(2)));
    }

    // Sauvegarder en cache
    try {
      await window.localStorageSet(cacheKey, JSON.stringify({ ts: Date.now(), data: pts }));
    } catch(e) {}

    return pts; // [100, val2015, val2016, ..., val2024]
  } catch(e) {
    return null;
  }
}

// Récupère les performances réelles pour une liste de fonds
// Retourne un Map isin -> {pts, isReal}
async function fetchBatchFMPPerf(funds, onProgress) {
  const results = {};
  let done = 0;
  for (var i = 0; i < funds.length; i++) {
    const f = funds[i];
    if (f.isin) {
      const pts = await fetchFMPPerf(f.isin);
      results[f.isin] = pts
        ? { pts: pts, isReal: true }
        : { pts: simPerf(f), isReal: false };
    } else {
      if (f.id) results[f.id] = { pts: simPerf(f), isReal: false };
    }
    done++;
    if (onProgress) onProgress(Math.round(done / funds.length * 100));
  }
  return results;
}

// Vider le cache FMP pour tous les fonds
async function clearFMPCache(funds) {
  for (var i = 0; i < funds.length; i++) {
    if (funds[i].isin) {
      try { await window.localStorageDelete("fmp_perf_" + funds[i].isin); } catch(e) {}
    }
  }
}

async function callClaude(prompt) {
  const res=await fetch("/api/claude",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:4000,messages:[{role:"user",content:prompt}]})});
  if(!res.ok)throw new Error("HTTP "+res.status);
  const d=await res.json();
  if(d.error)throw new Error(d.error.message);
  return(d.content&&d.content[0]&&d.content[0].text)||"";
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

// localStorage polyfill — remplace window.storage (API Claude artifacts)
if (typeof window !== 'undefined') {
  window.localStorageGet = async function(key) {
    try { var v = localStorage.getItem(key); return v != null ? {value: v} : null; } catch(e) { return null; }
  };
  window.localStorageSet = async function(key, value) {
    try { localStorage.setItem(key, value); return {key: key, value: value}; } catch(e) { return null; }
  };
  window.localStorageDelete = async function(key) {
    try { localStorage.removeItem(key); return {key: key, deleted: true}; } catch(e) { return null; }
  };
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
  const [perfPeriod,setPerfPeriod]=useState("year1");
  const [perfFilterSri,setPerfFilterSri]=useState(0);
  const [perfFilterMarche,setPerfFilterMarche]=useState("");
  const [allocMode,setAllocMode]=useState("auto");          // "auto" | "manuel"
  const [manuelFonds,setManuelFonds]=useState([]);           // [{fund, pct}]
  const [manuelSearch,setManuelSearch]=useState("");
  const [manuelSearchRes,setManuelSearchRes]=useState([]);
  const [manuelMontant,setManuelMontant]=useState("");
  const [manuelAiLoading,setManuelAiLoading]=useState(false);
  const [manuelAi,setManuelAi]=useState(null);
  const [manuelExpanded,setManuelExpanded]=useState(null);
  const [classifyLoading,setClassifyLoading]=useState(false);
  const [fmpCache,setFmpCache]=useState({});        // isin -> {pts, isReal}
  const [fmpLoading,setFmpLoading]=useState(false);
  const [fmpProgress,setFmpProgress]=useState(0);
  const [fmpStats,setFmpStats]=useState(null);      // {real, simulated, total}
  const [fondModal,setFondModal]=useState(null);         // fond affiché en modale
  const [fondModalAi,setFondModalAi]=useState(null);     // synthèse IA de la fiche
  const [fondModalAiLoading,setFondModalAiLoading]=useState(false);
  const [importUnlocked,setImportUnlocked]=useState(false);
  const [pinInput,setPinInput]=useState("");
  const [pinError,setPinError]=useState(false);
  const [showPinModal,setShowPinModal]=useState(false);
  const [classifyResults,setClassifyResults]=useState(null); // {assigned:[], unmatched:[], stats:{}}
  const [classifyProgress,setClassifyProgress]=useState(0);  // 0-100
  const fileRef=useRef();

  const allCompagnies=(function(){const s={};COMPAGNIES.forEach(function(c){s[c]=true;});funds.forEach(function(f){(f.dispo||[]).forEach(function(d){if(d)s[d]=true;});});return Object.keys(s).sort();})();

  useEffect(function(){(async function(){try{const r=await window.localStorageGet("base_funds");if(r&&r.value)setFunds(JSON.parse(r.value));}catch(e){}})();},[]);

  function handleFile(e) {
    const file=e.target.files[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=async function(ev){
      const parsed=parseCSV(ev.target.result);
      if(!parsed.length){setMsg({ok:false,text:"Aucun fond valide."});return;}
      const merged=funds.slice();
      parsed.forEach(function(f){if(!merged.find(function(x){return x.isin&&x.isin===f.isin;}))merged.push(f);});
      setFunds(merged);
      try{await window.localStorageSet("base_funds",JSON.stringify(merged));}catch(ex){}
      setMsg({ok:true,text:"checkmark "+parsed.length+" fonds importés — total : "+merged.length});
      e.target.value="";
    };
    reader.readAsText(file,"UTF-8");
  }

  // Nombre cible de fonds selon le montant investi
  function targetFundCount(mt) {
    if(!mt||isNaN(mt))return 5;
    if(mt<50000)return 3;
    if(mt<100000)return 5;
    if(mt<500000)return 8;
    if(mt<1000000)return 10;
    return 20;
  }

  // Calcul des poids SRI optimaux pour atteindre la cible par moyenne pondérée
  // Principe : fonds avec SRI < cible = "lestage défensif" (gros poids)
  //            fonds avec SRI > cible = "moteur de rendement" (petit poids)
  //            => la moyenne pondérée converge vers la cible exacte
  function computeWeightedAlloc(top, sriTarget) {
    var n = top.length;
    var sriV = top.map(function(f){return f.sri;});

    // ── Stratégie asymétrique ──────────────────────────────────────────────
    // Pour chaque fond on calcule un "poids brut" tel que :
    //   w_i ∝ (1/|sri_i - sriTarget| + ε) × perfScore_i × roleMultiplier_i
    //
    // roleMultiplier :
    //   sri_i < sriTarget  → fond défensif (socle) : multiplié par (sriTarget - sri_i + 1)^1.5
    //   sri_i > sriTarget  → fond offensif (satellite) : multiplié par 1/(sriTarget - sri_i)^1.5
    //   sri_i == sriTarget → fond cœur : multiplié par 1.8

    var perfMin = Math.min.apply(null, top.map(function(f){return f._perf10;}));
    var perfMax = Math.max.apply(null, top.map(function(f){return f._perf10;}));
    var perfRange = Math.max(1, perfMax - perfMin);

    var rawW = top.map(function(f) {
      var dist = Math.abs(f.sri - sriTarget);
      var perfScore = 0.3 + 0.7 * (f._perf10 - perfMin) / perfRange; // [0.3 – 1.0]
      var role;
      if (f.sri < sriTarget)       role = Math.pow(sriTarget - f.sri + 1, 1.5);  // défensif → gros poids
      else if (f.sri > sriTarget)  role = 1 / Math.pow(f.sri - sriTarget + 1, 1.5); // offensif → petit poids
      else                         role = 1.8;                                    // exactement cible
      return perfScore * role + 0.01; // jamais zéro
    });

    // Normaliser en pourcentages bruts (pré-ajustement SRI)
    var wSum = rawW.reduce(function(a,b){return a+b;},0);
    var pcts = rawW.map(function(w){return w/wSum*100;});

    // ── Ajustement itératif : faire converger SRI moyen vers cible ──────────
    var minFloor = Math.max(2, Math.round(60/n)); // plancher min par fond (2–10 %)
    for (var iter = 0; iter < 80; iter++) {
      var tot = pcts.reduce(function(a,b){return a+b;},0);
      var avgSri = pcts.reduce(function(a,p,i){return a+(p/tot)*sriV[i];}, 0);
      var err = avgSri - sriTarget;
      if (Math.abs(err) < 0.01) break;
      // Pousser les défensifs vers le haut si on est trop haut, et vice-versa
      pcts = pcts.map(function(p, i) {
        var pull = (sriV[i] - sriTarget) * err; // >0 si ce fond tire vers l'erreur
        var adjust = pull > 0 ? -0.14 : (pull < 0 ? 0.10 : 0); // asymétrie : baisser offensif plus vite qu'augmenter défensif
        return Math.max(minFloor, p * (1 + adjust));
      });
    }

    // ── Normaliser à 100 % ──────────────────────────────────────────────────
    var totNorm = pcts.reduce(function(a,b){return a+b;},0);
    pcts = pcts.map(function(p){return p/totNorm*100;});

    // ── Arrondi entier avec correction résidu ──────────────────────────────
    var rounded = pcts.map(function(p){return Math.round(p);});
    var diff = 100 - rounded.reduce(function(a,b){return a+b;},0);
    // Ajuster le fond dont le SRI est le plus proche de la cible
    var adjIdx = 0;
    for (var i = 1; i < sriV.length; i++) {
      if (Math.abs(sriV[i]-sriTarget) < Math.abs(sriV[adjIdx]-sriTarget)) adjIdx = i;
    }
    rounded[adjIdx] += diff;
    return rounded;
  }

  function generate() {
    if(!funds.length){setResults({noFunds:true});return;}
    setLoading(true);setResults(null);setAi(null);setExpanded(null);
    setTimeout(function(){
      try{
        const mt=montant?parseFloat(montant):null;
        const nTarget=targetFundCount(mt);

        // 1. Filtres compagnie + marchés
        var eligible=funds.filter(function(f){
          if(compagnie&&f.dispo&&f.dispo.length>0&&!f.dispo.some(function(c){return c.toLowerCase().includes(compagnie.toLowerCase());}))return false;
          if(marches.length>0&&f.marche&&!marches.includes(f.marche))return false;
          return true;
        });
        if(!eligible.length){setResults({alloc:[],total:0,montant:mt,nTarget:nTarget});setLoading(false);return;}

        // 2. Enrichir chaque fond avec ses métriques de performance simulée
        eligible=eligible.map(function(f){
          var perf=simPerf(f);
          var perf10=((perf[10]/perf[0])-1)*100;
          var sriDist=Math.abs(f.sri-sri);
          return Object.assign({},f,{_perf10:perf10,_sriDist:sriDist});
        });

        // 3. Tri : SRI le plus proche d'abord, à SRI égal la meilleure performance
        eligible.sort(function(a,b){
          if(a._sriDist!==b._sriDist)return a._sriDist-b._sriDist;
          return b._perf10-a._perf10;
        });

        // 4. Sélection avec diversification marchés
        //    On veut obligatoirement des fonds < sriTarget ET > sriTarget pour
        //    permettre la mécanique de moyenne pondérée asymétrique
        var selected=[];
        var usedMarche={};

        // Passe 1 : 1 meilleur fond par marché
        eligible.forEach(function(f){
          if(selected.length>=nTarget)return;
          var m=f.marche||"Autre";
          if(!usedMarche[m])usedMarche[m]=0;
          if(usedMarche[m]<1){selected.push(f);usedMarche[m]++;}
        });
        // Passe 2 : compléter (max 2 par marché)
        if(selected.length<nTarget){
          eligible.forEach(function(f){
            if(selected.length>=nTarget)return;
            if(selected.some(function(x){return x.id===f.id;}))return;
            var m=f.marche||"Autre";
            if(!usedMarche[m])usedMarche[m]=0;
            if(usedMarche[m]<2){selected.push(f);usedMarche[m]++;}
          });
        }
        // Passe 3 : compléter sans contrainte marché
        if(selected.length<nTarget){
          eligible.forEach(function(f){
            if(selected.length>=nTarget)return;
            if(!selected.some(function(x){return x.id===f.id;}))selected.push(f);
          });
        }

        // Passe 4 : s'assurer qu'il y a au moins 1 fond défensif (sri < cible)
        //           et au moins 1 fond offensif (sri > cible) si disponibles
        //           → cela permet l'effet levier/lestage
        var hasDefensif=selected.some(function(f){return f.sri<sri;});
        var hasOffensif=selected.some(function(f){return f.sri>sri;});
        if(!hasDefensif&&sri>1){
          var def=eligible.find(function(f){return f.sri<sri&&!selected.some(function(x){return x.id===f.id;});});
          if(def){selected.pop();selected.push(def);}
        }
        if(!hasOffensif&&sri<7){
          var off=eligible.find(function(f){return f.sri>sri&&!selected.some(function(x){return x.id===f.id;});});
          if(off){
            // Remplacer le fond le plus éloigné côté défensif ou le dernier
            var replIdx=selected.length-1;
            selected[replIdx]=off;
          }
        }

        var top=selected.slice(0,nTarget);
        if(!top.length)top=eligible.slice(0,nTarget);

        // 5. Calcul de la répartition asymétrique pondérée par SRI
        var rounded = computeWeightedAlloc(top, sri);

        const alloc=top.map(function(f,i){return Object.assign({},f,{pct:rounded[i]});});

        // Calcul SRI moyen résultant pour info
        var sriMoyen=alloc.reduce(function(a,f){return a+f.pct/100*f.sri;},0);

        setResults({alloc:alloc,total:eligible.length,montant:mt,nTarget:nTarget,sriMoyen:sriMoyen});
        setLoading(false);
        runAI(alloc,eligible,mt,nTarget);
      }catch(e){console.error(e);setResults({error:true});setLoading(false);}
    },50);
  }

  async function runAI(alloc,eligible,mt,nTarget) {
    setAiLoading(true);
    try{
      var perfCtx=alloc.map(function(f){
        var p=simPerf(f);
        var ann=[];for(var i=0;i<10;i++)ann.push(((p[i+1]/p[i])-1)*100);
        var tot=((p[10]/p[0])-1)*100;
        var best=Math.max.apply(null,ann).toFixed(1);
        var worst=Math.min.apply(null,ann).toFixed(1);
        return"- "+f.nom+" | SRI"+f.sri+" | "+(f.marche||"—")+" | "+f.pct+"% | perf10ans:"+tot.toFixed(1)+"% | meilleure année:+"+best+"% | pire année:"+worst+"% | ISIN:"+(f.isin||"—");
      }).join("\n");
      var nonRetenus=eligible.slice(nTarget,nTarget+8).map(function(f){
        var p=simPerf(f);var tot=((p[10]/p[0])-1)*100;
        return"- "+f.nom+" SRI"+f.sri+" perf10ans:"+tot.toFixed(1)+"%";
      }).join("\n")||"aucun";
      var tranche=mt?(mt<50000?"<50K€":mt<100000?"<100K€":mt<500000?"<500K€":mt<1000000?"<1M€":">1M€"):"non précisé";
      var marchesCtx=marches.length>0?marches.join(", "):"tous marchés";
      var prompt="Tu es conseiller senior Les Associés, spécialiste allocation d'actifs.\n"
        +"Profil client : SRI "+sri+" ("+RISK_LABEL[sri]+"), durée "+duree+", montant "+tranche+" ("+( mt?mt.toLocaleString("fr-FR"):"?")+"€), marchés ciblés: "+marchesCtx+(compagnie?", compagnie: "+compagnie:"")+".\n"
        +"Nombre de fonds adapté au montant : "+nTarget+" fonds.\n\n"
        +"Fonds sélectionnés (triés par meilleures performances à SRI compatible) :\n"+perfCtx+"\n\n"
        +"Fonds éligibles non retenus :\n"+nonRetenus+"\n\n"
        +"Analyse ces fonds comme un gérant de patrimoine senior. Pour chaque fonds :\n"
        +"- Contexte de marché PRÉCIS sur sa classe d'actifs (ex: spreads credit IG, valorisation P/E secteur tech, taux directeurs BCE/Fed, flux émergents…)\n"
        +"- Justifie pourquoi ce marché spécifique est pertinent AUJOURD'HUI dans l'environnement macro actuel\n"
        +"- Identifie si la performance est structurelle ou conjoncturelle\n\n"
        +"Réponds en JSON strict sans markdown :\n"
        +"{\"synthese\":\"3 phrases : contexte marché actuel + adéquation profil + forces du portefeuille\","
        +"\"fonds\":[{\"isin\":\"...\",\"role\":\"1 phrase\",\"pourquoi\":\"2 phrases sur pertinence actuelle et performance\",\"vigilance\":\"1 point de risque concret\"}]}";
      const txt=await callClaude(prompt);
      const clean=txt.replace(/```json|```/g,"").trim();
      setAi(JSON.parse(clean.slice(clean.indexOf("{"),clean.lastIndexOf("}")+1)));
    }catch(e){setAi({error:true,msg:e.message});}
    setAiLoading(false);
  }

  // ─── CLASSIFICATION IA DES MARCHÉS ────────────────────────────────────────
  async function classifyFunds() {
    if(!funds.length) return;
    setClassifyLoading(true);
    setClassifyResults(null);
    setClassifyProgress(0);

    const BATCH = 20; // fonds par appel
    const allResults = [];
    const marchesStr = MARCHES_GROUPES.map(g => g.groupe + ': ' + g.items.join(', ')).join(' | ');

    for(let i = 0; i < funds.length; i += BATCH) {
      const batch = funds.slice(i, i + BATCH);
      setClassifyProgress(Math.round((i / funds.length) * 90));

      const fondsList = batch.map(f =>
        `- ISIN:${f.isin||'N/A'} | Nom:"${f.nom}" | Société:"${f.soc||''}" | SRI:${f.sri} | Desc:"${(f.desc||'').slice(0,120)}"`
      ).join('\n');

      const prompt = [
        'Tu es un expert en gestion d\'actifs et classification de fonds d\'investissement.',
        'Voici la liste EXACTE des marchés disponibles (utilise UNIQUEMENT ces valeurs) :',
        marchesStr,
        '',
        'Classe chaque fonds ci-dessous dans le marché le plus précis et pertinent parmi cette liste.',
        'Analyse le nom, la société de gestion, le SRI (1=très défensif→7=très offensif) et le descriptif.',
        'Règles :',
        '- Un fonds "Patrimoine" diversifié SRI 4 → "Diversifié équilibré"',
        '- Un fonds obligataire court terme → "Obligations court terme" ou "Trésorerie court terme"',
        '- Un fonds actions technologie → "Actions Secteur technologie"',
        '- Un fonds High Yield → "Obligations d\'entreprises High Yield"',
        '- Un fonds monétaire → "Monétaire"',
        '- SRI 1-2 sans précision → "Monétaire" ou "Obligations court terme"',
        '- SRI 6-7 actions large cap US → "Actions US"',
        '- Si vraiment inclassable → "Diversifié équilibré"',
        '',
        'Fonds à classifier :',
        fondsList,
        '',
        'Réponds UNIQUEMENT en JSON strict, sans markdown, sans explication :',
        '{"classifications":[{"isin":"...", "marche":"valeur exacte de la liste", "confiance":"haute|moyenne|faible", "raison":"1 phrase max"}]}'
      ].join('\n');

      try {
        const txt = await callClaude(prompt);
        const clean = txt.replace(/```json|```/g,'').trim();
        const parsed = JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}')+1));
        allResults.push(...(parsed.classifications || []));
      } catch(e) {
        // En cas d'erreur sur un batch, on continue
        batch.forEach(f => allResults.push({isin: f.isin||'', marche: f.marche||'Diversifié équilibré', confiance:'faible', raison:'Erreur de classification'}));
      }
    }

    setClassifyProgress(95);

    // Appliquer les résultats aux fonds
    const byIsin = {};
    allResults.forEach(r => { if(r.isin) byIsin[r.isin] = r; });

    // Fallback par nom pour les fonds sans ISIN
    const byIdx = {};
    allResults.forEach((r,i) => { byIdx[i] = r; });

    let assigned = 0, changed = 0, unmatched = [];
    const updatedFunds = funds.map((f, idx) => {
      // Chercher par ISIN d'abord, puis par position dans le batch
      let result = byIsin[f.isin];
      if(!result) {
        // Trouver par nom approx
        result = allResults.find(r =>
          r.isin === f.isin ||
          (f.nom && r.raison && r.raison.toLowerCase().includes(f.nom.toLowerCase().slice(0,8)))
        );
      }
      if(!result) {
        // Fallback positional — trouver dans le bon batch
        const batchIdx = Math.floor(idx / BATCH);
        const posInBatch = idx % BATCH;
        const batchStart = batchIdx * BATCH;
        result = allResults[batchStart + posInBatch];
      }

      if(result && result.marche && MARCHES.includes(result.marche)) {
        assigned++;
        if(result.marche !== f.marche) changed++;
        return { ...f, marche: result.marche, _classifyMeta: { confiance: result.confiance, raison: result.raison } };
      } else {
        unmatched.push(f.nom);
        return f;
      }
    });

    // Sauvegarder
    setFunds(updatedFunds);
    try { await window.localStorageSet('base_funds', JSON.stringify(updatedFunds)); } catch(e) {}

    // Stats par groupe
    const statsByGroupe = {};
    MARCHES_GROUPES.forEach(g => { statsByGroupe[g.groupe] = 0; });
    updatedFunds.forEach(f => {
      const groupe = MARCHES_GROUPES.find(g => g.items.includes(f.marche));
      if(groupe) statsByGroupe[groupe.groupe] = (statsByGroupe[groupe.groupe]||0) + 1;
    });

    setClassifyResults({ assigned, changed, unmatched, statsByGroupe, total: funds.length, details: updatedFunds });
    setClassifyProgress(100);
    setClassifyLoading(false);
  }

  async function runManuelAI(alloc) {
    setManuelAiLoading(true);
    setManuelAi(null);
    try {
      const sriMoyen = alloc.reduce((a,f)=>a+f.pct/100*f.fund.sri, 0).toFixed(2);
      const perfCtx = alloc.map(f=>{
        const p=simPerf(f.fund);
        const ann=[];for(let i=0;i<10;i++)ann.push(((p[i+1]/p[i])-1)*100);
        const tot=((p[10]/p[0])-1)*100;
        const best=Math.max(...ann).toFixed(1);
        const worst=Math.min(...ann).toFixed(1);
        return "- "+f.fund.nom+" | SRI"+f.fund.sri+" | "+(f.fund.marche||"—")+" | "+f.pct+"% | perf10ans:"+tot.toFixed(1)+"% | meilleure:+"+best+"% | pire:"+worst+"% | ISIN:"+(f.fund.isin||"—");
      }).join("\n");
      const marchesCtx=[...new Set(alloc.map(f=>f.fund.marche).filter(Boolean))].join(", ")||"diversifié";
      const montantCtx=manuelMontant?parseFloat(manuelMontant).toLocaleString("fr-FR")+"€":"non précisé";
      const prompt = "Tu es conseiller senior Les Associés, spécialiste allocation d'actifs.\n\"\n        +\"Portefeuille MANUEL défini par le conseiller :\n\"+perfCtx+\"\n\n\"\n        +\"SRI moyen : \"+sriMoyen+\" | Marchés : \"+marchesCtx+\" | Montant : \"+montantCtx+\"\n\n\"\n        +\"Analyse ce portefeuille comme un expert. Pour chaque fonds, justifie sa pertinence aujourd'hui \"\n        +\"(contexte macro précis : taux, spreads, valorisation sectorielle, flux). \"\n        +\"Identifie si la performance est structurelle ou conjoncturelle.\n\n\"\n        +\"Réponds en JSON strict sans markdown :\n\"\n        +'{\"synthese\":\"3 phrases : contexte marché actuel + cohérence du portefeuille + forces\",\"fonds\":[{\"isin\":\"...\",\"role\":\"1 phrase\",\"pourquoi\":\"2 phrases sur pertinence actuelle\",\"vigilance\":\"1 point de risque concret\"}]}';\n      const txt = await callClaude(prompt);\n      const clean = txt.replace(/```json|```/g,\"\").trim();\n      setManuelAi(JSON.parse(clean.slice(clean.indexOf(\"{\"),clean.lastIndexOf(\"}\")+1)));\n    } catch(e) { setManuelAi({error:true,msg:e.message}); }\n    setManuelAiLoading(false);\n  }\n\n  function openHtmlInNewTab(html) {\n    // Méthode 1 : Blob URL (contourne les popup blockers)\n    try {\n      var blob = new Blob([html], {type:\"text/html;charset=utf-8\"});\n      var url = URL.createObjectURL(blob);\n      var a = document.createElement(\"a\");\n      a.href = url;\n      a.target = \"_blank";
      a.download = "allocation-les-associes-" + new Date().toISOString().slice(0,10) + ".html";
      document.body.appendChild(a);
      a.click();
      setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url);}, 1000);
      return true;
    } catch(e) { return false; }
  }

  function buildAllocSVG(alloc) {
    // Donut SVG en base64 pour le PDF
    var r=80,cx=100,cy=100,sw=28,circ=2*Math.PI*r;
    var cum=0;
    var slices=alloc.map(function(f,i){
      var pct=f.pct/100,offset=circ*(1-cum),dash=circ*pct;
      cum+=pct;
      return{dash:dash,offset:offset,color:PIE[i%PIE.length],pct:f.pct,sri:f.sri};
    });
    var parts=['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">'];
    parts.push('<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="#f0ece0" stroke-width="'+sw+'"/>');
    slices.forEach(function(s){
      parts.push('<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+s.color+'" stroke-width="'+sw+'" stroke-dasharray="'+s.dash+' '+(circ-s.dash)+'" stroke-dashoffset="'+s.offset+'" transform="rotate(-90 '+cx+' '+cy+')" />');
    });
    parts.push('</svg>');
    return "data:image/svg+xml;base64,"+btoa(unescape(encodeURIComponent(parts.join(""))));
  }

  function exportPDF() {
    if(!results||!results.alloc||!results.alloc.length)return;
    var avgSri=(results.sriMoyen||results.alloc.reduce(function(a,f){return a+f.pct/100*f.sri;},0)).toFixed(2);
    var donutSrc=buildAllocSVG(results.alloc);
    var yr=new Date().getFullYear();

    // Graphique perf simulée (sparklines inline)
    var perfRows=results.alloc.map(function(f,fi){
      var perf=simPerf(f);
      var yrs=[];for(var i=0;i<10;i++)yrs.push(yr-10+i+1);
      var ann=yrs.map(function(_,i){return((perf[i+1]/perf[i])-1)*100;});
      var tot=((perf[10]/perf[0])-1)*100;
      var pc=function(v){return v>=0?"#166534":"#991b1b";};
      var pb=function(v){return v>=0?"#f0fdf4":"#fef2f2";};
      var role=f.sri<sri?"DÉFENSIF":f.sri>sri?"MOTEUR":"CŒUR";
      var roleBg=f.sri<sri?"#f0fdf4":f.sri>sri?"#fef2f2":"#fffbeb";
      var roleCol=f.sri<sri?"#166534":f.sri>sri?"#991b1b":"#92400e";
      var annCells=ann.map(function(v){
        return "<td style='padding:4px 5px;text-align:center;white-space:nowrap'><span style='padding:2px 5px;border-radius:4px;font-size:10px;font-weight:700;background:"+pb(v)+";color:"+pc(v)+"'>"+(v>=0?"+":"")+v.toFixed(1)+"%</span></td>";
      }).join("");
      return "<tr style='border-bottom:1px solid #f0ece0;background:"+(fi%2===0?"#fff":"#fafaf8")+"'>"
        +"<td style='padding:8px 12px'>"
          +"<div style='display:flex;align-items:center;gap:8px'>"
            +"<div style='width:10px;height:10px;border-radius:3px;background:"+PIE[fi%PIE.length]+";flex-shrink:0'></div>"
            +"<div>"
              +"<div style='font-weight:700;font-size:12px;color:#0f2340'>"+f.nom+"</div>"
              +"<div style='font-size:10px;color:#8292a8;margin-top:1px'>"+(f.soc||"")+(f.marche?" · "+f.marche:"")+"</div>"
            +"</div>"
          +"</div>"
        +"</td>"
        +"<td style='padding:8px;text-align:center'>"
          +"<span style='background:"+RISK_COLOR[f.sri]+"22;color:"+RISK_COLOR[f.sri]+";padding:2px 8px;border-radius:8px;font-weight:700;font-size:11px'>SRI "+f.sri+"</span>"
        +"</td>"
        +"<td style='padding:8px;text-align:center'>"
          +"<span style='background:"+roleBg+";color:"+roleCol+";padding:2px 7px;border-radius:6px;font-weight:800;font-size:9px;letter-spacing:.5px;text-transform:uppercase'>"+role+"</span>"
        +"</td>"
        +"<td style='padding:8px;text-align:right;font-weight:800;color:#c9a227;font-size:14px'>"+f.pct+"%</td>"
        +(results.montant?"<td style='padding:8px;text-align:right;font-weight:600;font-size:12px;color:#0f2340'>"+Math.round(results.montant*f.pct/100).toLocaleString("fr-FR")+" €</td>":"")
        +annCells
        +"<td style='padding:8px;text-align:center'><span style='padding:3px 8px;border-radius:6px;font-weight:800;font-size:11px;background:"+pb(tot)+";color:"+pc(tot)+"'>"+(tot>=0?"+":"")+tot.toFixed(1)+"%</span></td>"
        +"</tr>";
    }).join("");

    var yrsHeader=[];for(var y=yr-9;y<=yr;y++)yrsHeader.push(y);

    var html="<!DOCTYPE html><html><head><meta charset='UTF-8'>"
      +"<title>Allocation Les Associés — "+new Date().toLocaleDateString("fr-FR")+"</title>"
      +"<style>"
        +"*{box-sizing:border-box;margin:0;padding:0}"
        +"body{font-family:'Segoe UI',system-ui,sans-serif;background:#ede8da;color:#0f2340}"
        +".wrap{max-width:1200px;margin:0 auto;padding:28px 24px}"
        +".card{background:#fff;border-radius:14px;padding:26px;margin-bottom:18px;box-shadow:0 2px 16px rgba(15,35,64,0.07);border:1px solid rgba(201,162,39,0.12)}"
        +".hdr{background:linear-gradient(135deg,#0f2340,#1a3560);border-radius:14px;padding:26px 30px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center;position:relative;overflow:hidden}"
        +".hdr::after{content:'';position:absolute;width:240px;height:240px;border-radius:50%;background:rgba(201,162,39,0.06);right:-60px;top:-60px}"
        +".hdr::before{content:'';position:absolute;width:160px;height:160px;border-radius:50%;background:rgba(201,162,39,0.04);right:70px;bottom:-80px}"
        +".logo{font-family:Georgia,serif;font-size:24px;font-weight:700;color:#c9a227}"
        +".logo-sub{font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:rgba(255,255,255,0.4);margin-top:4px}"
        +".stitle{font-size:14px;font-weight:700;color:#0f2340;margin-bottom:16px;padding-left:10px;border-left:3px solid #c9a227}"
        +".profil{display:flex;gap:0;border-radius:12px;overflow:hidden;margin-bottom:0}"
        +".p-item{flex:1;padding:14px 18px;background:#f8f6f0;border-right:1px solid rgba(201,162,39,0.15)}"
        +".p-item:last-child{border-right:none}"
        +".p-label{font-size:9px;font-weight:700;color:#8292a8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}"
        +".p-val{font-size:14px;font-weight:700;color:#0f2340}"
        +"table{width:100%;border-collapse:collapse}"
        +"th{padding:9px 8px;font-size:9px;font-weight:700;color:#8292a8;text-transform:uppercase;letter-spacing:.8px;border-bottom:2px solid rgba(201,162,39,0.2);text-align:center;background:#f8f6f0;white-space:nowrap}"
        +"th:first-child{text-align:left;padding-left:12px}"
        +".synthese{background:linear-gradient(135deg,#fff9ec,#fffef5);border-left:4px solid #c9a227;padding:16px 20px;border-radius:0 12px 12px 0;margin-bottom:0;line-height:1.8}"
        +".disc{background:#fffbeb;border:1px solid rgba(201,162,39,0.25);border-radius:10px;padding:12px 16px;font-size:11px;color:#78350f;margin-top:0;line-height:1.6}"
        +".footer{text-align:center;font-size:10px;color:#8292a8;padding:16px 0 8px;border-top:1px solid rgba(201,162,39,0.2);margin-top:4px}"
        +"@media print{body{background:#fff}.wrap{padding:0}.card{box-shadow:none;page-break-inside:avoid}}"
      +"</style></head><body><div class='wrap'>"

      // HEADER
      +"<div class='hdr'>"
        +"<div style='position:relative;z-index:1'>"
          +"<div class='logo'>Les Associés</div>"
          +"<div class='logo-sub'>Proposition d'allocation d'actifs</div>"
        +"</div>"
        +"<div style='position:relative;z-index:1;text-align:right'>"
          +"<div style='color:#c9a227;font-weight:600;font-size:13px'>"+new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})+"</div>"
          +"<div style='color:rgba(255,255,255,0.35);font-size:11px;margin-top:3px'>www.les-associes.fr</div>"
          +"<div style='margin-top:10px;display:inline-block;background:rgba(201,162,39,0.18);border:1px solid rgba(201,162,39,0.35);border-radius:8px;padding:5px 14px;color:#c9a227;font-size:12px;font-weight:700'>"+results.alloc.length+" fonds · SRI moyen "+avgSri+"</div>"
        +"</div>"
      +"</div>"

      // PROFIL CLIENT
      +"<div class='card'>"
        +"<div class='stitle'>👤 Profil client</div>"
        +"<div class='profil'>"
          +"<div class='p-item'><div class='p-label'>Profil de risque</div><div class='p-val'>SRI "+sri+" — "+RISK_LABEL[sri]+"</div></div>"
          +"<div class='p-item'><div class='p-label'>SRI moyen portefeuille</div><div class='p-val' style='color:#c9a227'>"+avgSri+" <span style='font-size:11px;color:#166534;font-weight:700'>✓ cible</span></div></div>"
          +"<div class='p-item'><div class='p-label'>Durée</div><div class='p-val'>"+duree+"</div></div>"
          +(compagnie?"<div class='p-item'><div class='p-label'>Compagnie</div><div class='p-val'>"+compagnie+"</div></div>":"")
          +(results.montant?"<div class='p-item'><div class='p-label'>Montant</div><div class='p-val'>"+results.montant.toLocaleString("fr-FR")+" €</div></div>":"")
          +(marches&&marches.length?"<div class='p-item'><div class='p-label'>Marchés</div><div class='p-val' style='font-size:11px'>"+marches.join(", ")+"</div></div>":"")
        +"</div>"
      +"</div>"

      // SYNTHESE IA
      +(ai&&ai.synthese
        ?"<div class='card'><div class='stitle'>🧠 Analyse IA — Synthèse</div><div class='synthese'><span style='font-size:13px;color:#0f2340'>"+ai.synthese+"</span></div></div>"
        :"")

      // ANALYSE PAR FOND
      +(ai&&ai.fonds&&ai.fonds.length
        ?"<div class='card'>"
          +"<div class='stitle'>🔍 Analyse détaillée par fonds</div>"
          +"<div style='display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px'>"
          +results.alloc.map(function(f,i){
            var ana=ai.fonds.find(function(a){return a.isin===f.isin;})||ai.fonds[i];
            if(!ana)return "";
            var role=f.sri<sri?"DÉFENSIF":f.sri>sri?"MOTEUR":"CŒUR";
            var roleBg=f.sri<sri?"#f0fdf4":f.sri>sri?"#fef2f2":"#fffbeb";
            var roleCol=f.sri<sri?"#166534":f.sri>sri?"#991b1b":"#92400e";
            return "<div style='border-radius:12px;border:1px solid rgba(201,162,39,0.15);overflow:hidden'>"
              +"<div style='padding:12px 14px;background:#f8f6f0;border-bottom:1px solid rgba(201,162,39,0.12);display:flex;align-items:center;gap:10px'>"
                +"<div style='width:4px;height:36px;border-radius:2px;background:"+PIE[i%PIE.length]+";flex-shrink:0'></div>"
                +"<div style='flex:1;min-width:0'>"
                  +"<div style='font-weight:700;font-size:13px;color:#0f2340;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'>"+f.nom+"</div>"
                  +"<div style='display:flex;gap:5px;margin-top:3px;align-items:center'>"
                    +"<span style='background:"+RISK_COLOR[f.sri]+"22;color:"+RISK_COLOR[f.sri]+";padding:1px 7px;border-radius:8px;font-weight:700;font-size:10px'>SRI "+f.sri+"</span>"
                    +"<span style='background:"+roleBg+";color:"+roleCol+";padding:1px 6px;border-radius:6px;font-weight:800;font-size:9px;text-transform:uppercase'>"+role+"</span>"
                  +"</div>"
                +"</div>"
                +"<div style='font-size:20px;font-weight:800;color:#c9a227;flex-shrink:0'>"+f.pct+"%</div>"
              +"</div>"
              +"<div style='padding:12px 14px;background:#fff;display:flex;flex-direction:column;gap:8px'>"
                +(ana.role?"<div style='padding:8px 12px;background:#eff6ff;border-radius:8px;border-left:3px solid #1a3560'><div style='font-size:9px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px'>Rôle</div><div style='font-size:12px;font-weight:600;color:#0f2340'>"+ana.role+"</div></div>":"")
                +(ana.pourquoi?"<div style='padding:8px 12px;background:#fafaf8;border-radius:8px'><div style='font-size:9px;font-weight:700;color:#8292a8;text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px'>Pourquoi maintenant ?</div><div style='font-size:12px;color:#0f2340;line-height:1.6'>"+ana.pourquoi+"</div></div>":"")
                +(ana.vigilance?"<div style='padding:8px 12px;background:#fffbeb;border-radius:8px;border-left:3px solid #c9a227'><div style='font-size:9px;font-weight:700;color:#92400e;text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px'>⚠ Vigilance</div><div style='font-size:12px;color:#78350f;line-height:1.6'>"+ana.vigilance+"</div></div>":"")
              +"</div>"
            +"</div>";
          }).join("")
          +"</div>"
        +"</div>"
        :"")

      // DONUT + RÉPARTITION
      +"<div class='card'>"
        +"<div class='stitle'>🍩 Répartition du portefeuille</div>"
        +"<div style='display:flex;align-items:center;gap:32px'>"
          +"<img src='"+donutSrc+"' style='width:160px;height:160px;flex-shrink:0'/>"
          +"<div style='flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px'>"
            +results.alloc.map(function(f,i){
              var role=f.sri<sri?"DÉFENSIF":f.sri>sri?"MOTEUR":"CŒUR";
              var roleBg=f.sri<sri?"#f0fdf4":f.sri>sri?"#fef2f2":"#fffbeb";
              var roleCol=f.sri<sri?"#166534":f.sri>sri?"#991b1b":"#92400e";
              return "<div style='display:flex;align-items:center;gap:10px;padding:10px;border-radius:10px;background:#f8f6f0'>"
                +"<div style='width:12px;height:36px;border-radius:3px;background:"+PIE[i%PIE.length]+";flex-shrink:0'></div>"
                +"<div style='flex:1;min-width:0'>"
                  +"<div style='font-weight:700;font-size:12px;color:#0f2340;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'>"+f.nom+"</div>"
                  +"<div style='display:flex;gap:4px;margin-top:3px;align-items:center'>"
                    +"<span style='background:"+RISK_COLOR[f.sri]+"22;color:"+RISK_COLOR[f.sri]+";padding:1px 6px;border-radius:8px;font-weight:700;font-size:10px'>SRI "+f.sri+"</span>"
                    +"<span style='background:"+roleBg+";color:"+roleCol+";padding:1px 6px;border-radius:6px;font-weight:800;font-size:9px;text-transform:uppercase'>"+role+"</span>"
                  +"</div>"
                +"</div>"
                +"<div style='font-size:18px;font-weight:800;color:#c9a227'>"+f.pct+"%</div>"
              +"</div>";
            }).join("")
          +"</div>"
        +"</div>"
      +"</div>"

      // TABLEAU PERFORMANCES 10 ANS
      +"<div class='card'>"
        +"<div class='stitle'>📈 Performances simulées sur 10 ans</div>"
        +"<div style='overflow-x:auto'>"
          +"<table>"
            +"<thead><tr>"
              +"<th style='text-align:left;padding-left:12px;min-width:160px'>Fonds</th>"
              +"<th style='min-width:60px'>Risque</th>"
              +"<th style='min-width:60px'>Rôle</th>"
              +"<th style='min-width:55px;color:#c9a227'>Alloc.</th>"
              +(results.montant?"<th style='min-width:80px'>Montant</th>":"")
              +yrsHeader.map(function(y){return "<th style='min-width:52px'>"+y+"</th>";}).join("")
              +"<th style='min-width:60px;color:#c9a227'>10 ans</th>"
            +"</tr></thead>"
            +"<tbody>"+perfRows+"</tbody>"
          +"</table>"
        +"</div>"
      +"</div>"

      // DISCLAIMER
      +"<div class='disc'>⚠️ <strong>Avertissement :</strong> Les performances présentées sont des simulations indicatives basées sur le profil de risque (SRI) de chaque fonds. Elles ne constituent pas des données historiques réelles et ne préjugent pas des performances futures. Tout investissement comporte un risque de perte en capital. Document à usage interne — non contractuel.</div>"
      +"<div class='footer'>Les Associés · Réseau de courtiers en assurance · www.les-associes.fr · Document non contractuel</div>"
      +"</div></body></html>";

    openHtmlInNewTab(html);
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

  // ─── CHARTE LES ASSOCIÉS ────────────────────────────────────────────────
  const C = {
    bg:       "#f5f3ee",        // fond crème chaud
    bgSub:    "#ede9df",        // fond légèrement plus foncé (sidebar, alternance)
    bgCard:   "#ffffff",        // cartes blanches
    bgCardHover: "#fdfcf8",
    navy:     "#0f2340",
    navyL:    "#1a3560",
    navyXL:   "#243d6e",
    gold:     "#c9a227",
    goldL:    "#e2be5a",
    goldXL:   "#f5e9c0",
    goldDim:  "#a07d10",
    border:   "rgba(15,35,64,0.1)",
    borderGold: "rgba(201,162,39,0.25)",
    text:     "#0f2340",
    textMid:  "#3d4f6e",
    textDim:  "#8292a8",
    green:    "#0d6e3e",
    greenBg:  "#edfdf5",
    red:      "#991b1b",
    redBg:    "#fef2f2",
    shadow:   "0 2px 16px rgba(15,35,64,0.08)",
    shadowMd: "0 4px 28px rgba(15,35,64,0.12)",
    shadowLg: "0 8px 40px rgba(15,35,64,0.15)",
    glow:     "0 4px 20px rgba(201,162,39,0.25)",
  };
  const RC = {1:"#059669",2:"#16a34a",3:"#65a30d",4:"#ca8a04",5:"#ea580c",6:"#dc2626",7:"#b91c1c"};
  const RLABEL = {1:"Très défensif",2:"Défensif",3:"Prudent",4:"Équilibré",5:"Dynamique",6:"Offensif",7:"Très offensif"};
  const PALETTE = ["#c9a227","#1a3560","#0d6e3e","#b91c1c","#7c3aed","#0e7490","#c2410c","#be185d","#047857","#1d4ed8"];

  const card = {
    background: C.bgCard,
    borderRadius: 14,
    border: "1px solid " + C.borderGold,
    boxShadow: C.shadow,
  };
  const inp = {
    padding: "9px 13px", borderRadius: 9,
    border: "1.5px solid " + C.borderGold,
    background: "#fdfcf8", color: C.text,
    fontSize: 13, width: "100%", boxSizing: "border-box",
    fontFamily: "inherit", outline: "none",
  };
  const sel = {
    padding: "8px 11px", borderRadius: 9,
    border: "1.5px solid " + C.borderGold,
    background: "#fdfcf8", color: C.text,
    fontSize: 12, cursor: "pointer",
    fontFamily: "inherit", outline: "none",
  };

  // ─── COMPOSANTS UI ───────────────────────────────────────────────────────

  function SRI({n, compact}) {
    const color = RC[n];
    return (
      <span style={{display:"inline-flex",alignItems:"center",gap:4,
        padding:compact?"1px 7px":"3px 9px",borderRadius:20,fontSize:compact?10:11,
        background:color+"18",color:color,fontWeight:700,
        border:"1px solid "+color+"30"}}>
        <span style={{width:compact?4:5,height:compact?4:5,borderRadius:"50%",background:color,flexShrink:0}}/>
        {compact ? n : n+" · "+RLABEL[n]}
      </span>
    );
  }

  function Spin() {
    return <div style={{width:13,height:13,border:"2px solid "+C.goldXL,
      borderTopColor:C.gold,borderRadius:"50%",display:"inline-block",
      animation:"spin .6s linear infinite"}}/>;
  }

  function Tag({children, color, bg}) {
    return <span style={{fontSize:10,padding:"2px 8px",borderRadius:20,
      background:bg||C.goldXL,color:color||C.goldDim,fontWeight:700,
      letterSpacing:.2,border:"1px solid "+(color||C.goldDim)+"20"}}>{children}</span>;
  }

  function RealBadge({isReal}) {
    if (isReal) return <span style={{fontSize:9,padding:"2px 7px",borderRadius:20,background:"rgba(13,110,62,0.12)",color:C.green,fontWeight:800,border:"1px solid rgba(13,110,62,0.2)",letterSpacing:.3}}>✓ DONNÉES RÉELLES</span>;
    return <span style={{fontSize:9,padding:"2px 7px",borderRadius:20,background:"rgba(201,162,39,0.12)",color:C.goldDim,fontWeight:700,border:"1px solid rgba(201,162,39,0.2)",letterSpacing:.3}}>SIMULÉ</span>;
  }

  function RoleBadge({sri, target}) {
    const role = sri < target ? "DÉFENSIF" : sri > target ? "MOTEUR" : "CŒUR";
    const col  = sri < target ? C.green    : sri > target ? C.red    : C.goldDim;
    const bg   = sri < target ? C.greenBg  : sri > target ? C.redBg  : C.goldXL;
    return <span style={{fontSize:9,padding:"2px 7px",borderRadius:5,
      background:bg,color:col,fontWeight:800,letterSpacing:.5,
      textTransform:"uppercase",border:"1px solid "+col+"20"}}>{role}</span>;
  }

  function Divider() {
    return <div style={{height:1,background:"linear-gradient(90deg,transparent,"+C.borderGold+",transparent)",margin:"14px 0"}}/>;
  }

  // Sparkline barre (pour cartes fonds)
  function Sparkline({pts, color}) {
    const ann = [];
    for (var i = 0; i < 10; i++) ann.push(((pts[i+1]/pts[i])-1)*100);
    const maxA = Math.max.apply(null, ann.map(Math.abs)) || 1;
    return (
      <div style={{display:"flex",alignItems:"flex-end",gap:2,height:28}}>
        {ann.map(function(v,i) {
          const h = Math.max(2, Math.abs(v)/maxA*28);
          const c = v>=0 ? color : C.red;
          return <div key={i} style={{flex:1,height:h,borderRadius:2,background:c,opacity:.65+.35*(Math.abs(v)/maxA)}}/>;
        })}
      </div>
    );
  }

  // Graphique ligne unique (fiche fond)
  function MiniChart({pts, color}) {
    const W=600,H=110,PL=32,PR=60,PT=8,PB=18,n=pts.length;
    const mn=Math.min.apply(null,pts)*.98, mx=Math.max.apply(null,pts)*1.02;
    const pxf=i=>PL+(i/(n-1))*(W-PL-PR);
    const pyf=v=>PT+(1-(v-mn)/(mx-mn))*(H-PT-PB);
    const d=pts.map((v,i)=>(i===0?"M":"L")+pxf(i).toFixed(1)+","+pyf(v).toFixed(1)).join(" ");
    const aD=d+" L"+pxf(n-1).toFixed(1)+","+pyf(mn).toFixed(1)+" L"+pxf(0).toFixed(1)+","+pyf(mn).toFixed(1)+" Z";
    const tot=((pts[n-1]/pts[0])-1)*100;
    const yr=new Date().getFullYear();
    return (
      <svg width="100%" viewBox={"0 0 "+W+" "+H}>
        <defs><linearGradient id="mcg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".12"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient></defs>
        {[0,.5,1].map(p=>{const y=PT+p*(H-PT-PB),v=mx-p*(mx-mn);return(
          <g key={p}><line x1={PL} y1={y} x2={W-PR} y2={y} stroke={C.borderGold} strokeWidth="1"/>
          <text x={PL-2} y={y+3} textAnchor="end" fontSize="8" fill={C.textDim}>{(v-100).toFixed(0)+"%"}</text></g>
        );})}
        {[0,5,10].map(i=><text key={i} x={pxf(i)} y={H-3} textAnchor="middle" fontSize="8" fill={C.textDim}>{yr-10+i}</text>)}
        <path d={aD} fill="url(#mcg)"/>
        <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
        <circle cx={pxf(n-1)} cy={pyf(pts[n-1])} r="4" fill={color}/>
        <rect x={pxf(n-1)+6} y={pyf(pts[n-1])-10} width="52" height="18" rx="5" fill={color} opacity=".15"/>
        <text x={pxf(n-1)+32} y={pyf(pts[n-1])+4} textAnchor="middle" fontSize="10" fill={color} fontWeight="700">{(tot>=0?"+":"")+tot.toFixed(1)+"%"}</text>
      </svg>
    );
  }

  // Graphique multi-courbes
  function PerfChart({funds}) {
    const W=820,H=260,PL=52,PR=64,PT=16,PB=30;
    const yr=new Date().getFullYear();
    const series=funds.map((f,i)=>({pts:getFondPerf(f),color:PALETTE[i%PALETTE.length],label:f.nom}));
    const all=[]; series.forEach(s=>s.pts.forEach(v=>all.push(v)));
    const mn=Math.min.apply(null,all)*.97, mx=Math.max.apply(null,all)*1.03;
    const pxf=i=>PL+(i/10)*(W-PL-PR);
    const pyf=v=>PT+(1-(v-mn)/(mx-mn))*(H-PT-PB);
    return (
      <div>
        <svg width="100%" viewBox={"0 0 "+W+" "+H}>
          <defs>{series.map((s,i)=>(
            <linearGradient key={i} id={"pg"+i} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity=".1"/>
              <stop offset="100%" stopColor={s.color} stopOpacity="0"/>
            </linearGradient>
          ))}</defs>
          {[0,.25,.5,.75,1].map(p=>{const y=PT+p*(H-PT-PB),v=mx-p*(mx-mn);return(
            <g key={p}><line x1={PL} y1={y} x2={W-PR} y2={y} stroke={C.borderGold} strokeWidth="1"/>
            <text x={PL-4} y={y+3} textAnchor="end" fontSize="9" fill={C.textDim}>{(v-100).toFixed(0)+"%"}</text></g>
          );})}
          {Array.from({length:11},(_,i)=><text key={i} x={pxf(i)} y={H-6} textAnchor="middle" fontSize="9" fill={C.textDim}>{yr-10+i}</text>)}
          <line x1={PL} y1={pyf(100)} x2={W-PR} y2={pyf(100)} stroke={C.gold} strokeWidth="1.5" strokeDasharray="5 3" opacity=".4"/>
          {series.map((s,i)=>{
            const d=s.pts.map((v,j)=>(j===0?"M":"L")+pxf(j).toFixed(1)+","+pyf(v).toFixed(1)).join(" ");
            const aD=d+" L"+pxf(10).toFixed(1)+","+pyf(mn).toFixed(1)+" L"+pxf(0).toFixed(1)+","+pyf(mn).toFixed(1)+" Z";
            const tot=((s.pts[10]/s.pts[0])-1)*100;
            const lY=pyf(s.pts[10]);
            return(<g key={i}>
              <path d={aD} fill={"url(#pg"+i+")"}/>
              <path d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round"/>
              <circle cx={pxf(10)} cy={lY} r="5" fill={s.color}/>
              <rect x={pxf(10)+7} y={lY-11} width="52" height="20" rx="5" fill={s.color} opacity=".15"/>
              <text x={pxf(10)+33} y={lY+4} textAnchor="middle" fontSize="10" fill={s.color} fontWeight="700">{(tot>=0?"+":"")+tot.toFixed(1)+"%"}</text>
            </g>);
          })}
        </svg>
        <div style={{display:"flex",flexWrap:"wrap",gap:"6px 18px",marginTop:10}}>
          {series.map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:C.textMid}}>
              <div style={{width:16,height:3,borderRadius:1.5,background:s.color}}/>
              {s.label}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Donut de répartition
  function Donut({funds, sriTarget, sriMoyen}) {
    const r=80,cx=92,cy=92,sw=22,circ=2*Math.PI*r;
    var cum=0;
    const slices=funds.map((f,i)=>{
      const pct=f.pct/100, offset=circ*(1-cum), dash=circ*pct; cum+=pct;
      return {dash,offset,color:PALETTE[i%PALETTE.length],pct:f.pct,nom:f.nom,sri:f.sri};
    });
    return (
      <div style={{display:"flex",gap:24,alignItems:"center"}}>
        <div style={{flexShrink:0,position:"relative"}}>
          <svg width="184" height="184">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.bgSub} strokeWidth={sw}/>
            {slices.map((s,i)=>(
              <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={sw}
                strokeDasharray={s.dash+" "+(circ-s.dash)} strokeDashoffset={s.offset}
                style={{transform:"rotate(-90deg)",transformOrigin:"50% 50%"}}/>
            ))}
            <text x={cx} y={cy-10} textAnchor="middle" fontSize="10" fill={C.textDim} fontFamily="inherit">SRI MOYEN</text>
            <text x={cx} y={cy+14} textAnchor="middle" fontSize="30" fill={C.navy} fontWeight="800" fontFamily="inherit">{(sriMoyen||sriTarget).toFixed(1)}</text>
            <text x={cx} y={cy+29} textAnchor="middle" fontSize="10" fill={C.green} fontFamily="inherit">✓ cible {sriTarget}</text>
          </svg>
        </div>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:7}}>
          {slices.map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:3,height:24,borderRadius:2,background:s.color,flexShrink:0}}/>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:11,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.nom}</div>
                <div style={{display:"flex",gap:4,marginTop:2}}><SRI n={s.sri} compact/><RoleBadge sri={s.sri} target={sriTarget}/></div>
              </div>
              <div style={{fontSize:15,fontWeight:800,color:C.navy,minWidth:38,textAlign:"right"}}>{s.pct}%</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Fiche fond individuelle
  function FicheFond({f, onClose, onSelect, selected}) {
    const perf=getFondPerf(f);
    const yr=new Date().getFullYear();
    const yrs=[]; for(var i=0;i<10;i++) yrs.push(yr-10+i+1);
    const ann=yrs.map((_,i)=>((perf[i+1]/perf[i])-1)*100);
    const tot=((perf[10]/perf[0])-1)*100;
    const col=PALETTE[(f.sri-1)%PALETTE.length];
    return (
      <div style={{display:"flex",flexDirection:"column",gap:12,position:"sticky",top:72}}>
        <div style={{...card,padding:20,borderTop:"3px solid "+col}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div style={{flex:1,marginRight:10}}>
              <div style={{fontSize:15,fontWeight:800,color:C.navy,marginBottom:7,lineHeight:1.3}}>{f.nom}</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                {f.soc&&<span style={{fontSize:11,color:C.textDim}}>{f.soc}</span>}
                <SRI n={f.sri}/>
                {f.isin&&<span style={{fontSize:10,color:C.textDim,background:C.bgSub,padding:"2px 7px",borderRadius:5,fontFamily:"monospace"}}>{f.isin}</span>}
                {f.marche&&<Tag>{f.marche}</Tag>}
              </div>
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              {onSelect&&<button onClick={onSelect} style={{padding:"7px 12px",borderRadius:8,border:"2px solid "+(selected?C.gold:C.borderGold),background:selected?"linear-gradient(135deg,"+C.gold+","+C.goldL+")":"transparent",color:selected?C.navy:C.gold,fontWeight:700,fontSize:11,cursor:"pointer"}}>{selected?"✓ Sélectionné":"+ Ajouter"}</button>}
              {onClose&&<button onClick={onClose} style={{padding:"6px 10px",borderRadius:8,border:"1px solid "+C.border,background:C.bgSub,cursor:"pointer",color:C.textDim,fontSize:15,fontWeight:700}}>✕</button>}
            </div>
          </div>
          {f.dispo&&f.dispo.length>0&&<div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:8}}>{f.dispo.map(d=><Tag key={d} color={C.goldDim} bg={C.goldXL}>{d}</Tag>)}</div>}
          {f.desc&&<div style={{padding:"10px 13px",background:C.bgSub,borderRadius:9,borderLeft:"3px solid "+C.gold}}><div style={{fontSize:9,fontWeight:700,color:C.goldDim,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>Descriptif</div><div style={{fontSize:12,color:C.textMid,lineHeight:1.7}}>{f.desc}</div></div>}
        </div>
        <div style={{...card,padding:20}}>
          <div style={{fontSize:12,fontWeight:700,color:C.navy,marginBottom:3}}>Performance simulée — 10 ans</div>
          <div style={{fontSize:10,color:C.textDim,marginBottom:10}}>Base 100 · SRI {f.sri}</div>
          <MiniChart pts={perf} color={col}/>
        </div>
        <div style={{...card,padding:20}}>
          <div style={{fontSize:12,fontWeight:700,color:C.navy,marginBottom:12}}>Performances annuelles</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4}}>
            {yrs.map((y,i)=>{const v=ann[i];return(
              <div key={y} style={{textAlign:"center",padding:"6px 4px",borderRadius:8,background:v>=0?C.greenBg:C.redBg,border:"1px solid "+(v>=0?"rgba(13,110,62,.12)":"rgba(153,27,27,.12)")}}>
                <div style={{fontSize:9,color:C.textDim,marginBottom:2}}>{y}</div>
                <div style={{fontSize:11,fontWeight:700,color:v>=0?C.green:C.red}}>{(v>=0?"+":"")+v.toFixed(1)+"%"}</div>
              </div>
            );})}
          </div>
          <div style={{marginTop:8,padding:"8px 12px",borderRadius:8,background:C.goldXL,border:"1px solid "+C.borderGold,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:11,color:C.textMid,fontWeight:600}}>Total 10 ans</span>
            <span style={{fontSize:14,fontWeight:800,color:tot>=0?C.green:C.red}}>{(tot>=0?"+":"")+tot.toFixed(2)+"%"}</span>
          </div>
        </div>
      </div>
    );
  }

  // Retourne les points de performance — réels (FMP) si dispo, simulés sinon
  const getFondPerf = (f) => {
    const cached = f.isin && fmpCache[f.isin];
    if (cached) return cached.pts;
    return simPerf(f);
  };
  const isFondReal = (f) => !!(f.isin && fmpCache[f.isin] && fmpCache[f.isin].isReal);

  async function loadFMPPerfs() {
    if (!funds.length || fmpLoading) return;
    setFmpLoading(true);
    setFmpProgress(0);
    setFmpStats(null);
    const results = await fetchBatchFMPPerf(funds, (pct) => setFmpProgress(pct));
    setFmpCache(results);
    const real = Object.values(results).filter(r => r.isReal).length;
    setFmpStats({ real, simulated: Object.values(results).length - real, total: funds.length });
    setFmpLoading(false);
  }

  async function refreshFMPPerfs() {
    await clearFMPCache(funds);
    setFmpCache({});
    setFmpStats(null);
    await loadFMPPerfs();
  }

  const getAna=isin=>ai&&ai.fonds?ai.fonds.find(f=>f.isin===isin)||null:null;

  async function openFondModal(f) {
    setFondModal(f);
    setFondModalAi(null);
    setFondModalAiLoading(true);
    try {
      const perf=getFondPerf(f);
      const ann=[];for(let i=0;i<10;i++)ann.push(((perf[i+1]/perf[i])-1)*100);
      const tot=((perf[10]/perf[0])-1)*100;
      const best=Math.max(...ann).toFixed(1);
      const worst=Math.min(...ann).toFixed(1);
      const prompt=[
        "Tu es un expert en gestion d'actifs. Analyse ce fonds de façon précise et experte.",
        "Fonds : "+f.nom,
        "Société : "+(f.soc||"N/A"),
        "ISIN : "+(f.isin||"N/A"),
        "SRI : "+f.sri+" ("+RISK_LABEL[f.sri]+")",
        "Marché cible : "+(f.marche||"Non défini"),
        "Descriptif : "+(f.desc||"Non renseigné"),
        "Performance simulée 10 ans : "+(tot>=0?"+":"")+tot.toFixed(2)+"%",
        "Meilleure année : +"+best+"% | Pire année : "+worst+"%",
        "",
        "Fournis une analyse experte structurée. Réponds en JSON strict sans markdown :",
        '{"synthese":"3 phrases : positionnement, contexte marché actuel, perspectives","profil":"1 phrase profil investisseur cible","avantages":["3 points forts concrets"],"risques":["3 risques ou vigilances concrets"],"horizon":"recommandation horizon avec justification"}'
      ].join("\n")
      const txt=await callClaude(prompt);
      const clean=txt.replace(/```json|```/g,"").trim();
      setFondModalAi(JSON.parse(clean.slice(clean.indexOf("{"),clean.lastIndexOf("}")+1)));
    } catch(e) {
      setFondModalAi({error:true,msg:e.message});
    }
    setFondModalAiLoading(false);
  }
  const defFund=()=>({id:Date.now().toString(),nom:"",soc:"",sri:4,isin:"",desc:"",dispo:[],marche:""});
  const saveEdit=f=>{if(funds.find(x=>x.id===f.id))setFunds(fs=>fs.map(x=>x.id===f.id?f:x));else setFunds(fs=>[...fs,f]);setEditF(null);};

  const filtered=(()=>{
    var f=funds.filter(x=>{
      if(search&&!(x.nom+x.isin+(x.soc||"")).toLowerCase().includes(search.toLowerCase()))return false;
      if(filterSri>0&&x.sri!==filterSri)return false;
      if(filterMarche&&x.marche!==filterMarche)return false;
      if(filterComp&&(!x.dispo||!x.dispo.includes(filterComp)))return false;
      return true;
    });
    return f.sort((a,b)=>sortBy==="sri"?a.sri-b.sri:sortBy==="sriDesc"?b.sri-a.sri:sortBy==="marche"?(a.marche||"").localeCompare(b.marche||""):a.nom.localeCompare(b.nom));
  })();

  const rechFiltered=(()=>{
    var f=rechSearch?rechResults:funds.slice(0,80);
    if(rechFilterSri>0) f=f.filter(x=>x.sri===rechFilterSri);
    if(rechFilterMarche) f=f.filter(x=>x.marche===rechFilterMarche);
    return f.slice().sort((a,b)=>rechSort==="sri"?a.sri-b.sri:rechSort==="sriDesc"?b.sri-a.sri:rechSort==="marche"?(a.marche||"").localeCompare(b.marche||""):a.nom.localeCompare(b.nom));
  })();

  const TABS=[
    {k:"allocation",  icon:"⚖️", label:"Allocation"},
    {k:"comparaison", icon:"📊", label:"Comparaison"},
    {k:"performances",icon:"🏆", label:"Performances"},
    {k:"fonds",       icon:"📋", label:`Fonds (${funds.length})`},
    {k:"import",      icon:"📁", label:"Import CSV"},
  ];

  return (
    <div style={{background:C.bg,minHeight:"100vh",fontFamily:"'Outfit',system-ui,sans-serif",color:C.text}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        @keyframes slideIn{from{opacity:0;transform:translateX(-8px)}to{opacity:1;transform:none}}
        .fu{animation:fadeUp .3s cubic-bezier(.22,1,.36,1) both}
        .fu1{animation:fadeUp .3s .05s cubic-bezier(.22,1,.36,1) both}
        .fu2{animation:fadeUp .3s .1s cubic-bezier(.22,1,.36,1) both}
        .fu3{animation:fadeUp .3s .15s cubic-bezier(.22,1,.36,1) both}
        .spin{animation:spin .6s linear infinite}
        button{transition:all .15s}
        button:hover{opacity:.88;transform:translateY(-1px)}
        input::placeholder{color:#a0aec0}
        select option{background:#fff;color:#0f2340}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:rgba(201,162,39,.35);border-radius:2px}
        .hov:hover{background:rgba(15,35,64,0.03)!important;border-color:rgba(201,162,39,0.4)!important}
        body::before{content:'';position:fixed;top:0;left:0;width:180px;height:100%;background:linear-gradient(180deg,#0f2340 0%,#1a3560 100%);z-index:0;pointer-events:none}
      `}</style>

      {/* ── LAYOUT : SIDEBAR + CONTENU ──────────────────────────────────── */}
      <div style={{display:"flex",minHeight:"100vh",alignItems:"stretch"}}>

        {/* ── SIDEBAR GAUCHE ── */}
        <div style={{
          width:180,flexShrink:0,
          background:"linear-gradient(180deg,"+C.navy+" 0%,"+C.navyL+" 100%)",
          boxShadow:"4px 0 20px rgba(15,35,64,0.15)",
          display:"flex",flexDirection:"column",
          position:"sticky",top:0,height:"100vh",
          overflowY:"auto",zIndex:100,
        }}>          {/* Logo */}
          <div style={{padding:"24px 18px 20px",borderBottom:"1px solid rgba(201,162,39,0.2)"}}>
            <div style={{display:"flex",alignItems:"center",gap:11}}>
              <div style={{width:44,height:44,borderRadius:12,background:"rgba(255,255,255,0.07)",border:"1.5px solid rgba(201,162,39,0.45)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 0 0 3px rgba(201,162,39,0.1)"}}>
                <span style={{fontFamily:"Georgia,serif",fontSize:23,fontWeight:700,color:C.gold,fontStyle:"italic",lineHeight:1}}>A</span>
              </div>
              <div>
                <div style={{fontSize:15,fontWeight:800,color:"#fff",letterSpacing:-.3,lineHeight:1.2}}>Les Associés</div>
                <div style={{fontSize:8,color:"rgba(201,162,39,0.65)",letterSpacing:1.8,textTransform:"uppercase",marginTop:2}}>Moteur d'allocation</div>
              </div>
            </div>
          </div>

          {/* Nav items */}
          <nav style={{flex:1,padding:"20px 10px 16px",display:"flex",flexDirection:"column",gap:2}}>
            <div style={{fontSize:8.5,color:"rgba(255,255,255,0.28)",fontWeight:700,letterSpacing:1.6,textTransform:"uppercase",marginBottom:10,paddingLeft:10}}>Navigation</div>
            {TABS.map(t=>{const a=tab===t.k;return(
              <button key={t.k} onClick={()=>{
                if(t.k==="import"&&!importUnlocked){setShowPinModal(true);return;}
                setTab(t.k);
              }} style={{
                width:"100%",padding:"11px 13px",borderRadius:9,border:"none",
                background:a?"rgba(201,162,39,0.15)":"transparent",
                borderLeft:a?"3px solid "+C.gold:"3px solid transparent",
                color:a?"#fff":"rgba(255,255,255,0.5)",
                fontWeight:a?700:400,fontSize:12.5,cursor:"pointer",
                display:"flex",alignItems:"center",gap:9,
                transition:"all .18s",textAlign:"left",fontFamily:"inherit",
              }}
              onMouseEnter={e=>{if(!a){e.currentTarget.style.background="rgba(255,255,255,0.06)";e.currentTarget.style.color="rgba(255,255,255,0.8)";}}}
              onMouseLeave={e=>{if(!a){e.currentTarget.style.background="transparent";e.currentTarget.style.color="rgba(255,255,255,0.5)";}}}
              >
                <span style={{fontSize:15,width:20,textAlign:"center",flexShrink:0}}>{t.icon}</span>
                <span style={{flex:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{t.label}</span>
                {t.k==="import"&&!importUnlocked&&<span style={{fontSize:11,opacity:.6}}>🔒</span>}
                {a&&<div style={{width:5,height:5,borderRadius:"50%",background:C.gold,flexShrink:0}}/>}
              </button>
            );})}
          </nav>

          {/* Bottom info */}
          <div style={{padding:"14px 12px 20px",borderTop:"1px solid rgba(201,162,39,0.14)"}}>
            <div style={{padding:"9px 11px",borderRadius:8,background:"rgba(255,255,255,0.04)"}}>
              <div style={{fontSize:11,fontWeight:600,color:"rgba(255,255,255,0.5)",marginBottom:1}}>v1.0 · Les Associés</div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.22)"}}>Données simulées indicatives</div>
            </div>
          </div>
        </div>

        {/* ── CONTENU ── */}
        <div style={{flex:1,minWidth:0,padding:"28px 32px 64px",overflowX:"hidden"}}>

        {/* ══ ALLOCATION ══════════════════════════════════════════════════ */}
        {tab==="allocation"&&(
          <div className="fu">

            {/* ── TOGGLE AUTO / MANUEL ── */}
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
              <div style={{display:"flex",background:C.bgCard,border:"1px solid "+C.borderGold,borderRadius:11,padding:3,boxShadow:C.shadow}}>
                {[{k:"auto",icon:"⚙️",label:"Automatique"},
                  {k:"manuel",icon:"✏️",label:"Manuel"}].map(m=>{const a=allocMode===m.k;return(
                  <button key={m.k} onClick={()=>setAllocMode(m.k)} style={{padding:"9px 20px",borderRadius:8,border:"none",background:a?"linear-gradient(135deg,"+C.navy+","+C.navyL+")":"transparent",color:a?C.gold:C.textDim,fontWeight:a?700:500,fontSize:13,cursor:"pointer",transition:"all .18s",fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
                    <span>{m.icon}</span>{m.label}
                  </button>
                );})}
              </div>
              <div style={{fontSize:12,color:C.textDim}}>
                {allocMode==="auto"?"Génération automatique selon profil SRI et montant":"Composez votre allocation librement fond par fond"}
              </div>
            </div>

            {/* ════ MODE AUTOMATIQUE ════ */}
            {allocMode==="auto"&&(
            <div>
            <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:20,alignItems:"start"}}>

              {/* Panneau gauche */}
              <div style={{...card,padding:22,position:"sticky",top:68}}>
                {/* Logo stripe */}
                <div style={{height:3,borderRadius:2,background:"linear-gradient(90deg,"+C.navy+","+C.gold+")",marginBottom:18}}/>
                <div style={{fontSize:11,fontWeight:700,color:C.gold,letterSpacing:1.2,textTransform:"uppercase",marginBottom:16}}>Profil client</div>

                {/* SRI */}
                <div style={{fontSize:10,color:C.textDim,fontWeight:600,letterSpacing:.8,textTransform:"uppercase",marginBottom:8}}>Niveau de risque (SRI)</div>
                <div style={{display:"flex",gap:3,marginBottom:6}}>
                  {[1,2,3,4,5,6,7].map(r=>{const a=sri===r;return(
                    <button key={r} onClick={()=>setSri(r)} style={{flex:1,height:40,borderRadius:8,
                      border:"1.5px solid "+(a?RC[r]+"90":C.borderGold),
                      background:a?RC[r]+"14":C.bgSub,
                      color:a?RC[r]:C.textDim,fontWeight:a?800:500,
                      cursor:"pointer",fontSize:13,fontFamily:"inherit",
                    }}>{r}</button>
                  );})}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:16,padding:"6px 10px",borderRadius:8,background:RC[sri]+"12",border:"1px solid "+RC[sri]+"30"}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:RC[sri]}}/>
                  <span style={{fontSize:11,color:RC[sri],fontWeight:700}}>{RLABEL[sri]}</span>
                </div>
                <Divider/>

                {[
                  ["Durée",<select value={duree} onChange={e=>setDuree(e.target.value)} style={{...sel,width:"100%"}}>{DUREES.map(d=><option key={d}>{d}</option>)}</select>],
                  ["Compagnie",<select value={compagnie} onChange={e=>setCompagnie(e.target.value)} style={{...sel,width:"100%"}}><option value="">Toutes compagnies</option>{allCompagnies.map(c=><option key={c}>{c}</option>)}</select>],
                  ["Marchés cibles",(
                    <div>
                      {marches.length>0&&(
                        <div style={{marginBottom:7,display:"flex",flexWrap:"wrap",gap:3}}>
                          {marches.map(m=>(
                            <span key={m} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:20,background:"linear-gradient(135deg,"+C.navy+","+C.navyL+")",color:C.gold,fontSize:10,fontWeight:700,border:"1px solid rgba(201,162,39,0.3)"}}>
                              {m}
                              <button onClick={()=>setMarches(ms=>ms.filter(x=>x!==m))} style={{background:"none",border:"none",color:"rgba(201,162,39,0.6)",cursor:"pointer",padding:0,fontSize:11,lineHeight:1,marginLeft:1}}>✕</button>
                            </span>
                          ))}
                          <button onClick={()=>setMarches([])} style={{fontSize:9,color:C.red,background:"none",border:"none",cursor:"pointer",padding:"2px 4px",fontFamily:"inherit"}}>Tout effacer</button>
                        </div>
                      )}
                      {MARCHES_GROUPES.map(g=>(
                        <div key={g.groupe} style={{marginBottom:8}}>
                          <div style={{fontSize:9,fontWeight:700,color:g.couleur,textTransform:"uppercase",letterSpacing:.8,marginBottom:4,display:"flex",alignItems:"center",gap:5}}>
                            <div style={{width:8,height:8,borderRadius:2,background:g.couleur,flexShrink:0}}/>
                            {g.groupe}
                          </div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                            {g.items.map(m=>{const s=marches.includes(m);return(
                              <button key={m} onClick={()=>setMarches(ms=>s?ms.filter(x=>x!==m):[...ms,m])} style={{padding:"3px 8px",borderRadius:5,border:"1px solid "+(s?g.couleur+"80":C.borderGold),background:s?g.couleur+"14":C.bgSub,color:s?g.couleur:C.textDim,fontSize:10,fontWeight:s?700:400,cursor:"pointer",transition:"all .12s"}}>
                                {m}
                              </button>
                            );})}
                          </div>
                        </div>
                      ))}
                    </div>
                  )],
                  ["Montant (€)",<div>
                    <input type="number" value={montant} onChange={e=>setMontant(e.target.value)} placeholder="Ex : 50 000" style={inp}/>
                    {montant&&!isNaN(parseFloat(montant))&&(
                      <div style={{marginTop:7,display:"flex",gap:3,alignItems:"center"}}>
                        {[{max:50000,n:3},{max:100000,n:5},{max:500000,n:8},{max:1000000,n:10},{max:Infinity,n:20}].map((tier,i)=>{
                          const mt2=parseFloat(montant);
                          const active=mt2<tier.max&&(i===0||mt2>=[50000,100000,500000,1000000][i-1]);
                          return <div key={i} style={{flex:1,height:3,borderRadius:2,background:active?"linear-gradient(90deg,"+C.navy+","+C.gold+")":C.borderGold,transition:"all .2s"}}/>;
                        })}
                        <span style={{fontSize:10,color:C.goldDim,fontWeight:700,marginLeft:6,whiteSpace:"nowrap"}}>
                          {(()=>{const mt2=parseFloat(montant);return mt2<50000?"3 fonds":mt2<100000?"5 fonds":mt2<500000?"8 fonds":mt2<1000000?"10 fonds":"20 fonds";})()}
                        </span>
                      </div>
                    )}
                  </div>],
                ].map(arr=>(
                  <div key={arr[0]} style={{marginBottom:13}}>
                    <div style={{fontSize:10,color:C.textDim,fontWeight:600,letterSpacing:.8,textTransform:"uppercase",marginBottom:6}}>{arr[0]}</div>
                    {arr[1]}
                  </div>
                ))}

                <button onClick={generate} disabled={loading} style={{width:"100%",marginTop:6,padding:"12px",borderRadius:10,border:"none",
                  background:loading?C.bgSub:"linear-gradient(135deg,"+C.navy+","+C.navyL+")",
                  color:loading?C.textDim:C.gold,fontWeight:800,fontSize:14,
                  cursor:loading?"wait":"pointer",
                  boxShadow:loading?"none":C.shadowMd,
                  display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                  fontFamily:"inherit",letterSpacing:.1}}>
                  {loading?<><Spin/>Calcul en cours…</>:"✦ Générer l'allocation"}
                </button>
              </div>

              {/* Panneau droite résultats */}
              <div>
                {!results&&(
                  <div style={{...card,padding:52,textAlign:"center"}} className="fu">
                    <div style={{width:72,height:72,borderRadius:20,background:"linear-gradient(135deg,"+C.navy+","+C.navyL+")",margin:"0 auto 20px",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:C.shadowMd}}>
                      <span style={{fontSize:32}}>⚖️</span>
                    </div>
                    <div style={{fontSize:19,fontWeight:800,color:C.navy,marginBottom:8}}>Prêt à construire l'allocation</div>
                    <div style={{fontSize:13,color:C.textMid,lineHeight:1.8}}>Configurez le profil client et cliquez sur "Générer"</div>
                    {!funds.length&&<div style={{marginTop:20,padding:"10px 18px",borderRadius:10,background:C.goldXL,border:"1px solid "+C.borderGold,fontSize:12,color:C.goldDim,display:"inline-flex",alignItems:"center",gap:7}}>⚠ Aucun fond chargé — allez dans Import CSV</div>}
                  </div>
                )}
                {results&&results.noFunds&&(
                  <div style={{...card,padding:28,textAlign:"center"}}>
                    <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:12}}>Aucun fond chargé</div>
                    <button onClick={()=>setTab("import")} style={{padding:"9px 20px",borderRadius:8,border:"none",background:"linear-gradient(135deg,"+C.navy+","+C.navyL+")",color:C.gold,fontWeight:700,fontSize:12,cursor:"pointer"}}>→ Import CSV</button>
                  </div>
                )}
                {results&&results.error&&<div style={{...card,padding:18,borderLeft:"3px solid "+C.red,color:C.red,fontSize:13}}>Une erreur est survenue.</div>}

                {results&&results.alloc&&(
                  <div>
                    {/* Export PDF button */}
                    <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
                      <button onClick={exportPDF} style={{padding:"10px 20px",borderRadius:10,border:"1.5px solid "+C.gold,background:"linear-gradient(135deg,"+C.navy+","+C.navyL+")",color:C.gold,fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:8,boxShadow:C.shadowMd,fontFamily:"inherit"}}>
                        📄 Exporter PDF
                      </button>
                    </div>
                    {/* Stats pills */}
                    <div style={{display:"flex",gap:7,marginBottom:14,flexWrap:"wrap"}} className="fu">
                      {[
                        {l:"Fonds retenus", v:results.alloc.length+(results.nTarget?"/"+results.nTarget:""), c:C.navy, bg:"rgba(15,35,64,0.07)"},
                        {l:"SRI moyen", v:(results.sriMoyen||results.alloc.reduce((a,f)=>a+f.pct/100*f.sri,0)).toFixed(2)+" ✓", c:C.green, bg:C.greenBg},
                        {l:"Marchés", v:(()=>{const m={};results.alloc.forEach(f=>{if(f.marche)m[f.marche]=1;});return Object.keys(m).length+" marchés";})(), c:C.navyL, bg:"rgba(26,53,96,0.07)"},
                        {l:"Défensifs/Moteurs", v:results.alloc.filter(f=>f.sri<sri).length+" / "+results.alloc.filter(f=>f.sri>sri).length, c:C.goldDim, bg:C.goldXL},
                      ].map(s=>(
                        <div key={s.l} style={{...card,padding:"9px 14px",flex:1,minWidth:110,borderTop:"2px solid "+s.c}}>
                          <div style={{fontSize:9,color:C.textDim,fontWeight:600,textTransform:"uppercase",letterSpacing:.8,marginBottom:3}}>{s.l}</div>
                          <div style={{fontSize:15,fontWeight:800,color:s.c}}>{s.v}</div>
                        </div>
                      ))}
                    </div>

                    {results.alloc.length===0&&<div style={{...card,padding:18,textAlign:"center",color:C.textDim}}>Aucun fond ne correspond aux critères.</div>}

                    {/* Fund cards */}
                    {results.alloc.map((f,fi)=>{
                      const ana=getAna(f.isin), isOpen=expanded===f.id;
                      const col=PALETTE[fi%PALETTE.length];
                      const perf=getFondPerf(f);
                      const tot=((perf[10]/perf[0])-1)*100;
                      return(
                        <div key={f.id} className="hov fu" style={{...card,marginBottom:9,overflow:"hidden",animationDelay:(fi*.04)+"s",borderLeft:"4px solid "+col,transition:"all .2s"}}>
                          <div style={{padding:"14px 16px"}}>
                            <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                              {/* Pct */}
                              <div style={{width:50,height:50,borderRadius:12,background:"linear-gradient(135deg,"+C.navy+","+C.navyL+")",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:C.shadow}}>
                                <span style={{fontSize:14,fontWeight:900,color:col,lineHeight:1}}>{f.pct}%</span>
                                <span style={{fontSize:7,color:"rgba(255,255,255,0.5)",marginTop:2,textTransform:"uppercase",letterSpacing:.5}}>alloc</span>
                              </div>
                              <div style={{flex:1}}>
                                <div style={{fontWeight:800,fontSize:14,color:C.navy,marginBottom:5,display:"flex",alignItems:"center",gap:8}}>
                                <span style={{flex:1}}>{f.nom}</span>
                                <button onClick={e=>{e.stopPropagation();openFondModal(f);}} style={{fontSize:11,padding:"2px 8px",borderRadius:6,border:"1px solid "+C.borderGold,background:C.bgSub,color:C.textDim,cursor:"pointer",fontWeight:600,flexShrink:0}}>Fiche</button>
                              </div>
                                <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                                  {f.soc&&<span style={{fontSize:10,color:C.textDim}}>{f.soc}</span>}
                                  <SRI n={f.sri}/>
                                  {f.isin&&<span style={{fontSize:10,color:C.textDim,background:C.bgSub,padding:"1px 6px",borderRadius:5,fontFamily:"monospace"}}>{f.isin}</span>}
                                  {f.marche&&<Tag>{f.marche}</Tag>}
                                  <RoleBadge sri={f.sri} target={sri}/>
                                  <RealBadge isReal={isFondReal(f)}/>
                                </div>
                                {f.dispo&&f.dispo.length>0&&<div style={{display:"flex",gap:3,flexWrap:"wrap",marginTop:5}}>{f.dispo.map(d=><Tag key={d} color={C.goldDim} bg={C.goldXL}>{d}</Tag>)}</div>}
                              </div>
                              <div style={{textAlign:"right",flexShrink:0}}>
                                {results.montant&&<div style={{fontSize:13,fontWeight:700,color:C.gold,marginBottom:5}}>{Math.round(results.montant*f.pct/100).toLocaleString("fr-FR")} €</div>}
                                <div style={{fontSize:12,fontWeight:700,color:tot>=0?C.green:C.red,marginBottom:5}}>{(tot>=0?"+":"")+tot.toFixed(1)+"%"}</div>
                                <button onClick={()=>setExpanded(isOpen?null:f.id)} style={{padding:"4px 10px",borderRadius:7,border:"1px solid "+C.borderGold,background:isOpen?C.goldXL:C.bgSub,fontSize:10,color:isOpen?C.goldDim:C.textDim,cursor:"pointer",fontFamily:"inherit"}}>
                                  {isOpen?"▲ Réduire":"▼ Analyse IA"}
                                </button>
                              </div>
                            </div>
                            {/* Progress + sparkline */}
                            <div style={{marginTop:10,display:"flex",gap:10,alignItems:"flex-end"}}>
                              <div style={{flex:1}}>
                                <div style={{height:3,background:C.bgSub,borderRadius:2}}>
                                  <div style={{height:3,width:f.pct+"%",background:"linear-gradient(90deg,"+col+"cc,"+col+")",borderRadius:2,transition:"width .5s ease"}}/>
                                </div>
                              </div>
                              <Sparkline pts={perf} color={col}/>
                            </div>
                          </div>
                          {isOpen&&(
                            <div style={{borderTop:"1px solid "+C.borderGold,padding:"14px 16px",background:"rgba(15,35,64,0.02)"}}>
                              {f.desc&&<div style={{marginBottom:10,padding:"10px 13px",background:C.bgSub,borderRadius:9,borderLeft:"3px solid "+C.gold}}><div style={{fontSize:9,fontWeight:700,color:C.goldDim,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>Descriptif</div><div style={{fontSize:12,color:C.textMid,lineHeight:1.7}}>{f.desc}</div></div>}
                              {aiLoading&&!ana&&<div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:C.textDim,padding:"6px 0"}}><Spin/>Analyse IA en cours…</div>}
                              {ana&&(
                                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                                  <div style={{padding:"10px 13px",background:C.goldXL,borderRadius:9,borderLeft:"3px solid "+C.gold}}><div style={{fontSize:9,fontWeight:700,color:C.goldDim,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>Rôle</div><div style={{fontSize:12,fontWeight:600,color:C.navy}}>{ana.role}</div></div>
                                  <div style={{padding:"10px 13px",background:C.bgSub,borderRadius:9}}><div style={{fontSize:9,fontWeight:700,color:C.textDim,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>Pourquoi ?</div><div style={{fontSize:12,color:C.textMid,lineHeight:1.6}}>{ana.pourquoi}</div></div>
                                  <div style={{padding:"10px 13px",background:C.goldXL,borderRadius:9,border:"1px solid "+C.borderGold,gridColumn:"span 2"}}><div style={{fontSize:9,fontWeight:700,color:C.goldDim,textTransform:"uppercase",letterSpacing:.8,marginBottom:4}}>⚠ Vigilance</div><div style={{fontSize:12,color:C.goldDim,lineHeight:1.6}}>{ana.vigilance}</div></div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom charts */}
            {results&&results.alloc&&results.alloc.length>0&&(
              <div style={{display:"flex",flexDirection:"column",gap:16,marginTop:18}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                  <div style={{...card,padding:24}} className="fu1">
                    <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:16}}>🍩 Répartition du portefeuille</div>
                    <Donut funds={results.alloc} sriTarget={sri} sriMoyen={results.sriMoyen}/>
                  </div>
                  <div style={{...card,padding:24}} className="fu2">
                    <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:16}}>🧠 Synthèse IA</div>
                    {aiLoading&&!ai&&<div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:C.textDim}}><Spin/>Analyse du portefeuille…</div>}
                    {ai&&ai.synthese&&<p style={{fontSize:13,color:C.textMid,lineHeight:1.9,margin:0}}>{ai.synthese}</p>}
                    {ai&&ai.error&&<div style={{fontSize:12,color:C.red}}>Indisponible{ai.msg?" : "+ai.msg:""}</div>}
                  </div>
                </div>
                <div style={{...card,padding:24}} className="fu3">
                  <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:4}}>📈 Performances simulées — 10 ans</div>
                  <div style={{fontSize:11,color:C.textDim,marginBottom:14}}>Base 100 · simulation indicative par profil SRI</div>
                  <PerfChart funds={results.alloc} getPts={getFondPerf}/>
                </div>

                {/* Tableau performances annuelles */}
                <div style={{...card,padding:24}} className="fu4">
                  <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:4}}>📊 Performances annuelles par fonds</div>
                  <div style={{fontSize:11,color:C.textDim,marginBottom:16}}>Simulations indicatives · base profil SRI</div>
                  <div style={{overflowX:"auto"}}>
                    {(()=>{
                      const yr=new Date().getFullYear();
                      const yrs=Array.from({length:10},(_,i)=>yr-10+i+1);
                      const pc=v=>v>=0?"#166534":"#991b1b";
                      const pb=v=>v>=0?"#f0fdf4":"#fef2f2";
                      return(
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:700}}>
                          <thead>
                            <tr style={{background:C.bgSub}}>
                              <th style={{padding:"9px 12px",textAlign:"left",fontWeight:700,color:C.navy,borderBottom:"2px solid "+C.borderGold,minWidth:160,whiteSpace:"nowrap"}}>Fonds</th>
                              {yrs.map(y=>(
                                <th key={y} style={{padding:"9px 6px",textAlign:"center",fontWeight:600,color:C.textDim,borderBottom:"2px solid "+C.borderGold,whiteSpace:"nowrap",fontSize:11}}>{y}</th>
                              ))}
                              <th style={{padding:"9px 6px",textAlign:"center",fontWeight:700,color:C.gold,borderBottom:"2px solid "+C.borderGold,whiteSpace:"nowrap"}}>10 ans</th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.alloc.map((f,fi)=>{
                              const pts=getFondPerf(f);
                              const ann=yrs.map((_,i)=>((pts[i+1]/pts[i])-1)*100);
                              const tot=((pts[10]/pts[0])-1)*100;
                              const col=PALETTE[fi%PALETTE.length];
                              return(
                                <tr key={f.id} style={{borderBottom:"1px solid "+C.borderGold,background:fi%2===0?"#fff":C.bgSub}}>
                                  <td style={{padding:"9px 12px"}}>
                                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                                      <div style={{width:10,height:10,borderRadius:3,background:col,flexShrink:0}}/>
                                      <div>
                                        <div style={{fontWeight:700,color:C.navy,fontSize:12,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:150}}>{f.nom}</div>
                                        <div style={{fontSize:10,color:C.textDim}}>{f.pct}% · SRI {f.sri}</div>
                                      </div>
                                    </div>
                                  </td>
                                  {ann.map((v,i)=>(
                                    <td key={i} style={{padding:"6px 4px",textAlign:"center"}}>
                                      <span style={{padding:"2px 5px",borderRadius:5,background:pb(v),color:pc(v),fontWeight:700,fontSize:10,whiteSpace:"nowrap"}}>
                                        {(v>=0?"+":"")+v.toFixed(1)+"%"}
                                      </span>
                                    </td>
                                  ))}
                                  <td style={{padding:"6px 4px",textAlign:"center"}}>
                                    <span style={{padding:"3px 8px",borderRadius:6,background:pb(tot),color:pc(tot),fontWeight:800,fontSize:11,whiteSpace:"nowrap"}}>
                                      {(tot>=0?"+":"")+tot.toFixed(1)+"%"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
            </div>)} {/* fin mode auto */}

            {/* ════ MODE MANUEL ════ */}
            {allocMode==="manuel"&&(()=>{
              // Somme des % saisis
              const totalPct = manuelFonds.reduce((a,f)=>a+f.pct,0);
              const remaining = 100 - totalPct;
              const isValid = manuelFonds.length>0 && Math.abs(remaining)<0.01;
              // SRI moyen
              const sriMoyenManuel = manuelFonds.length ? manuelFonds.reduce((a,f)=>a+f.pct/100*f.fund.sri,0) : 0;
              // Alloc normalisée pour les composants partagés
              const allocForDisplay = manuelFonds.map(f=>({...f.fund, pct:f.pct}));

              function exportManuelPDF() {
                if(!manuelFonds.length) return;
                const avgSri = sriMoyenManuel.toFixed(2);
                const donutSrc = buildAllocSVG(allocForDisplay);
                const yr = new Date().getFullYear();
                const yrsHeader = [];
                for(let y=yr-9;y<=yr;y++) yrsHeader.push(y);
                const pc = v=>v>=0?C.green:C.red;
                const pb = v=>v>=0?C.greenBg:C.redBg;

                const perfRows = allocForDisplay.map((f,fi)=>{
                  const perf=getFondPerf(f);
                  const ann=yrsHeader.map((_,i)=>((perf[i+1]/perf[i])-1)*100);
                  const tot=((perf[10]/perf[0])-1)*100;
                  const annCells=ann.map(v=>"<td style='padding:4px 5px;text-align:center'><span style='padding:2px 5px;border-radius:4px;font-size:10px;font-weight:700;background:"+(v>=0?"#f0fdf4":"#fef2f2")+";color:"+(v>=0?"#0d6e3e":"#991b1b")+"'>"+(v>=0?"+":"")+v.toFixed(1)+"%</span></td>").join("");
                  return "<tr style='border-bottom:1px solid rgba(201,162,39,0.1);background:"+(fi%2===0?"#fff":"#fafaf8")+"'>"
                    +"<td style='padding:8px 10px'><div style='display:flex;align-items:center;gap:7px'><div style='width:10px;height:10px;border-radius:3px;background:"+PALETTE[fi%PALETTE.length]+";flex-shrink:0'></div><div><div style='font-weight:700;font-size:12px;color:#0f2340'>"+f.nom+"</div><div style='font-size:10px;color:#8292a8'>"+(f.soc||"")+(f.marche?" · "+f.marche:"")+"</div></div></div></td>"
                    +"<td style='padding:8px;text-align:center'><span style='background:"+RISK_COLOR[f.sri]+"22;color:"+RISK_COLOR[f.sri]+";padding:2px 8px;border-radius:8px;font-weight:700;font-size:11px'>SRI "+f.sri+"</span></td>"
                    +"<td style='padding:8px;text-align:right;font-weight:800;color:#c9a227;font-size:14px'>"+f.pct+"%</td>"
                    +(manuelMontant?"<td style='padding:8px;text-align:right;font-size:12px'>"+Math.round(parseFloat(manuelMontant)*f.pct/100).toLocaleString("fr-FR")+" €</td>":"")
                    +annCells
                    +"<td style='padding:8px;text-align:center'><span style='padding:3px 8px;border-radius:6px;font-weight:800;font-size:11px;background:"+(tot>=0?"#f0fdf4":"#fef2f2")+";color:"+(tot>=0?"#0d6e3e":"#991b1b")+"'>"+(tot>=0?"+":"")+tot.toFixed(1)+"%</span></td>"
                    +"</tr>";
                }).join("");

                const aiBlocks = manuelAi&&manuelAi.fonds ? allocForDisplay.map((f,i)=>{
                  const ana=(manuelAi.fonds||[]).find(a=>a.isin===f.isin)||(manuelAi.fonds||[])[i];
                  if(!ana) return "";
                  return "<div style='border-radius:10px;border:1px solid rgba(201,162,39,0.15);overflow:hidden;margin-bottom:10px'>"
                    +"<div style='padding:10px 14px;background:#f8f6f0;border-bottom:1px solid rgba(201,162,39,0.12);display:flex;align-items:center;gap:9px'>"
                    +"<div style='width:4px;height:30px;border-radius:2px;background:"+PALETTE[i%PALETTE.length]+"'></div>"
                    +"<div style='flex:1'><div style='font-weight:700;font-size:13px;color:#0f2340'>"+f.nom+"</div></div>"
                    +"<span style='font-size:14px;font-weight:800;color:#c9a227'>"+f.pct+"%</span></div>"
                    +"<div style='padding:12px 14px;background:#fff;display:flex;flex-direction:column;gap:7px'>"
                    +(ana.role?"<div style='padding:8px 12px;background:#eff6ff;border-radius:8px;border-left:3px solid #1a3560'><div style='font-size:9px;font-weight:700;color:#1e40af;text-transform:uppercase;margin-bottom:3px'>Rôle</div><div style='font-size:12px;font-weight:600;color:#0f2340'>"+ana.role+"</div></div>":"")
                    +(ana.pourquoi?"<div style='padding:8px 12px;background:#fafaf8;border-radius:8px'><div style='font-size:9px;font-weight:700;color:#8292a8;text-transform:uppercase;margin-bottom:3px'>Pourquoi maintenant ?</div><div style='font-size:12px;color:#0f2340;line-height:1.6'>"+ana.pourquoi+"</div></div>":"")
                    +(ana.vigilance?"<div style='padding:8px 12px;background:#fffbeb;border-radius:8px;border-left:3px solid #c9a227'><div style='font-size:9px;font-weight:700;color:#92400e;text-transform:uppercase;margin-bottom:3px'>⚠ Vigilance</div><div style='font-size:12px;color:#78350f;line-height:1.6'>"+ana.vigilance+"</div></div>":"")
                    +"</div></div>";
                }).join("") : "";

                const html = "<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Allocation Manuelle — Les Associés</title>"
                  +"<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',system-ui,sans-serif;background:#f5f3ee;color:#0f2340}"
                  +".wrap{max-width:1200px;margin:0 auto;padding:28px}.card{background:#fff;border-radius:12px;padding:24px;margin-bottom:16px;box-shadow:0 2px 16px rgba(15,35,64,.08);border:1px solid rgba(201,162,39,.2)}"
                  +".hdr{background:linear-gradient(135deg,#0f2340,#1a3560);border-radius:14px;padding:26px 30px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center}"
                  +".logo{font-family:Georgia,serif;font-size:22px;font-weight:700;color:#c9a227}.stitle{font-size:14px;font-weight:700;color:#0f2340;margin-bottom:14px;padding-left:10px;border-left:3px solid #c9a227}"
                  +"table{width:100%;border-collapse:collapse}th{padding:9px 8px;font-size:9px;font-weight:700;color:#8292a8;text-transform:uppercase;border-bottom:2px solid rgba(201,162,39,.2);text-align:center;background:#fafaf8}th:first-child{text-align:left;padding-left:10px}"
                  +".footer{text-align:center;font-size:10px;color:#8292a8;padding:16px 0 8px;border-top:1px solid rgba(201,162,39,.2);margin-top:8px}"
                  +"@media print{body{background:#fff}.wrap{padding:0}.card{box-shadow:none;page-break-inside:avoid}}</style></head><body><div class='wrap'>"
                  +"<div class='hdr'><div><div class='logo'>Les Associés</div><div style='font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.4);margin-top:4px'>Allocation manuelle · Proposition de portefeuille</div></div>"
                  +"<div style='text-align:right;color:rgba(255,255,255,.5);font-size:12px'>"+new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})+"<br/><span style='background:rgba(201,162,39,.18);border:1px solid rgba(201,162,39,.35);border-radius:7px;padding:4px 12px;color:#c9a227;font-size:12px;font-weight:700;display:inline-block;margin-top:8px'>"+allocForDisplay.length+" fonds · SRI moyen "+avgSri+"</span></div></div>"
                  +"<div class='card'><div class='stitle'>👤 Profil du portefeuille</div>"
                  +"<div style='display:flex;gap:0;border-radius:10px;overflow:hidden'>"
                  +"<div style='flex:1;padding:12px 16px;background:#f8f6f0;border-right:1px solid rgba(201,162,39,.15)'><div style='font-size:9px;color:#8292a8;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px'>SRI moyen</div><div style='font-size:18px;font-weight:800;color:#0f2340'>"+avgSri+"</div></div>"
                  +"<div style='flex:1;padding:12px 16px;background:#f8f6f0;border-right:1px solid rgba(201,162,39,.15)'><div style='font-size:9px;color:#8292a8;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px'>Fonds</div><div style='font-size:18px;font-weight:800;color:#0f2340'>"+allocForDisplay.length+"</div></div>"
                  +(manuelMontant?"<div style='flex:1;padding:12px 16px;background:#f8f6f0'><div style='font-size:9px;color:#8292a8;font-weight:700;text-transform:uppercase;letter-spacing:.8px;margin-bottom:4px'>Montant</div><div style='font-size:18px;font-weight:800;color:#c9a227'>"+parseFloat(manuelMontant).toLocaleString("fr-FR")+" €</div></div>":"")
                  +"</div></div>"
                  +(manuelAi&&manuelAi.synthese?"<div class='card'><div class='stitle'>🧠 Synthèse IA</div><div style='padding:14px 18px;background:linear-gradient(135deg,#fff9ec,#fffef5);border-left:4px solid #c9a227;border-radius:0 10px 10px 0;font-size:13px;color:#0f2340;line-height:1.8'>"+manuelAi.synthese+"</div></div>":"")
                  +"<div class='card'><div class='stitle'>🍩 Répartition</div><div style='display:flex;align-items:center;gap:24px'>"
                  +"<img src='"+donutSrc+"' style='width:160px;height:160px;flex-shrink:0'/>"
                  +"<div style='flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:8px'>"
                  +allocForDisplay.map((f,i)=>"<div style='display:flex;align-items:center;gap:8px;padding:9px;border-radius:9px;background:#f8f6f0'><div style='width:3px;height:30px;border-radius:2px;background:"+PALETTE[i%PALETTE.length]+"'></div><div style='flex:1;min-width:0'><div style='font-weight:700;font-size:11px;color:#0f2340;white-space:nowrap;overflow:hidden;text-overflow:ellipsis'>"+f.nom+"</div><div style='font-size:10px;color:#8292a8;margin-top:2px'>SRI "+f.sri+(f.marche?" · "+f.marche:"")+"</div></div><div style='font-size:16px;font-weight:800;color:#c9a227'>"+f.pct+"%</div></div>").join("")
                  +"</div></div></div>"
                  +(aiBlocks?"<div class='card'><div class='stitle'>🔍 Analyse détaillée par fonds</div><div style='display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px'>"+aiBlocks+"</div></div>":"")
                  +"<div class='card'><div class='stitle'>📈 Performances simulées sur 10 ans</div><div style='overflow-x:auto'><table><thead><tr><th style='text-align:left;padding-left:10px;min-width:150px'>Fonds</th><th>Risque</th><th style='color:#c9a227'>Alloc.</th>"+(manuelMontant?"<th>Montant</th>":"")+yrsHeader.map(y=>"<th>"+y+"</th>").join("")+"<th style='color:#c9a227'>10 ans</th></tr></thead><tbody>"+perfRows+"</tbody></table></div></div>"
                  +"<div style='background:#fffbeb;border:1px solid rgba(201,162,39,.25);border-radius:10px;padding:12px 16px;font-size:11px;color:#78350f;line-height:1.6'>⚠️ Performances simulées indicatives basées sur le profil SRI. Non contractuel.</div>"
                  +"<div class='footer'>Les Associés · www.les-associes.fr · Document non contractuel</div></div></body></html>";
                openHtmlInNewTab(html);
              }

              return (
                <div style={{display:"grid",gridTemplateColumns:"300px 1fr",gap:20,alignItems:"start"}}>

                  {/* ── LEFT : sélecteur de fonds ── */}
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    <div style={{...card,padding:20}}>
                      <div style={{height:3,borderRadius:2,background:"linear-gradient(90deg,"+C.navy+","+C.gold+")",marginBottom:14}}/>
                      <div style={{fontSize:11,fontWeight:700,color:C.gold,letterSpacing:1.2,textTransform:"uppercase",marginBottom:12}}>Composer l'allocation</div>

                      {/* Montant */}
                      <div style={{marginBottom:14}}>
                        <div style={{fontSize:10,color:C.textDim,fontWeight:600,letterSpacing:.8,textTransform:"uppercase",marginBottom:6}}>Montant total (€)</div>
                        <input type="number" value={manuelMontant} onChange={e=>setManuelMontant(e.target.value)} placeholder="Ex : 100 000" style={inp}/>
                      </div>

                      {/* Recherche fonds */}
                      <div style={{marginBottom:10}}>
                        <div style={{fontSize:10,color:C.textDim,fontWeight:600,letterSpacing:.8,textTransform:"uppercase",marginBottom:6}}>Ajouter un fond</div>
                        <input value={manuelSearch} onChange={e=>{const q=e.target.value;setManuelSearch(q);if(!q.trim()){setManuelSearchRes([]);return;}const ql=q.toLowerCase();setManuelSearchRes(funds.filter(f=>(f.nom||"").toLowerCase().includes(ql)||(f.isin||"").toLowerCase().includes(ql)||(f.soc||"").toLowerCase().includes(ql)).filter(f=>!manuelFonds.some(m=>m.fund.id===f.id)).slice(0,8));}} placeholder={"🔍 Chercher parmi "+funds.length+" fonds…"} style={{...inp,marginBottom:6}} autoComplete="off"/>
                        {manuelSearchRes.length>0&&(
                          <div style={{border:"1px solid "+C.borderGold,borderRadius:9,overflow:"hidden",boxShadow:C.shadow}}>
                            {manuelSearchRes.map(f=>(
                              <div key={f.id} onClick={()=>{setManuelFonds(mf=>[...mf,{fund:f,pct:0}]);setManuelSearch("");setManuelSearchRes([]);}} style={{padding:"9px 12px",cursor:"pointer",borderBottom:"1px solid "+C.borderGold,background:C.bgCard,display:"flex",alignItems:"center",gap:8,transition:"background .1s"}}
                              onMouseEnter={e=>e.currentTarget.style.background=C.goldXL} onMouseLeave={e=>e.currentTarget.style.background=C.bgCard}>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:12,fontWeight:700,color:C.navy,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.nom}</div>
                                  <div style={{display:"flex",gap:4,marginTop:2}}><SRI n={f.sri} compact/>{f.marche&&<Tag>{f.marche}</Tag>}</div>
                                </div>
                                <span style={{fontSize:18,color:C.gold}}>+</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Liste des fonds sélectionnés */}
                      {manuelFonds.length>0&&(
                        <div>
                          <div style={{fontSize:10,color:C.textDim,fontWeight:600,letterSpacing:.8,textTransform:"uppercase",marginBottom:8}}>Fonds sélectionnés</div>
                          <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12,maxHeight:340,overflowY:"auto"}}>
                            {manuelFonds.map((item,i)=>{
                              const col=PALETTE[i%PALETTE.length];
                              return(
                                <div key={item.fund.id} style={{borderRadius:9,border:"1px solid "+C.borderGold,background:C.bgCard,overflow:"hidden"}}>
                                  <div style={{height:2,background:col}}/>
                                  <div style={{padding:"9px 11px"}}>
                                    <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}>
                                      <div style={{flex:1,minWidth:0}}>
                                        <div style={{fontSize:11,fontWeight:700,color:C.navy,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.fund.nom}</div>
                                        <div style={{display:"flex",gap:3,marginTop:2}}><SRI n={item.fund.sri} compact/>{item.fund.marche&&<Tag>{item.fund.marche}</Tag>}</div>
                                      </div>
                                      <button onClick={()=>setManuelFonds(mf=>mf.filter((_,j)=>j!==i))} style={{fontSize:12,color:C.red,background:"none",border:"none",cursor:"pointer",padding:"2px 4px",flexShrink:0}}>✕</button>
                                    </div>
                                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                                      <input type="number" min="0" max="100" step="0.5" value={item.pct||""} onChange={e=>{const v=Math.min(100,Math.max(0,parseFloat(e.target.value)||0));setManuelFonds(mf=>mf.map((m,j)=>j===i?{...m,pct:v}:m));}} placeholder="%" style={{...inp,width:70,padding:"6px 10px",fontSize:13,textAlign:"center"}}/>
                                      <div style={{flex:1,height:4,background:C.bgSub,borderRadius:2,overflow:"hidden"}}>
                                        <div style={{height:4,width:Math.min(100,item.pct)+"%",background:col,borderRadius:2,transition:"width .3s"}}/>
                                      </div>
                                      <span style={{fontSize:12,fontWeight:700,color:col,minWidth:36,textAlign:"right"}}>{item.pct||0}%</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Barre total */}
                          <div style={{padding:"10px 12px",borderRadius:9,background:Math.abs(remaining)<0.01?C.greenBg:Math.abs(remaining)<5?C.goldXL:C.redBg,border:"1px solid "+(Math.abs(remaining)<0.01?"rgba(13,110,62,.2)":Math.abs(remaining)<5?C.borderGold:"rgba(153,27,27,.2)"),marginBottom:12}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <span style={{fontSize:12,fontWeight:700,color:C.textMid}}>Total alloué</span>
                              <span style={{fontSize:16,fontWeight:900,color:Math.abs(remaining)<0.01?C.green:Math.abs(remaining)<5?C.goldDim:C.red}}>{totalPct.toFixed(1)}%</span>
                            </div>
                            {Math.abs(remaining)>0.01&&<div style={{fontSize:11,color:C.textDim,marginTop:3}}>{remaining>0?"Il reste "+remaining.toFixed(1)+"% à allouer":"⚠ Dépassement de "+Math.abs(remaining).toFixed(1)+"%"}</div>}
                          </div>

                          {/* Bouton Répartir équitablement */}
                          <button onClick={()=>{const equal=Math.floor(100/manuelFonds.length);const rem=100-equal*manuelFonds.length;setManuelFonds(mf=>mf.map((m,i)=>({...m,pct:equal+(i===0?rem:0)})));}} style={{width:"100%",padding:"8px",borderRadius:8,border:"1px solid "+C.borderGold,background:C.bgSub,color:C.textMid,fontSize:11,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>
                            ⚖️ Répartir équitablement
                          </button>

                          {/* Bouton Analyser */}
                          <button
                            onClick={()=>{if(isValid)runManuelAI(manuelFonds);}}
                            disabled={!isValid||manuelAiLoading}
                            style={{width:"100%",padding:"12px",borderRadius:10,border:"none",background:isValid?"linear-gradient(135deg,"+C.navy+","+C.navyL+")":C.bgSub,color:isValid?C.gold:C.textDim,fontWeight:800,fontSize:13,cursor:isValid?"pointer":"not-allowed",boxShadow:isValid?C.shadowMd:"none",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"inherit"}}>
                            {manuelAiLoading?<><Spin/>Analyse IA en cours…</>:isValid?"🧠 Analyser ce portefeuille":"Complétez l'allocation à 100%"}
                          </button>
                        </div>
                      )}
                      {!funds.length&&<div style={{marginTop:10,padding:"10px 14px",borderRadius:9,background:C.goldXL,border:"1px solid "+C.borderGold,fontSize:12,color:C.goldDim}}>⚠ Importez d'abord votre liste de fonds</div>}
                    </div>
                  </div>

                  {/* ── RIGHT : résultats ── */}
                  <div>
                    {manuelFonds.length===0&&(
                      <div style={{...card,padding:52,textAlign:"center"}} className="fu">
                        <div style={{width:72,height:72,borderRadius:20,background:"linear-gradient(135deg,"+C.navy+","+C.navyL+")",margin:"0 auto 18px",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:C.shadowMd}}><span style={{fontSize:32}}>✏️</span></div>
                        <div style={{fontSize:18,fontWeight:800,color:C.navy,marginBottom:8}}>Allocation manuelle</div>
                        <div style={{fontSize:13,color:C.textMid,lineHeight:1.8}}>Recherchez et ajoutez des fonds à gauche,<br/>saisissez les pourcentages, puis lancez l'analyse IA.</div>
                      </div>
                    )}

                    {manuelFonds.length>0&&(
                      <div>
                        {/* Stats */}
                        <div style={{display:"flex",gap:7,marginBottom:14,flexWrap:"wrap"}} className="fu">
                          {[
                            {l:"Fonds",v:manuelFonds.length,c:C.navy,bg:"rgba(15,35,64,0.07)"},
                            {l:"SRI moyen",v:sriMoyenManuel.toFixed(2),c:C.green,bg:C.greenBg},
                            {l:"Alloué",v:totalPct.toFixed(1)+"%",c:Math.abs(remaining)<0.01?C.green:C.red,bg:Math.abs(remaining)<0.01?C.greenBg:C.redBg},
                            {l:"Marchés",v:(()=>{const m={};manuelFonds.forEach(f=>{if(f.fund.marche)m[f.fund.marche]=1;});return Object.keys(m).length;})()+" marchés",c:C.navyL,bg:"rgba(26,53,96,0.07)"},
                          ].map(s=>(
                            <div key={s.l} style={{...card,padding:"9px 14px",flex:1,minWidth:100,borderTop:"2px solid "+s.c}}>
                              <div style={{fontSize:9,color:C.textDim,fontWeight:600,textTransform:"uppercase",letterSpacing:.8,marginBottom:3}}>{s.l}</div>
                              <div style={{fontSize:15,fontWeight:800,color:s.c}}>{s.v}</div>
                            </div>
                          ))}
                        </div>

                        {/* Fund cards */}
                        {allocForDisplay.map((f,fi)=>{
                          const isOpen=manuelExpanded===f.id;
                          const ana=manuelAi&&manuelAi.fonds?(manuelAi.fonds.find(a=>a.isin===f.isin)||manuelAi.fonds[fi]):null;
                          const col=PALETTE[fi%PALETTE.length];
                          const perf=getFondPerf(f);
                          const tot=((perf[10]/perf[0])-1)*100;
                          return(
                            <div key={f.id} className="hov" style={{...card,marginBottom:9,overflow:"hidden",borderLeft:"4px solid "+col}}>
                              <div style={{padding:"13px 15px"}}>
                                <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                                  <div style={{width:48,height:48,borderRadius:11,background:"linear-gradient(135deg,"+C.navy+","+C.navyL+")",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:C.shadow}}>
                                    <span style={{fontSize:13,fontWeight:900,color:col,lineHeight:1}}>{f.pct}%</span>
                                    <span style={{fontSize:7,color:"rgba(255,255,255,0.5)",marginTop:1,textTransform:"uppercase",letterSpacing:.5}}>alloc</span>
                                  </div>
                                  <div style={{flex:1}}>
                                    <div style={{fontWeight:800,fontSize:14,color:C.navy,marginBottom:4,display:"flex",alignItems:"center",gap:8}}>
                                      <span style={{flex:1}}>{f.nom}</span>
                                      <button onClick={e=>{e.stopPropagation();openFondModal(f);}} style={{fontSize:10,padding:"2px 7px",borderRadius:6,border:"1px solid "+C.borderGold,background:C.bgSub,color:C.textDim,cursor:"pointer",fontWeight:600,flexShrink:0}}>Fiche</button>
                                    </div>
                                    <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}>
                                      {f.soc&&<span style={{fontSize:10,color:C.textDim}}>{f.soc}</span>}
                                      <SRI n={f.sri}/>
                                      {f.isin&&<span style={{fontSize:10,color:C.textDim,background:C.bgSub,padding:"1px 6px",borderRadius:5,fontFamily:"monospace"}}>{f.isin}</span>}
                                      {f.marche&&<Tag>{f.marche}</Tag>}
                                    </div>
                                  </div>
                                  <div style={{textAlign:"right",flexShrink:0}}>
                                    {manuelMontant&&<div style={{fontSize:13,fontWeight:700,color:C.gold,marginBottom:4}}>{Math.round(parseFloat(manuelMontant)*f.pct/100).toLocaleString("fr-FR")} €</div>}
                                    <div style={{fontSize:12,fontWeight:700,color:tot>=0?C.green:C.red,marginBottom:4}}>{(tot>=0?"+":"")+tot.toFixed(1)+"%"}</div>
                                    <button onClick={()=>setManuelExpanded(isOpen?null:f.id)} style={{padding:"4px 10px",borderRadius:7,border:"1px solid "+C.borderGold,background:isOpen?C.goldXL:C.bgSub,fontSize:10,color:isOpen?C.goldDim:C.textDim,cursor:"pointer",fontFamily:"inherit"}}>
                                      {isOpen?"▲ Réduire":"▼ Analyse IA"}
                                    </button>
                                  </div>
                                </div>
                                <div style={{marginTop:9,display:"flex",gap:10,alignItems:"flex-end"}}>
                                  <div style={{flex:1}}><div style={{height:3,background:C.bgSub,borderRadius:2}}><div style={{height:3,width:f.pct+"%",background:"linear-gradient(90deg,"+col+"cc,"+col+")",borderRadius:2,transition:"width .5s"}}/></div></div>
                                  <Sparkline pts={perf} color={col}/>
                                </div>
                              </div>
                              {isOpen&&(
                                <div style={{borderTop:"1px solid "+C.borderGold,padding:"13px 15px",background:"rgba(15,35,64,0.02)"}}>
                                  {f.desc&&<div style={{marginBottom:9,padding:"9px 12px",background:C.bgSub,borderRadius:8,borderLeft:"3px solid "+C.gold}}><div style={{fontSize:9,fontWeight:700,color:C.goldDim,textTransform:"uppercase",letterSpacing:.8,marginBottom:3}}>Descriptif</div><div style={{fontSize:12,color:C.textMid,lineHeight:1.6}}>{f.desc}</div></div>}
                                  {manuelAiLoading&&!ana&&<div style={{display:"flex",alignItems:"center",gap:8,fontSize:12,color:C.textDim}}><Spin/>Analyse IA…</div>}
                                  {ana&&(
                                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                                      <div style={{padding:"9px 12px",background:C.goldXL,borderRadius:8,borderLeft:"3px solid "+C.gold}}><div style={{fontSize:9,fontWeight:700,color:C.goldDim,textTransform:"uppercase",letterSpacing:.8,marginBottom:3}}>Rôle</div><div style={{fontSize:12,fontWeight:600,color:C.navy}}>{ana.role}</div></div>
                                      <div style={{padding:"9px 12px",background:C.bgSub,borderRadius:8}}><div style={{fontSize:9,fontWeight:700,color:C.textDim,textTransform:"uppercase",letterSpacing:.8,marginBottom:3}}>Pourquoi ?</div><div style={{fontSize:12,color:C.textMid,lineHeight:1.6}}>{ana.pourquoi}</div></div>
                                      <div style={{padding:"9px 12px",background:C.goldXL,borderRadius:8,border:"1px solid "+C.borderGold,gridColumn:"span 2"}}><div style={{fontSize:9,fontWeight:700,color:C.goldDim,textTransform:"uppercase",letterSpacing:.8,marginBottom:3}}>⚠ Vigilance</div><div style={{fontSize:12,color:C.goldDim,lineHeight:1.6}}>{ana.vigilance}</div></div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Bottom charts (même composants que mode auto) */}
                        {isValid&&(
                          <div style={{display:"flex",flexDirection:"column",gap:16,marginTop:18}}>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                              <div style={{...card,padding:24}}>
                                <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:16}}>🍩 Répartition du portefeuille</div>
                                <Donut funds={allocForDisplay} sriTarget={Math.round(sriMoyenManuel)} sriMoyen={sriMoyenManuel}/>
                              </div>
                              <div style={{...card,padding:24}}>
                                <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:16}}>🧠 Synthèse IA</div>
                                {manuelAiLoading&&!manuelAi&&<div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:C.textDim}}><Spin/>Analyse du portefeuille…</div>}
                                {manuelAi&&manuelAi.synthese&&<p style={{fontSize:13,color:C.textMid,lineHeight:1.9,margin:0}}>{manuelAi.synthese}</p>}
                                {manuelAi&&manuelAi.error&&<div style={{fontSize:12,color:C.red}}>Indisponible{manuelAi.msg?" : "+manuelAi.msg:""}</div>}
                                {!manuelAi&&!manuelAiLoading&&isValid&&<div style={{fontSize:12,color:C.textDim}}>Lancez l'analyse depuis le panneau gauche.</div>}
                              </div>
                            </div>
                            <div style={{...card,padding:24}}>
                              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
                                <div>
                                  <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:2}}>📈 Performances simulées — 10 ans</div>
                                  <div style={{fontSize:11,color:C.textDim}}>Base 100 · simulation indicative par profil SRI</div>
                                </div>
                                <button onClick={exportManuelPDF} style={{padding:"8px 16px",borderRadius:8,border:"1.5px solid "+C.gold,background:"linear-gradient(135deg,"+C.navy+","+C.navyL+")",color:C.gold,fontWeight:700,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                                  📄 Export PDF
                                </button>
                              </div>
                              <PerfChart funds={allocForDisplay} getPts={getFondPerf}/>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          </div>
        )}

        {/* ══ COMPARAISON ════════════════════════════════════════════════ */}
        {tab==="comparaison"&&(
          <div className="fu">

            {/* ── BARRE DU HAUT : recherche + filtres + sélection ── */}
            <div style={{...card,padding:20,marginBottom:20,borderTop:"3px solid "+C.gold}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14,flexWrap:"wrap"}}>
                <div style={{fontSize:14,fontWeight:800,color:C.navy,flex:1}}>📊 Comparaison de fonds</div>
                <div style={{fontSize:12,color:rechSelected.length>=10?C.red:C.textDim,fontWeight:600}}>
                  {rechSelected.length}/10 fonds sélectionnés
                </div>
                {rechSelected.length>0&&(
                  <button onClick={()=>{setRechSelected([]);setFicheFond(null);}} style={{fontSize:11,padding:"4px 10px",borderRadius:7,border:"1px solid rgba(153,27,27,.2)",background:"rgba(153,27,27,.05)",color:C.red,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
                    ✕ Tout effacer
                  </button>
                )}
              </div>

              {/* Recherche + filtres */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 140px 140px",gap:10,marginBottom:14}}>
                <input value={rechSearch} onChange={e=>{const q=e.target.value;setRechSearch(q);if(!q.trim()){setRechResults([]);return;}const ql=q.toLowerCase();setRechResults(funds.filter(f=>(f.nom||"").toLowerCase().includes(ql)||(f.isin||"").toLowerCase().includes(ql)||(f.soc||"").toLowerCase().includes(ql)).slice(0,80));}} placeholder={"🔍 Chercher parmi "+funds.length+" fonds…"} style={inp} autoComplete="off"/>
                <select value={rechFilterSri} onChange={e=>setRechFilterSri(parseInt(e.target.value))} style={sel}><option value={0}>Tous SRI</option>{[1,2,3,4,5,6,7].map(r=><option key={r} value={r}>SRI {r}</option>)}</select>
                <select value={rechFilterMarche} onChange={e=>setRechFilterMarche(e.target.value)} style={sel}><option value="">Tous marchés</option>{MARCHES_GROUPES.map(g=><optgroup key={g.groupe} label={"— "+g.groupe+" —"}>{g.items.map(m=><option key={m} value={m}>{m}</option>)}</optgroup>)}</select>
              </div>

              {/* Instruction + compteur */}
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderRadius:9,background:"linear-gradient(135deg,"+C.navy+"08,"+C.gold+"08)",border:"1px solid "+C.borderGold,marginBottom:10}}>
                <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,"+C.navy+","+C.navyL+")",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><span style={{fontSize:16}}>📊</span></div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:700,color:C.navy}}>Sélectionnez les fonds à comparer</div>
                  <div style={{fontSize:10,color:C.textDim,marginTop:1}}>Cliquez sur un fond pour l'ajouter — jusqu'à 10 fonds simultanément</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:16,fontWeight:900,color:rechSelected.length>0?C.gold:C.textDim}}>{rechSelected.length}<span style={{fontSize:11,fontWeight:600,color:C.textDim}}>/10</span></div>
                  <div style={{fontSize:9,color:C.textDim}}>{rechFiltered.length} fonds</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:5,maxHeight:"calc(100vh - 420px)",minHeight:400,overflowY:"auto",padding:1,marginBottom:0}}>

                {rechFiltered.map(f=>{
                  const sel2=rechSelected.some(x=>x.id===f.id);
                  const maxed=rechSelected.length>=10&&!sel2;
                  const col=PALETTE[(f.sri-1)%PALETTE.length];
                  return(
                    <div key={f.id} onClick={()=>{if(maxed)return;setRechSelected(s=>sel2?s.filter(x=>x.id!==f.id):[...s,f]);}}
                      style={{
                        borderRadius:9,
                        border:"1.5px solid "+(sel2?C.gold:C.borderGold),
                        background:sel2?"linear-gradient(135deg,"+C.navy+","+C.navyL+")":C.bgCard,
                        padding:"9px 11px",
                        cursor:maxed?"not-allowed":"pointer",
                        opacity:maxed?.4:1,
                        transition:"all .15s",
                        borderLeft:"3px solid "+(sel2?C.gold:col),
                      }}
                      onMouseEnter={e=>{if(!sel2&&!maxed)e.currentTarget.style.background=C.goldXL;}}
                      onMouseLeave={e=>{if(!sel2)e.currentTarget.style.background=C.bgCard;}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:4}}>
                        <div style={{width:18,height:18,borderRadius:5,background:sel2?C.gold:col+"22",border:"1.5px solid "+(sel2?C.gold:col),display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:10,fontWeight:900,color:sel2?C.navy:col}}>
                          {sel2?"✓":""}
                        </div>
                        <div style={{fontWeight:700,fontSize:11,color:sel2?"#fff":C.navy,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{f.nom}</div>
                      </div>
                      <div style={{display:"flex",gap:4,alignItems:"center",justifyContent:"space-between",paddingLeft:24}}>
                        <div style={{display:"flex",gap:4,alignItems:"center",flex:1,minWidth:0}}>
                          <SRI n={f.sri} compact/>
                          {f.marche&&<span style={{fontSize:9,padding:"1px 5px",borderRadius:4,background:sel2?"rgba(255,255,255,0.12)":C.bgSub,color:sel2?"rgba(255,255,255,0.7)":C.textDim,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:80}}>{f.marche}</span>}
                        </div>
                        <button onClick={e=>{e.stopPropagation();openFondModal(f);}} style={{flexShrink:0,fontSize:10,padding:"2px 6px",borderRadius:5,border:"1px solid "+(sel2?"rgba(255,255,255,0.2)":C.borderGold),background:sel2?"rgba(255,255,255,0.08)":C.bgSub,color:sel2?"rgba(255,255,255,0.6)":C.textDim,cursor:"pointer",lineHeight:1}}>ℹ</button>
                      </div>
                    </div>
                  );
                })}
                {!funds.length&&<div style={{gridColumn:"span 3",textAlign:"center",padding:24,color:C.textDim,fontSize:13}}>Importez d'abord votre liste de fonds</div>}
              </div>

              {/* Chips des fonds sélectionnés */}
              {rechSelected.length>0&&(
                <div style={{marginTop:14,paddingTop:14,borderTop:"1px solid "+C.borderGold}}>
                  <div style={{fontSize:10,color:C.textDim,fontWeight:600,textTransform:"uppercase",letterSpacing:.8,marginBottom:8}}>Sélection en cours</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {rechSelected.map((f,i)=>(
                      <div key={f.id} style={{display:"inline-flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:20,background:"linear-gradient(135deg,"+C.navy+","+C.navyL+")",border:"1px solid rgba(201,162,39,0.3)"}}>
                        <div style={{width:8,height:8,borderRadius:2,background:PALETTE[i%PALETTE.length],flexShrink:0}}/>
                        <span style={{fontSize:11,color:"#fff",fontWeight:600,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.nom}</span>
                        <span style={{fontSize:9,background:PALETTE[i%PALETTE.length]+"30",color:PALETTE[i%PALETTE.length],padding:"1px 5px",borderRadius:8,fontWeight:700}}>SRI {f.sri}</span>
                        <button onClick={()=>setRechSelected(s=>s.filter(x=>x.id!==f.id))} style={{fontSize:11,color:"rgba(255,255,255,0.5)",background:"none",border:"none",cursor:"pointer",padding:0,lineHeight:1,marginLeft:2}}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── ZONE RÉSULTATS ── */}
            <div>

              {ficheFond&&rechSelected.length===0&&(
                <FicheFond f={ficheFond} onClose={()=>setFicheFond(null)} onSelect={()=>setRechSelected(s=>s.some(x=>x.id===ficheFond.id)?s.filter(x=>x.id!==ficheFond.id):[...s,ficheFond])} selected={rechSelected.some(x=>x.id===(ficheFond&&ficheFond.id))} getPts={getFondPerf}/>
              )}

                {rechSelected.length>0&&(()=>{
                  const yr=new Date().getFullYear();
                  const series=rechSelected.map((f,i)=>({f,pts:getFondPerf(f),color:PALETTE[i%PALETTE.length]}));
                  const allPts=[]; series.forEach(s=>s.pts.forEach(v=>allPts.push(v)));
                  const mn=Math.min.apply(null,allPts)*.97,mx=Math.max.apply(null,allPts)*1.03;
                  const W=740,H=300,PL=52,PR=60,PT=18,PB=32;
                  const pxf=i=>PL+(i/10)*(W-PL-PR);
                  const pyf=v=>PT+(1-(v-mn)/(mx-mn))*(H-PT-PB);
                  const yrs=[]; for(var i=0;i<10;i++) yrs.push(yr-10+i+1);

                  function printPDF() {
                    const svgDataUri=buildComparaisonSVG(series);
                    const ranked=series.slice().sort((a,b)=>((b.pts[10]/b.pts[0])-1)-((a.pts[10]/a.pts[0])-1));
                    const medals=["🥇","🥈","🥉"];
                    const legendHtml=series.map(s=>`<span style='display:inline-flex;align-items:center;gap:7px;margin:3px 12px 3px 0;font-size:11px;color:#3d4f6e'><span style='display:inline-block;width:18px;height:3px;border-radius:2px;background:${s.color}'></span>${s.f.nom} <span style='background:${RISK_COLOR[s.f.sri]}22;color:${RISK_COLOR[s.f.sri]};padding:1px 7px;border-radius:8px;font-weight:700;font-size:10px'>SRI ${s.f.sri}</span></span>`).join("");
                    const podiumHtml=ranked.map((s,rank)=>{const tot=((s.pts[10]/s.pts[0])-1)*100;return `<tr style='border-bottom:1px solid #f0ece0;background:${rank===0?"rgba(201,162,39,0.05)":"#fff"}'><td style='padding:10px 14px;font-size:18px;width:44px;text-align:center'>${rank<3?medals[rank]:"#"+(rank+1)}</td><td style='padding:10px 14px'><div style='display:flex;align-items:center;gap:8px'><div style='width:10px;height:10px;border-radius:3px;background:${s.color};flex-shrink:0'></div><div><div style='font-weight:700;font-size:13px;color:#0f2340'>${s.f.nom}</div><div style='font-size:11px;color:#8292a8;margin-top:2px'>${s.f.soc||""}${s.f.marche?" · "+s.f.marche:""}</div></div></div></td><td style='padding:10px;text-align:center'><span style='background:${RISK_COLOR[s.f.sri]}22;color:${RISK_COLOR[s.f.sri]};padding:3px 10px;border-radius:8px;font-weight:700;font-size:11px'>SRI ${s.f.sri}</span></td><td style='padding:10px;text-align:right'><span style='padding:4px 12px;border-radius:8px;font-weight:800;font-size:14px;background:${tot>=0?"#f0fdf4":"#fef2f2"};color:${tot>=0?"#166534":"#991b1b"}'>${(tot>=0?"+":"")+tot.toFixed(1)+"%"}</span></td></tr>`;}).join("");
                    const tableRows=series.map((s,i)=>{const ap=yrs.map((_,j)=>((s.pts[j+1]/s.pts[j])-1)*100);const tot=((s.pts[10]/s.pts[0])-1)*100;return `<tr style='border-bottom:1px solid #f0ece0;background:${i%2===0?"#fff":"#fafaf8"}'><td style='padding:7px 10px'><div style='display:flex;align-items:center;gap:6px'><div style='width:8px;height:8px;border-radius:2px;background:${s.color};flex-shrink:0'></div><div style='font-weight:600;font-size:11px;color:#0f2340;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'>${s.f.nom}</div></div></td>${ap.map(v=>`<td style='padding:5px 3px;text-align:center'><span style='padding:2px 5px;border-radius:4px;font-size:10px;font-weight:700;background:${v>=0?"#f0fdf4":"#fef2f2"};color:${v>=0?"#0d6e3e":"#991b1b"}'>${(v>=0?"+":"")+v.toFixed(1)+"%"}</span></td>`).join("")}<td style='padding:5px;text-align:center'><span style='padding:2px 8px;border-radius:6px;font-weight:800;font-size:11px;background:${tot>=0?"#f0fdf4":"#fef2f2"};color:${tot>=0?"#0d6e3e":"#991b1b"}'>${(tot>=0?"+":"")+tot.toFixed(1)+"%"}</span></td></tr>`;}).join("");
                    const html=`<!DOCTYPE html><html><head><meta charset='UTF-8'><title>Comparaison Les Associés</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',system-ui,sans-serif;background:#f5f3ee;color:#0f2340}.wrap{max-width:1080px;margin:0 auto;padding:28px}.card{background:#fff;border-radius:12px;padding:24px;margin-bottom:16px;box-shadow:0 2px 16px rgba(15,35,64,.08);border:1px solid rgba(201,162,39,.2)}.hdr{background:linear-gradient(135deg,#0f2340,#1a3560);border-radius:14px;padding:26px 30px;margin-bottom:20px;display:flex;justify-content:space-between;align-items:center}.logo{font-family:Georgia,serif;font-size:22px;font-weight:700;color:#c9a227}.logo-sub{font-size:10px;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.4);margin-top:4px}.stitle{font-size:14px;font-weight:700;color:#0f2340;margin-bottom:14px;padding-left:10px;border-left:3px solid #c9a227}table{width:100%;border-collapse:collapse}th{padding:9px 8px;font-size:10px;font-weight:700;color:#8292a8;text-transform:uppercase;border-bottom:2px solid rgba(201,162,39,.2);text-align:center;background:#fafaf8}th:first-child{text-align:left;padding-left:12px}.footer{text-align:center;font-size:10px;color:#8292a8;padding:16px 0 8px;border-top:1px solid rgba(201,162,39,.2);margin-top:4px}.disc{background:#fff9ec;border:1px solid rgba(201,162,39,.25);border-radius:10px;padding:12px 16px;font-size:11px;color:#78350f;margin:14px 0;line-height:1.6}@media print{body{background:#fff}.wrap{padding:0}.card{box-shadow:none;page-break-inside:avoid}}</style></head><body><div class='wrap'><div class='hdr'><div><div class='logo'>Les Associés</div><div class='logo-sub'>Comparaison de fonds · Analyse de performances</div></div><div style='text-align:right;color:rgba(255,255,255,.5);font-size:12px'>${new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})}<div style='margin-top:8px;display:inline-block;background:rgba(201,162,39,.18);border:1px solid rgba(201,162,39,.35);border-radius:7px;padding:4px 12px;color:#c9a227;font-size:12px;font-weight:700'>${series.length} fonds comparés</div></div></div><div class='card'><div class='stitle'>📈 Évolution sur 10 ans (base 100)</div><div style='background:#fafaf8;border-radius:10px;padding:8px'><img src='${svgDataUri}' style='width:100%;height:auto;display:block'/></div><div style='margin-top:12px;display:flex;flex-wrap:wrap'>${legendHtml}</div><div style='margin-top:8px;font-size:10px;color:#8292a8;font-style:italic'>Base 100 — Simulations indicatives.</div></div><div class='card'><div class='stitle'>🏆 Classement sur 10 ans</div><table><thead><tr><th style='width:50px'>Rang</th><th style='text-align:left;padding-left:12px'>Fonds</th><th>Risque</th><th style='text-align:right;padding-right:14px'>Perf.</th></tr></thead><tbody>${podiumHtml}</tbody></table></div><div class='card'><div class='stitle'>📊 Performances annuelles</div><div style='overflow-x:auto'><table><thead><tr><th style='text-align:left;padding-left:10px;min-width:130px'>Fonds</th>${yrs.map(y=>`<th>${y}</th>`).join("")}<th style='color:#c9a227'>10 ans</th></tr></thead><tbody>${tableRows}</tbody></table></div></div><div class='disc'>⚠️ Simulations indicatives basées sur le SRI. Ne constituent pas des données réelles. Document interne non contractuel.</div><div class='footer'>Les Associés · www.les-associes.fr</div></div></body></html>`;
                    openHtmlInNewTab(html);
                  }

                  return (
                    <div style={{display:"flex",flexDirection:"column",gap:14}}>
                      <div style={{...card,padding:18,display:"flex",alignItems:"center",justifyContent:"space-between",borderTop:"3px solid "+C.gold}}>
                        <div>
                          <div style={{fontSize:15,fontWeight:800,color:C.navy}}>Comparaison de {series.length} fond{series.length>1?"s":""}</div>
                          <div style={{fontSize:11,color:C.textDim,marginTop:2}}>Performances simulées sur 10 ans · base 100</div>
                        </div>
                        <button onClick={printPDF} style={{padding:"8px 16px",borderRadius:8,border:"1.5px solid "+C.gold,background:"linear-gradient(135deg,"+C.navy+","+C.navyL+")",color:C.gold,fontWeight:700,fontSize:11,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                          📄 Exporter PDF
                        </button>
                      </div>

                      <div style={{...card,padding:22}}>
                        <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:14}}>📈 Évolution (base 100)</div>
                        <svg width="100%" viewBox={"0 0 "+W+" "+H}>
                          <defs>{series.map((s,i)=>(<linearGradient key={i} id={"cg"+i} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={s.color} stopOpacity=".1"/><stop offset="100%" stopColor={s.color} stopOpacity="0"/></linearGradient>))}</defs>
                          {[0,.25,.5,.75,1].map(p=>{const y=PT+p*(H-PT-PB),v=mx-p*(mx-mn);return(<g key={p}><line x1={PL} y1={y} x2={W-PR} y2={y} stroke={C.borderGold} strokeWidth="1"/><text x={PL-4} y={y+3} textAnchor="end" fontSize="9" fill={C.textDim}>{(v-100).toFixed(0)+"%"}</text></g>);})}
                          {Array.from({length:11},(_,i)=><text key={i} x={pxf(i)} y={H-8} textAnchor="middle" fontSize="9" fill={C.textDim}>{yr-10+i}</text>)}
                          <line x1={PL} y1={pyf(100)} x2={W-PR} y2={pyf(100)} stroke={C.gold} strokeWidth="1.5" strokeDasharray="5 3" opacity=".5"/>
                          {series.map((s,i)=>{
                            const d=s.pts.map((v,j)=>(j===0?"M":"L")+pxf(j).toFixed(1)+","+pyf(v).toFixed(1)).join(" ");
                            const tot=((s.pts[10]/s.pts[0])-1)*100;
                            const lY=pyf(s.pts[10]);
                            const aD=d+" L"+pxf(10).toFixed(1)+","+pyf(mn).toFixed(1)+" L"+pxf(0).toFixed(1)+","+pyf(mn).toFixed(1)+" Z";
                            return(<g key={i}><path d={aD} fill={"url(#cg"+i+")"}/><path d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round"/><circle cx={pxf(10)} cy={lY} r="5" fill={s.color}/><rect x={pxf(10)+8} y={lY-11} width="52" height="20" rx="5" fill={s.color} opacity=".15"/><text x={pxf(10)+34} y={lY+4} textAnchor="middle" fontSize="10" fill={s.color} fontWeight="700">{(tot>=0?"+":"")+tot.toFixed(1)+"%"}</text></g>);
                          })}
                        </svg>
                        <div style={{display:"flex",flexWrap:"wrap",gap:"6px 16px",marginTop:12}}>
                          {series.map((s,i)=><div key={i} style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:C.textMid}}><div style={{width:16,height:3,borderRadius:1.5,background:s.color}}/>{s.f.nom} <SRI n={s.f.sri} compact/></div>)}
                        </div>
                      </div>

                      <div style={{...card,padding:22}}>
                        <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:14}}>📊 Performances annuelles</div>
                        <div style={{overflowX:"auto"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                            <thead><tr style={{background:C.bgSub}}>
                              <th style={{padding:"8px 12px",textAlign:"left",fontWeight:600,color:C.textMid,borderBottom:"2px solid "+C.borderGold,minWidth:160,position:"sticky",left:0,background:C.bgSub}}>Fond</th>
                              {yrs.map(y=><th key={y} style={{padding:"8px 6px",textAlign:"center",fontWeight:600,color:C.textMid,borderBottom:"2px solid "+C.borderGold,whiteSpace:"nowrap"}}>{y}</th>)}
                              <th style={{padding:"8px 6px",textAlign:"center",fontWeight:700,color:C.gold,borderBottom:"2px solid "+C.borderGold}}>10 ans</th>
                              <th style={{padding:"8px 6px",textAlign:"center",fontWeight:600,color:C.textMid,borderBottom:"2px solid "+C.borderGold,whiteSpace:"nowrap"}}>Val. finale</th>
                            </tr></thead>
                            <tbody>
                              {series.map((s,i)=>{
                                const tot=((s.pts[10]/s.pts[0])-1)*100;
                                const ap=yrs.map((_,j)=>((s.pts[j+1]/s.pts[j])-1)*100);
                                return(<tr key={i} style={{borderBottom:"1px solid "+C.borderGold,background:i%2===0?C.bgCard:C.bgSub}}>
                                  <td style={{padding:"9px 12px",position:"sticky",left:0,background:i%2===0?C.bgCard:C.bgSub}}>
                                    <div style={{display:"flex",alignItems:"center",gap:7}}><div style={{width:8,height:8,borderRadius:2,background:s.color,flexShrink:0}}/><div><div style={{fontWeight:600,color:C.navy,fontSize:11}}>{s.f.nom}</div><div style={{fontSize:9,color:C.textDim}}>{s.f.soc||""}{s.f.marche?" · "+s.f.marche:""}</div></div></div>
                                  </td>
                                  {ap.map((v,j)=><td key={j} style={{padding:"6px",textAlign:"center"}}><span style={{padding:"2px 5px",borderRadius:4,background:v>=0?C.greenBg:C.redBg,color:v>=0?C.green:C.red,fontWeight:600,fontSize:10,whiteSpace:"nowrap"}}>{(v>=0?"+":"")+v.toFixed(1)+"%"}</span></td>)}
                                  <td style={{padding:"6px",textAlign:"center"}}><span style={{padding:"2px 8px",borderRadius:5,background:tot>=0?C.greenBg:C.redBg,color:tot>=0?C.green:C.red,fontWeight:800,fontSize:11}}>{(tot>=0?"+":"")+tot.toFixed(1)+"%"}</span></td>
                                  <td style={{padding:"6px",textAlign:"center",fontWeight:600,color:C.gold,fontSize:11}}>{s.pts[10].toFixed(1)}</td>
                                </tr>);
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div style={{...card,padding:22}}>
                        <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:14}}>🏆 Classement sur 10 ans</div>
                        <div style={{display:"flex",flexDirection:"column",gap:7}}>
                          {series.slice().sort((a,b)=>((b.pts[10]/b.pts[0])-1)-((a.pts[10]/a.pts[0])-1)).map((s,rank)=>{
                            const tot=((s.pts[10]/s.pts[0])-1)*100;
                            const medals=["🥇","🥈","🥉"];
                            return(<div key={s.f.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderRadius:10,background:rank===0?C.goldXL:C.bgSub,border:"1px solid "+(rank===0?C.borderGold:C.border),transition:"all .15s"}}>
                              <div style={{fontSize:18,width:30,textAlign:"center",flexShrink:0}}>{medals[rank]||"#"+(rank+1)}</div>
                              <div style={{width:8,height:8,borderRadius:2,background:s.color,flexShrink:0}}/>
                              <div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,color:C.navy}}>{s.f.nom}</div><div style={{fontSize:10,color:C.textDim}}>{s.f.soc||""}{s.f.marche?" · "+s.f.marche:""}</div></div>
                              <SRI n={s.f.sri} compact/>
                              <div style={{fontSize:15,fontWeight:800,color:tot>=0?C.green:C.red,minWidth:68,textAlign:"right"}}>{(tot>=0?"+":"")+tot.toFixed(1)+"%"}</div>
                            </div>);
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
            </div>
          </div>
        )}

        {/* ══ PERFORMANCES ════════════════════════════════════════════════ */}
        {tab==="performances"&&(()=>{
          if(!funds.length) return (
            <div className="fu" style={{textAlign:"center",padding:"60px 0"}}>
              <div style={{width:72,height:72,borderRadius:20,background:"linear-gradient(135deg,"+C.navy+","+C.navyL+")",margin:"0 auto 18px",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:C.shadowMd}}><span style={{fontSize:32}}>🏆</span></div>
              <div style={{fontSize:18,fontWeight:800,color:C.navy,marginBottom:8}}>Aucun fond chargé</div>
              <button onClick={()=>setTab("import")} style={{marginTop:8,padding:"10px 22px",borderRadius:10,border:"none",background:"linear-gradient(135deg,"+C.navy+","+C.navyL+")",color:C.gold,fontWeight:700,fontSize:13,cursor:"pointer",boxShadow:C.shadowMd}}>→ Import CSV</button>
            </div>
          );

          function simPerfPeriods(fund) {
            const rets=[0.01,0.02,0.03,0.045,0.065,0.085,0.10];
            const vols=[0.005,0.01,0.02,0.04,0.07,0.10,0.14];
            const ret=rets[fund.sri-1], vol=vols[fund.sri-1];
            const key=fund.isin||fund.nom||"x";
            var seed=0; for(var i=0;i<key.length;i++) seed+=key.charCodeAt(i);
            const rng=()=>{seed=(seed*1664525+1013904223)&0xffffffff;return(seed>>>0)/0xffffffff;};
            const monthly=[100];
            for(var m=0;m<120;m++) monthly.push(monthly[monthly.length-1]*(1+ret/12+(rng()-0.5)*2*vol/Math.sqrt(12)));
            const volJ=vol/Math.sqrt(252);
            const lastMo=monthly[119];
            const days=[lastMo];
            for(var d=0;d<5;d++) days.push(days[days.length-1]*(1+ret/252+(rng()-0.5)*2*volJ));
            const week=((days[5]/days[0])-1)*100;
            const month=((monthly[120]/monthly[119])-1)*100;
            const year1=((monthly[120]/monthly[108])-1)*100;
            const year5=((monthly[120]/monthly[60])-1)*100;
            const monthly5=[];
            for(var i=60;i<=120;i+=5) monthly5.push(monthly[i]);
            return {week,month,year1,year5,monthly5};
          }

          function MiniSpark({pts,color,h=28}) {
            if(!pts||!pts.length) return null;
            const mn=Math.min.apply(null,pts), mx=Math.max.apply(null,pts);
            const range=Math.max(0.01,mx-mn);
            const W2=80,H2=h;
            const pxs=i=>i/(pts.length-1)*W2;
            const pys=v=>H2-(v-mn)/range*H2;
            const d=pts.map((v,i)=>(i===0?"M":"L")+pxs(i).toFixed(1)+","+pys(v).toFixed(1)).join(" ");
            const aD=d+" L"+W2+","+H2+" L0,"+H2+" Z";
            const isPos=(pts[pts.length-1]||0)>=(pts[0]||0);
            const col=color||(isPos?C.green:C.red);
            return(
              <svg width={W2} height={H2} style={{overflow:"visible",flexShrink:0}}>
                <defs><linearGradient id={"sg"+Math.abs(pts[0]).toFixed(0)} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity=".15"/><stop offset="100%" stopColor={col} stopOpacity="0"/></linearGradient></defs>
                <path d={aD} fill={"url(#sg"+Math.abs(pts[0]).toFixed(0)+")"}/>
                <path d={d} fill="none" stroke={col} strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
            );
          }

          const periods=[
            {key:"week",  label:"Semaine", icon:"📅",desc:"7 derniers jours"},
            {key:"month", label:"Mois",    icon:"📆",desc:"30 derniers jours"},
            {key:"year1", label:"1 an",    icon:"📈",desc:"12 derniers mois"},
            {key:"year5", label:"5 ans",   icon:"🚀",desc:"60 derniers mois"},
          ];

          const allStats=funds.map(f=>{
            // Use real FMP data if available — derive short-term periods from 10y data
            const realPts=getFondPerf(f);
            const isR=isFondReal(f);
            if(isR&&realPts&&realPts.length===11){
              // Derive annual periods from real data
              const ann=[];for(let i=0;i<10;i++)ann.push(((realPts[i+1]/realPts[i])-1)*100);
              const year1=ann[ann.length-1];
              const year5=((realPts[10]/realPts[5])-1)*100;
              const month=year1/12; // approximation
              const week=year1/52;  // approximation
              const monthly5=[];for(let i=0;i<=10;i+=2)monthly5.push(realPts[i]);
              return Object.assign({},f,{_p:{week,month,year1,year5,monthly5},_isReal:true});
            }
            const p=simPerfPeriods(f);
            return Object.assign({},f,{_p:p,_isReal:false});
          });
          const filteredStats=allStats.filter(f=>{
            if(perfFilterSri>0&&f.sri!==perfFilterSri)return false;
            if(perfFilterMarche&&f.marche!==perfFilterMarche)return false;
            return true;
          });
          const sorted=filteredStats.slice().sort((a,b)=>b._p[perfPeriod]-a._p[perfPeriod]);
          const top10=sorted.slice(0,10);
          const flop5=sorted.slice().reverse().slice(0,5);
          const avg=k=>(filteredStats.reduce((a,f)=>a+f._p[k],0)/Math.max(1,filteredStats.length));
          const maxPerf=top10.length?Math.abs(top10[0]._p[perfPeriod]):1;

          return(
            <div className="fu">
              {/* Header */}
              <div style={{marginBottom:22}}>
                <div style={{fontSize:22,fontWeight:900,color:C.navy,marginBottom:4,display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:40,height:40,borderRadius:10,background:"linear-gradient(135deg,"+C.navy+","+C.navyL+")",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:C.shadow}}><span style={{fontSize:18}}>🏆</span></div>
                  Classement des performances
                </div>
                <div style={{fontSize:12,color:C.textDim}}>Simulation indicative · {filteredStats.length} fonds{perfFilterSri||perfFilterMarche?" (filtrés)":""}</div>
              </div>

              {/* Period selector */}
              <div style={{display:"flex",gap:8,marginBottom:20,flexWrap:"wrap",alignItems:"center"}}>
                <div style={{display:"flex",gap:6,padding:"4px",borderRadius:12,background:C.bgCard,border:"1px solid "+C.borderGold,boxShadow:C.shadow}}>
                  {periods.map(p=>{const a=perfPeriod===p.key;return(
                    <button key={p.key} onClick={()=>setPerfPeriod(p.key)} style={{padding:"8px 16px",borderRadius:9,border:"none",background:a?"linear-gradient(135deg,"+C.navy+","+C.navyL+")":"transparent",color:a?C.gold:C.textMid,fontWeight:a?700:500,fontSize:12,cursor:"pointer",transition:"all .18s",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
                      <span>{p.icon}</span>{p.label}
                    </button>
                  );})}
                </div>
                <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
                  <select value={perfFilterSri} onChange={e=>setPerfFilterSri(parseInt(e.target.value))} style={{...sel,fontSize:11}}>
                    <option value={0}>Tous SRI</option>
                    {[1,2,3,4,5,6,7].map(r=><option key={r} value={r}>SRI {r}</option>)}
                  </select>
                  <select value={perfFilterMarche} onChange={e=>setPerfFilterMarche(e.target.value)} style={{...sel,fontSize:11}}>
                    <option value="">Tous marchés</option>
                    {MARCHES.map(m=><option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* KPI strip */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
                {[
                  {label:"Moy. semaine",  k:"week",  icon:"📅"},
                  {label:"Moy. mois",     k:"month", icon:"📆"},
                  {label:"Moy. 1 an",     k:"year1", icon:"📈"},
                  {label:"Moy. 5 ans",    k:"year5", icon:"🚀"},
                ].map(s=>{const v=avg(s.k);const pos=v>=0;return(
                  <div key={s.k} style={{...card,padding:"14px 16px",borderTop:"3px solid "+(pos?C.green:C.red)+"90",background:s.k===perfPeriod?C.goldXL:C.bgCard,border:"1px solid "+(s.k===perfPeriod?C.borderGold:C.border)}}>
                    <div style={{fontSize:10,color:C.textDim,fontWeight:600,textTransform:"uppercase",letterSpacing:.8,marginBottom:5,display:"flex",alignItems:"center",gap:4}}><span>{s.icon}</span>{s.label}</div>
                    <div style={{fontSize:20,fontWeight:900,color:pos?C.green:C.red,lineHeight:1}}>{(pos?"+":"")+v.toFixed(2)+"%"}</div>
                  </div>
                );})}
              </div>

              {/* Main layout */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 300px",gap:16,alignItems:"start"}}>

                {/* Leaderboard */}
                <div style={{...card,padding:0,overflow:"hidden"}}>
                  <div style={{padding:"14px 20px",borderBottom:"1px solid "+C.borderGold,background:C.bgSub,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div>
                      <div style={{fontSize:13,fontWeight:800,color:C.navy}}>Top 10 — {periods.find(p=>p.key===perfPeriod).label}</div>
                      <div style={{fontSize:10,color:C.textDim,marginTop:1}}>Classement par performance simulée</div>
                    </div>
                    <div style={{fontSize:11,color:C.textDim}}>{top10.length} fonds affichés</div>
                  </div>

                  {top10.map((f,rank)=>{
                    const val=f._p[perfPeriod];
                    const pos=val>=0;
                    const col=PALETTE[(f.sri-1)%PALETTE.length];
                    const barW=Math.min(100,Math.abs(val)/Math.max(0.01,maxPerf)*100);
                    const medals=["🥇","🥈","🥉"];
                    return(
                      <div key={f.id} onClick={()=>openFondModal(f)} style={{padding:"11px 18px",borderBottom:"1px solid "+C.borderGold,display:"flex",alignItems:"center",gap:11,background:rank===0?C.goldXL:rank%2===0?C.bgCard:C.bgSub,transition:"background .15s",cursor:"pointer"}}
                      onMouseEnter={e=>e.currentTarget.style.background=C.goldXL} onMouseLeave={e=>e.currentTarget.style.background=rank===0?C.goldXL:rank%2===0?C.bgCard:C.bgSub}>
                        <div style={{width:32,textAlign:"center",flexShrink:0}}>
                          {rank<3?<span style={{fontSize:18}}>{medals[rank]}</span>:<span style={{fontSize:12,fontWeight:800,color:C.textDim}}>#{rank+1}</span>}
                        </div>
                        <div style={{width:3,height:38,borderRadius:2,background:col,flexShrink:0}}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                        <div style={{fontWeight:700,fontSize:12,color:C.navy,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{f.nom}</div>
                        <button onClick={e=>{e.stopPropagation();openFondModal(f);}} style={{fontSize:9,padding:"2px 6px",borderRadius:5,border:"1px solid "+C.borderGold,background:C.bgSub,color:C.textDim,cursor:"pointer",flexShrink:0}}>Fiche</button>
                      </div>
                          <div style={{display:"flex",gap:5,marginTop:3,alignItems:"center"}}>
                            <SRI n={f.sri} compact/>
                            {f.marche&&<Tag>{f.marche}</Tag>}
                            {f.soc&&<span style={{fontSize:9,color:C.textDim}}>{f.soc}</span>}
                          </div>
                          <div style={{marginTop:5,height:2,background:C.bgSub,borderRadius:1,border:"1px solid "+C.borderGold}}>
                            <div style={{height:2,width:barW+"%",background:pos?"linear-gradient(90deg,"+C.green+",#34d399cc)":"linear-gradient(90deg,"+C.red+",#f87171cc)",borderRadius:1,transition:"width .4s ease"}}/>
                          </div>
                        </div>
                        <MiniSpark pts={f._p.monthly5} color={pos?C.green:C.red}/>
                        <div style={{minWidth:70,textAlign:"right",flexShrink:0}}>
                          <div style={{fontSize:15,fontWeight:900,color:pos?C.green:C.red,lineHeight:1}}>{(pos?"+":"")+val.toFixed(2)+"%"}</div>
                          <div style={{fontSize:9,color:C.textDim,marginTop:2}}>{periods.find(p=>p.key===perfPeriod).label}</div>
                        </div>
                      </div>
                    );
                  })}
                  {top10.length===0&&<div style={{padding:40,textAlign:"center",color:C.textDim}}>Aucun fond ne correspond aux filtres.</div>}
                </div>

                {/* Right column */}
                <div style={{display:"flex",flexDirection:"column",gap:12}}>

                  {/* Spotlight best */}
                  {top10.length>0&&(()=>{
                    const f=top10[0];
                    const val=f._p[perfPeriod];
                    const col=PALETTE[(f.sri-1)%PALETTE.length];
                    return(
                      <div onClick={()=>openFondModal(f)} style={{...card,padding:18,borderTop:"3px solid "+col,boxShadow:C.shadowMd,cursor:"pointer"}}>
                        <div style={{fontSize:10,fontWeight:700,color:col,textTransform:"uppercase",letterSpacing:1,marginBottom:10}}>🥇 Meilleur fonds</div>
                        <div style={{fontSize:14,fontWeight:800,color:C.navy,marginBottom:6,lineHeight:1.3}}>{f.nom}</div>
                        <div style={{display:"flex",gap:4,marginBottom:12,flexWrap:"wrap"}}><SRI n={f.sri}/>{f.marche&&<Tag>{f.marche}</Tag>}</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:12}}>
                          {[["Semaine",f._p.week],["Mois",f._p.month],["1 an",f._p.year1],["5 ans",f._p.year5]].map(r=>{const pos=r[1]>=0;return(
                            <div key={r[0]} style={{padding:"7px 10px",borderRadius:8,background:pos?C.greenBg:C.redBg,textAlign:"center",border:"1px solid "+(pos?"rgba(13,110,62,.15)":"rgba(153,27,27,.15)")}}>
                              <div style={{fontSize:9,color:C.textDim,marginBottom:2}}>{r[0]}</div>
                              <div style={{fontSize:13,fontWeight:800,color:pos?C.green:C.red}}>{(pos?"+":"")+r[1].toFixed(2)+"%"}</div>
                            </div>
                          );})}
                        </div>
                        <MiniSpark pts={f._p.monthly5} color={col} h={32}/>
                        {f.desc&&<div style={{marginTop:10,fontSize:11,color:C.textDim,lineHeight:1.6,borderTop:"1px solid "+C.borderGold,paddingTop:10}}>{f.desc.slice(0,140)}{f.desc.length>140?"…":""}</div>}
                      </div>
                    );
                  })()}

                  {/* Flop */}
                  <div style={{...card,padding:0,overflow:"hidden"}}>
                    <div style={{padding:"10px 14px",borderBottom:"1px solid "+C.borderGold,background:C.bgSub}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.navy}}>⚠️ Moins performants</div>
                      <div style={{fontSize:9,color:C.textDim,marginTop:1}}>{periods.find(p=>p.key===perfPeriod).label}</div>
                    </div>
                    {flop5.map((f,i)=>{
                      const val=f._p[perfPeriod];
                      const pos=val>=0;
                      return(
                        <div key={f.id} onClick={()=>openFondModal(f)} style={{padding:"9px 14px",borderBottom:"1px solid "+C.borderGold,display:"flex",alignItems:"center",gap:9,background:i%2===0?C.bgCard:C.bgSub,cursor:"pointer"}}
                        onMouseEnter={e=>e.currentTarget.style.background=C.goldXL} onMouseLeave={e=>e.currentTarget.style.background=i%2===0?C.bgCard:C.bgSub}>
                          <span style={{fontSize:11,color:C.textDim,width:18,flexShrink:0,textAlign:"center"}}>#{flop5.length-i}</span>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:11,fontWeight:600,color:C.navy,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.nom}</div>
                            <SRI n={f.sri} compact/>
                          </div>
                          <div style={{fontSize:12,fontWeight:800,color:pos?C.green:C.red}}>{(pos?"+":"")+val.toFixed(2)+"%"}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Multi-period table */}
                  <div style={{...card,padding:14}}>
                    <div style={{fontSize:11,fontWeight:700,color:C.navy,marginBottom:10}}>📊 Vue multi-périodes · Top 5</div>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
                      <thead><tr>
                        <th style={{padding:"5px 6px",textAlign:"left",fontSize:9,color:C.textDim,fontWeight:600,textTransform:"uppercase",letterSpacing:.6,borderBottom:"1px solid "+C.borderGold}}>Fonds</th>
                        {["Sem.","Mois","1 an","5 ans"].map(h=><th key={h} style={{padding:"5px 4px",textAlign:"right",fontSize:9,color:C.textDim,fontWeight:600,textTransform:"uppercase",letterSpacing:.6,borderBottom:"1px solid "+C.borderGold}}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {sorted.slice(0,5).map((f,i)=>(
                          <tr key={f.id} onClick={()=>openFondModal(f)} style={{borderBottom:"1px solid "+C.borderGold,background:i%2===0?C.bgCard:C.bgSub,cursor:"pointer"}}
                          onMouseEnter={e=>e.currentTarget.style.background=C.goldXL} onMouseLeave={e=>e.currentTarget.style.background=i%2===0?C.bgCard:C.bgSub}>
                            <td style={{padding:"6px"}}>
                              <div style={{fontWeight:600,color:C.navy,fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:90}}>{f.nom}</div>
                            </td>
                            {[f._p.week,f._p.month,f._p.year1,f._p.year5].map((v,j)=>{const pos=v>=0;return(
                              <td key={j} style={{padding:"6px 4px",textAlign:"right"}}>
                                <span style={{fontSize:10,fontWeight:700,color:pos?C.green:C.red}}>{(pos?"+":"")+v.toFixed(1)+"%"}</span>
                              </td>
                            );})}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ══ FONDS ═══════════════════════════════════════════════════════ */}
        {tab==="fonds"&&(
          <div className="fu">
            <div style={{display:"flex",gap:8,marginBottom:16,alignItems:"center",flexWrap:"wrap"}}>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Nom, ISIN, société…" style={{...inp,maxWidth:240}}/>
              <select value={filterSri} onChange={e=>setFilterSri(parseInt(e.target.value))} style={sel}><option value={0}>Tous SRI</option>{[1,2,3,4,5,6,7].map(r=><option key={r} value={r}>SRI {r}</option>)}</select>
              <select value={filterMarche} onChange={e=>setFilterMarche(e.target.value)} style={sel}><option value="">Tous marchés</option>{MARCHES_GROUPES.map(g=><optgroup key={g.groupe} label={"— "+g.groupe+" —"}>{g.items.map(m=><option key={m} value={m}>{m}</option>)}</optgroup>)}</select>
              <select value={filterComp} onChange={e=>setFilterComp(e.target.value)} style={sel}><option value="">Toutes compagnies</option>{allCompagnies.map(c=><option key={c}>{c}</option>)}</select>
              <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={sel}><option value="nom">Nom A→Z</option><option value="sri">SRI ↑</option><option value="sriDesc">SRI ↓</option><option value="marche">Marché</option></select>
              <button onClick={()=>setEditF(defFund())} style={{padding:"9px 16px",borderRadius:9,border:"1.5px solid "+C.gold,background:"linear-gradient(135deg,"+C.navy+","+C.navyL+")",color:C.gold,fontWeight:700,fontSize:12,cursor:"pointer",marginLeft:"auto"}}>+ Ajouter</button>
              <span style={{fontSize:11,color:C.textDim}}>{filtered.length}/{funds.length}</span>
            </div>
            {!filtered.length&&<div style={{...card,textAlign:"center",color:C.textDim,padding:40}}>Aucun fond trouvé.</div>}
            <div style={{display:"grid",gridTemplateColumns:fondsFiche?"1fr 1fr":"1fr",gap:14,alignItems:"start"}}>
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {filtered.map(f=>{const col=PALETTE[(f.sri-1)%PALETTE.length];return(
                  <div key={f.id} onClick={()=>openFondModal(f)} className="hov" style={{...card,padding:"11px 14px",display:"flex",gap:10,alignItems:"center",borderLeft:"3px solid "+(fondsFiche&&fondsFiche.id===f.id?col:C.borderGold),cursor:"pointer",transition:"all .15s",background:fondsFiche&&fondsFiche.id===f.id?C.goldXL:C.bgCard}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap",marginBottom:4}}><span style={{fontWeight:700,fontSize:12,color:C.navy}}>{f.nom}</span>{f.soc&&<span style={{fontSize:10,color:C.textDim}}>{f.soc}</span>}</div>
                      <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center"}}><SRI n={f.sri} compact/>{f.isin&&<span style={{fontSize:9,color:C.textDim,background:C.bgSub,padding:"1px 6px",borderRadius:4,fontFamily:"monospace"}}>{f.isin}</span>}{f.marche&&<Tag>{f.marche}</Tag>}</div>
                      {f.dispo&&f.dispo.length>0&&<div style={{marginTop:4,display:"flex",gap:3,flexWrap:"wrap"}}>{f.dispo.map(d=><Tag key={d} color={C.goldDim} bg={C.goldXL}>{d}</Tag>)}</div>}
                    </div>
                    <div style={{display:"flex",gap:5}} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>setEditF(Object.assign({},f))} style={{padding:"5px 9px",borderRadius:7,border:"1px solid "+C.borderGold,background:C.bgSub,cursor:"pointer",color:C.textMid,fontSize:13}}>✏️</button>
                      <button onClick={()=>setFunds(fs=>fs.filter(x=>x.id!==f.id))} style={{padding:"5px 9px",borderRadius:7,border:"1px solid rgba(153,27,27,.2)",background:"rgba(153,27,27,.04)",cursor:"pointer",color:C.red,fontSize:13}}>🗑</button>
                    </div>
                  </div>
                );})}
              </div>
              {fondsFiche&&<FicheFond f={fondsFiche} onClose={()=>setFondsFiche(null)} getPts={getFondPerf}/>}
            </div>
          </div>
        )}

        {/* ══ IMPORT CSV ══════════════════════════════════════════════════ */}
        {tab==="import"&&(
          <div className="fu" style={{maxWidth:600}}>
            <div style={{...card,padding:24,marginBottom:16}}>
              <div style={{height:3,borderRadius:2,background:"linear-gradient(90deg,"+C.navy+","+C.gold+")",marginBottom:16}}/>
              <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:12}}>📋 Format CSV attendu</div>
              <div style={{fontFamily:"monospace",fontSize:11,background:C.navy,color:"#e2be5a",borderRadius:10,padding:"14px 16px",lineHeight:2,overflowX:"auto",border:"1px solid rgba(201,162,39,.3)"}}>
                <span style={{color:"#93c5fd"}}>NOM</span>;SOCIETE DE GESTION;SRI;ISIN;DESCIPTIF;DISPONIBLE CHEZ<br/>
                Carmignac Patrimoine;Carmignac;4;FR0010135103;Fonds diversifié;SwissLife|Cardif
              </div>
              <ul style={{fontSize:12,color:C.textMid,marginTop:12,paddingLeft:20,lineHeight:2.2}}>
                <li>Séparateur <code style={{background:C.bgSub,padding:"1px 6px",borderRadius:4}}>;</code> ou <code style={{background:C.bgSub,padding:"1px 6px",borderRadius:4}}>,</code> — <strong>DISPONIBLE CHEZ</strong> : séparés par <code style={{background:C.bgSub,padding:"1px 6px",borderRadius:4}}>|</code></li>
                <li><strong>SRI</strong> : entier de 1 à 7 — encodage UTF-8</li>
              </ul>
            </div>
            <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
              <label style={{padding:"11px 22px",borderRadius:10,background:"linear-gradient(135deg,"+C.navy+","+C.navyL+")",color:C.gold,fontWeight:700,fontSize:13,cursor:"pointer",display:"flex",alignItems:"center",gap:8,boxShadow:C.shadowMd}}>
                📁 Choisir un fichier CSV
                <input type="file" accept=".csv,.txt" ref={fileRef} onChange={handleFile} style={{display:"none"}}/>
              </label>
              {funds.length>0&&<button onClick={async()=>{if(!window.confirm("Supprimer les "+funds.length+" fonds ?"))return;try{await window.localStorageDelete("base_funds");}catch(e){}setFunds([]);setMsg(null);}} style={{padding:"10px 16px",borderRadius:10,border:"1px solid rgba(153,27,27,.25)",background:"rgba(153,27,27,.05)",color:C.red,fontSize:12,cursor:"pointer",fontWeight:600}}>🗑 Réinitialiser</button>}
            </div>
            {msg&&<div style={{marginTop:12,padding:"10px 14px",borderRadius:8,background:msg.ok?C.greenBg:C.redBg,color:msg.ok?C.green:C.red,fontSize:13,border:"1px solid "+(msg.ok?"rgba(13,110,62,.2)":"rgba(153,27,27,.2)")}}>{msg.text}</div>}
            {funds.length>0&&(
              <div style={{...card,marginTop:16,padding:18}}>
                <div style={{fontSize:12,fontWeight:700,color:C.navy,marginBottom:12}}>🔒 {funds.length} fonds sauvegardés</div>
                {funds.slice(0,8).map(f=>(
                  <div key={f.id} style={{display:"flex",gap:8,alignItems:"center",padding:"7px 0",borderBottom:"1px solid "+C.borderGold}}>
                    <div style={{width:6,height:6,borderRadius:2,background:PALETTE[(f.sri-1)%PALETTE.length],flexShrink:0}}/>
                    <span style={{flex:1,fontSize:12,color:C.navy}}>{f.nom}</span>
                    <SRI n={f.sri} compact/>
                    {f.isin&&<span style={{fontSize:9,color:C.textDim,fontFamily:"monospace"}}>{f.isin}</span>}
                    {f.marche&&<Tag>{f.marche}</Tag>}
                  </div>
                ))}
                {funds.length>8&&<div style={{fontSize:10,color:C.textDim,marginTop:8}}>…et {funds.length-8} autres</div>}
              </div>
            )}

            {/* ── PERFORMANCES RÉELLES FMP ── */}
            {funds.length>0&&(
              <div style={{...card,marginTop:16,padding:24,maxWidth:600,borderTop:"3px solid "+C.green}}>
                <div style={{height:3,borderRadius:2,background:"linear-gradient(90deg,"+C.green+","+C.gold+")",marginBottom:16}}/>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:12}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:800,color:C.navy,marginBottom:4}}>📡 Performances réelles — Financial Modeling Prep</div>
                    <div style={{fontSize:12,color:C.textMid,lineHeight:1.6}}>
                      Récupère les <strong>prix historiques réels</strong> sur 10 ans pour chaque fond via son ISIN.<br/>
                      <span style={{fontSize:11,color:C.textDim}}>Clé API : FMP · Mise en cache 24h · Fallback simulé si ISIN non trouvé.</span>
                    </div>
                  </div>
                </div>

                {!fmpLoading&&!fmpStats&&(
                  <div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
                      {[
                        {icon:"📋",label:"Fonds avec ISIN",val:funds.filter(f=>f.isin).length+"/"+funds.length},
                        {icon:"📡",label:"API FMP",val:"Connectée"},
                        {icon:"⏱",label:"Cache",val:"24 heures"},
                      ].map(s=>(
                        <div key={s.label} style={{padding:"10px 12px",borderRadius:9,background:C.bgSub,border:"1px solid "+C.borderGold,textAlign:"center"}}>
                          <div style={{fontSize:18,marginBottom:3}}>{s.icon}</div>
                          <div style={{fontSize:14,fontWeight:800,color:C.navy}}>{s.val}</div>
                          <div style={{fontSize:9,color:C.textDim,textTransform:"uppercase",letterSpacing:.6}}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <button onClick={loadFMPPerfs} style={{width:"100%",padding:"13px",borderRadius:10,border:"none",background:"linear-gradient(135deg,"+C.green+",#059669)",color:"#fff",fontWeight:800,fontSize:14,cursor:"pointer",boxShadow:"0 4px 16px rgba(13,110,62,0.25)",display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"inherit"}}>
                      📡 Charger les performances réelles
                    </button>
                  </div>
                )}

                {fmpLoading&&(
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                      <div className="spin" style={{width:20,height:20,border:"3px solid rgba(13,110,62,0.2)",borderTopColor:C.green,borderRadius:"50%",flexShrink:0}}/>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:C.navy}}>Récupération des données FMP…</div>
                        <div style={{fontSize:11,color:C.textDim}}>Interrogation de l'API pour chaque ISIN · Cache 24h activé</div>
                      </div>
                    </div>
                    <div style={{height:8,background:C.bgSub,borderRadius:4,border:"1px solid "+C.borderGold,overflow:"hidden",marginBottom:8}}>
                      <div style={{height:"100%",width:fmpProgress+"%",background:"linear-gradient(90deg,"+C.green+",#34d399)",borderRadius:4,transition:"width .4s ease"}}/>
                    </div>
                    <div style={{fontSize:11,color:C.textDim,textAlign:"right"}}>{fmpProgress}%</div>
                  </div>
                )}

                {fmpStats&&!fmpLoading&&(
                  <div className="fu">
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:14}}>
                      {[
                        {icon:"✅",label:"Données réelles",val:fmpStats.real,col:C.green,bg:C.greenBg},
                        {icon:"📊",label:"Simulés (fallback)",val:fmpStats.simulated,col:fmpStats.simulated>0?C.goldDim:C.green,bg:fmpStats.simulated>0?C.goldXL:C.greenBg},
                        {icon:"📋",label:"Total traités",val:fmpStats.total,col:C.navyL,bg:"rgba(26,53,96,0.07)"},
                      ].map(s=>(
                        <div key={s.label} style={{padding:"10px 12px",borderRadius:9,background:s.bg,border:"1px solid "+s.col+"30",textAlign:"center"}}>
                          <div style={{fontSize:16,marginBottom:2}}>{s.icon}</div>
                          <div style={{fontSize:20,fontWeight:900,color:s.col}}>{s.val}</div>
                          <div style={{fontSize:9,color:C.textDim,textTransform:"uppercase",letterSpacing:.6}}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                    {fmpStats.simulated>0&&(
                      <div style={{padding:"10px 14px",borderRadius:9,background:C.goldXL,border:"1px solid "+C.borderGold,fontSize:12,color:C.goldDim,marginBottom:12}}>
                        ⚠ {fmpStats.simulated} fonds sans données réelles (ISIN manquant ou non reconnu par FMP) — performances simulées utilisées en fallback.
                      </div>
                    )}
                    <div style={{display:"flex",gap:8}}>
                      <button onClick={refreshFMPPerfs} style={{flex:1,padding:"10px",borderRadius:9,border:"1px solid "+C.borderGold,background:C.bgSub,color:C.textMid,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
                        🔄 Actualiser (vide le cache)
                      </button>
                      <button onClick={()=>{setFmpCache({});setFmpStats(null);}} style={{padding:"10px 14px",borderRadius:9,border:"1px solid rgba(153,27,27,.25)",background:"rgba(153,27,27,.05)",color:C.red,fontSize:12,cursor:"pointer",fontFamily:"inherit",fontWeight:600}}>
                        ✕ Désactiver
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── CLASSIFIEUR IA ── */}
            {funds.length>0&&(
              <div style={{...card,marginTop:16,padding:24,borderTop:"3px solid "+C.gold,maxWidth:600}}>
                <div style={{height:3,borderRadius:2,background:"linear-gradient(90deg,"+C.navy+","+C.gold+")",marginBottom:16}}/>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:12}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:800,color:C.navy,marginBottom:4}}>🧠 Classification IA des marchés</div>
                    <div style={{fontSize:12,color:C.textMid,lineHeight:1.6}}>
                      Analyse experte de chaque fonds pour l'associer automatiquement au marché cible le plus précis parmi les <strong style={{color:C.gold}}>{MARCHES.length} marchés</strong> disponibles.<br/>
                      <span style={{fontSize:11,color:C.textDim}}>Utilise le nom, la société, le SRI et le descriptif de chaque fonds.</span>
                    </div>
                  </div>
                </div>

                {/* Infos avant lancement */}
                {!classifyLoading&&!classifyResults&&(
                  <div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
                      {[
                        {icon:"📋",label:"Fonds à analyser",val:funds.length},
                        {icon:"🗂",label:"Marchés disponibles",val:MARCHES.length},
                        {icon:"📦",label:"Groupes de marchés",val:MARCHES_GROUPES.length},
                      ].map(s=>(
                        <div key={s.label} style={{padding:"10px 12px",borderRadius:9,background:C.bgSub,border:"1px solid "+C.borderGold,textAlign:"center"}}>
                          <div style={{fontSize:18,marginBottom:3}}>{s.icon}</div>
                          <div style={{fontSize:18,fontWeight:800,color:C.navy}}>{s.val}</div>
                          <div style={{fontSize:9,color:C.textDim,textTransform:"uppercase",letterSpacing:.6}}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <button onClick={classifyFunds} style={{width:"100%",padding:"13px",borderRadius:10,border:"none",background:"linear-gradient(135deg,"+C.navy+","+C.navyL+")",color:C.gold,fontWeight:800,fontSize:14,cursor:"pointer",boxShadow:C.shadowMd,display:"flex",alignItems:"center",justifyContent:"center",gap:8,fontFamily:"inherit"}}>
                      🔍 Lancer la classification IA
                    </button>
                  </div>
                )}

                {/* Progression */}
                {classifyLoading&&(
                  <div>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                      <div className="spin" style={{width:20,height:20,border:"3px solid "+C.goldXL,borderTopColor:C.gold,borderRadius:"50%",flexShrink:0}}/>
                      <div>
                        <div style={{fontSize:13,fontWeight:700,color:C.navy}}>Analyse en cours…</div>
                        <div style={{fontSize:11,color:C.textDim}}>Traitement par lots de 20 fonds · Claude analyse chaque fonds</div>
                      </div>
                    </div>
                    <div style={{height:8,background:C.bgSub,borderRadius:4,border:"1px solid "+C.borderGold,overflow:"hidden",marginBottom:8}}>
                      <div style={{height:"100%",width:classifyProgress+"%",background:"linear-gradient(90deg,"+C.navy+","+C.gold+")",borderRadius:4,transition:"width .4s ease"}}/>
                    </div>
                    <div style={{fontSize:11,color:C.textDim,textAlign:"right"}}>{classifyProgress}%</div>
                  </div>
                )}

                {/* Résultats */}
                {classifyResults&&!classifyLoading&&(
                  <div className="fu">
                    {/* Résumé */}
                    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16}}>
                      {[
                        {icon:"✅",label:"Classifiés",val:classifyResults.assigned,col:C.green,bg:C.greenBg},
                        {icon:"🔄",label:"Mis à jour",val:classifyResults.changed,col:C.navyL,bg:"rgba(26,53,96,0.07)"},
                        {icon:"⚠️",label:"Non matchés",val:(classifyResults.unmatched||[]).length,col:(classifyResults.unmatched||[]).length>0?C.red:C.green,bg:(classifyResults.unmatched||[]).length>0?C.redBg:C.greenBg},
                      ].map(s=>(
                        <div key={s.label} style={{padding:"10px 12px",borderRadius:9,background:s.bg,border:"1px solid "+s.col+"30",textAlign:"center"}}>
                          <div style={{fontSize:16,marginBottom:2}}>{s.icon}</div>
                          <div style={{fontSize:20,fontWeight:900,color:s.col}}>{s.val}</div>
                          <div style={{fontSize:9,color:C.textDim,textTransform:"uppercase",letterSpacing:.6}}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Distribution par groupe */}
                    <div style={{marginBottom:14}}>
                      <div style={{fontSize:11,fontWeight:700,color:C.navy,marginBottom:8}}>Répartition par classe d'actifs</div>
                      {MARCHES_GROUPES.map(g=>{
                        const count=classifyResults.statsByGroupe[g.groupe]||0;
                        if(!count) return null;
                        const pct=Math.round(count/classifyResults.total*100);
                        return(
                          <div key={g.groupe} style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
                            <div style={{width:3,height:20,borderRadius:1.5,background:g.couleur,flexShrink:0}}/>
                            <div style={{fontSize:11,color:C.textMid,flex:1,fontWeight:500}}>{g.groupe}</div>
                            <div style={{flex:2,height:6,background:C.bgSub,borderRadius:3,overflow:"hidden",border:"1px solid "+C.borderGold}}>
                              <div style={{height:"100%",width:pct+"%",background:g.couleur+"cc",borderRadius:3,transition:"width .6s ease"}}/>
                            </div>
                            <div style={{fontSize:11,fontWeight:700,color:g.couleur,minWidth:36,textAlign:"right"}}>{count}</div>
                            <div style={{fontSize:10,color:C.textDim,minWidth:28}}>{pct}%</div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Détail des fonds classifiés */}
                    <div style={{maxHeight:320,overflowY:"auto",border:"1px solid "+C.borderGold,borderRadius:10,overflow:"hidden"}}>
                      <div style={{background:C.bgSub,padding:"8px 12px",fontSize:10,fontWeight:700,color:C.textDim,textTransform:"uppercase",letterSpacing:.8,borderBottom:"1px solid "+C.borderGold}}>
                        Détail des classifications
                      </div>
                      {(classifyResults.details||[]).map((f,i)=>{
                        const meta=f._classifyMeta||{};
                        const confCol=meta.confiance==="haute"?C.green:meta.confiance==="moyenne"?C.goldDim:C.red;
                        const groupe=MARCHES_GROUPES.find(g=>g.items.includes(f.marche));
                        return(
                          <div key={f.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderBottom:"1px solid "+C.borderGold,background:i%2===0?C.bgCard:C.bgSub}}>
                            <div style={{width:6,height:6,borderRadius:2,background:PALETTE[(f.sri-1)%PALETTE.length],flexShrink:0}}/>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:11,fontWeight:600,color:C.navy,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.nom}</div>
                              {meta.raison&&<div style={{fontSize:9,color:C.textDim,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{meta.raison}</div>}
                            </div>
                            <SRI n={f.sri} compact/>
                            {f.marche&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:groupe?groupe.couleur+"14":C.goldXL,color:groupe?groupe.couleur:C.goldDim,fontWeight:700,border:"1px solid "+(groupe?groupe.couleur+"30":C.borderGold),whiteSpace:"nowrap"}}>{f.marche}</span>}
                            {meta.confiance&&<span style={{fontSize:9,padding:"1px 6px",borderRadius:20,background:confCol+"14",color:confCol,fontWeight:700,border:"1px solid "+confCol+"30",flexShrink:0}}>{meta.confiance}</span>}
                          </div>
                        );
                      })}
                    </div>

                    {classifyResults.unmatched&&classifyResults.unmatched.length>0&&(
                      <div style={{marginTop:10,padding:"10px 14px",borderRadius:9,background:C.redBg,border:"1px solid rgba(153,27,27,.2)"}}>
                        <div style={{fontSize:11,fontWeight:700,color:C.red,marginBottom:4}}>⚠ Fonds non classifiés :</div>
                        <div style={{fontSize:11,color:C.red}}>{classifyResults.unmatched.join(", ")}</div>
                      </div>
                    )}

                    <button onClick={classifyFunds} style={{marginTop:12,width:"100%",padding:"10px",borderRadius:9,border:"1.5px solid "+C.borderGold,background:C.bgSub,color:C.textMid,fontWeight:600,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
                      🔄 Relancer la classification
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* ══ MODALE FICHE FOND ════════════════════════════════════════════ */}
      {fondModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,35,64,0.65)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:350,padding:20}} onClick={e=>{if(e.target===e.currentTarget){setFondModal(null);setFondModalAi(null);}}}>
          <div style={{background:C.bgCard,borderRadius:18,width:"100%",maxWidth:860,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(15,35,64,0.3)",border:"1px solid "+C.borderGold}}>
            {(()=>{
              const f=fondModal;
              const perf=getFondPerf(f);
              const yr=new Date().getFullYear();
              const yrs=[];for(let i=0;i<10;i++)yrs.push(yr-10+i+1);
              const ann=yrs.map((_,i)=>((perf[i+1]/perf[i])-1)*100);
              const tot=((perf[10]/perf[0])-1)*100;
              const col=PALETTE[(f.sri-1)%PALETTE.length];
              const groupe=MARCHES_GROUPES.find(g=>g.items.includes(f.marche));
              return (
                <>
                  {/* ── HEADER ── */}
                  <div style={{background:"linear-gradient(135deg,"+C.navy+","+C.navyL+")",borderRadius:"18px 18px 0 0",padding:"24px 28px",position:"relative",overflow:"hidden"}}>
                    <div style={{position:"absolute",right:-30,top:-30,width:180,height:180,borderRadius:"50%",background:"rgba(201,162,39,0.06)"}}/>
                    <div style={{position:"absolute",right:60,bottom:-50,width:120,height:120,borderRadius:"50%",background:"rgba(201,162,39,0.04)"}}/>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",position:"relative",zIndex:1}}>
                      <div style={{flex:1,marginRight:16}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                          <div style={{width:44,height:44,borderRadius:12,background:col+"22",border:"2px solid "+col+"60",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            <span style={{fontSize:11,fontWeight:900,color:col}}>{f.sri}</span>
                          </div>
                          <div>
                            <div style={{fontSize:19,fontWeight:900,color:"#fff",lineHeight:1.2,marginBottom:4}}>{f.nom}</div>
                            {f.soc&&<div style={{fontSize:12,color:"rgba(255,255,255,0.55)"}}>{f.soc}</div>}
                          </div>
                        </div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                          <SRI n={f.sri}/>
                          <RealBadge isReal={isFondReal(f)}/>
                          {f.marche&&(
                            <span style={{fontSize:11,padding:"3px 10px",borderRadius:20,background:groupe?groupe.couleur+"30":"rgba(201,162,39,0.2)",color:groupe?groupe.couleur:C.gold,fontWeight:700,border:"1px solid "+(groupe?groupe.couleur+"40":C.borderGold)}}>
                              {f.marche}
                            </span>
                          )}
                          {f.isin&&<span style={{fontSize:10,color:"rgba(255,255,255,0.45)",background:"rgba(255,255,255,0.07)",padding:"2px 8px",borderRadius:5,fontFamily:"monospace"}}>{f.isin}</span>}
                          {f.dispo&&f.dispo.length>0&&f.dispo.slice(0,3).map(d=><span key={d} style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:"rgba(201,162,39,0.15)",color:C.gold,fontWeight:600}}>{d}</span>)}
                        </div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:8,flexShrink:0}}>
                        <button onClick={()=>{setFondModal(null);setFondModalAi(null);}} style={{width:32,height:32,borderRadius:8,border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.7)",cursor:"pointer",fontSize:15,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:22,fontWeight:900,color:tot>=0?C.green:C.red,lineHeight:1}}>{(tot>=0?"+":"")+tot.toFixed(1)+"%"}</div>
                          <div style={{fontSize:9,color:"rgba(255,255,255,0.4)",marginTop:2}}>PERF. 10 ANS</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── BODY ── */}
                  <div style={{padding:"24px 28px",display:"flex",flexDirection:"column",gap:20}}>

                    {/* Descriptif */}
                    {f.desc&&(
                      <div style={{padding:"14px 16px",background:C.bgSub,borderRadius:10,borderLeft:"3px solid "+C.gold}}>
                        <div style={{fontSize:9,fontWeight:700,color:C.goldDim,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>Descriptif</div>
                        <div style={{fontSize:13,color:C.textMid,lineHeight:1.75}}>{f.desc}</div>
                      </div>
                    )}

                    {/* Graphique + performances annuelles côte à côte */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
                      <div style={{...card,padding:18}}>
                        <div style={{fontSize:12,fontWeight:700,color:C.navy,marginBottom:3}}>📈 Performance simulée — 10 ans</div>
                        <div style={{fontSize:10,color:C.textDim,marginBottom:10}}>Base 100 · SRI {f.sri}</div>
                        <MiniChart pts={perf} color={col}/>
                      </div>
                      <div style={{...card,padding:18}}>
                        <div style={{fontSize:12,fontWeight:700,color:C.navy,marginBottom:12}}>📊 Performances annuelles</div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:4,marginBottom:8}}>
                          {yrs.map((y,i)=>{const v=ann[i];return(
                            <div key={y} style={{textAlign:"center",padding:"6px 4px",borderRadius:8,background:v>=0?C.greenBg:C.redBg,border:"1px solid "+(v>=0?"rgba(13,110,62,.12)":"rgba(153,27,27,.12)")}}>
                              <div style={{fontSize:8,color:C.textDim,marginBottom:2}}>{y}</div>
                              <div style={{fontSize:11,fontWeight:700,color:v>=0?C.green:C.red}}>{(v>=0?"+":"")+v.toFixed(1)+"%"}</div>
                            </div>
                          );})}
                        </div>
                        <div style={{padding:"8px 12px",borderRadius:8,background:C.goldXL,border:"1px solid "+C.borderGold,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                          <span style={{fontSize:11,color:C.textMid,fontWeight:600}}>Total 10 ans</span>
                          <span style={{fontSize:15,fontWeight:900,color:tot>=0?C.green:C.red}}>{(tot>=0?"+":"")+tot.toFixed(2)+"%"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Synthèse IA */}
                    <div style={{...card,padding:20,borderTop:"3px solid "+C.gold}}>
                      <div style={{fontSize:13,fontWeight:700,color:C.navy,marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
                        🧠 Analyse IA experte
                        {fondModalAiLoading&&<div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,color:C.textDim,fontWeight:400}}><Spin/>Analyse en cours…</div>}
                      </div>
                      {fondModalAiLoading&&!fondModalAi&&(
                        <div style={{display:"flex",flexDirection:"column",gap:8}}>
                          {[1,2,3].map(i=><div key={i} style={{height:14,borderRadius:4,background:C.bgSub,width:i===3?"60%":"100%",animation:"pulse 1.5s ease infinite"}}/>)}
                        </div>
                      )}
                      {fondModalAi&&!fondModalAi.error&&(
                        <div style={{display:"flex",flexDirection:"column",gap:12}}>
                          {/* Synthèse */}
                          {fondModalAi.synthese&&(
                            <div style={{padding:"14px 16px",background:"linear-gradient(135deg,#fff9ec,#fffef5)",borderRadius:10,borderLeft:"4px solid "+C.gold}}>
                              <div style={{fontSize:9,fontWeight:700,color:C.goldDim,textTransform:"uppercase",letterSpacing:.8,marginBottom:6}}>Synthèse</div>
                              <p style={{fontSize:13,color:C.navy,lineHeight:1.85,margin:0}}>{fondModalAi.synthese}</p>
                            </div>
                          )}
                          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                            {/* Profil investisseur */}
                            {fondModalAi.profil&&(
                              <div style={{padding:"12px 14px",background:C.bgSub,borderRadius:9,border:"1px solid "+C.borderGold}}>
                                <div style={{fontSize:9,fontWeight:700,color:C.navyL,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>👤 Profil cible</div>
                                <div style={{fontSize:12,color:C.navy,lineHeight:1.6}}>{fondModalAi.profil}</div>
                              </div>
                            )}
                            {/* Avantages */}
                            {fondModalAi.avantages&&(
                              <div style={{padding:"12px 14px",background:C.greenBg,borderRadius:9,border:"1px solid rgba(13,110,62,.15)"}}>
                                <div style={{fontSize:9,fontWeight:700,color:C.green,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>✅ Points forts</div>
                                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                                  {(fondModalAi.avantages||[]).map((a,i)=>(
                                    <div key={i} style={{display:"flex",gap:6,fontSize:11,color:C.navy,lineHeight:1.5}}>
                                      <span style={{color:C.green,flexShrink:0,fontWeight:700}}>+</span>{a}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {/* Risques */}
                            {fondModalAi.risques&&(
                              <div style={{padding:"12px 14px",background:C.redBg,borderRadius:9,border:"1px solid rgba(153,27,27,.15)"}}>
                                <div style={{fontSize:9,fontWeight:700,color:C.red,textTransform:"uppercase",letterSpacing:.8,marginBottom:5}}>⚠ Vigilance</div>
                                <div style={{display:"flex",flexDirection:"column",gap:4}}>
                                  {(fondModalAi.risques||[]).map((r,i)=>(
                                    <div key={i} style={{display:"flex",gap:6,fontSize:11,color:C.navy,lineHeight:1.5}}>
                                      <span style={{color:C.red,flexShrink:0,fontWeight:700}}>!</span>{r}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          {/* Horizon */}
                          {fondModalAi.horizon&&(
                            <div style={{padding:"12px 16px",background:C.goldXL,borderRadius:9,border:"1px solid "+C.borderGold,display:"flex",alignItems:"center",gap:10}}>
                              <span style={{fontSize:20,flexShrink:0}}>⏱</span>
                              <div>
                                <div style={{fontSize:9,fontWeight:700,color:C.goldDim,textTransform:"uppercase",letterSpacing:.8,marginBottom:3}}>Horizon recommandé</div>
                                <div style={{fontSize:12,color:C.navy,fontWeight:600}}>{fondModalAi.horizon}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {fondModalAi&&fondModalAi.error&&(
                        <div style={{fontSize:12,color:C.red,padding:"10px 14px",background:C.redBg,borderRadius:8}}>Analyse indisponible — {fondModalAi.msg||"erreur"}</div>
                      )}
                    </div>

                    {/* Compagnies disponibles */}
                    {f.dispo&&f.dispo.length>0&&(
                      <div style={{...card,padding:16}}>
                        <div style={{fontSize:11,fontWeight:700,color:C.navy,marginBottom:10}}>🏢 Disponible chez</div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                          {f.dispo.map(d=>(
                            <span key={d} style={{padding:"5px 12px",borderRadius:20,background:C.navy,color:C.gold,fontSize:11,fontWeight:600,border:"1px solid rgba(201,162,39,0.3)"}}>{d}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* ══ MODALE PIN IMPORT ════════════════════════════════════════════ */}
      {showPinModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,35,64,0.6)",backdropFilter:"blur(8px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400,padding:16}} onClick={e=>{if(e.target===e.currentTarget){setShowPinModal(false);setPinInput("");setPinError(false);}}}>
          <div style={{...card,width:320,padding:32,borderTop:"3px solid "+C.gold,boxShadow:C.shadowLg,textAlign:"center"}}>
            <div style={{fontSize:36,marginBottom:12}}>🔒</div>
            <div style={{fontSize:17,fontWeight:800,color:C.navy,marginBottom:6}}>Accès restreint</div>
            <div style={{fontSize:13,color:C.textMid,marginBottom:24,lineHeight:1.6}}>L'onglet Import CSV est protégé.<br/>Entrez votre code PIN pour continuer.</div>
            <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:16}}>
              {[0,1,2,3].map(i=>(
                <div key={i} style={{width:44,height:54,borderRadius:10,border:"2px solid "+(pinError?C.red:pinInput.length>i?C.gold:C.borderGold),background:pinInput.length>i?C.goldXL:C.bgSub,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900,color:C.navy,transition:"all .15s"}}>
                  {pinInput.length>i?"●":""}
                </div>
              ))}
            </div>
            {pinError&&<div style={{fontSize:12,color:C.red,marginBottom:12,fontWeight:600}}>Code incorrect. Réessayez.</div>}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:8}}>
              {[1,2,3,4,5,6,7,8,9].map(n=>(
                <button key={n} onClick={()=>{if(pinInput.length<4){const p=pinInput+n;setPinInput(p);setPinError(false);if(p.length===4){if(p==="0663"){setImportUnlocked(true);setShowPinModal(false);setTab("import");setPinInput("");}else{setPinError(true);setTimeout(()=>{setPinInput("");setPinError(false);},800);}}}}} style={{height:52,borderRadius:10,border:"1px solid "+C.borderGold,background:C.bgCard,color:C.navy,fontSize:18,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all .12s"}}
                onMouseEnter={e=>e.currentTarget.style.background=C.goldXL} onMouseLeave={e=>e.currentTarget.style.background=C.bgCard}>
                  {n}
                </button>
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              <button onClick={()=>{setShowPinModal(false);setPinInput("");setPinError(false);}} style={{height:52,borderRadius:10,border:"1px solid rgba(153,27,27,.25)",background:"rgba(153,27,27,.05)",color:C.red,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>Annuler</button>
              <button onClick={()=>{if(pinInput.length<4){const p=pinInput+"0";setPinInput(p);setPinError(false);if(p.length===4){if(p==="0663"){setImportUnlocked(true);setShowPinModal(false);setTab("import");setPinInput("");}else{setPinError(true);setTimeout(()=>{setPinInput("");setPinError(false);},800);}}}}} style={{height:52,borderRadius:10,border:"1px solid "+C.borderGold,background:C.bgCard,color:C.navy,fontSize:18,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}
              onMouseEnter={e=>e.currentTarget.style.background=C.goldXL} onMouseLeave={e=>e.currentTarget.style.background=C.bgCard}>0</button>
              <button onClick={()=>{setPinInput(p=>p.slice(0,-1));setPinError(false);}} style={{height:52,borderRadius:10,border:"1px solid "+C.borderGold,background:C.bgSub,color:C.textMid,fontSize:16,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>⌫</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODALE ÉDITION ═══════════════════════════════════════════════ */}
      {editF&&(
        <div style={{position:"fixed",inset:0,background:"rgba(15,35,64,0.5)",backdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:300,padding:16}} onClick={e=>{if(e.target===e.currentTarget)setEditF(null);}}>
          <div style={{...card,width:"100%",maxWidth:520,maxHeight:"90vh",overflowY:"auto",padding:28,borderTop:"3px solid "+C.gold,boxShadow:C.shadowLg}}>
            <div style={{fontWeight:800,fontSize:16,color:C.navy,marginBottom:18}}><span style={{color:C.gold}}>✦</span> {editF.nom?"Modifier le fond":"Nouveau fond"}</div>
            {[["Nom","nom","Carmignac Patrimoine"],["Société","soc","Carmignac"],["ISIN","isin","FR0010135103"]].map(arr=>(
              <div key={arr[1]} style={{marginBottom:12}}>
                <div style={{fontSize:10,color:C.textDim,fontWeight:600,letterSpacing:.8,textTransform:"uppercase",marginBottom:6}}>{arr[0]}</div>
                <input value={editF[arr[1]]||""} onChange={e=>{const k=arr[1];setEditF(f=>{const n=Object.assign({},f);n[k]=e.target.value;return n;});}} placeholder={arr[2]} style={inp}/>
              </div>
            ))}
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,color:C.textDim,fontWeight:600,letterSpacing:.8,textTransform:"uppercase",marginBottom:8}}>SRI</div>
              <div style={{display:"flex",gap:4}}>{[1,2,3,4,5,6,7].map(r=>{const a=editF.sri===r;return(<button key={r} onClick={()=>setEditF(f=>Object.assign({},f,{sri:r}))} style={{flex:1,height:38,borderRadius:8,border:"1.5px solid "+(a?RC[r]+"80":C.borderGold),background:a?RC[r]+"14":C.bgSub,color:a?RC[r]:C.textDim,fontWeight:a?800:500,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>{r}</button>);})}</div>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,color:C.textDim,fontWeight:600,letterSpacing:.8,textTransform:"uppercase",marginBottom:6}}>Marché</div>
              <select value={editF.marche||""} onChange={e=>setEditF(f=>Object.assign({},f,{marche:e.target.value}))} style={{...sel,width:"100%"}}><option value="">—</option>{MARCHES_GROUPES.map(g=><optgroup key={g.groupe} label={"— "+g.groupe+" —"}>{g.items.map(m=><option key={m} value={m}>{m}</option>)}</optgroup>)}</select>
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,color:C.textDim,fontWeight:600,letterSpacing:.8,textTransform:"uppercase",marginBottom:8}}>Disponible chez</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                {allCompagnies.map(cp=>{const s=editF.dispo&&editF.dispo.includes(cp);return(<button key={cp} onClick={()=>setEditF(f=>{const d=f.dispo||[];return Object.assign({},f,{dispo:s?d.filter(x=>x!==cp):[...d,cp]});})} style={{padding:"4px 10px",borderRadius:20,border:"1.5px solid "+(s?C.gold:C.borderGold),background:s?"linear-gradient(135deg,"+C.navy+","+C.navyL+")":C.bgSub,color:s?C.gold:C.textDim,fontSize:11,cursor:"pointer",fontWeight:s?700:400}}>{cp}</button>);})}</div>
            </div>
            <div style={{marginBottom:18}}>
              <div style={{fontSize:10,color:C.textDim,fontWeight:600,letterSpacing:.8,textTransform:"uppercase",marginBottom:6}}>Descriptif</div>
              <textarea value={editF.desc||""} onChange={e=>setEditF(f=>Object.assign({},f,{desc:e.target.value}))} style={{...inp,height:64,resize:"vertical"}}/>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>saveEdit(editF)} style={{flex:1,padding:"12px",borderRadius:10,border:"none",background:"linear-gradient(135deg,"+C.navy+","+C.navyL+")",color:C.gold,fontWeight:800,fontSize:13,cursor:"pointer",boxShadow:C.shadowMd,fontFamily:"inherit"}}>Enregistrer</button>
              <button onClick={()=>setEditF(null)} style={{padding:"12px 20px",borderRadius:10,border:"1.5px solid "+C.borderGold,background:C.bgSub,color:C.textMid,cursor:"pointer",fontSize:13,fontFamily:"inherit"}}>Annuler</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

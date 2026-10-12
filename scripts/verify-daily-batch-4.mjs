const userAgent = "HowConnected editorial verification (batch 4; contact: project owner)";

const titles = [
  "Java (programming language)", "James Gosling", "Sun Microsystems",
  "JavaScript", "Brendan Eich", "Netscape",
  "C++", "Bjarne Stroustrup", "Bell Labs",
  "Swift (programming language)", "Chris Lattner", "Apple Inc.",
  "IPod", "Tony Fadell", "Nest Labs",
  "Ford Motor Company", "Henry Ford", "Edison Illuminating Company",
  "Alibaba Group", "Jack Ma", "Hangzhou Normal University",
  "Virgin Group", "Richard Branson", "Virgin Galactic",
  "Patagonia, Inc.", "Yvon Chouinard", "1% for the Planet",
  "Sgt. Pepper's Lonely Hearts Club Band", "George Martin", "Associated Independent Recording",
  "Respect (song)", "Aretha Franklin", "Presidential Medal of Freedom",
  "Graceland (album)", "Paul Simon", "Gershwin Prize",
  "Arthur Ashe Stadium", "Arthur Ashe", "Presidential Medal of Freedom",
  "Stadio Diego Armando Maradona", "Diego Maradona", "SSC Napoli",
  "I Am Bolt", "Usain Bolt", "Order of Jamaica",
  "Turing Award", "Alan Turing", "Princeton University",
  "Salk Institute for Biological Studies", "Jonas Salk", "University of Pittsburgh",
  "Rosalind Franklin (rover)", "Rosalind Franklin", "King's College London",
  "Nelson's Column", "Horatio Nelson, 1st Viscount Nelson", "Battle of Trafalgar",
  "Machu Picchu", "Hiram Bingham III", "Yale University",
  "Rust (programming language)", "Graydon Hoare", "Mozilla Foundation",
  "BASIC", "John G. Kemeny", "Dartmouth College",
  "Amazon (company)", "Jeff Bezos", "Blue Origin",
  "Bloomberg L.P.", "Michael Bloomberg", "Bloomberg Philanthropies",
  "Songs in the Key of Life", "Stevie Wonder", "Presidential Medal of Freedom",
  "Cristiano Ronaldo International Airport", "Cristiano Ronaldo", "Manchester United F.C.",
  "Erasmus Programme", "Erasmus", "The Praise of Folly",
  "C Sharp (programming language)", "Anders Hejlsberg", "Microsoft",
  "Madeira Airport", "In Praise of Folly",
];

const interesting = new Set(["P54","P61","P69","P108","P112","P127","P1344","P138","P162","P166","P175","P178","P1830","P463","P921"]);

const candidates = [
  ["java-gosling-sun","Q251","P178","Q92622","P108","Q14647"],
  ["rust-hoare-mozilla","Q575650","P61","Q28937563","P108","Q169925"],
  ["cpp-stroustrup-bell-labs","Q2407","P178","Q92620","P108","Q217365"],
  ["swift-lattner-apple","Q17118377","P178","Q2964778","P108","Q312"],
  ["typescript-hejlsberg-microsoft","Q978185","P170","Q316544","P108","Q2283"],
  ["amazon-bezos-blue-origin","Q3884","P112","Q312556","P112","Q885836","forward","reverse"],
  ["alibaba-ma-hangzhou-normal","Q1359568","P112","Q1137062","P69","Q5648125"],
  ["virgin-group-branson-galactic","Q494917","P112","Q194419","P112","Q373225","forward","reverse"],
  ["bloomberg-company-founder-philanthropies","Q13977","P112","Q607","P112","Q16987920","forward","reverse"],
  ["sgt-pepper-martin-air","Q169226","P162","Q191819","P112","Q743026","forward","reverse"],
  ["songs-key-life-wonder-medal-freedom","Q845040","P175","Q714","P166","Q17144"],
  ["graceland-simon-gershwin","Q1027822","P175","Q4028","P166","Q2422622"],
  ["ashe-stadium-ashe-medal-freedom","Q609551","P138","Q53325","P166","Q17144"],
  ["maradona-stadium-maradona-napoli","Q82709","P138","Q17515","P54","Q2641"],
  ["madeira-airport-ronaldo-man-united","Q639161","P138","Q11571","P54","Q18656"],
  ["turing-award-turing-princeton","Q185667","P138","Q7251","P69","Q21578"],
  ["salk-institute-salk-pittsburgh","Q1351061","P112","Q200101","P108","Q235034"],
  ["franklin-rover-franklin-kings","Q3445540","P138","Q7474","P108","Q245247"],
  ["erasmus-programme-erasmus-folly","Q254168","P138","Q43499","P50","Q569869","forward","reverse"],
  ["machu-picchu-bingham-yale","Q676203","P61","Q237220","P69","Q49112"],
];

async function get(params) {
  const endpoint = new URL("https://www.wikidata.org/w/api.php");
  endpoint.search = new URLSearchParams({ ...params, format:"json", origin:"*" }).toString();
  const response = await fetch(endpoint, { headers:{ "User-Agent":userAgent } });
  if (!response.ok) throw new Error(`Wikidata request failed: ${response.status}`);
  return response.json();
}

if (process.argv.includes("--titles")) {
  const output = [];
  for (let index = 0; index < titles.length; index += 40) {
    const payload = await get({ action:"wbgetentities", sites:"enwiki", titles:titles.slice(index,index+40).join("|"), props:"labels|descriptions|sitelinks|claims", languages:"en", sitefilter:"enwiki" });
    for (const item of Object.values(payload.entities)) output.push({
      qid:item.id,
      label:item.labels?.en?.value ?? null,
      description:item.descriptions?.en?.value ?? null,
      title:item.sitelinks?.enwiki?.title ?? null,
      claims:Object.fromEntries(Object.entries(item.claims ?? {}).filter(([pid])=>interesting.has(pid)).map(([pid,claims])=>[pid,claims.map((claim)=>({rank:claim.rank,value:claim.mainsnak?.datavalue?.value?.id ?? null,qualifiers:Object.fromEntries(Object.entries(claim.qualifiers ?? {}).map(([qpid,snaks])=>[qpid,snaks.map((snak)=>snak.datavalue?.value?.time ?? snak.datavalue?.value?.id ?? snak.datavalue?.value ?? null)]))}))]))
    });
  }
  console.log(JSON.stringify(output,null,2));
}

if (process.argv.includes("--map")) {
  const output = [];
  for (let index = 0; index < titles.length; index += 40) {
    const payload = await get({ action:"wbgetentities", sites:"enwiki", titles:titles.slice(index,index+40).join("|"), props:"labels|descriptions|sitelinks", languages:"en", sitefilter:"enwiki" });
    for (const item of Object.values(payload.entities)) output.push({ qid:item.id ?? null, label:item.labels?.en?.value ?? null, title:item.sitelinks?.enwiki?.title ?? null });
  }
  console.log(JSON.stringify(output,null,2));
}

if (process.argv.includes("--verify")) {
  const ids = [...new Set(candidates.flatMap(([,a,,m,,b])=>[a,m,b]))];
  const entities = {};
  for (let index=0; index<ids.length; index+=40) {
    const payload = await get({ action:"wbgetentities", ids:ids.slice(index,index+40).join("|"), props:"labels|claims|sitelinks", languages:"en", sitefilter:"enwiki" });
    Object.assign(entities,payload.entities);
  }
  const values = (qid,pid)=>(entities[qid]?.claims?.[pid]??[]).filter((claim)=>claim.rank!=="deprecated").map((claim)=>claim.mainsnak?.datavalue?.value?.id).filter(Boolean);
  const results = candidates.map(([id,a,p1,m,p2,b,d1="forward",d2="forward"])=>{
    const edge1 = d1 === "reverse" ? values(m,p1).includes(a) : values(a,p1).includes(m);
    const edge2 = d2 === "reverse" ? values(b,p2).includes(m) : values(m,p2).includes(b);
    return {id,edge1,edge2,exactClaims:edge1&&edge2,sitelinks:[a,m,b].map((qid)=>({qid,title:entities[qid]?.sitelinks?.enwiki?.title??null})),edge1Values:d1==="reverse"?values(m,p1):values(a,p1),edge2Values:d2==="reverse"?values(b,p2):values(m,p2)};
  });
  console.log(JSON.stringify(results,null,2));
  if (results.some((item)=>!item.exactClaims)) process.exitCode=2;
}

if (process.argv.includes("--ambiguity")) {
  const branches = candidates.map(([id,a,p1,,p2,b,d1="forward",d2="forward"])=>{
    const first=d1==="reverse"?`?mid wdt:${p1} wd:${a}`:`wd:${a} wdt:${p1} ?mid`;
    const second=d2==="reverse"?`wd:${b} wdt:${p2} ?mid`:`?mid wdt:${p2} wd:${b}`;
    return `{ BIND("${id}" AS ?id) ${first}. ${second}. }`;
  }).join(" UNION ");
  const endpoint=new URL("https://query.wikidata.org/sparql");
  endpoint.searchParams.set("query",`SELECT ?id ?mid ?midLabel WHERE { ${branches} SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY ?id ?mid`);
  endpoint.searchParams.set("format","json");
  const response=await fetch(endpoint,{headers:{"User-Agent":userAgent,Accept:"application/sparql-results+json"}});
  if(!response.ok) throw new Error(`WDQS request failed: ${response.status}`);
  const payload=await response.json();
  console.log(JSON.stringify(payload.results.bindings.map((item)=>({id:item.id.value,qid:item.mid.value.split("/").at(-1),label:item.midLabel?.value??null})),null,2));
}

if (process.argv.includes("--links")) {
  const { readFile } = await import("node:fs/promises");
  const registry=JSON.parse(await readFile(new URL("../content/daily-puzzles.json",import.meta.url),"utf8"));
  const audit=JSON.parse(await readFile(new URL("../content/daily-batch-4-review.json",import.meta.url),"utf8"));
  const ids=new Set(audit.candidates.filter(x=>x.decision==="approved").map(x=>x.id));
  const batch=registry.filter(x=>ids.has(x.id));
  const urls=[...new Set([...batch.flatMap(x=>[...x.path.map(n=>n.wikipediaUrl),...x.relationships.flatMap(r=>r.evidence.filter(e=>e.kind==="supporting").map(e=>e.url))]),...audit.candidates.filter(x=>x.decision==="rejected").flatMap(x=>[...x.wikipediaLinks.map(n=>n.url),...x.sourceEvidence.filter(e=>e.kind==="supporting").map(e=>e.url)])])];
  const results=[];
  for(let i=0;i<urls.length;i+=8)results.push(...await Promise.all(urls.slice(i,i+8).map(async url=>{try{const response=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(20000),headers:{"User-Agent":userAgent}});await response.body?.cancel();return{url,status:response.status,ok:response.ok,accessBlocked:[401,403,429].includes(response.status)};}catch(error){return{url,status:null,ok:false,error:error instanceof Error?error.message:String(error)};}})));
  const failed=results.filter(x=>!x.ok&&!x.accessBlocked);
  console.log(JSON.stringify({checkedAt:new Date().toISOString(),checked:results.length,accessBlocked:results.filter(x=>x.accessBlocked),failed},null,2));
  if(failed.length)process.exitCode=2;
}

if (process.argv.includes("--qualifiers")) {
  const ids=[...new Set(candidates.flatMap(([,a,,m,,b])=>[a,m,b]))],entities={};
  for(let i=0;i<ids.length;i+=40){const payload=await get({action:"wbgetentities",ids:ids.slice(i,i+40).join("|"),props:"claims",languages:"en"});Object.assign(entities,payload.entities);}
  const output=[];
  for(const [id,a,p1,m,p2,b,d1="forward",d2="forward"] of candidates){
    for(const [edge,qid,pid,target] of [[1,d1==="reverse"?m:a,p1,d1==="reverse"?a:m],[2,d2==="reverse"?b:m,p2,d2==="reverse"?m:b]]){
      const claim=(entities[qid]?.claims?.[pid]??[]).find(x=>x.rank!=="deprecated"&&x.mainsnak?.datavalue?.value?.id===target);
      output.push({id,edge,claim:`${qid} ${pid} ${target}`,qualifiers:Object.fromEntries(Object.entries(claim?.qualifiers??{}).map(([key,snaks])=>[key,snaks.map(s=>s.datavalue?.value?.time??s.datavalue?.value?.id??s.datavalue?.value??null)]))});
    }
  }
  console.log(JSON.stringify(output,null,2));
}

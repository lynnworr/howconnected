const userAgent = "HowConnected editorial verification (batch 5; contact: project owner)";

const titles = [
  "Get Out", "Jordan Peele", "Academy Award for Best Original Screenplay",
  "The Muppet Show", "Jim Henson", "University of Maryland, College Park",
  "The Lord of the Rings (film series)", "Peter Jackson", "WingNut Films",
  "Fleabag", "Phoebe Waller-Bridge", "No Time to Die",
  "Roma (2018 film)", "Alfonso Cuarón", "National Autonomous University of Mexico",
  "Mad Max: Fury Road", "George Miller (filmmaker)", "Happy Feet",
  "Breaking Bad", "Bryan Cranston", "Malcolm in the Middle",
  "Marshall Plan", "George C. Marshall", "Nobel Peace Prize",
  "Nuremberg trials", "Robert H. Jackson", "Associate Justice of the Supreme Court of the United States",
  "Normandy landings", "Dwight D. Eisenhower", "Columbia University",
  "Suez Crisis", "Anthony Eden", "Eton College",
  "Treaty of Versailles", "Georges Clemenceau", "Académie Française",
  "Apollo–Soyuz", "Alexei Leonov", "Hero of the Soviet Union",
  "Burj Khalifa", "Adrian Smith (architect)", "Skidmore, Owings & Merrill",
  "Mount Rushmore", "Gutzon Borglum", "Stone Mountain",
  "Gateway Arch", "Eero Saarinen", "TWA Flight Center",
  "Rhodes Scholarship", "Cecil Rhodes", "De Beers",
  "Arduino", "Massimo Banzi", "Interaction Design Institute Ivrea",
  "Doom (1993 video game)", "John Carmack", "Oculus VR",
  "Raspberry Pi", "Eben Upton", "University of Cambridge",
  "Pixar", "Edwin Catmull", "University of Utah",
  "FedEx", "Frederick W. Smith", "Yale University",
  "Southwest Airlines", "Herb Kelleher", "Wesleyan University",
  "Voyager Golden Record", "Carl Sagan", "Cornell University",
  "Pasteur Institute", "Louis Pasteur", "École normale supérieure (Paris)",
  "FIFA World Cup Trophy", "Silvio Gazzaniga", "Brera Academy",
  "Cool Runnings", "Jamaica national bobsleigh team", "1988 Winter Olympics",
  "Kind of Blue", "Miles Davis", "Juilliard School",
  "The Miseducation of Lauryn Hill", "Lauryn Hill", "Sister Act 2: Back in the Habit",
  "The Handmaid's Tale", "Margaret Atwood", "Booker Prize",
  "Alfred Nobel", "Dynamite", "Lincoln Memorial", "Abraham Lincoln", "President of the United States",
  "George Washington University", "George Washington", "Napoleon's theorem", "Napoleon", "Emperor of the French",
  "Anne Frank House", "Anne Frank", "Montessori Lyceum Amsterdam",
  "One World Trade Center", "Stack Overflow", "Joel Spolsky", "GitHub", "Chris Wanstrath", "University of Cincinnati",
  "WhatsApp", "Jan Koum", "Yahoo!", "Cosmos (Sagan book)",
  "FIFA Puskás Award", "Ferenc Puskás", "Real Madrid CF", "Jackie Robinson Day", "Jackie Robinson", "Brooklyn Dodgers",
  "Khan Academy", "Sal Khan", "Massachusetts Institute of Technology",
];

const interesting = new Set(["P39","P50","P54","P57","P58","P61","P69","P84","P108","P112","P1344","P138","P161","P166","P170","P175","P463","P710","P921"]);

const candidates = [
  ["get-out-peele-oscar","Q25136235","P57","Q3371986","P166","Q41417"],
  ["muppet-show-henson-maryland","Q2120540","P170","Q191037","P69","Q503415"],
  ["lotr-jackson-wingnut","Q190214","P57","Q4465","P112","Q3569323","forward","reverse"],
  ["fleabag-waller-bridge-bond","Q16868648","P170","Q16224046","P58","Q21534241","forward","reverse"],
  ["roma-cuaron-unam","Q27959455","P57","Q28028","P69","Q222738"],
  ["fury-road-miller-happy-feet","Q1757288","P57","Q446960","P57","Q126800","forward","reverse"],
  ["breaking-bad-cranston-malcolm","Q1079","P161","Q23547","P161","Q242596","forward","reverse"],
  ["marshall-plan-marshall-nobel","Q4576","P138","Q151414","P166","Q35637"],
  ["nobel-peace-nobel-dynamite","Q35637","P138","Q23810","P61","Q80728","forward","reverse"],
  ["lincoln-memorial-lincoln-president","Q213559","P138","Q91","P39","Q11696"],
  ["gwu-washington-president","Q432637","P138","Q23","P39","Q11696"],
  ["napoleon-theorem-emperor","Q637418","P138","Q517","P39","Q5373953"],
  ["anne-frank-house-montessori","Q165366","P138","Q4583","P69","Q3960588"],
  ["burj-som-one-world-trade","Q12495","P84","Q459464","P84","Q11245","forward","reverse"],
  ["mount-rushmore-borglum-stone-mountain","Q83497","P84","Q336432","P84","Q609700","forward","reverse"],
  ["gateway-arch-saarinen-twa","Q2027162","P84","Q167073","P84","Q29257","forward","reverse"],
  ["rhodes-scholarship-rhodes-de-beers","Q1204346","P138","Q19825","P112","Q471891","forward","reverse"],
  ["stack-overflow-spolsky-yale","Q549037","P112","Q2387083","P69","Q49112"],
  ["github-wanstrath-cincinnati","Q364","P112","Q27940879","P69","Q153265"],
  ["khan-academy-khan-mit","Q94887","P112","Q471472","P69","Q49108"],
  ["pixar-catmull-utah","Q127552","P112","Q93161","P69","Q168515"],
  ["fedex-smith-yale","Q459477","P112","Q324086","P69","Q49112"],
  ["southwest-kelleher-wesleyan","Q503308","P112","Q764247","P69","Q49167"],
  ["cosmos-sagan-cornell","Q1194705","P50","Q410","P108","Q49115"],
  ["pasteur-institute-pasteur-ens","Q391083","P112","Q529","P69","Q83259"],
  ["puskas-award-puskas-real-madrid","Q616031","P138","Q482931","P54","Q8682"],
  ["jackie-robinson-day-dodgers","Q585397","P138","Q221048","P54","Q5869184"],
  ["kind-of-blue-davis-juilliard","Q283221","P175","Q93341","P69","Q503246"],
  ["miseducation-hill-sister-act","Q945926","P175","Q214226","P161","Q1140762","forward","reverse"],
  ["handmaids-tale-atwood-booker","Q1541914","P50","Q183492","P166","Q160082"],
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
      qid:item.id, label:item.labels?.en?.value ?? null, description:item.descriptions?.en?.value ?? null,
      title:item.sitelinks?.enwiki?.title ?? null,
      claims:Object.fromEntries(Object.entries(item.claims ?? {}).filter(([pid])=>interesting.has(pid)).map(([pid,claims])=>[pid,claims.map((claim)=>({rank:claim.rank,value:claim.mainsnak?.datavalue?.value?.id ?? null,qualifiers:Object.fromEntries(Object.entries(claim.qualifiers ?? {}).map(([qpid,snaks])=>[qpid,snaks.map((snak)=>snak.datavalue?.value?.time ?? snak.datavalue?.value?.id ?? snak.datavalue?.value ?? null)]))}))]))
    });
  }
  console.log(JSON.stringify(output,null,2));
}

if (process.argv.includes("--map")) {
  const output = [];
  for (let index = 0; index < titles.length; index += 40) {
    const payload = await get({ action:"wbgetentities", sites:"enwiki", titles:titles.slice(index,index+40).join("|"), props:"labels|sitelinks", languages:"en", sitefilter:"enwiki" });
    for (const item of Object.values(payload.entities)) output.push({ qid:item.id ?? null, label:item.labels?.en?.value ?? null, title:item.sitelinks?.enwiki?.title ?? null });
  }
  console.log(JSON.stringify(output,null,2));
}

if (process.argv.includes("--search")) {
  const queries = ["Khan Academy", "Sal Khan", "Massachusetts Institute of Technology"];
  const output = [];
  for (const search of queries) {
    const payload = await get({ action:"wbsearchentities", search, language:"en", limit:"5", type:"item" });
    output.push({ search, results:payload.search.map(({id,label,description})=>({id,label,description})) });
  }
  console.log(JSON.stringify(output,null,2));
}

if (process.argv.includes("--verify") || process.argv.includes("--qualifiers")) {
  const ids = [...new Set(candidates.flatMap(([,a,,m,,b])=>[a,m,b]))], entities = {};
  for (let index=0; index<ids.length; index+=40) {
    const payload = await get({ action:"wbgetentities", ids:ids.slice(index,index+40).join("|"), props:"labels|claims|sitelinks", languages:"en", sitefilter:"enwiki" });
    Object.assign(entities,payload.entities);
  }
  const values=(qid,pid)=>(entities[qid]?.claims?.[pid]??[]).filter(x=>x.rank!=="deprecated").map(x=>x.mainsnak?.datavalue?.value?.id).filter(Boolean);
  if (process.argv.includes("--verify")) {
    const results=candidates.map(([id,a,p1,m,p2,b,d1="forward",d2="forward"])=>{
      const edge1=d1==="reverse"?values(m,p1).includes(a):values(a,p1).includes(m);
      const edge2=d2==="reverse"?values(b,p2).includes(m):values(m,p2).includes(b);
      return {id,edge1,edge2,exactClaims:edge1&&edge2,sitelinks:[a,m,b].map(qid=>({qid,title:entities[qid]?.sitelinks?.enwiki?.title??null})),edge1Values:d1==="reverse"?values(m,p1):values(a,p1),edge2Values:d2==="reverse"?values(b,p2):values(m,p2)};
    });
    console.log(JSON.stringify(process.argv.includes("--compact")?results.map(({id,edge1,edge2,exactClaims,sitelinks})=>({id,edge1,edge2,exactClaims,sitelinks})):results,null,2));
  }
  if (process.argv.includes("--qualifiers")) {
    const output=[];
    for(const [id,a,p1,m,p2,b,d1="forward",d2="forward"] of candidates) for(const [edge,qid,pid,target] of [[1,d1==="reverse"?m:a,p1,d1==="reverse"?a:m],[2,d2==="reverse"?b:m,p2,d2==="reverse"?m:b]]) {
      const claim=(entities[qid]?.claims?.[pid]??[]).find(x=>x.rank!=="deprecated"&&x.mainsnak?.datavalue?.value?.id===target);
      output.push({id,edge,claim:`${qid} ${pid} ${target}`,qualifiers:Object.fromEntries(Object.entries(claim?.qualifiers??{}).map(([key,snaks])=>[key,snaks.map(s=>s.datavalue?.value?.time??s.datavalue?.value?.id??s.datavalue?.value??null)]))});
    }
    console.log(JSON.stringify(output,null,2));
  }
}

if (process.argv.includes("--ambiguity")) {
  const branches=candidates.map(([id,a,p1,,p2,b,d1="forward",d2="forward"])=>`{ BIND("${id}" AS ?id) ${d1==="reverse"?`?mid wdt:${p1} wd:${a}`:`wd:${a} wdt:${p1} ?mid`}. ${d2==="reverse"?`wd:${b} wdt:${p2} ?mid`:`?mid wdt:${p2} wd:${b}`}. }`).join(" UNION ");
  const endpoint=new URL("https://query.wikidata.org/sparql"); endpoint.searchParams.set("query",`SELECT ?id ?mid ?midLabel WHERE { ${branches} SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY ?id ?mid`); endpoint.searchParams.set("format","json");
  const response=await fetch(endpoint,{headers:{"User-Agent":userAgent,Accept:"application/sparql-results+json"}}); if(!response.ok)throw new Error(`WDQS request failed: ${response.status}`);
  const payload=await response.json(),rows=payload.results.bindings.map(x=>({id:x.id.value,qid:x.mid.value.split("/").at(-1),label:x.midLabel?.value??null}));
  console.log(JSON.stringify(process.argv.includes("--compact")?Object.fromEntries([...new Set(candidates.map(x=>x[0]))].map(id=>[id,rows.filter(x=>x.id===id).length])):rows,null,2));
}

if (process.argv.includes("--links")) {
  const { readFile } = await import("node:fs/promises");
  const registry=JSON.parse(await readFile(new URL("../content/daily-puzzles.json",import.meta.url),"utf8"));
  const audit=JSON.parse(await readFile(new URL("../content/daily-batch-5-review.json",import.meta.url),"utf8"));
  const ids=new Set(audit.candidates.filter(x=>x.decision==="approved").map(x=>x.id));
  const batch=registry.filter(x=>ids.has(x.id));
  const urls=[...new Set([...batch.flatMap(x=>[...x.path.map(n=>n.wikipediaUrl),...x.relationships.flatMap(r=>r.evidence.filter(e=>e.kind==="supporting").map(e=>e.url))]),...audit.candidates.filter(x=>x.decision==="rejected").flatMap(x=>[...x.wikipediaLinks.map(n=>n.url),...x.sourceEvidence.filter(e=>e.kind==="supporting").map(e=>e.url)])])];
  const results=[];
  for(let i=0;i<urls.length;i+=8)results.push(...await Promise.all(urls.slice(i,i+8).map(async url=>{try{const response=await fetch(url,{redirect:"follow",signal:AbortSignal.timeout(25000),headers:{"User-Agent":userAgent}});await response.body?.cancel();return{url,status:response.status,ok:response.ok,accessBlocked:[401,403,429].includes(response.status)};}catch(error){return{url,status:null,ok:false,error:error instanceof Error?error.message:String(error)};}})));
  const failed=results.filter(x=>!x.ok&&!x.accessBlocked);
  console.log(JSON.stringify({checkedAt:new Date().toISOString(),checked:results.length,accessBlocked:results.filter(x=>x.accessBlocked),failed},null,2));
  if(failed.length)process.exitCode=2;
}

if (process.argv.includes("--distractors")) {
  const { readFile } = await import("node:fs/promises");
  const registry=JSON.parse(await readFile(new URL("../content/daily-puzzles.json",import.meta.url),"utf8"));
  const audit=JSON.parse(await readFile(new URL("../content/daily-batch-5-review.json",import.meta.url),"utf8"));
  const ids=new Set(audit.candidates.filter(x=>x.decision==="approved").map(x=>x.id)),batch=registry.filter(x=>ids.has(x.id));
  const qids=[...new Set(batch.flatMap(p=>[...p.path.map(n=>n.qid),...p.options.map(o=>o.qid)]))],entities={};
  for(let i=0;i<qids.length;i+=40){const payload=await get({action:"wbgetentities",ids:qids.slice(i,i+40).join("|"),props:"claims",languages:"en"});Object.assign(entities,payload.entities);}
  const values=(qid,pid)=>(entities[qid]?.claims?.[pid]??[]).filter(x=>x.rank!=="deprecated").map(x=>x.mainsnak?.datavalue?.value?.id).filter(Boolean);
  const failures=[];
  for(const p of batch)for(const option of p.options.filter(o=>o.id!==p.correctOptionId)){
    const [r1,r2]=p.relationships;
    const e1=r1.direction==="forward"?values(p.path[0].qid,r1.propertyId).includes(option.qid):values(option.qid,r1.propertyId).includes(p.path[0].qid);
    const e2=r2.direction==="forward"?values(option.qid,r2.propertyId).includes(p.path[2].qid):values(p.path[2].qid,r2.propertyId).includes(option.qid);
    if(e1&&e2)failures.push({id:p.id,distractor:option});
  }
  console.log(JSON.stringify({puzzles:batch.length,distractors:batch.length*3,failures},null,2));
  if(failures.length)process.exitCode=2;
}

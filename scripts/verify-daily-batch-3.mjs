const userAgent = "HowConnected content verification contact@howconnected.app";

const candidates = [
  ["rush-lauda-ferrari", "Q1768437", "P921", "Q78489", "P54", "Q169898"],
  ["pele-film-pele-cosmos", "Q105694930", "P921", "Q12897", "P54", "Q646135"],
  ["last-dance-jordan-medal-freedom", "Q85807688", "P921", "Q41421", "P166", "Q17144"],
  ["paris-1924-liddell-edinburgh", "Q8132", "P1344", "Q317422", "P69", "Q160302", "forward", "reverse"],
  ["milan-weah-liberia-president", "Q1543", "P54", "Q173139", "P39", "Q19161825", "forward", "reverse"],
  ["lombardi-trophy-lombardi-fordham", "Q2526532", "P138", "Q553321", "P54", "Q5468071"],
  ["everest-george-everest-royal-society", "Q513", "P138", "Q217119", "P463", "Q123885"],
  ["lake-victoria-queen-va", "Q5505", "P138", "Q9439", "P138", "Q213322", "reverse"],
  ["bolivia-bolivar-currency", "Q750", "P138", "Q8605", "P138", "Q203757", "reverse"],
  ["gregorian-calendar-gregory-university", "Q12138", "P138", "Q83029", "P138", "Q467025", "reverse"],
  ["rosetta-bouchard-polytechnique", "Q48584", "P61", "Q1386062", "P69", "Q273626"],
  ["tasmania-tasman-voc", "Q34366", "P138", "Q42188", "P108", "Q159766"],
  ["iran-crisis-carter-nobel-peace", "Q589673", "P710", "Q23685", "P166", "Q35637"],
  ["churchill-college-churchill-nobel", "Q714740", "P138", "Q8016", "P166", "Q37922"],
  ["roosevelt-park-roosevelt-nobel", "Q1137669", "P138", "Q33866", "P166", "Q35637"],
  ["webb-telescope-webb-nasa", "Q186447", "P138", "Q537520", "P108", "Q23548"],
  ["higgs-boson-higgs-edinburgh", "Q402", "P138", "Q192112", "P108", "Q160302"],
  ["thriller-jones-color-purple", "Q44320", "P162", "Q193645", "P86", "Q223299", "reverse"],
  ["back-black-winehouse-brit-school", "Q156670", "P175", "Q15897", "P69", "Q796940"],
  ["et-spielberg-csu-long-beach", "Q11621", "P57", "Q8877", "P69", "Q1026926"],
];

const distractorLabels = [
  "James Hunt racing driver", "Alain Prost", "Ayrton Senna",
  "Diego Maradona", "Neymar", "Lionel Messi",
  "Scottie Pippen", "Dennis Rodman", "LeBron James",
  "Paavo Nurmi", "Harold Abrahams", "Usain Bolt",
  "Paolo Maldini", "Kaka footballer", "Andriy Shevchenko",
  "Bill Belichick", "Andy Reid coach", "Tom Landry",
  "Edmund Hillary", "George Mallory", "Tenzing Norgay",
  "Elizabeth II", "Prince Albert of Saxe-Coburg and Gotha", "John Hanning Speke",
  "Hugo Chavez", "Jose de San Martin", "Antonio Jose de Sucre",
  "Julius Caesar", "Pope Gregory I", "Ignatius of Loyola",
  "Jean-Francois Champollion", "Napoleon", "Thomas Young scientist",
  "James Cook", "Matthew Flinders", "Willem Janszoon",
  "Ruhollah Khomeini", "Ronald Reagan", "Walter Mondale",
  "Clement Attlee", "Margaret Thatcher", "Neville Chamberlain",
  "Franklin D. Roosevelt", "William Howard Taft", "Woodrow Wilson",
  "Edwin Hubble", "Nancy Grace Roman", "Sean O'Keefe NASA",
  "Albert Einstein", "Stephen Hawking", "Richard Feynman",
  "Michael Jackson", "Rod Temperton", "Steven Spielberg",
  "Adele", "Duffy singer", "Lily Allen",
  "George Lucas", "James Cameron", "Robert Zemeckis",
];

if (process.argv.includes("--links")) {
  const { readFile } = await import("node:fs/promises");
  const registry = JSON.parse(await readFile(new URL("../content/daily-puzzles.json", import.meta.url), "utf8"));
  const audit = JSON.parse(await readFile(new URL("../content/daily-batch-3-review.json", import.meta.url), "utf8"));
  const ids = new Set(audit.candidates.filter((item) => item.decision === "approved").map((item) => item.id));
  const batch = registry.filter((item) => ids.has(item.id));
  const urls = [...new Set([...batch.flatMap((item) => [...item.path.map((entry) => entry.wikipediaUrl), ...item.relationships.flatMap((relationship) => relationship.evidence.filter((entry) => entry.kind === "supporting").map((entry) => entry.url))]), ...audit.candidates.filter((item) => item.decision === "rejected").flatMap((item) => [...item.wikipediaLinks.map((entry) => entry.url), ...item.sourceEvidence.map((entry) => entry.url)])])];
  const results = [];
  for (let index = 0; index < urls.length; index += 8) {
    results.push(...await Promise.all(urls.slice(index, index + 8).map(async (url) => {
      try { const response = await fetch(url, { redirect:"follow", signal:AbortSignal.timeout(20_000), headers:{"User-Agent":userAgent} }); await response.body?.cancel(); return {url,status:response.status,ok:response.ok,accessBlocked:[401,403,429].includes(response.status)}; }
      catch (error) { return {url,status:null,ok:false,error:error instanceof Error?error.message:String(error)}; }
    })));
  }
  const failed = results.filter((item) => !item.ok && !item.accessBlocked);
  console.log(JSON.stringify({checkedAt:new Date().toISOString(),checked:results.length,accessBlocked:results.filter((item)=>item.accessBlocked),failed},null,2));
  if (failed.length) process.exitCode=2;
}

const searchLabels = [
  "Moneyball 2011 film", "Billy Beane", "Oakland Athletics",
  "Rush 2013 film", "Niki Lauda", "Scuderia Ferrari",
  "Pele 2021 film", "Pele footballer", "New York Cosmos 1970",
  "The Last Dance documentary", "Michael Jordan", "Presidential Medal of Freedom",
  "Chariots of Fire", "Eric Liddell", "1924 Summer Olympics",
  "Cool Runnings", "Jamaica national bobsleigh team", "1988 Winter Olympics",
  "Mount Everest", "George Everest", "Royal Geographical Society",
  "Lake Victoria", "Queen Victoria", "Victoria and Albert Museum",
  "Cook Islands", "James Cook", "Royal Society",
  "Bolivia", "Simon Bolivar", "Venezuelan bolivar currency",
  "Gregorian calendar", "Pope Gregory XIII", "Pontifical Gregorian University",
  "Rosetta Stone", "Pierre-Francois Bouchard", "French Army",
  "Treaty of Versailles", "Woodrow Wilson", "Nobel Peace Prize",
  "Yalta Conference", "Winston Churchill", "Nobel Prize in Literature",
  "Camp David Accords", "Jimmy Carter", "Nobel Peace Prize",
  "Dolly sheep", "Ian Wilmut", "University of Edinburgh",
  "Higgs boson", "Peter Higgs", "University of Edinburgh",
  "Thriller Michael Jackson album", "Quincy Jones", "The Color Purple 1985 film",
  "Back to Black album", "Amy Winehouse", "BRIT School",
  "E.T. the Extra-Terrestrial", "Steven Spielberg", "California State University Long Beach",
];

const replacementLabels = [
  "1924 Summer Olympics", "Eric Liddell", "University of Edinburgh",
  "A.C. Milan", "George Weah", "President of Liberia",
  "Super Bowl Most Valuable Player Award", "Tom Brady", "Birmingham City F.C.",
  "Tasmania", "Abel Tasman", "Dutch East India Company",
  "Paris Peace Conference 1919", "Woodrow Wilson", "Nobel Peace Prize",
  "Iran hostage crisis", "Jimmy Carter", "Nobel Peace Prize",
  "World War II", "Winston Churchill", "Nobel Prize in Literature",
  "James Webb Space Telescope", "James E. Webb", "NASA",
  "Senna documentary", "Ayrton Senna", "McLaren",
  "Churchill tank", "Winston Churchill", "Nobel Prize in Literature",
  "Mount Rushmore", "Theodore Roosevelt", "Nobel Peace Prize",
  "Churchill College Cambridge", "Winston Churchill", "Nobel Prize in Literature",
  "Theodore Roosevelt National Park", "Theodore Roosevelt", "Nobel Peace Prize",
  "Vince Lombardi Trophy", "Vince Lombardi", "Fordham University",
  "Fordham Rams football",
];

if (process.argv.includes("--titles")) {
  const titles = [
    "Moneyball (film)", "Rush (2013 film)", "Pelé (2021 film)", "Pelé", "New York Cosmos (1970–1985)",
    "The Last Dance (miniseries)", "Jamaica national bobsleigh team", "Venezuelan bolívar", "Winston Churchill",
    "Dolly (sheep)", "Thriller (album)", "The Color Purple (1985 film)", "Back to Black",
    "Senna (film)",
  ];
  const endpoint = new URL("https://www.wikidata.org/w/api.php");
  endpoint.search = new URLSearchParams({ action: "wbgetentities", sites: "enwiki", titles: titles.join("|"), props: "labels|descriptions|sitelinks", languages: "en", format: "json", origin: "*" }).toString();
  const response = await fetch(endpoint, { headers: { "User-Agent": userAgent } });
  if (!response.ok) throw new Error(`Wikidata title lookup failed: ${response.status}`);
  const payload = await response.json();
  console.log(JSON.stringify(Object.values(payload.entities).map((item) => ({ qid: item.id, label: item.labels?.en?.value ?? null, description: item.descriptions?.en?.value ?? null, title: item.sitelinks?.enwiki?.title ?? null, missing: Object.hasOwn(item, "missing") })), null, 2));
}

if (process.argv.includes("--inspect")) {
  const ids = [
    "Q221820", "Q26122", "Q1768437", "Q78489", "Q105694930", "Q12897", "Q85807688", "Q41421",
    "Q207921", "Q317422", "Q282748", "Q1679839", "Q513", "Q217119", "Q5505", "Q213322",
    "Q26988", "Q7324", "Q750", "Q203757", "Q12138", "Q467025", "Q48584", "Q1386062",
    "Q8736", "Q34296", "Q161227", "Q8016", "Q309204", "Q23685", "Q171433", "Q1353638",
    "Q402", "Q192112", "Q44320", "Q193645", "Q223299", "Q156670", "Q15897", "Q11621", "Q8877",
    "Q8132", "Q1543", "Q173139", "Q19161825", "Q1079382", "Q313381", "Q19444", "Q34366",
    "Q42188", "Q159766", "Q361", "Q589673", "Q362", "Q186447", "Q537520", "Q23548", "Q273626",
    "Q534785", "Q10490", "Q172030", "Q696182", "Q83497", "Q33866",
    "Q714740", "Q1137669",
    "Q2526532", "Q553321", "Q130965",
    "Q2340403", "Q5468071",
  ];
  const interesting = new Set(["P39", "P50", "P57", "P61", "P69", "P86", "P108", "P112", "P127", "P1344", "P1346", "P138", "P161", "P162", "P166", "P175", "P180", "P1830", "P463", "P54", "P710", "P793", "P921"]);
  const entities = {};
  for (let index = 0; index < ids.length; index += 40) {
    const endpoint = new URL("https://www.wikidata.org/w/api.php");
    endpoint.search = new URLSearchParams({ action: "wbgetentities", ids: ids.slice(index, index + 40).join("|"), props: "labels|claims|sitelinks", languages: "en", sitefilter: "enwiki", format: "json", origin: "*" }).toString();
    const response = await fetch(endpoint, { headers: { "User-Agent": userAgent } });
    if (!response.ok) throw new Error(`Wikidata inspection failed: ${response.status}`);
    Object.assign(entities, (await response.json()).entities);
  }
  const compact = Object.fromEntries(Object.entries(entities).map(([qid, item]) => [qid, {
    label: item.labels?.en?.value ?? null,
    wikipediaTitle: item.sitelinks?.enwiki?.title ?? null,
    claims: Object.fromEntries(Object.entries(item.claims ?? {}).filter(([pid]) => interesting.has(pid)).map(([pid, claims]) => [pid, claims.map((claim) => claim.mainsnak?.datavalue?.value?.id).filter(Boolean)]).filter(([, values]) => values.length)),
  }]));
  console.log(JSON.stringify(compact, null, 2));
}

if (process.argv.includes("--search")) {
  const results = [];
  for (const label of searchLabels) {
    const endpoint = new URL("https://www.wikidata.org/w/api.php");
    endpoint.search = new URLSearchParams({ action: "wbsearchentities", search: label, language: "en", uselang: "en", type: "item", limit: "4", format: "json", origin: "*" }).toString();
    const response = await fetch(endpoint, { headers: { "User-Agent": userAgent } });
    if (!response.ok) throw new Error(`Wikidata search failed: ${response.status}`);
    const payload = await response.json();
    results.push({ search: label, results: (payload.search ?? []).map(({ id, label: itemLabel, description }) => ({ id, label: itemLabel, description })) });
  }
  console.log(JSON.stringify(results, null, 2));
}

if (process.argv.includes("--search-replacements")) {
  const results = [];
  for (const label of replacementLabels) {
    const endpoint = new URL("https://www.wikidata.org/w/api.php");
    endpoint.search = new URLSearchParams({ action: "wbsearchentities", search: label, language: "en", uselang: "en", type: "item", limit: "4", format: "json", origin: "*" }).toString();
    const response = await fetch(endpoint, { headers: { "User-Agent": userAgent } });
    if (!response.ok) throw new Error(`Wikidata search failed: ${response.status}`);
    const payload = await response.json();
    results.push({ search: label, results: (payload.search ?? []).map(({ id, label: itemLabel, description }) => ({ id, label: itemLabel, description })) });
  }
  console.log(JSON.stringify(results, null, 2));
}

if (process.argv.includes("--distractors")) {
  const results = [];
  for (const label of distractorLabels) {
    const endpoint = new URL("https://www.wikidata.org/w/api.php");
    endpoint.search = new URLSearchParams({ action: "wbsearchentities", search: label, language: "en", uselang: "en", type: "item", limit: "1", format: "json", origin: "*" }).toString();
    const response = await fetch(endpoint, { headers: { "User-Agent": userAgent } });
    if (!response.ok) throw new Error(`Wikidata distractor search failed: ${response.status}`);
    const item = (await response.json()).search?.[0];
    results.push({ search: label, qid: item?.id ?? null, label: item?.label ?? null, description: item?.description ?? null });
  }
  console.log(JSON.stringify(results, null, 2));
}

if (process.argv.includes("--ambiguity")) {
  const branches = candidates.map(([id, a, p1, , p2, b, direction2 = "forward", direction1 = "forward"]) => {
    const first = direction1 === "reverse" ? `?mid wdt:${p1} wd:${a}` : `wd:${a} wdt:${p1} ?mid`;
    const second = direction2 === "reverse" ? `wd:${b} wdt:${p2} ?mid` : `?mid wdt:${p2} wd:${b}`;
    return `{ BIND("${id}" AS ?candidateId) ${first} . ${second} }`;
  }).join(" UNION ");
  const query = `SELECT ?candidateId ?mid ?midLabel WHERE { ${branches} SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY ?candidateId ?midLabel`;
  const endpoint = new URL("https://query.wikidata.org/sparql");
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set("format", "json");
  const response = await fetch(endpoint, { headers: { "User-Agent": userAgent, Accept: "application/sparql-results+json" } });
  if (!response.ok) throw new Error(`WDQS request failed: ${response.status}`);
  const payload = await response.json();
  console.log(JSON.stringify(payload.results.bindings.map((item) => ({ id: item.candidateId.value, qid: item.mid.value.split("/").at(-1), label: item.midLabel?.value ?? null })), null, 2));
}

if (process.argv.includes("--verify")) {
  const ids = [...new Set(candidates.flatMap(([, a, , middle, , b]) => [a, middle, b]))];
  const entities = {};
  for (let index = 0; index < ids.length; index += 40) {
    const endpoint = new URL("https://www.wikidata.org/w/api.php");
    endpoint.search = new URLSearchParams({ action: "wbgetentities", ids: ids.slice(index, index + 40).join("|"), props: "labels|claims|sitelinks", languages: "en", sitefilter: "enwiki", format: "json", origin: "*" }).toString();
    const response = await fetch(endpoint, { headers: { "User-Agent": userAgent } });
    if (!response.ok) throw new Error(`Wikidata verification failed: ${response.status}`);
    Object.assign(entities, (await response.json()).entities);
  }
  const targets = (entity, property) => (entity?.claims?.[property] ?? []).map((claim) => claim.mainsnak?.datavalue?.value?.id).filter(Boolean);
  const qualifierData = (entity, property, target) => (entity?.claims?.[property] ?? []).filter((claim) => claim.mainsnak?.datavalue?.value?.id === target).map((claim) => Object.fromEntries(Object.entries(claim.qualifiers ?? {}).map(([pid, values]) => [pid, values.map((value) => value.datavalue?.value?.time ?? value.datavalue?.value?.id ?? value.datavalue?.value)])));
  const results = candidates.map(([id, a, p1, middle, p2, b, direction2 = "forward", direction1 = "forward"]) => {
    const firstSubject = direction1 === "reverse" ? middle : a;
    const firstObject = direction1 === "reverse" ? a : middle;
    const secondSubject = direction2 === "reverse" ? b : middle;
    const secondObject = direction2 === "reverse" ? middle : b;
    const path = [a, middle, b].map((qid) => ({ qid, label: entities[qid]?.labels?.en?.value ?? null, wikipediaTitle: entities[qid]?.sitelinks?.enwiki?.title ?? null }));
    const relationships = [
      { propertyId: p1, subjectQid: firstSubject, objectQid: firstObject, direction: direction1, present: targets(entities[firstSubject], p1).includes(firstObject), qualifiers: qualifierData(entities[firstSubject], p1, firstObject) },
      { propertyId: p2, subjectQid: secondSubject, objectQid: secondObject, direction: direction2, present: targets(entities[secondSubject], p2).includes(secondObject), qualifiers: qualifierData(entities[secondSubject], p2, secondObject) },
    ];
    return { id, path, relationships, structurallyVerified: relationships.every((edge) => edge.present) && path.every((entry) => entry.wikipediaTitle) };
  });
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
  if (results.some((item) => !item.structurallyVerified)) process.exitCode = 2;
}

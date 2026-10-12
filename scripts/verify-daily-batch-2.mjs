const userAgent = "HowConnected content verification contact@howconnected.app";

const candidates = [
  ["linux-torvalds-git", "Q14579", "P178", "Q34253", "P178", "Q186055", "reverse"],
  ["python-rossum-microsoft", "Q28865", "P178", "Q30942", "P108", "Q2283"],
  ["air-jordan-nike-phil-knight", "Q420953", "P127", "Q483915", "P112", "Q557305"],
  ["paypal-thiel-palantir", "Q483959", "P112", "Q705525", "P112", "Q2047336", "reverse"],
  ["berkshire-buffett-giving-pledge", "Q217583", "P127", "Q47213", "P112", "Q203807", "reverse"],
  ["jolene-dolly-dollywood", "Q1573997", "P175", "Q180453", "P127", "Q530744", "reverse"],
  ["rolling-stone-dylan-nobel-literature", "Q214430", "P175", "Q392", "P166", "Q37922"],
  ["hamilton-miranda-moana", "Q19320959", "P86", "Q1646482", "P86", "Q18647981", "reverse"],
  ["eiffel-tower-eiffel-statue-liberty", "Q243", "P138", "Q20882", "P800", "Q9202"],
  ["frankenstein-shelley-wollstonecraft", "Q150827", "P50", "Q47152", "P25", "Q101638"],
  ["little-prince-saint-exupery-aeropostale", "Q25338", "P50", "Q2908", "P108", "Q2723467"],
  ["march-washington-king-nobel-peace", "Q1128871", "P793", "Q8027", "P166", "Q35637", "forward", "reverse"],
  ["cuban-crisis-kennedy-pulitzer-biography", "Q128160", "P793", "Q9696", "P166", "Q285117", "forward", "reverse"],
  ["hubble-telescope-hubble-chicago", "Q2513", "P138", "Q43027", "P69", "Q131252"],
  ["halley-comet-halley-royal-society", "Q23054", "P138", "Q47434", "P463", "Q123885"],
  ["black-panther-boseman-42", "Q23780734", "P161", "Q5066520", "P161", "Q3599091", "reverse"],
  ["spirited-away-miyazaki-ghibli", "Q155653", "P57", "Q55400", "P112", "Q182950", "reverse"],
  ["blind-side-oher-ravens", "Q206497", "P921", "Q977601", "P54", "Q276539"],
  ["senna-ayrton-mclaren", "Q534785", "P921", "Q10490", "P54", "Q172030"],
  ["oprah-show-winfrey-own", "Q694106", "P371", "Q55800", "P112", "Q2573619", "reverse"],
];

const searchLabels = [
  "Linux", "Linus Torvalds", "Git",
  "Python programming language", "Guido van Rossum", "Dropbox",
  "Air Jordan", "Nike", "Phil Knight",
  "PayPal", "Peter Thiel", "Palantir Technologies",
  "Berkshire Hathaway", "Warren Buffett", "The Giving Pledge",
  "Jolene song", "Dolly Parton", "Dollywood",
  "Like a Rolling Stone", "Bob Dylan", "Nobel Prize in Literature",
  "Hamilton musical", "Lin-Manuel Miranda", "Moana 2016 film",
  "Eiffel Tower", "Gustave Eiffel", "Statue of Liberty",
  "Frankenstein novel", "Mary Shelley", "Mary Wollstonecraft",
  "The Little Prince", "Antoine de Saint-Exupery", "Aeropostale airline",
  "March on Washington for Jobs and Freedom", "Martin Luther King Jr.", "Nobel Peace Prize",
  "Cuban Missile Crisis", "John F. Kennedy", "Pulitzer Prize",
  "Hubble Space Telescope", "Edwin Hubble", "University of Chicago",
  "Halley's Comet", "Edmond Halley", "Royal Society",
  "Black Panther 2018 film", "Chadwick Boseman", "42 2013 film",
  "Spirited Away", "Hayao Miyazaki", "Studio Ghibli",
  "The Blind Side film", "Michael Oher", "Baltimore Ravens",
  "Senna film", "Ayrton Senna", "McLaren",
  "The Oprah Winfrey Show", "Oprah Winfrey", "Oprah Winfrey Network",
  "Jolene Dolly Parton song", "Hamilton 2015 musical", "Moana film",
  "Frankenstein", "Aeropostale French airline", "Black Panther film",
  "42 film", "The Blind Side", "Senna documentary",
];

const distractorLabels = [
  "Richard Stallman", "Ken Thompson", "Brian Kernighan",
  "James Gosling", "Brendan Eich", "Bjarne Stroustrup",
  "Adidas", "Reebok", "Converse",
  "Elon Musk", "Max Levchin", "Reid Hoffman",
  "Charlie Munger", "Bill Gates", "Melinda French Gates",
  "Loretta Lynn", "Emmylou Harris", "Reba McEntire",
  "Paul Simon", "Leonard Cohen", "Bruce Springsteen",
  "Alan Menken", "Robert Lopez", "Stephen Sondheim",
  "Frederic Auguste Bartholdi", "Stephen Sauvestre", "Eugene Viollet-le-Duc",
  "Percy Bysshe Shelley", "Lord Byron", "Claire Clairmont",
  "Jean Mermoz", "Albert Camus", "Joseph Kessel",
  "A. Philip Randolph", "Bayard Rustin", "John Lewis politician",
  "Nikita Khrushchev", "Robert F. Kennedy", "Ted Sorensen",
  "James Webb administrator", "Carl Sagan", "Subrahmanyan Chandrasekhar",
  "Isaac Newton", "Robert Hooke", "John Flamsteed",
  "Michael B. Jordan", "Lupita Nyongo", "Danai Gurira",
  "Isao Takahata", "Toshio Suzuki producer", "Mamoru Hosoda",
  "Sandra Bullock", "Leigh Anne Tuohy", "Quinton Aaron",
  "Alain Prost", "Lewis Hamilton", "Michael Schumacher",
  "Gayle King", "Ellen DeGeneres", "Phil Donahue",
];

if (process.argv.includes("--links")) {
  const { readFile } = await import("node:fs/promises");
  const registry = JSON.parse(await readFile(new URL("../content/daily-puzzles.json", import.meta.url), "utf8"));
  const audit = JSON.parse(await readFile(new URL("../content/daily-batch-2-review.json", import.meta.url), "utf8"));
  const candidateIds = new Set(candidates.map(([id]) => id));
  const batch = registry.filter((item) => candidateIds.has(item.id));
  const urls = [...new Set([
    ...batch.flatMap((item) => [
      ...item.path.map((entry) => entry.wikipediaUrl),
      ...item.relationships.flatMap((relationship) => relationship.evidence.filter((entry) => entry.kind === "supporting").map((entry) => entry.url)),
    ]),
    ...audit.candidates.filter((item) => item.decision === "rejected").flatMap((item) => item.sourceEvidence.map((entry) => entry.url)),
  ])];
  const results = [];
  for (let index = 0; index < urls.length; index += 8) {
    const group = await Promise.all(urls.slice(index, index + 8).map(async (url) => {
      try {
        const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000), headers: { "User-Agent": userAgent } });
        await response.body?.cancel();
        return { url, status: response.status, finalUrl: response.url, ok: response.ok, accessBlocked: response.status === 401 || response.status === 403 || response.status === 429 };
      } catch (error) {
        return { url, status: null, ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }));
    results.push(...group);
  }
  const hardFailures = results.filter((item) => !item.ok && !item.accessBlocked);
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), checked: results.length, accessBlocked: results.filter((item) => item.accessBlocked), failed: hardFailures }, null, 2));
  if (hardFailures.length) process.exitCode = 2;
  process.exit();
}

if (process.argv.includes("--titles")) {
  const titles = ["Jolene", "Hamilton (musical)", "Moana (2016 film)", "Aéropostale (aviation)", "Black Panther (film)", "42 (film)", "Senna (film)"];
  const endpoint = new URL("https://www.wikidata.org/w/api.php");
  endpoint.search = new URLSearchParams({ action: "wbgetentities", sites: "enwiki", titles: titles.join("|"), props: "labels|descriptions", languages: "en", format: "json", origin: "*" }).toString();
  const response = await fetch(endpoint, { headers: { "User-Agent": userAgent } });
  if (!response.ok) throw new Error(`Wikidata title lookup failed: ${response.status}`);
  const payload = await response.json();
  console.log(JSON.stringify(Object.values(payload.entities).map((item) => ({ qid: item.id, label: item.labels?.en?.value ?? null, description: item.descriptions?.en?.value ?? null, missing: Object.hasOwn(item, "missing") })), null, 2));
  process.exit(0);
}

if (process.argv.includes("--inspect")) {
  const inspectIds = ["Q30942", "Q420953", "Q217583", "Q530744", "Q243", "Q9202", "Q1128871", "Q128160", "Q9696", "Q977601"];
  const endpoint = new URL("https://www.wikidata.org/w/api.php");
  endpoint.search = new URLSearchParams({ action: "wbgetentities", ids: inspectIds.join("|"), props: "labels|claims", languages: "en", format: "json", origin: "*" }).toString();
  const response = await fetch(endpoint, { headers: { "User-Agent": userAgent } });
  if (!response.ok) throw new Error(`Wikidata inspection failed: ${response.status}`);
  const payload = await response.json();
  const compact = Object.fromEntries(Object.entries(payload.entities).map(([qid, item]) => [qid, {
    label: item.labels?.en?.value ?? null,
    claims: Object.fromEntries(Object.entries(item.claims ?? {}).map(([pid, claims]) => [pid, claims.map((claim) => claim.mainsnak?.datavalue?.value?.id ?? claim.mainsnak?.datavalue?.value?.time ?? claim.mainsnak?.datavalue?.value).filter((value) => typeof value === "string")]).filter(([, values]) => values.length)),
  }]));
  console.log(JSON.stringify(compact, null, 2));
  process.exit(0);
}

if (process.argv.includes("--inspect-small")) {
  const inspect = { Q8027: ["P793", "P166"], Q9696: ["P793", "P166"], Q9202: ["P84", "P193", "P287", "P88", "P138"], Q20882: ["P800"] };
  const endpoint = new URL("https://www.wikidata.org/w/api.php");
  endpoint.search = new URLSearchParams({ action: "wbgetentities", ids: Object.keys(inspect).join("|"), props: "labels|claims", languages: "en", format: "json", origin: "*" }).toString();
  const response = await fetch(endpoint, { headers: { "User-Agent": userAgent } }); const payload = await response.json();
  const output = Object.fromEntries(Object.entries(inspect).map(([qid, pids]) => [qid, Object.fromEntries(pids.map((pid) => [pid, (payload.entities[qid]?.claims?.[pid] ?? []).map((claim) => ({ target: claim.mainsnak?.datavalue?.value?.id ?? null, qualifiers: Object.fromEntries(Object.entries(claim.qualifiers ?? {}).map(([key, values]) => [key, values.map((value) => value.datavalue?.value?.id ?? value.datavalue?.value?.time ?? value.datavalue?.value)])) }))]))]));
  console.log(JSON.stringify(output, null, 2)); process.exit(0);
}

if (process.argv.includes("--search") || process.argv.includes("--search-new")) {
  const results = [];
  const labels = process.argv.includes("--search-new") ? searchLabels.slice(-9) : searchLabels;
  for (const label of labels) {
    const endpoint = new URL("https://www.wikidata.org/w/api.php");
    endpoint.search = new URLSearchParams({ action: "wbsearchentities", search: label, language: "en", uselang: "en", type: "item", limit: "3", format: "json", origin: "*" }).toString();
    const response = await fetch(endpoint, { headers: { "User-Agent": userAgent } });
    if (!response.ok) throw new Error(`Wikidata search failed: ${response.status}`);
    const payload = await response.json();
    results.push({ search: label, results: (payload.search ?? []).map(({ id, label: itemLabel, description }) => ({ id, label: itemLabel, description })) });
  }
  console.log(JSON.stringify(results, null, 2));
  process.exit(0);
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
  process.exit(0);
}

if (process.argv.includes("--ambiguity")) {
  const branches = candidates.map(([id, a, p1, , p2, b, direction2 = "forward", direction1 = "forward"]) => {
    const first = direction1 === "reverse" ? `?mid wdt:${p1} wd:${a}` : `wd:${a} wdt:${p1} ?mid`;
    const second = direction2 === "reverse" ? `wd:${b} wdt:${p2} ?mid` : `?mid wdt:${p2} wd:${b}`;
    return `{ BIND("${id}" AS ?candidateId) ${first} . ${second} }`;
  }).join(" UNION ");
  const query = `SELECT ?candidateId ?mid ?midLabel WHERE { ${branches} SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY ?candidateId ?midLabel`;
  const endpoint = new URL("https://query.wikidata.org/sparql");
  endpoint.searchParams.set("query", query); endpoint.searchParams.set("format", "json");
  const response = await fetch(endpoint, { headers: { "User-Agent": userAgent, Accept: "application/sparql-results+json" } });
  if (!response.ok) throw new Error(`WDQS request failed: ${response.status}`);
  const payload = await response.json();
  console.log(JSON.stringify(payload.results.bindings.map((item) => ({ id: item.candidateId.value, qid: item.mid.value.split("/").at(-1), label: item.midLabel?.value ?? null })), null, 2));
  process.exit(0);
}

const ids = [...new Set(candidates.flatMap(([, a, , middle, , b]) => [a, middle, b]))];
const entities = {};
for (let index = 0; index < ids.length; index += 40) {
  const endpoint = new URL("https://www.wikidata.org/w/api.php");
  endpoint.search = new URLSearchParams({ action: "wbgetentities", ids: ids.slice(index, index + 40).join("|"), props: "labels|claims|sitelinks", languages: "en", sitefilter: "enwiki", format: "json", origin: "*" }).toString();
  const response = await fetch(endpoint, { headers: { "User-Agent": userAgent } });
  if (!response.ok) throw new Error(`Wikidata request failed: ${response.status}`);
  const payload = await response.json(); Object.assign(entities, payload.entities);
}
const targets = (entity, property) => (entity?.claims?.[property] ?? []).map((claim) => claim.mainsnak?.datavalue?.value?.id).filter(Boolean);
const qualifierData = (entity, property, target) => (entity?.claims?.[property] ?? []).filter((claim) => claim.mainsnak?.datavalue?.value?.id === target).map((claim) => Object.fromEntries(Object.entries(claim.qualifiers ?? {}).map(([pid, values]) => [pid, values.map((value) => value.datavalue?.value?.time ?? value.datavalue?.value?.id ?? value.datavalue?.value)])));
const results = candidates.map(([id, a, p1, middle, p2, b, direction2 = "forward", direction1 = "forward"]) => {
  const firstSubject = direction1 === "reverse" ? middle : a; const firstObject = direction1 === "reverse" ? a : middle;
  const secondSubject = direction2 === "reverse" ? b : middle; const secondObject = direction2 === "reverse" ? middle : b;
  return {
    id,
    path: [a, middle, b].map((qid) => ({ qid, label: entities[qid]?.labels?.en?.value ?? null, wikipediaTitle: entities[qid]?.sitelinks?.enwiki?.title ?? null })),
    relationships: [
      { propertyId: p1, subjectQid: firstSubject, objectQid: firstObject, direction: direction1, present: targets(entities[firstSubject], p1).includes(firstObject), qualifiers: qualifierData(entities[firstSubject], p1, firstObject) },
      { propertyId: p2, subjectQid: secondSubject, objectQid: secondObject, direction: direction2, present: targets(entities[secondSubject], p2).includes(secondObject), qualifiers: qualifierData(entities[secondSubject], p2, secondObject) },
    ],
  };
});
for (const item of results) item.structurallyVerified = item.relationships.every((edge) => edge.present) && item.path.every((entry) => entry.wikipediaTitle);
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
if (results.some((item) => !item.structurallyVerified)) process.exitCode = 2;

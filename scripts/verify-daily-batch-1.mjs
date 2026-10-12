const candidates = [
  ["apollo-armstrong-nasa", "Q43653", "P1029", "Q1615", "P108", "Q23548"],
  ["penicillin-fleming-nobel-medicine", "Q12190", "P61", "Q37064", "P166", "Q80061"],
  ["hamlet-shakespeare-stratford", "Q41567", "P50", "Q692", "P19", "Q189288"],
  ["nineteen-eighty-four-orwell-bbc", "Q208460", "P50", "Q3335", "P108", "Q9531"],
  ["hobbit-tolkien-oxford", "Q74287", "P50", "Q892", "P108", "Q34433"],
  ["abbey-road-beatles-liverpool", "Q173643", "P175", "Q1299", "P740", "Q24826"],
  ["bohemian-rhapsody-queen-london", "Q187745", "P175", "Q15862", "P740", "Q84"],
  ["toy-story-hanks-apollo-13", "Q171048", "P725", "Q2263", "P161", "Q106428", "reverse"],
  ["titanic-dicaprio-revenant", "Q44578", "P161", "Q38111", "P161", "Q18002795", "reverse"],
  ["space-jam-jordan-bulls", "Q207659", "P161", "Q41421", "P54", "Q128109"],
  ["iphone-apple-jobs", "Q2766", "P176", "Q312", "P112", "Q19837"],
  ["youtube-google-alphabet", "Q866", "P127", "Q95", "P749", "Q20800404"],
  ["guernica-picasso-cubism", "Q175036", "P170", "Q5593", "P135", "Q42934"],
  ["persistence-memory-dali-surrealism", "Q25729", "P170", "Q5577", "P135", "Q39427"],
  ["declaration-jefferson-uva", "Q127912", "P50", "Q11812", "P112", "Q213439", "reverse"],
  ["berlin-wall-east-germany-warsaw-pact", "Q5086", "P17", "Q16957", "P463", "Q41644"],
  ["sydney-opera-utzon-pritzker", "Q45178", "P84", "Q180398", "P166", "Q133160"],
  ["relativity-einstein-nobel-physics", "Q43514", "P61", "Q937", "P166", "Q38104"],
  ["hundred-years-marquez-nobel-literature", "Q178869", "P50", "Q5878", "P166", "Q37922"],
  ["starry-night-van-gogh-post-impressionism", "Q45585", "P170", "Q5582", "P135", "Q166713"],
];

if (process.argv.includes("--links")) {
  const { readFile } = await import("node:fs/promises");
  const registry = JSON.parse(await readFile(new URL("../content/daily-puzzles.json", import.meta.url), "utf8"));
  const audit = JSON.parse(await readFile(new URL("../content/daily-batch-1-review.json", import.meta.url), "utf8"));
  const batch = registry.filter((item) => candidates.some(([id]) => id === item.id));
  const urls = [...new Set(batch.flatMap((item) => [
    ...item.path.map((entry) => entry.wikipediaUrl),
    ...item.relationships.flatMap((edge) => edge.evidence.filter((entry) => entry.kind === "supporting").map((entry) => entry.url)),
  ]).concat(audit.candidates.filter((item) => item.decision === "rejected").flatMap((item) => item.sourceEvidence.map((entry) => entry.url))))];
  const results = [];
  for (let index = 0; index < urls.length; index += 8) {
    const group = await Promise.all(urls.slice(index, index + 8).map(async (url) => {
      try {
        const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20_000), headers: { "User-Agent": "HowConnected content verification contact@howconnected.app" } });
        await response.body?.cancel();
        return { url, status: response.status, finalUrl: response.url, ok: response.ok, accessBlocked: response.status === 401 || response.status === 403 };
      } catch (error) {
        return { url, status: null, ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }));
    results.push(...group);
  }
  const hardFailures = results.filter((item) => !item.ok && !item.accessBlocked);
  console.log(JSON.stringify({ checkedAt: new Date().toISOString(), checked: results.length, accessBlocked: results.filter((item) => item.accessBlocked), failed: hardFailures, results }, null, 2));
  if (hardFailures.length) process.exitCode = 2;
  process.exit();
}

if (process.argv.includes("--search")) {
  const labels = ["Abbey Road", "Toy Story", "Apollo 13", "The Revenant", "Guernica"];
  const searches = [];
  for (const search of labels) {
    const endpoint = new URL("https://www.wikidata.org/w/api.php");
    endpoint.search = new URLSearchParams({ action: "wbsearchentities", search, language: "en", uselang: "en", type: "item", limit: "4", format: "json", origin: "*" }).toString();
    const response = await fetch(endpoint, { headers: { "User-Agent": "HowConnected content verification contact@howconnected.app" } });
    const payload = await response.json();
    searches.push({ search, results: payload.search?.map(({ id, label, description }) => ({ id, label, description })) ?? [] });
  }
  console.log(JSON.stringify(searches, null, 2));
  process.exit(0);
}

if (process.argv.includes("--distractors")) {
  const labels = ["Louis Pasteur", "Robert Koch", "Joseph Lister", "Christopher Marlowe", "Ben Jonson", "Oscar Wilde", "Aldous Huxley", "Ray Bradbury", "H. G. Wells", "C. S. Lewis", "Philip Pullman", "George R. R. Martin", "The Rolling Stones", "Led Zeppelin", "Pink Floyd", "The Who", "Electric Light Orchestra", "Tim Allen", "Bill Paxton", "Ed Harris", "Kate Winslet", "Tom Hardy", "Billy Zane", "Samsung Electronics", "Microsoft", "Google", "Meta Platforms", "Yahoo! Inc.", "Salvador Dalí", "Joan Miró", "Georges Braque", "Pablo Picasso", "Max Ernst", "Benjamin Franklin", "John Adams", "James Madison", "West Germany", "Soviet Union", "Poland", "Frank Gehry", "Zaha Hadid", "Renzo Piano", "Max Planck", "Niels Bohr", "Marie Curie", "Jorge Luis Borges", "Mario Vargas Llosa", "Isabel Allende", "Claude Monet", "Paul Gauguin", "Paul Cézanne"];
  const resolved = [];
  for (const search of labels) {
    const endpoint = new URL("https://www.wikidata.org/w/api.php");
    endpoint.search = new URLSearchParams({ action: "wbsearchentities", search, language: "en", uselang: "en", type: "item", limit: "1", format: "json", origin: "*" }).toString();
    const response = await fetch(endpoint, { headers: { "User-Agent": "HowConnected content verification contact@howconnected.app" } });
    const payload = await response.json(); const item = payload.search?.[0];
    resolved.push({ search, qid: item?.id ?? null, label: item?.label ?? null, description: item?.description ?? null });
  }
  console.log(JSON.stringify(resolved, null, 2));
  process.exit(0);
}

if (process.argv.includes("--ambiguity")) {
  const branches = candidates.map(([id, a, p1, , p2, b, direction2 = "forward"]) => {
    const second = direction2 === "reverse" ? `wd:${b} wdt:${p2} ?mid` : `?mid wdt:${p2} wd:${b}`;
    return `{ BIND("${id}" AS ?candidateId) wd:${a} wdt:${p1} ?mid . ${second} }`;
  }).join(" UNION ");
  const query = `SELECT ?candidateId ?mid ?midLabel WHERE { ${branches} SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } } ORDER BY ?candidateId ?midLabel`;
  const endpoint = new URL("https://query.wikidata.org/sparql");
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set("format", "json");
  const response = await fetch(endpoint, { headers: { "User-Agent": "HowConnected content verification contact@howconnected.app", Accept: "application/sparql-results+json" } });
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
  const response = await fetch(endpoint, { headers: { "User-Agent": "HowConnected content verification contact@howconnected.app" } });
  if (!response.ok) throw new Error(`Wikidata request failed: ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`Wikidata API error: ${payload.error.info}`);
  Object.assign(entities, payload.entities);
}
const targetQids = (entity, property) => (entity?.claims?.[property] ?? []).map((claim) => claim.mainsnak?.datavalue?.value?.id).filter(Boolean);
const qualifiers = (entity, property, target) => (entity?.claims?.[property] ?? []).filter((claim) => claim.mainsnak?.datavalue?.value?.id === target).map((claim) => Object.fromEntries(Object.entries(claim.qualifiers ?? {}).map(([pid, values]) => [pid, values.map((value) => value.datavalue?.value?.time ?? value.datavalue?.value?.id ?? value.datavalue?.value)])));

const results = candidates.map(([id, a, p1, middle, p2, b, direction2 = "forward"]) => {
  const first = targetQids(entities[a], p1).includes(middle);
  const secondSubject = direction2 === "reverse" ? b : middle;
  const secondObject = direction2 === "reverse" ? middle : b;
  const second = targetQids(entities[secondSubject], p2).includes(secondObject);
  return {
    id,
    path: [a, middle, b].map((qid) => ({ qid, label: entities[qid]?.labels?.en?.value ?? null, wikipediaTitle: entities[qid]?.sitelinks?.enwiki?.title ?? null })),
    relationships: [
      { propertyId: p1, subjectQid: a, objectQid: middle, direction: "forward", present: first, qualifiers: qualifiers(entities[a], p1, middle) },
      { propertyId: p2, subjectQid: secondSubject, objectQid: secondObject, direction: direction2, present: second, qualifiers: qualifiers(entities[secondSubject], p2, secondObject) },
    ],
    structurallyVerified: first && second,
  };
});
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2));
if (results.some((item) => !item.structurallyVerified)) process.exitCode = 2;

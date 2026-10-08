const BASE_URL = process.env.BENCHMARK_BASE_URL ?? "http://localhost:3000";

const pairs = [
  ["Kevin Bacon", "Q3454165", "Paw Patrol", "Q15106029"],
  ["Adam Sandler", "Q132952", "Los Angeles Lakers", "Q121783"],
  ["Bluey", "Q39071378", "Las Vegas Raiders", "Q324523"],
  ["NASA", "Q23548", "The Coca-Cola Company", "Q3295867"],
  ["Steve Jobs", "Q19837", "Walt Disney", "Q8704"],
  ["George Lucas", "Q38222", "Walt Disney", "Q8704"],
  ["Sergey Brin", "Q92764", "Larry Page", "Q4934"],
  ["Steve Jobs", "Q19837", "Tim Cook", "Q265852"],
  ["Steve Jobs", "Q19837", "Bob Iger", "Q160042"],
  ["George Lucas", "Q38222", "Star Wars", "Q462"],
  ["Apple", "Q312", "Pixar", "Q127552"],
  ["The Walt Disney Company", "Q7414", "Pixar", "Q127552"],
  ["Elon Musk", "Q317521", "NASA", "Q23548"],
  ["Taylor Swift", "Q26876", "Apple", "Q312"],
  ["Barack Obama", "Q76", "Washington, D.C.", "Q61"],
  ["Michael Jordan", "Q41421", "Los Angeles Lakers", "Q121783"],
  ["Snoop Dogg", "Q6096", "Los Angeles", "Q65"],
  ["Elizabeth II", "Q9682", "The Walt Disney Company", "Q7414"],
  ["Bill Gates", "Q5284", "Harvard University", "Q13371"],
  ["LeBron James", "Q36159", "Los Angeles Lakers", "Q121783"],
  ["The Coca-Cola Company", "Q3295867", "Coca-Cola", "Q2813"],
  ["NASA", "Q23548", "Dwight D. Eisenhower", "Q9916"],
  ["Pixar", "Q127552", "Steve Jobs", "Q19837"],
  ["Walt Disney", "Q8704", "The Walt Disney Company", "Q7414"],
  ["Tim Cook", "Q265852", "Apple", "Q312"],
  ["Statue of Liberty", "Q9202", "France", "Q142"],
  ["Eiffel Tower", "Q243", "France", "Q142"],
  ["Statue of Liberty", "Q9202", "United States", "Q30"],
  ["Mona Lisa", "Q12418", "France", "Q142"],
  ["Mona Lisa", "Q12418", "Italy", "Q38"],
  ["Sydney Opera House", "Q45178", "Denmark", "Q35"],
];

const results = [];
for (const [source, fromQid, target, toQid] of pairs) {
  const startedAt = performance.now();
  try {
    const url = new URL("/api/discover", BASE_URL);
    url.search = new URLSearchParams({ fromQid, toQid, debug: "1" });
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const body = await response.json();
    const runtimeMs = Math.round(performance.now() - startedAt);
    results.push({
      source,
      target,
      fromQid,
      toQid,
      found: body.found === true,
      httpStatus: response.status,
      stage: body.diagnostics?.stage ?? null,
      qualityBand: body.bestPath?.qualityBand ?? null,
      score: body.bestPath?.score ?? null,
      runtimeMs,
      timedOut: body.diagnostics?.timedOut === true,
      terminationReason: body.diagnostics?.terminationReason ?? body.error ?? null,
      path: body.bestPath?.nodes?.map((node) => node.name) ?? [],
    });
  } catch (error) {
    results.push({
      source,
      target,
      fromQid,
      toQid,
      found: false,
      stage: null,
      qualityBand: null,
      score: null,
      runtimeMs: Math.round(performance.now() - startedAt),
      timedOut: error?.name === "TimeoutError",
      terminationReason: error instanceof Error ? error.message : "request failed",
      path: [],
    });
  }
}

function summarize(sample) {
  const count = sample.length;
  const found = sample.filter((result) => result.found);
  const cold = sample.filter((result) => result.stage !== "A");
  const bands = Object.fromEntries(
    ["strong", "acceptable", "weak"].map((band) => [
      band,
      sample.filter((result) => result.qualityBand === band).length,
    ]),
  );

  return {
    pairs: count,
    semanticPathSuccessRate: found.length / count,
    qualityRates: Object.fromEntries(
      Object.entries(bands).map(([band, value]) => [band, value / count]),
    ),
    averageColdRuntimeMs:
      cold.length > 0
        ? Math.round(
            cold.reduce((total, result) => total + result.runtimeMs, 0) /
              cold.length,
          )
        : null,
    coldSamples: cold.length,
    timeoutRate:
      sample.filter((result) => result.timedOut).length / count,
    errorRate:
      sample.filter((result) => (result.httpStatus ?? 500) >= 400).length /
      count,
  };
}

const summary = {
  overall: summarize(results),
  originalCrossDomain: summarize(results.slice(0, 25)),
  monumentAndArtwork: summarize(results.slice(25)),
};

console.log(JSON.stringify({ summary, results }, null, 2));

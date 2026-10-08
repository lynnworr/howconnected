export type SearchRankingCandidate = {
  id: string;
  label: string;
  description: string;
  aliases: string[];
  wikidataRank?: number;
};

function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("en");
}

function hasWholePhrase(value: string, query: string): boolean {
  return ` ${value.replace(/[^a-z0-9]+/g, " ")} `.includes(` ${query} `);
}

export function scoreSearchCandidate(
  query: string,
  candidate: SearchRankingCandidate,
): number {
  const normalizedQuery = normalize(query);
  const label = normalize(candidate.label);
  const aliases = candidate.aliases.map(normalize);
  const description = normalize(candidate.description);
  const exactAliasMatch = aliases.includes(normalizedQuery);
  const recognizableDescription =
    /(person|player|athlete|actor|filmmaker|writer|business|company|country|city|state|river|planet|element|film|ship|university|organization|agency|administration|musician|singer|politician|president|scientist|monarch|king|queen)/.test(
      description,
    );
  let score = 0;

  if (label === normalizedQuery) score += 90;
  else if (label.startsWith(`${normalizedQuery} `)) score += 55;
  else if (hasWholePhrase(label, normalizedQuery)) score += 50;
  else if (label.includes(normalizedQuery)) score += 15;

  if (exactAliasMatch) score += 75;
  else if (aliases.some((alias) => alias.startsWith(normalizedQuery))) score += 28;
  else if (aliases.some((alias) => hasWholePhrase(alias, normalizedQuery))) {
    score += 22;
  }

  if (candidate.description.trim()) score += 12;
  if (recognizableDescription) {
    score += 18;
  }

  // Acronyms often match a notable entity's alias rather than its long label.
  // Reward that combination without requiring another upstream lookup.
  if (
    exactAliasMatch &&
    !label.includes(normalizedQuery) &&
    recognizableDescription
  ) {
    score += 35;
  }

  if (candidate.wikidataRank !== undefined) {
    score += Math.max(0, 30 - candidate.wikidataRank);
  }

  if (/wikimedia (disambiguation|category)/.test(description)) score -= 100;
  if (/^(given name|family name|name)$/.test(description)) score -= 40;
  if (/^(painting|photograph|portrait|sculpture)\b|\b(painting|photograph) by\b/.test(description)) {
    score -= 60;
  }

  return score;
}

export function rankSearchCandidates<T extends SearchRankingCandidate>(
  query: string,
  candidates: T[],
): T[] {
  return [...candidates].sort((left, right) => {
    const scoreDifference =
      scoreSearchCandidate(query, right) - scoreSearchCandidate(query, left);
    if (scoreDifference !== 0) return scoreDifference;

    const wikidataDifference =
      (left.wikidataRank ?? Number.MAX_SAFE_INTEGER) -
      (right.wikidataRank ?? Number.MAX_SAFE_INTEGER);
    return wikidataDifference || left.id.localeCompare(right.id);
  });
}

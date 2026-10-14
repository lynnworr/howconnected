export const HOWCONNECTED_ORIGIN = "https://www.howconnected.app";
export const HOWCONNECTED_SEARCH_ENDPOINT = `${HOWCONNECTED_ORIGIN}/api/search`;
export const WIKIPEDIA_API_ENDPOINT = "https://en.wikipedia.org/w/api.php";
export const EXTENSION_SOURCE_PARAMETER = "source";
export const EXTENSION_SOURCE_VALUE = "extension";

const QID_PATTERN = /^Q[1-9]\d*$/;

export function isValidQid(value) {
  return typeof value === "string" && QID_PATTERN.test(value);
}

export function buildExtensionReferralUrl(pathname) {
  const url = new URL(pathname, HOWCONNECTED_ORIGIN);
  if (url.origin !== HOWCONNECTED_ORIGIN) {
    throw new TypeError("Extension referral URLs must stay on HowConnected.");
  }
  url.searchParams.set(EXTENSION_SOURCE_PARAMETER, EXTENSION_SOURCE_VALUE);
  return url.toString();
}

export const HOWCONNECTED_HOME_URL = buildExtensionReferralUrl("/");
export const HOWCONNECTED_EXTENSION_URL = buildExtensionReferralUrl("/extension");
export const HOWCONNECTED_DAILY_URL = buildExtensionReferralUrl("/daily");

export function parseWikipediaArticleUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || url.hostname !== "en.wikipedia.org") {
      return { status: "unsupported" };
    }
    if (!url.pathname.startsWith("/wiki/")) return { status: "unsupported" };

    const encodedTitle = url.pathname.slice("/wiki/".length);
    if (!encodedTitle || encodedTitle.includes("/")) {
      return { status: "unsupported" };
    }

    const title = decodeURIComponent(encodedTitle).replaceAll("_", " ").trim();
    return title ? { status: "article", title } : { status: "unsupported" };
  } catch {
    return { status: "unsupported" };
  }
}

export function buildWikipediaLookupUrl(title) {
  const url = new URL(WIKIPEDIA_API_ENDPOINT);
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    redirects: "1",
    prop: "pageprops",
    ppprop: "wikibase_item|disambiguation",
    titles: title,
  }).toString();
  return url.toString();
}

export function parseWikipediaLookupResponse(value) {
  if (!value || typeof value !== "object") return { status: "invalid" };
  const pages = value.query?.pages;
  if (!Array.isArray(pages) || pages.length !== 1) return { status: "invalid" };

  const page = pages[0];
  if (!page || typeof page !== "object") return { status: "invalid" };
  const title = typeof page.title === "string" ? page.title.trim() : "";
  if (page.missing === true || !title) return { status: "missing", title };
  if (page.ns !== 0) return { status: "unsupported", title };

  const pageprops = page.pageprops;
  if (!pageprops || typeof pageprops !== "object") {
    return { status: "missing-qid", title };
  }
  if (Object.prototype.hasOwnProperty.call(pageprops, "disambiguation")) {
    return { status: "disambiguation", title };
  }

  const qid = pageprops.wikibase_item;
  if (!isValidQid(qid)) return { status: "missing-qid", title };
  return {
    status: "found",
    entity: {
      id: qid,
      label: title,
      description: "Current English Wikipedia article",
    },
  };
}

export function buildSearchUrl(query) {
  const url = new URL(HOWCONNECTED_SEARCH_ENDPOINT);
  url.searchParams.set("q", query.trim());
  return url.toString();
}

export function parseSearchResponse(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.results)) {
    return [];
  }
  return value.results.flatMap((result) => {
    if (
      !result ||
      typeof result !== "object" ||
      !isValidQid(result.id) ||
      typeof result.label !== "string" ||
      typeof result.description !== "string"
    ) {
      return [];
    }
    return [{
      id: result.id,
      label: result.label,
      description: result.description,
    }];
  }).slice(0, 6);
}

export function selectedEntityAfterEdit(selected, value) {
  return selected?.label === value ? selected : null;
}

export function canFindConnection(source, target) {
  return Boolean(
    source &&
    target &&
    isValidQid(source.id) &&
    isValidQid(target.id) &&
    source.id !== target.id,
  );
}

export function buildConnectionUrl(sourceQid, targetQid) {
  if (!isValidQid(sourceQid) || !isValidQid(targetQid)) {
    throw new TypeError("Connection URLs require two valid Wikidata QIDs.");
  }
  if (sourceQid === targetQid) {
    throw new TypeError("Connection URLs require two different entities.");
  }
  return buildExtensionReferralUrl(`/connect/${encodeURIComponent(sourceQid)}/${encodeURIComponent(targetQid)}`);
}

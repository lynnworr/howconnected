export type SearchApiResult = {
  id: string;
  label: string;
  description: string;
  url: string;
};

type SearchFunction = (query: string) => Promise<SearchApiResult[]>;
type ErrorLogger = (message: string, error: unknown) => void;

export async function handleSearchRequest(
  request: Request,
  search: SearchFunction,
  logError: ErrorLogger = console.error,
): Promise<Response> {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) return Response.json({ results: [] });

  try {
    return Response.json({ results: await search(query) });
  } catch (error: unknown) {
    logError("Wikidata search failed", error);
    return Response.json(
      { error: "Wikidata search is currently unavailable." },
      { status: 502 },
    );
  }
}

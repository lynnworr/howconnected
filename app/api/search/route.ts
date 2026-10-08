import { searchEntities } from "@/lib/entity-search";
import { handleSearchRequest } from "@/lib/search-api";

export function GET(request: Request) {
  return handleSearchRequest(request, searchEntities);
}

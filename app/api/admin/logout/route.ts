import { logoutAdmin } from "@/lib/admin-auth";

export async function POST(request: Request) {
  return logoutAdmin(request);
}

import { loginAdmin } from "@/lib/admin-auth";

export async function POST(request: Request) {
  return loginAdmin(request);
}

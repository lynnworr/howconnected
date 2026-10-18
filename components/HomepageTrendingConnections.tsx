import { connection } from "next/server";
import TrendingConnections from "@/components/TrendingConnections";
import { getHomepageTrendingConnections } from "@/lib/trending-connections";

export default async function HomepageTrendingConnections() {
  await connection();
  return <TrendingConnections connections={getHomepageTrendingConnections()} />;
}

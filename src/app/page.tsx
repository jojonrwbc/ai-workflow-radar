import { FeedView } from "@/components/feed-view";
import { listLatestBenchmarks, listNewsItems } from "@/lib/news-store";
import { withResolvedImages } from "@/lib/source-images";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [items, benchmarks] = await Promise.all([
    listNewsItems(120),
    listLatestBenchmarks(),
  ]);
  const hydratedItems = await withResolvedImages(items);

  return (
    <FeedView initialItems={hydratedItems} initialBenchmarks={benchmarks} />
  );
}

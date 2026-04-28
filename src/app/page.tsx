import { FeedView } from "@/components/feed-view";
import { listLatestBenchmarks, listNewsItems } from "@/lib/news-store";
import { withResolvedImages } from "@/lib/source-images";

export const revalidate = 300;

const INITIAL_VISIBLE_ITEMS = 24;
const ABOVE_FOLD_HYDRATION_COUNT = 12;

export default async function Home() {
  const [items, benchmarks] = await Promise.all([
    listNewsItems(INITIAL_VISIBLE_ITEMS),
    listLatestBenchmarks(),
  ]);
  const aboveFold = items.slice(0, ABOVE_FOLD_HYDRATION_COUNT);
  const belowFold = items.slice(ABOVE_FOLD_HYDRATION_COUNT);
  const hydratedAboveFold = await withResolvedImages(aboveFold);
  const hydratedItems = [...hydratedAboveFold, ...belowFold];

  return (
    <FeedView initialItems={hydratedItems} initialBenchmarks={benchmarks} />
  );
}

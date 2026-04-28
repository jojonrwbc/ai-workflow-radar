import { NextResponse } from "next/server";
import { getNewsItemById } from "@/lib/news-store";
import { withResolvedImages } from "@/lib/source-images";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  const { id } = await params;
  const item = await getNewsItemById(id);

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const [hydratedItem] = await withResolvedImages([item]);
  return NextResponse.json(hydratedItem);
}

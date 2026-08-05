import Image from "next/image";
import Link from "next/link";
import { BiasBar } from "./bias-bar";
import type { SampleArticle } from "@/lib/sample-articles";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function NewsCard({ article }: { article: SampleArticle }) {
  return (
    <Link
      href={`/articles/${article.id}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-bg-primary shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[16/10] w-full">
        <Image
          src={article.imageUrl}
          alt={article.title}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
        <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-caption text-white">
          i
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <p className="text-body-sm text-text-secondary">
          {article.category} · {article.location}
        </p>

        <h3 className="text-h4 font-medium text-text-primary line-clamp-3">{article.title}</h3>

        <BiasBar
          leftPercentage={article.leftPercentage}
          centerPercentage={article.centerPercentage}
          rightPercentage={article.rightPercentage}
        />

        <p className="mt-auto text-caption text-text-secondary">
          {article.source} · {dateFormatter.format(new Date(article.publishedAt))}
        </p>
      </div>
    </Link>
  );
}

import Image from "next/image";
import Link from "next/link";
import type { NewsCardArticle } from "./news-card";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function RelatedArticleCard({ article }: { article: NewsCardArticle }) {
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
          sizes="(min-width: 640px) 50vw, 100vw"
          className="object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-h4 font-medium text-text-primary line-clamp-2">{article.title}</h3>

        <p className="mt-auto text-caption text-text-secondary">
          {article.source} · {dateFormatter.format(new Date(article.publishedAt))}
        </p>
      </div>
    </Link>
  );
}

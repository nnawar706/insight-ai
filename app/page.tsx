import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { NewsCard } from "@/components/news-card";
import { sampleArticles } from "@/lib/sample-articles";

export default function Page() {
  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-(--container-insight) flex-1 px-6 py-8">
        <h1 className="text-h2 font-semibold text-text-primary">Top News</h1>

        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {sampleArticles.map((article) => (
            <NewsCard key={article.id} article={article} />
          ))}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

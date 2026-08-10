import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { NewsCard, type NewsCardArticle } from "@/components/news-card";
import { getPublishedArticles } from "@/lib/supabase/queries/articles";

export default async function Page() {
  const publishedArticles = await getPublishedArticles();

  const articles: NewsCardArticle[] = publishedArticles.map((article) => ({
    id: article.id,
    title: article.title,
    imageUrl: article.image_url,
    source: article.source.name,
    publishedAt: article.published_at,
    leftPercentage: article.analysis.left_percentage,
    centerPercentage: article.analysis.center_percentage,
    rightPercentage: article.analysis.right_percentage,
  }));

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-(--container-insight) flex-1 px-6 py-8">
        <h1 className="text-h2 font-semibold text-text-primary">Top News</h1>

        {articles.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <p className="mt-6 text-body-md text-text-secondary">No analyzed articles yet.</p>
        )}
      </main>

      <SiteFooter />
    </>
  );
}

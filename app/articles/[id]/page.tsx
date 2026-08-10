import Image from "next/image";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BiasBar } from "@/components/bias-bar";
import { SentimentBadge } from "@/components/sentiment-badge";
import { BiasAnalysisCard } from "@/components/bias-analysis-card";
import { AiSummaryCard } from "@/components/ai-summary-card";
import { FramingNotesCard } from "@/components/framing-notes-card";
import { getArticleById } from "@/lib/supabase/queries/articles";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

type ArticlePageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: ArticlePageProps) {
  const { id } = await params;
  const article = await getArticleById(id);

  if (!article) {
    return { title: "INSIGHT AI" };
  }

  return { title: `${article.title} | INSIGHT AI` };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { id } = await params;
  const article = await getArticleById(id);

  if (!article || !article.analysis) {
    notFound();
  }

  const analysis = article.analysis;
  const bodyParagraphs = article.raw_text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-(--container-insight) flex-1 px-6 py-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h1 className="text-h1 font-bold text-text-primary">{article.title}</h1>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="text-body-sm text-text-secondary">
                {article.source.name} · {dateFormatter.format(new Date(article.published_at))}
              </p>
              <SentimentBadge sentimentLabel={analysis.sentiment_label} />
              <button
                type="button"
                aria-label="Save"
                className="ml-auto flex h-8 w-8 items-center justify-center rounded-full border border-border text-text-secondary transition-colors hover:bg-surface"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                  <path d="M6 2h12a1 1 0 0 1 1 1v18l-7-4-7 4V3a1 1 0 0 1 1-1Z" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Share"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-text-secondary transition-colors hover:bg-surface"
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
                  <path d="M18 16.1a3 3 0 0 0-2.1.9l-7.1-4.1a3 3 0 0 0 0-1.8l7.1-4.1a3 3 0 1 0-1-1.7l-7.1 4.1a3 3 0 1 0 0 5.2l7.1 4.1a3 3 0 1 0 3.1-2.6Z" />
                </svg>
              </button>
            </div>

            <div className="relative mt-6 aspect-[16/9] w-full overflow-hidden rounded-lg">
              <Image
                src={article.image_url}
                alt={article.title}
                fill
                sizes="(min-width: 1024px) 66vw, 100vw"
                className="object-cover"
                priority
              />
            </div>

            <div className="mt-6 rounded-lg border border-border bg-bg-primary p-6 shadow-sm">
              <h2 className="text-h4 font-medium text-text-primary">Bias Distribution</h2>
              <div className="mt-3">
                <BiasBar
                  leftPercentage={analysis.left_percentage}
                  centerPercentage={analysis.center_percentage}
                  rightPercentage={analysis.right_percentage}
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-4">
              {bodyParagraphs.map((paragraph, index) => (
                <p key={index} className="text-body-lg text-text-primary">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-6 lg:col-span-1">
            <BiasAnalysisCard
              biasLabel={analysis.bias_label}
              leftPercentage={analysis.left_percentage}
              centerPercentage={analysis.center_percentage}
              rightPercentage={analysis.right_percentage}
              confidence={analysis.confidence}
            />

            <AiSummaryCard summary={analysis.summary} disclaimer={analysis.disclaimer} />

            <FramingNotesCard framingNotes={analysis.framing_notes} loadedTerms={analysis.loaded_terms} />
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

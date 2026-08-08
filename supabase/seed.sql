-- insight-ai initial sources
-- Run after schema.sql. Homepage entry URLs only (AGENTS.md section 9) -- never sub-pages.

insert into sources (name, listing_url, parser_strategy, is_active) values
  ('Reuters', 'https://www.reuters.com/', 'reuters', true),
  ('NPR', 'https://www.npr.org/', 'npr', true),
  ('Fox News', 'https://www.foxnews.com/', 'fox', true),
  ('BBC News', 'https://www.bbc.com/news', 'bbc', true),
  ('The Guardian', 'https://www.theguardian.com/us', 'guardian', true)
on conflict (listing_url) do nothing;

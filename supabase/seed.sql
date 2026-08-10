-- insight-ai initial sources
-- Run after schema.sql. Homepage entry URLs only (AGENTS.md section 9) -- never sub-pages.

insert into sources (name, listing_url, parser_strategy, is_active) values
  ('Reuters', 'https://www.reuters.com/technology', 'reuters', true),
  ('NPR', 'https://www.npr.org/sections/technology', 'npr', true),
  ('Fox News', 'https://www.foxnews.com/tech', 'fox', true),
  ('BBC News', 'https://www.bbc.com/news/technology', 'bbc', true),
  ('The Guardian', 'https://www.theguardian.com/au/technology', 'guardian', true)
on conflict (listing_url) do nothing;


-- marketplace_search_cache is system-only; block all client access
CREATE POLICY "Block all client access to search cache"
  ON public.marketplace_search_cache
  FOR ALL
  USING (false);

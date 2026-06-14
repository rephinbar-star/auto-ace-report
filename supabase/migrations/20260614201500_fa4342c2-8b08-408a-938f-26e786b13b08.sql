-- 1. user_roles: restrictive policy ensuring only admins can insert roles
CREATE POLICY "Only admins can insert roles (restrictive)"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. marketplace_search_cache: replace permissive false with restrictive deny
DROP POLICY IF EXISTS "Block all client access to search cache" ON public.marketplace_search_cache;
CREATE POLICY "Deny all client access to search cache"
ON public.marketplace_search_cache
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- 3. vehicle-images: fix UPDATE ownership check to use correct path segment for marketplace images
DROP POLICY IF EXISTS "Restrict vehicle-images updates to owners" ON storage.objects;
CREATE POLICY "Restrict vehicle-images updates to owners"
ON storage.objects
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  (bucket_id <> 'vehicle-images'::text)
  OR ((auth.uid())::text = (storage.foldername(name))[2])
)
WITH CHECK (
  (bucket_id <> 'vehicle-images'::text)
  OR ((auth.uid())::text = (storage.foldername(name))[2])
);

-- 4. Revoke EXECUTE on internal-only SECURITY DEFINER functions from client roles
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_otps() FROM PUBLIC, anon, authenticated;

-- has_role is required by RLS for authenticated users; remove only anon/public exposure
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
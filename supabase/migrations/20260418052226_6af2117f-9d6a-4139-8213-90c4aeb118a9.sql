-- 1) Restrict SELECT on vehicle-images/marketplace/** to the uploader.
-- Drop the overly permissive policy if present, recreate with ownership check.
DROP POLICY IF EXISTS "Authenticated users can read marketplace images" ON storage.objects;

CREATE POLICY "Uploaders can read their marketplace images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'vehicle-images'
  AND (storage.foldername(name))[1] = 'marketplace'
  AND (storage.foldername(name))[2] = (auth.uid())::text
);

-- 2) Harden has_role: NULL caller (anon / unexpected RLS path) must return false.
-- The service role bypasses RLS entirely and does not depend on this branch.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  caller uuid := auth.uid();
  caller_is_admin boolean;
BEGIN
  -- Deny when there is no authenticated caller. Service role bypasses RLS
  -- and does not need this function to authorize access.
  IF caller IS NULL THEN
    RETURN false;
  END IF;

  -- Callers may always check their own roles.
  IF caller = _user_id THEN
    RETURN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    );
  END IF;

  -- Otherwise, only admins may check arbitrary users' roles.
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = caller AND role = 'admin'::app_role
  ) INTO caller_is_admin;

  IF caller_is_admin THEN
    RETURN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    );
  END IF;

  RETURN false;
END;
$function$;
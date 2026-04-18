-- 1) Restrictive UPDATE policy for vehicle-images bucket scoped to ownership
DROP POLICY IF EXISTS "Restrict vehicle-images updates to owners" ON storage.objects;
CREATE POLICY "Restrict vehicle-images updates to owners"
ON storage.objects
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (
  bucket_id <> 'vehicle-images'
  OR (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id <> 'vehicle-images'
  OR (auth.uid())::text = (storage.foldername(name))[1]
);

-- 2) Harden has_role to prevent role enumeration of other users.
-- Non-admin callers may only check their own roles. Admins (verified via direct
-- table lookup with elevated privileges) may check any user's roles.
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
  -- Allow internal/SQL contexts with no auth.uid() (e.g. triggers, cron, service role)
  IF caller IS NULL THEN
    RETURN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    );
  END IF;

  -- Callers may always check their own roles
  IF caller = _user_id THEN
    RETURN EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    );
  END IF;

  -- Otherwise, only admins may check arbitrary users' roles
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
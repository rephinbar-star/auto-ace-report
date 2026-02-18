
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NULL
    )
  );
  
  INSERT INTO public.subscriptions (user_id, type, status)
  VALUES (NEW.id, 'pro', 'active');
  
  RETURN NEW;
END;
$function$;

-- Also backfill existing profiles that have no display_name from auth.users metadata
UPDATE public.profiles p
SET display_name = COALESCE(
  u.raw_user_meta_data->>'full_name',
  u.raw_user_meta_data->>'name'
)
FROM auth.users u
WHERE p.user_id = u.id
  AND p.display_name IS NULL
  AND (u.raw_user_meta_data->>'full_name' IS NOT NULL OR u.raw_user_meta_data->>'name' IS NOT NULL);

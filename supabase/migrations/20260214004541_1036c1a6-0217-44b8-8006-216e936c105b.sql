-- Block anonymous access to user_blocks
CREATE POLICY "Block anonymous access to user_blocks"
ON public.user_blocks
AS RESTRICTIVE
FOR ALL
USING (false);
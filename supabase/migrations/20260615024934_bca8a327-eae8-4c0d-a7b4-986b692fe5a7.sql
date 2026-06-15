CREATE POLICY "Admins can view all reports"
ON public.vehicle_reports
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
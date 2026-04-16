-- Block UPDATE on history-reports storage bucket
CREATE POLICY "Block updates on history reports"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'history-reports' AND false);
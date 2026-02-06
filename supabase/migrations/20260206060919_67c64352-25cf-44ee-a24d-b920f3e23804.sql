-- Create storage bucket for vehicle history reports
INSERT INTO storage.buckets (id, name, public)
VALUES ('history-reports', 'history-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload their own history reports"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'history-reports' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to read their own files
CREATE POLICY "Users can read their own history reports"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'history-reports' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete their own history reports"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'history-reports' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
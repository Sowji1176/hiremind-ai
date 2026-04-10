-- Drop existing overly permissive storage policies
DROP POLICY IF EXISTS "Users can view resumes" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload resumes" ON storage.objects;

-- Create owner-scoped SELECT policy (user can only view their own files)
CREATE POLICY "Users can view own resumes"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'resumes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create owner-scoped INSERT policy (user can only upload to their own folder)
CREATE POLICY "Users can upload own resumes"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'resumes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create owner-scoped DELETE policy
CREATE POLICY "Users can delete own resumes"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'resumes'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
-- ============================================================================
-- HumanOS – Storage Buckets & Policies
-- Migration 00003: Create private storage buckets with RLS
-- ============================================================================

-- 1. Create storage buckets (both private – presigned URLs only)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'documents',
    'documents',
    false,
    52428800, -- 50MB max file size
    NULL      -- allow all MIME types
  ),
  (
    'generated-images',
    'generated-images',
    false,
    10485760, -- 10MB max file size
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  ),
  (
    'avatars',
    'avatars',
    false,
    2097152, -- 2MB max file size
    ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
  );

-- 2. Storage policies for 'documents' bucket
-- ============================================================================

-- Users can upload to their own folder: documents/{user_id}/...
CREATE POLICY "documents_upload_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can view their own documents
CREATE POLICY "documents_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can view shared documents (path starts with 'shared/')
CREATE POLICY "documents_select_shared"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = 'shared'
  );

-- Users can update their own documents
CREATE POLICY "documents_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own documents
CREATE POLICY "documents_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. Storage policies for 'generated-images' bucket
-- ============================================================================

-- Adults can upload generated images to their own folder
CREATE POLICY "generated_images_upload_adults"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'generated-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.get_user_role() IN ('admin', 'partner')
  );

-- All authenticated users can view generated images (gallery)
CREATE POLICY "generated_images_select_all"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'generated-images');

-- Users can delete their own generated images
CREATE POLICY "generated_images_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'generated-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Storage policies for 'avatars' bucket
-- ============================================================================

-- Users can upload their own avatar: avatars/{user_id}/...
CREATE POLICY "avatars_upload_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- All authenticated users can view avatars
CREATE POLICY "avatars_select_all"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');

-- Users can update their own avatar
CREATE POLICY "avatars_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own avatar
CREATE POLICY "avatars_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

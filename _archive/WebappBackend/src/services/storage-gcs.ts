import { Storage } from '@google-cloud/storage';

// Initialize Google Cloud Storage client
const storage = new Storage({
  projectId: process.env.GCLOUD_PROJECT || 'bookvid-be-prod',
  keyFilename: process.env.GCP_JSON_CREDENTIALS 
    ? JSON.parse(process.env.GCP_JSON_CREDENTIALS)
    : undefined
});

const BUCKET_NAME = process.env.GCLOUD_STORAGE_BUCKET || 'bookvid-prod-vr-recordings';

/**
 * Upload recording to Google Cloud Storage
 * Use this instead of AWS S3 since you already have GCS configured
 */
export async function uploadRecording(
  buffer: Buffer,
  sessionId: string,
  filename?: string
): Promise<string> {
  const bucket = storage.bucket(BUCKET_NAME);
  const blobName = `vr-recordings/${sessionId}/${filename || Date.now()}.webm`;
  const blob = bucket.file(blobName);

  try {
    await blob.save(buffer, {
      contentType: 'video/webm',
      metadata: {
        sessionId: sessionId,
        uploadedAt: new Date().toISOString()
      },
      public: true // Make recordings publicly accessible
    });

    // Return public URL
    const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${blobName}`;
    console.log(`✅ Recording uploaded to GCS: ${publicUrl}`);
    return publicUrl;
  } catch (error) {
    console.error('Failed to upload to GCS:', error);
    throw new Error('Failed to upload recording');
  }
}

/**
 * Generate signed URL for temporary secure access
 */
export async function getRecordingUrl(blobName: string, expiresIn: number = 3600): Promise<string> {
  const bucket = storage.bucket(BUCKET_NAME);
  const blob = bucket.file(blobName);

  try {
    const [url] = await blob.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresIn * 1000
    });

    return url;
  } catch (error) {
    console.error('Failed to generate signed URL:', error);
    throw new Error('Failed to generate download URL');
  }
}

/**
 * Upload from stream
 */
export async function uploadFromStream(
  stream: NodeJS.ReadableStream,
  sessionId: string,
  filename?: string
): Promise<string> {
  const bucket = storage.bucket(BUCKET_NAME);
  const blobName = `vr-recordings/${sessionId}/${filename || Date.now()}.webm`;
  const blob = bucket.file(blobName);

  return new Promise((resolve, reject) => {
    stream
      .pipe(blob.createWriteStream({
        metadata: {
          contentType: 'video/webm',
          metadata: {
            sessionId: sessionId
          }
        },
        public: true
      }))
      .on('error', (error) => {
        console.error('GCS upload error:', error);
        reject(error);
      })
      .on('finish', () => {
        const publicUrl = `https://storage.googleapis.com/${BUCKET_NAME}/${blobName}`;
        console.log(`✅ Recording uploaded to GCS: ${publicUrl}`);
        resolve(publicUrl);
      });
  });
}

/**
 * Delete recording
 */
export async function deleteRecording(blobName: string): Promise<void> {
  const bucket = storage.bucket(BUCKET_NAME);
  const blob = bucket.file(blobName);

  try {
    await blob.delete();
    console.log(`✅ Deleted recording: ${blobName}`);
  } catch (error) {
    console.error('Failed to delete from GCS:', error);
    throw new Error('Failed to delete recording');
  }
}

/**
 * List recordings for a session
 */
export async function listSessionRecordings(sessionId: string): Promise<string[]> {
  const bucket = storage.bucket(BUCKET_NAME);
  const prefix = `vr-recordings/${sessionId}/`;

  try {
    const [files] = await bucket.getFiles({ prefix });
    return files.map(file => file.name);
  } catch (error) {
    console.error('Failed to list recordings:', error);
    return [];
  }
}


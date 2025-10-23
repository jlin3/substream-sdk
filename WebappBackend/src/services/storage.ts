import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  } : undefined
});

const BUCKET_NAME = process.env.S3_BUCKET || 'vr-stream-recordings';

/**
 * Upload recording to S3
 */
export async function uploadRecording(
  buffer: Buffer,
  sessionId: string,
  filename?: string
): Promise<string> {
  const key = `recordings/${sessionId}/${filename || Date.now()}.webm`;

  try {
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: 'video/webm',
      Metadata: {
        sessionId: sessionId,
        uploadedAt: new Date().toISOString()
      }
    }));

    // Return public URL (assumes bucket is public or has appropriate access)
    return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  } catch (error) {
    console.error('Failed to upload to S3:', error);
    throw new Error('Failed to upload recording');
  }
}

/**
 * Generate presigned URL for secure download
 */
export async function getRecordingUrl(key: string, expiresIn: number = 3600): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('Failed to generate presigned URL:', error);
    throw new Error('Failed to generate download URL');
  }
}

/**
 * Upload recording from stream/file
 */
export async function uploadFromStream(
  stream: NodeJS.ReadableStream,
  sessionId: string,
  filename?: string
): Promise<string> {
  // Convert stream to buffer
  const chunks: Buffer[] = [];
  
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        const url = await uploadRecording(buffer, sessionId, filename);
        resolve(url);
      } catch (error) {
        reject(error);
      }
    });
    stream.on('error', reject);
  });
}


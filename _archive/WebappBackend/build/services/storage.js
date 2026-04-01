"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadFromStream = exports.getRecordingUrl = exports.uploadRecording = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const s3Client = new client_s3_1.S3Client({
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
async function uploadRecording(buffer, sessionId, filename) {
    const key = `recordings/${sessionId}/${filename || Date.now()}.webm`;
    try {
        await s3Client.send(new client_s3_1.PutObjectCommand({
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
    }
    catch (error) {
        console.error('Failed to upload to S3:', error);
        throw new Error('Failed to upload recording');
    }
}
exports.uploadRecording = uploadRecording;
/**
 * Generate presigned URL for secure download
 */
async function getRecordingUrl(key, expiresIn = 3600) {
    try {
        const command = new client_s3_1.GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });
        const url = await (0, s3_request_presigner_1.getSignedUrl)(s3Client, command, { expiresIn });
        return url;
    }
    catch (error) {
        console.error('Failed to generate presigned URL:', error);
        throw new Error('Failed to generate download URL');
    }
}
exports.getRecordingUrl = getRecordingUrl;
/**
 * Upload recording from stream/file
 */
async function uploadFromStream(stream, sessionId, filename) {
    // Convert stream to buffer
    const chunks = [];
    return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(chunk));
        stream.on('end', async () => {
            try {
                const buffer = Buffer.concat(chunks);
                const url = await uploadRecording(buffer, sessionId, filename);
                resolve(url);
            }
            catch (error) {
                reject(error);
            }
        });
        stream.on('error', reject);
    });
}
exports.uploadFromStream = uploadFromStream;
//# sourceMappingURL=storage.js.map
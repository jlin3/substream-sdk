/**
 * Streaming Module Exports
 */

// Types
export * from './types';

// IVS Client
export {
  getIVSClient,
  createChannel,
  getChannel,
  deleteChannel,
  createStreamKey,
  getStream,
  stopStream,
  buildRTMPSIngestUrl,
  createRecordingConfiguration,
  getRecordingConfiguration,
} from './ivs-client';

// Playback Auth
export {
  generatePlaybackToken,
  generateCloudFrontSignedUrl,
  buildPlaybackUrlWithToken,
  refreshPlaybackToken,
} from './playback-auth';

// Encryption (for administrative use)
export {
  encryptStreamKey,
  decryptStreamKey,
  isEncrypted,
  generateEncryptionKey,
} from './encryption';

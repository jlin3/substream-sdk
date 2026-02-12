/**
 * Streaming Module Exports
 * IVS-based "Private Twitch" streaming infrastructure
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

// Stream Service
export {
  ensureChannelForChild,
  getIngestProvisioning,
  getPlaybackForParent,
  createStreamSession,
  endStreamSession,
  getSessionInfo,
  getVODsForChild,
  forceStopStream,
  resetChannel,
} from './stream-service';

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

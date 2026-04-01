import { Router } from 'express';
import multer from 'multer';
import { authenticateToken, optionalAuth, AuthRequest } from '../middleware/auth';
import { supabase } from '../db/supabase';
import { uploadRecording, getRecordingUrl } from '../services/storage';
import { notifyRecordingReady } from '../services/notifications';

const router = Router();

// Configure multer for file uploads (store in memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB limit
  }
});

/**
 * Upload recording
 * POST /api/recordings/upload
 */
router.post('/upload', authenticateToken, upload.single('recording'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { sessionId } = req.body;
    const userId = req.user!.id;

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    // Verify session belongs to user
    const { data: session } = await supabase
      .from('stream_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    console.log(`📹 Uploading recording for session ${sessionId} (${(req.file.size / 1024 / 1024).toFixed(2)}MB)`);

    // Upload to S3
    const storageUrl = await uploadRecording(
      req.file.buffer,
      sessionId,
      req.file.originalname
    );

    console.log(`✅ Recording uploaded to S3: ${storageUrl}`);

    // Save recording metadata to database
    const { data: recording, error } = await supabase
      .from('stream_recordings')
      .insert({
        session_id: sessionId,
        storage_url: storageUrl,
        file_size: req.file.size,
        duration: null // Will be calculated later if needed
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: error.message });
    }

    // TODO: Send notification to parent
    /*
    try {
      const parentEmail = await getParentEmail(userId);
      if (parentEmail) {
        await notifyRecordingReady(parentEmail, req.user!.email, storageUrl, sessionId);
      }
    } catch (err) {
      console.error('Failed to send notification:', err);
    }
    */

    res.json({
      id: recording.id,
      url: storageUrl,
      fileSize: req.file.size
    });
  } catch (error) {
    console.error('Error uploading recording:', error);
    res.status(500).json({ error: 'Failed to upload recording' });
  }
});

/**
 * Get recordings for a session
 * GET /api/recordings/session/:sessionId
 */
router.get('/session/:sessionId', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params;

    const { data, error } = await supabase
      .from('stream_recordings')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json(data || []);
  } catch (error) {
    console.error('Error fetching recordings:', error);
    res.status(500).json({ error: 'Failed to fetch recordings' });
  }
});

/**
 * Get recording by ID
 * GET /api/recordings/:recordingId
 */
router.get('/:recordingId', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { recordingId } = req.params;

    const { data, error } = await supabase
      .from('stream_recordings')
      .select('*')
      .eq('id', recordingId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error fetching recording:', error);
    res.status(500).json({ error: 'Failed to fetch recording' });
  }
});

/**
 * Get presigned URL for downloading a recording
 * GET /api/recordings/:recordingId/download
 */
router.get('/:recordingId/download', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { recordingId } = req.params;

    // Get recording from database
    const { data: recording, error } = await supabase
      .from('stream_recordings')
      .select('*, stream_sessions!inner(user_id)')
      .eq('id', recordingId)
      .single();

    if (error || !recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    // Verify user has access (owner or admin)
    const session = recording.stream_sessions as any;
    if (session.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Extract key from storage URL
    const url = new URL(recording.storage_url);
    const key = url.pathname.substring(1); // Remove leading slash

    // Generate presigned URL
    const downloadUrl = await getRecordingUrl(key);

    res.json({ url: downloadUrl });
  } catch (error) {
    console.error('Error generating download URL:', error);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

/**
 * Delete recording
 * DELETE /api/recordings/:recordingId
 */
router.delete('/:recordingId', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { recordingId } = req.params;

    // Get recording to verify ownership
    const { data: recording } = await supabase
      .from('stream_recordings')
      .select('*, stream_sessions!inner(user_id)')
      .eq('id', recordingId)
      .single();

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    // Verify user has access
    const session = recording.stream_sessions as any;
    if (session.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Delete from database (TODO: also delete from S3)
    const { error } = await supabase
      .from('stream_recordings')
      .delete()
      .eq('id', recordingId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting recording:', error);
    res.status(500).json({ error: 'Failed to delete recording' });
  }
});

export default router;


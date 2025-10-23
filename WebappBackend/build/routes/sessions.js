"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const supabase_1 = require("../db/supabase");
const router = (0, express_1.Router)();
/**
 * Start streaming session (Unity calls this)
 * POST /api/sessions/start
 */
router.post('/start', auth_1.authenticateToken, async (req, res) => {
    try {
        const { connectionId, metadata } = req.body;
        const userId = req.user.id;
        const roomName = `stream-${userId}-${Date.now()}`;
        // Create session in database
        const { data, error } = await supabase_1.supabase
            .from('stream_sessions')
            .insert({
            user_id: userId,
            connection_id: connectionId || null,
            room_name: roomName,
            status: 'active',
            metadata: metadata || {}
        })
            .select()
            .single();
        if (error) {
            console.error('Database error:', error);
            return res.status(500).json({ error: error.message });
        }
        console.log(`✅ Stream session started: ${data.id} for user ${userId}`);
        // TODO: Trigger parent notification
        // This would require fetching parent email from your main app's database
        // For now, we'll add this in the integration phase
        /*
        try {
          const parentEmail = await getParentEmail(userId);
          if (parentEmail) {
            const streamUrl = `${process.env.STREAM_VIEWER_URL}/watch/${roomName}`;
            await notifyStreamStarted(parentEmail, req.user!.email, streamUrl, data.id);
          }
        } catch (err) {
          console.error('Failed to send notification:', err);
          // Don't fail the request if notification fails
        }
        */
        res.json({
            sessionId: data.id,
            roomName: roomName,
            connectionId: connectionId
        });
    }
    catch (error) {
        console.error('Error starting session:', error);
        res.status(500).json({ error: 'Failed to start session' });
    }
});
/**
 * End streaming session
 * POST /api/sessions/end/:sessionId
 */
router.post('/end/:sessionId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user.id;
        // Verify session belongs to user
        const { data: session } = await supabase_1.supabase
            .from('stream_sessions')
            .select('*')
            .eq('id', sessionId)
            .eq('user_id', userId)
            .single();
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        // Update session
        const { error } = await supabase_1.supabase
            .from('stream_sessions')
            .update({
            ended_at: new Date().toISOString(),
            status: 'ended'
        })
            .eq('id', sessionId);
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        // Calculate duration
        const startTime = new Date(session.started_at).getTime();
        const endTime = Date.now();
        const duration = Math.floor((endTime - startTime) / 1000); // seconds
        console.log(`✅ Stream session ended: ${sessionId} (duration: ${duration}s)`);
        // TODO: Send notification
        /*
        try {
          const parentEmail = await getParentEmail(userId);
          if (parentEmail) {
            await notifyStreamEnded(parentEmail, req.user!.email, sessionId, duration);
          }
        } catch (err) {
          console.error('Failed to send notification:', err);
        }
        */
        res.json({
            success: true,
            duration: duration
        });
    }
    catch (error) {
        console.error('Error ending session:', error);
        res.status(500).json({ error: 'Failed to end session' });
    }
});
/**
 * Get active streams
 * GET /api/sessions/active
 */
router.get('/active', auth_1.optionalAuth, async (req, res) => {
    try {
        const { data, error } = await supabase_1.supabase
            .from('stream_sessions')
            .select('id, user_id, room_name, started_at, status')
            .is('ended_at', null)
            .eq('status', 'active')
            .order('started_at', { ascending: false })
            .limit(50);
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.json(data || []);
    }
    catch (error) {
        console.error('Error fetching active sessions:', error);
        res.status(500).json({ error: 'Failed to fetch active sessions' });
    }
});
/**
 * Get session details
 * GET /api/sessions/:sessionId
 */
router.get('/:sessionId', auth_1.optionalAuth, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { data, error } = await supabase_1.supabase
            .from('stream_sessions')
            .select('*')
            .eq('id', sessionId)
            .single();
        if (error || !data) {
            return res.status(404).json({ error: 'Session not found' });
        }
        res.json(data);
    }
    catch (error) {
        console.error('Error fetching session:', error);
        res.status(500).json({ error: 'Failed to fetch session' });
    }
});
/**
 * Track viewer joining a session
 * POST /api/sessions/:sessionId/viewers
 */
router.post('/:sessionId/viewers', auth_1.optionalAuth, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.user?.id || 'anonymous';
        // Verify session exists
        const { data: session } = await supabase_1.supabase
            .from('stream_sessions')
            .select('id')
            .eq('id', sessionId)
            .single();
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        // Add viewer record
        const { data, error } = await supabase_1.supabase
            .from('stream_viewers')
            .insert({
            session_id: sessionId,
            user_id: userId
        })
            .select()
            .single();
        if (error) {
            console.error('Error adding viewer:', error);
            return res.status(500).json({ error: error.message });
        }
        console.log(`✅ Viewer ${userId} joined session ${sessionId}`);
        res.json(data);
    }
    catch (error) {
        console.error('Error tracking viewer:', error);
        res.status(500).json({ error: 'Failed to track viewer' });
    }
});
/**
 * Track viewer leaving a session
 * DELETE /api/sessions/:sessionId/viewers/:viewerId
 */
router.delete('/:sessionId/viewers/:viewerId', async (req, res) => {
    try {
        const { viewerId } = req.params;
        const { error } = await supabase_1.supabase
            .from('stream_viewers')
            .update({ left_at: new Date().toISOString() })
            .eq('id', viewerId);
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error updating viewer:', error);
        res.status(500).json({ error: 'Failed to update viewer' });
    }
});
exports.default = router;
//# sourceMappingURL=sessions.js.map
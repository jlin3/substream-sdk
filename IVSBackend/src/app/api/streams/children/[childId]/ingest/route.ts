/**
 * Ingest Provisioning API
 * Provides RTMPS ingest credentials for a child's Stream SDK
 * 
 * POST /api/streams/children/:childId/ingest
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIngestProvisioning, StreamingError } from '@/lib/streaming';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ childId: string }> }
) {
  try {
    const { childId } = await params;
    
    // TODO: Replace with actual auth extraction from session/token
    // This should come from your auth system
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    
    // Extract user ID from auth (placeholder - implement based on your auth)
    const requestingUserId = extractUserIdFromAuth(authHeader);
    if (!requestingUserId) {
      return NextResponse.json(
        { error: 'Invalid authentication', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const result = await getIngestProvisioning(childId, requestingUserId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Ingest provisioning error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'no stack');

    if (error instanceof StreamingError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.statusCode }
      );
    }

    // Return more details in development
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage, code: 'INTERNAL_ERROR', stack: error instanceof Error ? error.stack : undefined },
      { status: 500 }
    );
  }
}

/**
 * Extract user ID from auth header
 * Supports demo tokens for SDK testing
 */
function extractUserIdFromAuth(authHeader: string): string | null {
  const match = authHeader.match(/^Bearer\s+(.+)$/);
  if (!match) return null;
  
  const token = match[1];
  
  // Demo token mapping for SDK users to test immediately
  const demoTokens: Record<string, string> = {
    'demo-token': 'demo-user-001',           // Demo child (streamer)
    'demo-viewer-token': 'demo-viewer-001',  // Demo parent (viewer)
    'test-token': 'test-user-id',            // Test child
    'test-parent-token': 'test-parent-user-id', // Test parent
  };
  
  if (demoTokens[token]) {
    return demoTokens[token];
  }
  
  // TODO: In production, verify JWT and extract user ID
  // For now, treat the token as a user ID (development only)
  return token;
}

/**
 * WebRTC Signaling Bridge for IVS Real-Time
 * 
 * POST /api/streams/realtime/signal
 * 
 * This endpoint handles WebRTC signaling between Unity clients and IVS Real-Time Stages.
 * 
 * NOTE: IVS Real-Time uses a proprietary signaling protocol via their SDK.
 * This endpoint provides a bridge for clients that don't have native IVS SDK support.
 * 
 * Current limitation: Full SDP exchange requires IVS SDK integration.
 * This endpoint validates the setup and returns connection info for manual integration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStage, isValidStageArn } from '@/lib/streaming/ivs-realtime-client';
import { StreamingError, StreamingErrorCode } from '@/lib/streaming/types';

interface SignalingRequest {
  stageArn: string;
  participantToken: string;
  sdpOffer: string;
}

interface SignalingResponse {
  sdpAnswer?: string;
  error?: string;
  connectionInfo?: {
    stageArn: string;
    region: string;
    signalingEndpoint: string;
    instructions: string[];
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SignalingRequest;
    
    // Validate required fields
    if (!body.stageArn) {
      return NextResponse.json(
        { error: 'Missing stageArn', code: 'INVALID_PARAMS' },
        { status: 400 }
      );
    }
    
    if (!body.participantToken) {
      return NextResponse.json(
        { error: 'Missing participantToken', code: 'INVALID_PARAMS' },
        { status: 400 }
      );
    }
    
    if (!body.sdpOffer) {
      return NextResponse.json(
        { error: 'Missing sdpOffer', code: 'INVALID_PARAMS' },
        { status: 400 }
      );
    }
    
    // Validate stage ARN format
    if (!isValidStageArn(body.stageArn)) {
      return NextResponse.json(
        { 
          error: 'Invalid stageArn format', 
          code: 'INVALID_PARAMS',
          details: 'Stage ARN should match: arn:aws:ivs:REGION:ACCOUNT:stage/ID'
        },
        { status: 400 }
      );
    }
    
    // Verify the stage exists
    const stage = await getStage(body.stageArn);
    if (!stage) {
      return NextResponse.json(
        { error: 'Stage not found', code: 'STAGE_NOT_FOUND' },
        { status: 404 }
      );
    }
    
    const region = process.env.AWS_REGION || 'us-east-1';
    
    // IVS Real-Time signaling info
    // Note: IVS uses their SDK for signaling, not standard WHIP
    const signalingEndpoint = `wss://global.realtime.ivs.${region}.amazonaws.com`;
    
    // For now, we return connection info since we can't do full SDP exchange
    // without IVS SDK integration
    const response: SignalingResponse = {
      // We don't have an SDP answer because IVS doesn't expose raw SDP exchange
      // The client needs to use IVS's signaling protocol
      connectionInfo: {
        stageArn: body.stageArn,
        region,
        signalingEndpoint,
        instructions: [
          'IVS Real-Time uses proprietary signaling, not standard WebRTC SDP exchange.',
          'To connect from Unity without IVS SDK:',
          '1. Use the RTMPS path (IVSStreamControl.cs) for reliable streaming',
          '2. Or wait for IVS WHIP support (standard WebRTC-HTTP protocol)',
          '',
          'The participant token you have is valid for connecting via IVS SDK.',
          `Signaling endpoint: ${signalingEndpoint}`,
          'Protocol: IVS Real-Time proprietary (not documented for third-party use)',
        ],
      },
      error: 'SDP exchange not available - IVS uses proprietary signaling. Use RTMPS path for now.',
    };
    
    // Return 501 Not Implemented with helpful info
    return NextResponse.json(response, { status: 501 });
    
  } catch (error) {
    console.error('[Signal] Error:', error);
    
    if (error instanceof StreamingError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode }
      );
    }
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Internal error',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for checking signaling status
 */
export async function GET() {
  const region = process.env.AWS_REGION || 'us-east-1';
  const stageArn = process.env.IVS_STAGE_ARN;
  
  return NextResponse.json({
    status: 'experimental',
    message: 'IVS Real-Time WebRTC signaling bridge',
    capabilities: {
      sdpExchange: false, // Not available without IVS SDK
      whip: false, // IVS doesn't support WHIP yet
      ivsSignaling: 'requires-sdk', // Needs IVS native SDK
    },
    config: {
      region,
      stageArn: stageArn ? 'configured' : 'not-configured',
      signalingEndpoint: `wss://global.realtime.ivs.${region}.amazonaws.com`,
    },
    recommendation: 'Use RTMPS path (IVSStreamControl.cs) until IVS adds WHIP support',
  });
}

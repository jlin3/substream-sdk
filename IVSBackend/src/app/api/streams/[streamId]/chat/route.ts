/**
 * Chat Token & Moderation API
 *
 * POST   /api/streams/:streamId/chat/token     — Get a chat token for a viewer
 * DELETE /api/streams/:streamId/chat/message    — Delete a message (moderation)
 * POST   /api/streams/:streamId/chat/disconnect — Disconnect a user (moderation)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, requireScopes, type AuthContext } from '@/lib/auth';
import {
  createChatRoom,
  createChatToken,
  deleteMessage,
  disconnectUser,
} from '@/lib/chat/ivs-chat-client';

// ============================================
// POST — Get or create chat room + return token
// ============================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ streamId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const auth: AuthContext = authResult;
    const { streamId } = await params;

    const body = await request.json().catch(() => ({}));
    const action: string = body.action || 'token';

    if (action === 'disconnect') {
      return handleDisconnect(auth, streamId, body);
    }

    // Default: issue a chat token
    const stream = await prisma.stream.findUnique({
      where: { id: streamId },
      include: { chatRoom: true },
    });

    let chatRoomArn: string;

    if (stream?.chatRoom?.ivsChatRoomArn) {
      chatRoomArn = stream.chatRoom.ivsChatRoomArn;
    } else {
      // Auto-create a chat room for this stream
      const room = await createChatRoom({
        name: `stream-${streamId}`,
        tags: { streamId },
      });
      chatRoomArn = room.arn;

      if (stream) {
        await prisma.chatRoom.upsert({
          where: { streamId },
          update: { ivsChatRoomArn: room.arn },
          create: { streamId, appId: stream.appId, ivsChatRoomArn: room.arn },
        });
      }
    }

    const displayName = body.displayName || auth.userId;
    const capabilities = body.capabilities || ['SEND_MESSAGE'];

    const tokenResult = await createChatToken({
      roomArn: chatRoomArn,
      userId: auth.userId,
      displayName,
      capabilities,
    });

    return NextResponse.json({
      chatRoomArn,
      token: tokenResult.token,
      sessionExpirationTime: tokenResult.sessionExpirationTime.toISOString(),
      tokenExpirationTime: tokenResult.tokenExpirationTime.toISOString(),
    });
  } catch (error) {
    console.error('[Chat] Token error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

// ============================================
// DELETE — Delete a message (moderation)
// ============================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ streamId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const auth: AuthContext = authResult;

    const scopeErr = requireScopes(auth, ['streams:write']);
    if (scopeErr) return scopeErr;

    const { streamId } = await params;
    const body = await request.json();

    if (!body.messageId) {
      return NextResponse.json(
        { error: 'Missing messageId', code: 'INVALID_PARAMS' },
        { status: 400 },
      );
    }

    const chatRoom = await prisma.chatRoom.findUnique({ where: { streamId } });
    if (!chatRoom?.ivsChatRoomArn) {
      return NextResponse.json(
        { error: 'Chat room not found', code: 'NOT_FOUND' },
        { status: 404 },
      );
    }

    await deleteMessage(chatRoom.ivsChatRoomArn, body.messageId, body.reason);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Chat] Delete message error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error', code: 'INTERNAL_ERROR' },
      { status: 500 },
    );
  }
}

// ============================================
// DISCONNECT USER
// ============================================

async function handleDisconnect(
  auth: AuthContext,
  streamId: string,
  body: Record<string, unknown>,
): Promise<NextResponse> {
  const scopeErr = requireScopes(auth, ['streams:write']);
  if (scopeErr) return scopeErr;

  const targetUserId = body.userId as string;
  if (!targetUserId) {
    return NextResponse.json(
      { error: 'Missing userId', code: 'INVALID_PARAMS' },
      { status: 400 },
    );
  }

  const chatRoom = await prisma.chatRoom.findUnique({ where: { streamId } });
  if (!chatRoom?.ivsChatRoomArn) {
    return NextResponse.json(
      { error: 'Chat room not found', code: 'NOT_FOUND' },
      { status: 404 },
    );
  }

  await disconnectUser(chatRoom.ivsChatRoomArn, targetUserId, body.reason as string);
  return NextResponse.json({ success: true });
}

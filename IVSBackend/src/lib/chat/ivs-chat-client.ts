/**
 * AWS IVS Chat Client
 *
 * Wraps the IVS Chat SDK for creating rooms, generating tokens,
 * and moderation actions.
 */

import {
  IvschatClient,
  CreateChatTokenCommand,
  CreateRoomCommand,
  DeleteRoomCommand,
  GetRoomCommand,
  SendEventCommand,
  DisconnectUserCommand,
  DeleteMessageCommand,
  type ChatTokenCapability,
} from '@aws-sdk/client-ivschat';

let client: IvschatClient | null = null;

function getClient(): IvschatClient {
  if (!client) {
    client = new IvschatClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }
  return client;
}

// ============================================
// ROOM MANAGEMENT
// ============================================

export async function createChatRoom(opts: {
  name: string;
  tags?: Record<string, string>;
}): Promise<{ arn: string; id: string }> {
  const resp = await getClient().send(
    new CreateRoomCommand({
      name: opts.name,
      maximumMessageLength: 500,
      maximumMessageRatePerSecond: 5,
      tags: opts.tags,
    }),
  );
  return { arn: resp.arn!, id: resp.id! };
}

export async function deleteChatRoom(arn: string): Promise<void> {
  await getClient().send(new DeleteRoomCommand({ identifier: arn }));
}

export async function getChatRoom(arn: string): Promise<{ arn: string; name: string } | null> {
  try {
    const resp = await getClient().send(new GetRoomCommand({ identifier: arn }));
    return { arn: resp.arn!, name: resp.name! };
  } catch {
    return null;
  }
}

// ============================================
// TOKENS
// ============================================

export async function createChatToken(opts: {
  roomArn: string;
  userId: string;
  displayName?: string;
  capabilities?: ChatTokenCapability[];
  sessionDurationMinutes?: number;
  attributes?: Record<string, string>;
}): Promise<{ token: string; sessionExpirationTime: Date; tokenExpirationTime: Date }> {
  const resp = await getClient().send(
    new CreateChatTokenCommand({
      roomIdentifier: opts.roomArn,
      userId: opts.userId,
      capabilities: opts.capabilities || ['SEND_MESSAGE'],
      sessionDurationInMinutes: opts.sessionDurationMinutes || 60,
      attributes: {
        displayName: opts.displayName || opts.userId,
        ...opts.attributes,
      },
    }),
  );

  return {
    token: resp.token!,
    sessionExpirationTime: resp.sessionExpirationTime!,
    tokenExpirationTime: resp.tokenExpirationTime!,
  };
}

// ============================================
// MODERATION
// ============================================

export async function deleteMessage(roomArn: string, messageId: string, reason?: string): Promise<void> {
  await getClient().send(
    new DeleteMessageCommand({
      roomIdentifier: roomArn,
      id: messageId,
      reason,
    }),
  );
}

export async function disconnectUser(roomArn: string, userId: string, reason?: string): Promise<void> {
  await getClient().send(
    new DisconnectUserCommand({
      roomIdentifier: roomArn,
      userId,
      reason,
    }),
  );
}

export async function sendSystemEvent(
  roomArn: string,
  eventName: string,
  attributes?: Record<string, string>,
): Promise<void> {
  await getClient().send(
    new SendEventCommand({
      roomIdentifier: roomArn,
      eventName,
      attributes,
    }),
  );
}

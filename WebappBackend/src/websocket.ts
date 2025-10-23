import * as websocket from "ws";
import { Server } from 'http';
import { IncomingMessage } from 'http';
import * as handler from "./class/websockethandler";
import * as jwt from 'jsonwebtoken';

export default class WSSignaling {
  server: Server;
  wss: websocket.Server;

  constructor(server: Server, mode: string) {
    this.server = server;
    this.wss = new websocket.Server({ server });
    handler.reset(mode);

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      // Extract and verify auth token from query params or headers
      const token = this.extractToken(req);
      
      if (process.env.JWT_SECRET && token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
          (ws as any).userId = decoded.sub || decoded.userId || decoded.id;
          (ws as any).userEmail = decoded.email;
          console.log(`✅ WebSocket authenticated: ${(ws as any).userId}`);
        } catch (err) {
          console.warn('⚠️  Invalid WebSocket token, closing connection');
          ws.close(1008, 'Invalid token');
          return;
        }
      } else if (process.env.JWT_SECRET) {
        // If JWT_SECRET is set but no token provided, require auth
        console.warn('⚠️  No token provided for WebSocket, closing connection');
        ws.close(1008, 'No token provided');
        return;
      }
      // If no JWT_SECRET, allow unauthenticated (development mode)

      handler.add(ws);

      ws.onclose = (): void => {
        handler.remove(ws);
      };

      ws.onmessage = (event: MessageEvent): void => {

        // type: connect, disconnect JSON Schema
        // connectionId: connect or disconnect connectionId

        // type: offer, answer, candidate JSON Schema
        // from: from connection id
        // to: to connection id
        // data: any message data structure

        const msg = JSON.parse(event.data);
        if (!msg || !this) {
          return;
        }

        console.log(msg);

        switch (msg.type) {
          case "connect":
            handler.onConnect(ws, msg.connectionId);
            break;
          case "disconnect":
            handler.onDisconnect(ws, msg.connectionId);
            break;
          case "offer":
            handler.onOffer(ws, msg.data);
            break;
          case "answer":
            handler.onAnswer(ws, msg.data);
            break;
          case "candidate":
            handler.onCandidate(ws, msg.data);
            break;
          default:
            break;
        }
      };
    });
  }

  private extractToken(req: IncomingMessage): string | null {
    // Try query parameter first
    if (req.url) {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      if (token) return token;
    }

    // Try authorization header
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    return null;
  }
}

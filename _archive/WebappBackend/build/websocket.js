"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const websocket = __importStar(require("ws"));
const handler = __importStar(require("./class/websockethandler"));
const jwt = __importStar(require("jsonwebtoken"));
class WSSignaling {
    constructor(server, mode) {
        this.server = server;
        this.wss = new websocket.Server({ server });
        handler.reset(mode);
        this.wss.on('connection', (ws, req) => {
            // Extract and verify auth token from query params or headers
            const token = this.extractToken(req);
            if (process.env.JWT_SECRET && token) {
                try {
                    const decoded = jwt.verify(token, process.env.JWT_SECRET);
                    ws.userId = decoded.sub || decoded.userId || decoded.id;
                    ws.userEmail = decoded.email;
                    console.log(`✅ WebSocket authenticated: ${ws.userId}`);
                }
                catch (err) {
                    console.warn('⚠️  Invalid WebSocket token, closing connection');
                    ws.close(1008, 'Invalid token');
                    return;
                }
            }
            else if (process.env.JWT_SECRET) {
                // If JWT_SECRET is set but no token provided, require auth
                console.warn('⚠️  No token provided for WebSocket, closing connection');
                ws.close(1008, 'No token provided');
                return;
            }
            // If no JWT_SECRET, allow unauthenticated (development mode)
            handler.add(ws);
            ws.onclose = () => {
                handler.remove(ws);
            };
            ws.onmessage = (event) => {
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
    extractToken(req) {
        // Try query parameter first
        if (req.url) {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const token = url.searchParams.get('token');
            if (token)
                return token;
        }
        // Try authorization header
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }
        return null;
    }
}
exports.default = WSSignaling;
//# sourceMappingURL=websocket.js.map
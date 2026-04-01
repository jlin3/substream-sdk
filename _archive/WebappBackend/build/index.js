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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RenderStreaming = void 0;
// Load environment variables from .env file
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const commander_1 = require("commander");
const https = __importStar(require("https"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const server_1 = require("./server");
const websocket_1 = __importDefault(require("./websocket"));
class RenderStreaming {
    constructor(options) {
        this.options = options;
        this.app = (0, server_1.createServer)(this.options);
        if (this.options.secure) {
            this.server = https.createServer({
                key: fs.readFileSync(options.keyfile),
                cert: fs.readFileSync(options.certfile),
            }, this.app).listen(this.options.port, () => {
                const { port } = this.server.address();
                const addresses = this.getIPAddress();
                for (const address of addresses) {
                    console.log(`https://${address}:${port}`);
                }
            });
        }
        else {
            this.server = this.app.listen(this.options.port, () => {
                const { port } = this.server.address();
                const addresses = this.getIPAddress();
                for (const address of addresses) {
                    console.log(`http://${address}:${port}`);
                }
            });
        }
        if (this.options.type == 'http') {
            console.log(`Use http polling for signaling server.`);
        }
        else if (this.options.type != 'websocket') {
            console.log(`signaling type should be set "websocket" or "http". ${this.options.type} is not supported.`);
            console.log(`Changing signaling type to websocket.`);
            this.options.type = 'websocket';
        }
        if (this.options.type == 'websocket') {
            console.log(`Use websocket for signaling server ws://${this.getIPAddress()[0]}`);
            //Start Websocket Signaling server
            new websocket_1.default(this.server, this.options.mode);
        }
        console.log(`start as ${this.options.mode} mode`);
    }
    static run(argv) {
        const program = new commander_1.Command();
        const readOptions = () => {
            if (Array.isArray(argv)) {
                program
                    .usage('[options] <apps...>')
                    .option('-p, --port <n>', 'Port to start the server on.', process.env.PORT || `80`)
                    .option('-s, --secure', 'Enable HTTPS (you need server.key and server.cert).', process.env.SECURE || false)
                    .option('-k, --keyfile <path>', 'https key file.', process.env.KEYFILE || 'server.key')
                    .option('-c, --certfile <path>', 'https cert file.', process.env.CERTFILE || 'server.cert')
                    .option('-t, --type <type>', 'Type of signaling protocol, Choose websocket or http.', process.env.TYPE || 'websocket')
                    .option('-m, --mode <type>', 'Choose Communication mode public or private.', process.env.MODE || 'public')
                    .option('-l, --logging <type>', 'Choose http logging type combined, dev, short, tiny or none.', process.env.LOGGING || 'dev')
                    .parse(argv);
                const option = program.opts();
                return {
                    port: option.port,
                    secure: option.secure == undefined ? false : option.secure,
                    keyfile: option.keyfile,
                    certfile: option.certfile,
                    type: option.type == undefined ? 'websocket' : option.type,
                    mode: option.mode,
                    logging: option.logging,
                };
            }
        };
        const options = readOptions();
        return new RenderStreaming(options);
    }
    getIPAddress() {
        const interfaces = os.networkInterfaces();
        const addresses = [];
        for (const k in interfaces) {
            for (const k2 in interfaces[k]) {
                const address = interfaces[k][k2];
                if (address.family === 'IPv4') {
                    addresses.push(address.address);
                }
            }
        }
        return addresses;
    }
}
exports.RenderStreaming = RenderStreaming;
RenderStreaming.run(process.argv);
//# sourceMappingURL=index.js.map
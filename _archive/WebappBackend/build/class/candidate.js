"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Candidate {
    constructor(candidate, sdpMLineIndex, sdpMid, datetime) {
        this.candidate = candidate;
        this.sdpMLineIndex = sdpMLineIndex;
        this.sdpMid = sdpMid;
        this.datetime = datetime;
    }
}
exports.default = Candidate;
//# sourceMappingURL=candidate.js.map
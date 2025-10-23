"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.postCandidate = exports.postAnswer = exports.postOffer = exports.deleteConnection = exports.createConnection = exports.deleteSession = exports.createSession = exports.getCandidate = exports.getAnswer = exports.getOffer = exports.getConnection = exports.getAll = exports.checkSessionId = exports.reset = void 0;
const offer_1 = __importDefault(require("./offer"));
const answer_1 = __importDefault(require("./answer"));
const candidate_1 = __importDefault(require("./candidate"));
const uuid_1 = require("uuid");
class Disconnection {
    constructor(id, datetime) {
        this.id = id;
        this.datetime = datetime;
    }
}
const TimeoutRequestedTime = 10000; // 10sec
let isPrivate;
// [{sessonId:[connectionId,...]}]
const clients = new Map();
// [{sessonId:Date}]
const lastRequestedTime = new Map();
// [{connectionId:[sessionId1, sessionId2]}]
const connectionPair = new Map(); // key = connectionId
// [{sessionId:[{connectionId:Offer},...]}]
const offers = new Map(); // key = sessionId
// [{sessionId:[{connectionId:Answer},...]}]
const answers = new Map(); // key = sessionId
// [{sessionId:[{connectionId:Candidate},...]}]
const candidates = new Map(); // key = sessionId
// [{sessionId:[Disconnection,...]}]
const disconnections = new Map(); // key = sessionId
function getOrCreateConnectionIds(sessionId) {
    let connectionIds = null;
    if (!clients.has(sessionId)) {
        connectionIds = new Set();
        clients.set(sessionId, connectionIds);
    }
    connectionIds = clients.get(sessionId);
    return connectionIds;
}
function reset(mode) {
    isPrivate = mode == "private";
    clients.clear();
    connectionPair.clear();
    offers.clear();
    answers.clear();
    candidates.clear();
    disconnections.clear();
}
exports.reset = reset;
function checkSessionId(req, res, next) {
    if (req.url === '/') {
        next();
        return;
    }
    const id = req.header('session-id');
    if (!clients.has(id)) {
        res.sendStatus(404);
        return;
    }
    lastRequestedTime.set(id, Date.now());
    next();
}
exports.checkSessionId = checkSessionId;
function _deleteConnection(sessionId, connectionId, datetime) {
    clients.get(sessionId).delete(connectionId);
    if (isPrivate) {
        if (connectionPair.has(connectionId)) {
            const pair = connectionPair.get(connectionId);
            const otherSessionId = pair[0] == sessionId ? pair[1] : pair[0];
            if (otherSessionId) {
                if (clients.has(otherSessionId)) {
                    clients.get(otherSessionId).delete(connectionId);
                    const array1 = disconnections.get(otherSessionId);
                    array1.push(new Disconnection(connectionId, datetime));
                }
            }
        }
    }
    else {
        disconnections.forEach((array, id) => {
            if (id == sessionId)
                return;
            array.push(new Disconnection(connectionId, datetime));
        });
    }
    connectionPair.delete(connectionId);
    offers.get(sessionId).delete(connectionId);
    answers.get(sessionId).delete(connectionId);
    candidates.get(sessionId).delete(connectionId);
    const array2 = disconnections.get(sessionId);
    array2.push(new Disconnection(connectionId, datetime));
}
function _deleteSession(sessionId) {
    if (clients.has(sessionId)) {
        for (const connectionId of Array.from(clients.get(sessionId))) {
            _deleteConnection(sessionId, connectionId, Date.now());
        }
    }
    offers.delete(sessionId);
    answers.delete(sessionId);
    candidates.delete(sessionId);
    clients.delete(sessionId);
    disconnections.delete(sessionId);
}
function _checkForTimedOutSessions() {
    for (const sessionId of Array.from(clients.keys())) {
        if (!lastRequestedTime.has(sessionId))
            continue;
        if (lastRequestedTime.get(sessionId) > Date.now() - TimeoutRequestedTime)
            continue;
        _deleteSession(sessionId);
        console.log(`deleted sessionId:${sessionId} by timeout.`);
    }
}
function _getConnection(sessionId) {
    _checkForTimedOutSessions();
    return Array.from(clients.get(sessionId));
}
function _getDisconnection(sessionId, fromTime) {
    _checkForTimedOutSessions();
    let arrayDisconnections = [];
    if (disconnections.size != 0 && disconnections.has(sessionId)) {
        arrayDisconnections = disconnections.get(sessionId);
    }
    if (fromTime > 0) {
        arrayDisconnections = arrayDisconnections.filter((v) => v.datetime >= fromTime);
    }
    return arrayDisconnections;
}
function _getOffer(sessionId, fromTime) {
    let arrayOffers = [];
    if (offers.size != 0) {
        if (isPrivate) {
            if (offers.has(sessionId)) {
                arrayOffers = Array.from(offers.get(sessionId));
            }
        }
        else {
            const otherSessionMap = Array.from(offers).filter(x => x[0] != sessionId);
            arrayOffers = [].concat(...Array.from(otherSessionMap, x => Array.from(x[1], y => [y[0], y[1]])));
        }
    }
    if (fromTime > 0) {
        arrayOffers = arrayOffers.filter((v) => v[1].datetime >= fromTime);
    }
    return arrayOffers;
}
function _getAnswer(sessionId, fromTime) {
    let arrayAnswers = [];
    if (answers.size != 0 && answers.has(sessionId)) {
        arrayAnswers = Array.from(answers.get(sessionId));
    }
    if (fromTime > 0) {
        arrayAnswers = arrayAnswers.filter((v) => v[1].datetime >= fromTime);
    }
    return arrayAnswers;
}
function _getCandidate(sessionId, fromTime) {
    const connectionIds = Array.from(clients.get(sessionId));
    const arr = [];
    for (const connectionId of connectionIds) {
        const pair = connectionPair.get(connectionId);
        if (pair == null) {
            continue;
        }
        const otherSessionId = sessionId === pair[0] ? pair[1] : pair[0];
        if (!candidates.get(otherSessionId) || !candidates.get(otherSessionId).get(connectionId)) {
            continue;
        }
        const arrayCandidates = candidates.get(otherSessionId).get(connectionId)
            .filter((v) => v.datetime >= fromTime);
        if (arrayCandidates.length === 0) {
            continue;
        }
        for (const candidate of arrayCandidates) {
            arr.push([connectionId, candidate]);
        }
    }
    return arr;
}
function getAnswer(req, res) {
    // get `fromtime` parameter from request query
    const fromTime = req.query.fromtime ? Number(req.query.fromtime) : 0;
    const sessionId = req.header('session-id');
    const answers = _getAnswer(sessionId, fromTime);
    res.json({ answers: answers.map((v) => ({ connectionId: v[0], sdp: v[1].sdp, type: "answer", datetime: v[1].datetime })) });
}
exports.getAnswer = getAnswer;
function getConnection(req, res) {
    // get `fromtime` parameter from request query
    const sessionId = req.header('session-id');
    const connections = _getConnection(sessionId);
    res.json({ connections: connections.map((v) => ({ connectionId: v, type: "connect", datetime: Date.now() })) });
}
exports.getConnection = getConnection;
function getOffer(req, res) {
    // get `fromtime` parameter from request query
    const fromTime = req.query.fromtime ? Number(req.query.fromtime) : 0;
    const sessionId = req.header('session-id');
    const offers = _getOffer(sessionId, fromTime);
    res.json({ offers: offers.map((v) => ({ connectionId: v[0], sdp: v[1].sdp, polite: v[1].polite, type: "offer", datetime: v[1].datetime })) });
}
exports.getOffer = getOffer;
function getCandidate(req, res) {
    // get `fromtime` parameter from request query
    const fromTime = req.query.fromtime ? Number(req.query.fromtime) : 0;
    const sessionId = req.header('session-id');
    const candidates = _getCandidate(sessionId, fromTime);
    res.json({ candidates: candidates.map((v) => ({ connectionId: v[0], candidate: v[1].candidate, sdpMLineIndex: v[1].sdpMLineIndex, sdpMid: v[1].sdpMid, type: "candidate", datetime: v[1].datetime })) });
}
exports.getCandidate = getCandidate;
function getAll(req, res) {
    const fromTime = req.query.fromtime ? Number(req.query.fromtime) : 0;
    const sessionId = req.header('session-id');
    const connections = _getConnection(sessionId);
    const offers = _getOffer(sessionId, fromTime);
    const answers = _getAnswer(sessionId, fromTime);
    const candidates = _getCandidate(sessionId, fromTime);
    const disconnections = _getDisconnection(sessionId, fromTime);
    const datetime = lastRequestedTime.get(sessionId);
    let array = [];
    array = array.concat(connections.map((v) => ({ connectionId: v, type: "connect", datetime: datetime })));
    array = array.concat(offers.map((v) => ({ connectionId: v[0], sdp: v[1].sdp, polite: v[1].polite, type: "offer", datetime: v[1].datetime })));
    array = array.concat(answers.map((v) => ({ connectionId: v[0], sdp: v[1].sdp, type: "answer", datetime: v[1].datetime })));
    array = array.concat(candidates.map((v) => ({ connectionId: v[0], candidate: v[1].candidate, sdpMLineIndex: v[1].sdpMLineIndex, sdpMid: v[1].sdpMid, type: "candidate", datetime: v[1].datetime })));
    array = array.concat(disconnections.map((v) => ({ connectionId: v.id, type: "disconnect", datetime: v.datetime })));
    array.sort((a, b) => a.datetime - b.datetime);
    res.json({ messages: array, datetime: datetime });
}
exports.getAll = getAll;
function createSession(req, res) {
    const sessionId = typeof req === "string" ? req : (0, uuid_1.v4)();
    clients.set(sessionId, new Set());
    offers.set(sessionId, new Map());
    answers.set(sessionId, new Map());
    candidates.set(sessionId, new Map());
    disconnections.set(sessionId, []);
    res.json({ sessionId: sessionId });
}
exports.createSession = createSession;
function deleteSession(req, res) {
    const id = req.header('session-id');
    _deleteSession(id);
    res.sendStatus(200);
}
exports.deleteSession = deleteSession;
function createConnection(req, res) {
    const sessionId = req.header('session-id');
    const { connectionId } = req.body;
    const datetime = lastRequestedTime.get(sessionId);
    if (connectionId == null) {
        res.status(400).send({ error: new Error(`connectionId is required`) });
        return;
    }
    let polite = true;
    if (isPrivate) {
        if (connectionPair.has(connectionId)) {
            const pair = connectionPair.get(connectionId);
            if (pair[0] != null && pair[1] != null) {
                const err = new Error(`${connectionId}: This connection id is already used.`);
                console.log(err);
                res.status(400).send({ error: err });
                return;
            }
            else if (pair[0] != null) {
                connectionPair.set(connectionId, [pair[0], sessionId]);
                const map = getOrCreateConnectionIds(pair[0]);
                map.add(connectionId);
            }
        }
        else {
            connectionPair.set(connectionId, [sessionId, null]);
            polite = false;
        }
    }
    const connectionIds = getOrCreateConnectionIds(sessionId);
    connectionIds.add(connectionId);
    res.json({ connectionId: connectionId, polite: polite, type: "connect", datetime: datetime });
}
exports.createConnection = createConnection;
function deleteConnection(req, res) {
    const sessionId = req.header('session-id');
    const { connectionId } = req.body;
    const datetime = lastRequestedTime.get(sessionId);
    _deleteConnection(sessionId, connectionId, datetime);
    res.json({ connectionId: connectionId });
}
exports.deleteConnection = deleteConnection;
function postOffer(req, res) {
    const sessionId = req.header('session-id');
    const { connectionId } = req.body;
    const datetime = lastRequestedTime.get(sessionId);
    let keySessionId = null;
    let polite = false;
    if (isPrivate) {
        if (connectionPair.has(connectionId)) {
            const pair = connectionPair.get(connectionId);
            keySessionId = pair[0] == sessionId ? pair[1] : pair[0];
            if (keySessionId != null) {
                polite = true;
                const map = offers.get(keySessionId);
                map.set(connectionId, new offer_1.default(req.body.sdp, datetime, polite));
            }
        }
        res.sendStatus(200);
        return;
    }
    if (!connectionPair.has(connectionId)) {
        connectionPair.set(connectionId, [sessionId, null]);
    }
    keySessionId = sessionId;
    const map = offers.get(keySessionId);
    map.set(connectionId, new offer_1.default(req.body.sdp, datetime, polite));
    res.sendStatus(200);
}
exports.postOffer = postOffer;
function postAnswer(req, res) {
    const sessionId = req.header('session-id');
    const { connectionId } = req.body;
    const datetime = lastRequestedTime.get(sessionId);
    const connectionIds = getOrCreateConnectionIds(sessionId);
    connectionIds.add(connectionId);
    if (!connectionPair.has(connectionId)) {
        res.sendStatus(200);
        return;
    }
    // add connectionPair
    const pair = connectionPair.get(connectionId);
    const otherSessionId = pair[0] == sessionId ? pair[1] : pair[0];
    if (!clients.has(otherSessionId)) {
        // already deleted
        res.sendStatus(200);
        return;
    }
    if (!isPrivate) {
        connectionPair.set(connectionId, [otherSessionId, sessionId]);
    }
    const map = answers.get(otherSessionId);
    map.set(connectionId, new answer_1.default(req.body.sdp, datetime));
    // update datetime for candidates
    const mapCandidates = candidates.get(otherSessionId);
    if (mapCandidates) {
        const arrayCandidates = mapCandidates.get(connectionId);
        if (arrayCandidates) {
            for (const candidate of arrayCandidates) {
                candidate.datetime = datetime;
            }
        }
    }
    res.sendStatus(200);
}
exports.postAnswer = postAnswer;
function postCandidate(req, res) {
    const sessionId = req.header('session-id');
    const { connectionId } = req.body;
    const datetime = lastRequestedTime.get(sessionId);
    const map = candidates.get(sessionId);
    if (!map.has(connectionId)) {
        map.set(connectionId, []);
    }
    const arr = map.get(connectionId);
    const candidate = new candidate_1.default(req.body.candidate, req.body.sdpMLineIndex, req.body.sdpMid, datetime);
    arr.push(candidate);
    res.sendStatus(200);
}
exports.postCandidate = postCandidate;
//# sourceMappingURL=httphandler.js.map
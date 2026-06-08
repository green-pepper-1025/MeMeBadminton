const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT || 8787);
const DEFAULT_ROOM = 'LAN1';

let nextClientId = 1;
const rooms = new Map();
const clients = new Map();

function createPlayer(clientId, playerId) {
    return {
        clientId,
        playerId,
        characterId: playerId === 'player1' ? 'kobe' : 'caixukun',
        isReady: false,
        connected: true,
    };
}

function getRoom(roomId) {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, {
            roomId,
            players: [],
            matchStarted: false,
        });
    }
    return rooms.get(roomId);
}

function getSnapshot(room) {
    return {
        roomId: room.roomId,
        hostPlayerId: 'player1',
        matchStarted: room.matchStarted,
        players: room.players.map((player) => ({ ...player })),
    };
}

function send(client, type, data) {
    if (client && client.ws.readyState === client.ws.OPEN) {
        client.ws.send(JSON.stringify({ type, data, timestamp: Date.now() }));
    }
}

function broadcastRoom(room, type, data) {
    for (const player of room.players) {
        const client = clients.get(player.clientId);
        send(client, type, data);
    }
}

function broadcastSnapshot(room) {
    const snapshot = getSnapshot(room);
    for (const player of room.players) {
        const client = clients.get(player.clientId);
        send(client, 'ROOM_SNAPSHOT', {
            ...snapshot,
            localPlayerId: player.playerId,
        });
    }
}

function forwardToOther(senderClient, type, data) {
    const room = senderClient.room;
    if (!room) return;

    for (const player of room.players) {
        if (player.clientId !== senderClient.clientId && player.connected) {
            send(clients.get(player.clientId), type, data);
        }
    }
}

function joinRoom(client, roomId) {
    const room = getRoom(roomId || DEFAULT_ROOM);
    const existing = room.players.find((player) => player.clientId === client.clientId);
    if (existing) {
        existing.connected = true;
        client.room = room;
        client.playerId = existing.playerId;
        broadcastSnapshot(room);
        return;
    }

    if (room.players.length >= 2) {
        send(client, 'ERROR', { message: 'ROOM_FULL' });
        return;
    }

    const playerId = room.players.length === 0 ? 'player1' : 'player2';
    room.players.push(createPlayer(client.clientId, playerId));
    client.room = room;
    client.playerId = playerId;
    broadcastSnapshot(room);
}

function handleCharacterSelect(client, data) {
    const room = client.room;
    if (!room) return;
    const player = room.players.find((item) => item.clientId === client.clientId);
    if (!player || player.isReady) return;

    player.characterId = data.characterId;
    broadcastSnapshot(room);
    forwardToOther(client, 'CHARACTER_SELECT', {
        playerId: player.playerId,
        characterId: player.characterId,
    });
}

function handleCharacterReady(client, data) {
    const room = client.room;
    if (!room) return;
    const player = room.players.find((item) => item.clientId === client.clientId);
    if (!player) return;

    player.isReady = Boolean(data.isReady);
    room.matchStarted = room.players.length === 2 && room.players.every((item) => item.connected && item.isReady);
    broadcastSnapshot(room);

    if (room.matchStarted) {
        broadcastRoom(room, 'MATCH_START', getSnapshot(room));
    }
}

function handleDisconnect(client) {
    const room = client.room;
    clients.delete(client.clientId);
    if (!room) return;

    const player = room.players.find((item) => item.clientId === client.clientId);
    if (player) {
        player.connected = false;
        player.isReady = false;
    }
    room.matchStarted = false;
    broadcastSnapshot(room);
    broadcastRoom(room, 'PLAYER_DISCONNECTED', { playerId: client.playerId });
}

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('MemeBadminton LAN WebSocket server\n');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
    const client = {
        clientId: `c${nextClientId++}`,
        ws,
        room: null,
        playerId: null,
    };
    clients.set(client.clientId, client);
    send(client, 'CONNECTED', { clientId: client.clientId });

    ws.on('message', (raw) => {
        let message;
        try {
            message = JSON.parse(raw.toString());
        } catch {
            send(client, 'ERROR', { message: 'BAD_JSON' });
            return;
        }

        switch (message.type) {
            case 'JOIN_ROOM':
                joinRoom(client, message.data?.roomId);
                break;
            case 'CHARACTER_SELECT':
                handleCharacterSelect(client, message.data || {});
                break;
            case 'CHARACTER_READY':
                handleCharacterReady(client, message.data || {});
                break;
            case 'PLAYER_INPUT':
            case 'BALL_STATE':
            case 'SCORE_UPDATE':
            case 'MATCH_EVENT':
                forwardToOther(client, message.type, message.data || {});
                break;
            case 'PING':
                send(client, 'PONG', { time: message.data?.time || Date.now() });
                break;
            default:
                send(client, 'ERROR', { message: `UNKNOWN_TYPE:${message.type}` });
                break;
        }
    });

    ws.on('close', () => handleDisconnect(client));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[lan-server] listening on ws://0.0.0.0:${PORT}`);
});

const http = require('http');
const dgram = require('dgram');
const { WebSocketServer } = require('ws');

const PORT = Number(process.env.PORT || 8787);
const DISCOVERY_PORT = Number(process.env.DISCOVERY_PORT || 12345);
const GAME_PORT = Number(process.env.GAME_PORT || 12346);
const DEFAULT_ROOM = 'LAN1';

let nextClientId = 1;
const rooms = new Map();
const clients = new Map();
const discoveredRooms = new Map();
const udpPeers = new Map();
let activeHostClientId = null;
let pendingJoinClientId = null;

const discoverySocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
const gameSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

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

function sendWire(client, message) {
    if (client && client.ws.readyState === client.ws.OPEN) {
        client.ws.send(JSON.stringify({ timestamp: Date.now(), ...message }));
    }
}

function makeWire(type, data, playerId) {
    return {
        type,
        data: data || {},
        player_id: playerId,
        timestamp: Date.now(),
    };
}

function sendUdp(address, port, message) {
    const payload = Buffer.from(JSON.stringify({ timestamp: Date.now(), ...message }));
    gameSocket.send(payload, port, address);
}

function rememberUdpPeer(clientId, address, port, playerId) {
    udpPeers.set(clientId, { address, port, playerId });
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
    broadcastSnapshotToUdpPeers(room, snapshot);
}

function broadcastSnapshotToUdpPeers(room, snapshot = getSnapshot(room)) {
    for (const player of room.players) {
        if (!player.clientId.startsWith('udp:') || !player.connected) continue;
        const peer = udpPeers.get(player.clientId);
        if (peer) {
            sendUdp(peer.address, peer.port, makeWire('ROOM_SNAPSHOT', {
                ...snapshot,
                localPlayerId: player.playerId,
            }, player.playerId));
        }
    }
}

function broadcastMatchStartToUdpPeers(room, snapshot = getSnapshot(room)) {
    for (const player of room.players) {
        if (!player.clientId.startsWith('udp:') || !player.connected) continue;
        const peer = udpPeers.get(player.clientId);
        if (peer) {
            sendUdp(peer.address, peer.port, makeWire('MATCH_START', snapshot, player.playerId));
        }
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

function createHostRoom(client, data) {
    const roomId = data.room_id || data.roomId || DEFAULT_ROOM;
    joinRoom(client, roomId);
    activeHostClientId = client.clientId;
    client.isHost = true;
    client.hostRoomName = data.room_name || roomId;
    client.hostName = data.host_name || 'Host';
    broadcastSnapshot(client.room);
}

function getAdvertisedRooms() {
    const now = Date.now();
    for (const [roomId, room] of discoveredRooms) {
        if (now - room.lastSeenAt > 5000) {
            discoveredRooms.delete(roomId);
        }
    }

    return Array.from(discoveredRooms.values()).map((room) => {
        const { lastSeenAt, ...advertise } = room;
        return advertise;
    });
}

function handleBrowseRooms(client) {
    sendWire(client, makeWire('room_list', { rooms: getAdvertisedRooms() }, client.playerId));
}

function handleJoinRequest(client, data) {
    if (data.host && data.port) {
        pendingJoinClientId = client.clientId;
        client.pendingRoomId = data.room_id || DEFAULT_ROOM;
        sendUdp(data.host, Number(data.port), makeWire('join_request', {
            room_id: client.pendingRoomId,
            player_name: data.player_name || 'Player',
        }, client.playerId));
        return;
    }

    joinRoom(client, data.roomId || data.room_id || DEFAULT_ROOM);
}

function forwardUdpGameMessage(client, type, data) {
    const room = client.room;
    if (!room) return;

    if (client.isHost || client.playerId === 'player1') {
        for (const player of room.players) {
            if (player.clientId.startsWith('udp:') && player.connected) {
                const peer = udpPeers.get(player.clientId);
                if (peer) {
                    sendUdp(peer.address, peer.port, makeWire(type, data, client.playerId));
                }
            }
        }
        return;
    }

    const host = Array.from(discoveredRooms.values()).find((item) => item.room_id === client.room?.roomId);
    if (host) {
        sendUdp(host.host, host.port, makeWire(type, data, client.playerId));
    }
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
        const snapshot = getSnapshot(room);
        broadcastRoom(room, 'MATCH_START', snapshot);
        broadcastMatchStartToUdpPeers(room, snapshot);
    }
}

function getDiscoveredHostForClient(client) {
    if (!client.room) return null;
    return Array.from(discoveredRooms.values()).find((item) => item.room_id === client.room.roomId) || null;
}

function isClientJoinedToRemoteHost(client) {
    return Boolean(client.room?.players.some((player) => player.clientId === 'remote-host'));
}

function forwardRoomFlowToDiscoveredHost(client, type, data) {
    const host = getDiscoveredHostForClient(client);
    if (!host) return false;

    sendUdp(host.host, host.port, makeWire(type, data, client.playerId || 'player2'));
    return true;
}

function findLocalRemoteClient(roomId) {
    const candidates = Array.from(clients.values()).filter((client) => {
        if (!client.room || client.isHost) return false;
        if (roomId && client.room.roomId !== roomId) return false;
        return true;
    });

    return candidates[0] || clients.get(pendingJoinClientId) || null;
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

function advertiseHostRoom() {
    const host = clients.get(activeHostClientId);
    if (!host || !host.room || !host.isHost) return;

    const message = makeWire('room_advertise', {
        room_id: host.room.roomId,
        room_name: host.hostRoomName || host.room.roomId,
        host_name: host.hostName || 'Host',
        host: getLocalAdvertiseAddress(),
        port: GAME_PORT,
        players: host.room.players.filter((player) => player.connected).length,
        max_players: 2,
    }, 'player1');
    const payload = Buffer.from(JSON.stringify(message));
    discoverySocket.send(payload, DISCOVERY_PORT, '255.255.255.255');
}

function getLocalAdvertiseAddress() {
    return process.env.LAN_HOST || '127.0.0.1';
}

function handleDiscoveryMessage(raw, rinfo) {
    let message;
    try {
        message = JSON.parse(raw.toString());
    } catch {
        return;
    }

    if (message.type !== 'room_advertise') return;
    const data = message.data || {};
    const roomId = data.room_id || data.roomId;
    if (!roomId) return;

    discoveredRooms.set(roomId, {
        room_id: roomId,
        room_name: data.room_name || roomId,
        host_name: data.host_name || 'Host',
        host: data.host && data.host !== '127.0.0.1' ? data.host : rinfo.address,
        port: Number(data.port || GAME_PORT),
        players: Number(data.players || 1),
        max_players: Number(data.max_players || 2),
        lastSeenAt: Date.now(),
    });

    for (const client of clients.values()) {
        sendWire(client, makeWire('room_list', { rooms: getAdvertisedRooms() }, client.playerId));
    }
}

function handleUdpGameMessage(raw, rinfo) {
    let message;
    try {
        message = JSON.parse(raw.toString());
    } catch {
        return;
    }

    const data = message.data || {};
    if (message.type === 'join_request') {
        const host = clients.get(activeHostClientId);
        if (!host || !host.room || !host.isHost) {
            sendUdp(rinfo.address, rinfo.port, makeWire('join_response', { success: false, reason: 'no_host' }));
            return;
        }

        const room = host.room;
        const remoteClientId = `udp:${rinfo.address}:${rinfo.port}`;
        const existing = room.players.find((player) => player.clientId === remoteClientId);
        if (!existing && room.players.length >= 2) {
            sendUdp(rinfo.address, rinfo.port, makeWire('join_response', { success: false, reason: 'room_full' }));
            return;
        }

        const playerId = existing?.playerId || (room.players.length === 0 ? 'player1' : 'player2');
        if (!existing) {
            room.players.push(createPlayer(remoteClientId, playerId));
        } else {
            existing.connected = true;
        }
        rememberUdpPeer(remoteClientId, rinfo.address, rinfo.port, playerId);
        const snapshot = getSnapshot(room);
        sendUdp(rinfo.address, rinfo.port, makeWire('join_response', {
            success: true,
            player_id: playerId,
            room_snapshot: { ...snapshot, localPlayerId: playerId },
        }, playerId));
        broadcastSnapshot(room);
        return;
    }

    if (message.type === 'join_response') {
        const client = clients.get(pendingJoinClientId);
        if (!client) return;
        sendWire(client, makeWire('join_response', data, data.player_id));
        if (data.success) {
            client.playerId = data.player_id || 'player2';
            client.isHost = false;
            const room = getRoom(client.pendingRoomId || DEFAULT_ROOM);
            room.players = [
                createPlayer('remote-host', 'player1'),
                createPlayer(client.clientId, client.playerId),
            ];
            client.room = room;
            const snapshot = data.room_snapshot || { ...getSnapshot(room), localPlayerId: client.playerId };
            send(client, 'ROOM_SNAPSHOT', snapshot);
        }
        return;
    }

    if (message.type === 'ROOM_SNAPSHOT') {
        const client = findLocalRemoteClient(data.roomId);
        if (client) {
            send(client, 'ROOM_SNAPSHOT', data);
        }
        return;
    }

    if (message.type === 'MATCH_START') {
        const client = findLocalRemoteClient(data.roomId);
        if (client) {
            send(client, 'MATCH_START', data);
        }
        return;
    }

    if (message.type === 'CHARACTER_SELECT') {
        const host = clients.get(activeHostClientId);
        if (!host || !host.room || !host.isHost) return;

        const remoteClientId = `udp:${rinfo.address}:${rinfo.port}`;
        const player = host.room.players.find((item) => item.clientId === remoteClientId);
        if (!player || player.isReady) return;

        player.characterId = data.characterId;
        broadcastSnapshot(host.room);
        return;
    }

    if (message.type === 'CHARACTER_READY') {
        const host = clients.get(activeHostClientId);
        if (!host || !host.room || !host.isHost) return;

        const remoteClientId = `udp:${rinfo.address}:${rinfo.port}`;
        const player = host.room.players.find((item) => item.clientId === remoteClientId);
        if (!player) return;

        player.isReady = Boolean(data.isReady);
        host.room.matchStarted = host.room.players.length === 2 && host.room.players.every((item) => item.connected && item.isReady);
        const snapshot = getSnapshot(host.room);
        broadcastSnapshot(host.room);

        if (host.room.matchStarted) {
            broadcastRoom(host.room, 'MATCH_START', snapshot);
            broadcastMatchStartToUdpPeers(host.room, snapshot);
        }
        return;
    }

    if (message.type === 'player_input') {
        const host = clients.get(activeHostClientId);
        sendWire(host, makeWire('player_input', data, message.player_id || 'player2'));
        return;
    }

    if (message.type === 'game_state' || message.type === 'game_start' || message.type === 'game_end' || message.type === 'map_sync') {
        for (const client of clients.values()) {
            if (!client.isHost) {
                sendWire(client, makeWire(message.type, data, message.player_id || 'player1'));
            }
        }
        return;
    }

    if (message.type === 'heartbeat') {
        sendUdp(rinfo.address, rinfo.port, makeWire('heartbeat', { ok: true }));
        return;
    }

    if (message.type === 'disconnect') {
        const host = clients.get(activeHostClientId);
        sendWire(host, makeWire('disconnect', data, message.player_id));
    }
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
            case 'create_room':
            case 'CREATE_ROOM':
                createHostRoom(client, message.data || {});
                break;
            case 'browse_rooms':
            case 'BROWSE_ROOMS':
                handleBrowseRooms(client);
                break;
            case 'join_request':
                handleJoinRequest(client, message.data || {});
                break;
            case 'JOIN_ROOM':
                joinRoom(client, message.data?.roomId);
                break;
            case 'CHARACTER_SELECT':
                handleCharacterSelect(client, message.data || {});
                if (!client.isHost && isClientJoinedToRemoteHost(client)) {
                    forwardRoomFlowToDiscoveredHost(client, 'CHARACTER_SELECT', message.data || {});
                }
                break;
            case 'CHARACTER_READY':
                handleCharacterReady(client, message.data || {});
                if (!client.isHost && isClientJoinedToRemoteHost(client)) {
                    forwardRoomFlowToDiscoveredHost(client, 'CHARACTER_READY', message.data || {});
                }
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
            case 'player_input':
            case 'game_start':
            case 'game_state':
            case 'game_end':
            case 'map_sync':
            case 'heartbeat':
            case 'disconnect':
                forwardUdpGameMessage(client, message.type, message.data || {});
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

discoverySocket.on('message', handleDiscoveryMessage);
discoverySocket.bind(DISCOVERY_PORT, () => {
    discoverySocket.setBroadcast(true);
    console.log(`[lan-server] UDP discovery listening on 0.0.0.0:${DISCOVERY_PORT}`);
});

gameSocket.on('message', handleUdpGameMessage);
gameSocket.bind(GAME_PORT, () => {
    console.log(`[lan-server] UDP game listening on 0.0.0.0:${GAME_PORT}`);
});

setInterval(advertiseHostRoom, 1000);

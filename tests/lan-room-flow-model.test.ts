import {
    buildLanRoomViewModel,
    shouldRequestLanRoomBrowse,
} from '../assets/scripts/core/LanRoomFlowModel';
import { LanRoomAdvertise, RoomSnapshot } from '../assets/scripts/net/NetworkTypes';

function assert(condition: boolean, message: string): void {
    if (!condition) {
        throw new Error(message);
    }
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
    if (actual !== expected) {
        throw new Error(`${message}. Expected ${expected}, got ${actual}`);
    }
}

function room(roomId: string, name: string, players: number): LanRoomAdvertise {
    return {
        room_id: roomId,
        room_name: name,
        host_name: 'Host',
        host: '192.168.1.10',
        port: 12346,
        players,
        max_players: 2,
    };
}

function snapshot(players: RoomSnapshot['players']): RoomSnapshot {
    return {
        roomId: 'ROOM',
        hostPlayerId: 'player1',
        matchStarted: false,
        players,
    };
}

function testEmptyRoomListShowsActionableState(): void {
    const model = buildLanRoomViewModel({
        serverUrl: 'ws://localhost:8787',
        connectionStatus: '已连接',
        roomId: 'LAN1',
        snapshot: null,
        lanRooms: [],
    });

    assertEqual(model.title, '局域网房间', 'online entry uses LAN room title');
    assertEqual(model.emptyListText, '未发现局域网房间，点击刷新或等待自动搜索', 'empty list tells player what to do');
    assertEqual(model.roomRows.length, 0, 'empty advertised room list has no rows');
    assertEqual(model.statusLines[0], '服务器: ws://localhost:8787', 'server URL is visible');
}

function testAdvertisedRoomsAreSingleClickJoinRows(): void {
    const model = buildLanRoomViewModel({
        serverUrl: 'ws://localhost:8787',
        connectionStatus: '已连接',
        roomId: 'LAN1',
        snapshot: null,
        lanRooms: [room('A1', 'A房间', 1), room('FULL', '满员房间', 2)],
    });

    assertEqual(model.roomRows.length, 2, 'all advertised rooms are shown');
    assertEqual(model.roomRows[0].joinable, true, 'room with one player can be joined');
    assertEqual(model.roomRows[0].label, 'A房间 / Host / 1-2 / 单击加入', 'joinable row label explains single click');
    assertEqual(model.roomRows[1].joinable, false, 'full room is disabled');
    assertEqual(model.roomRows[1].label, '满员房间 / Host / 2-2 / 已满', 'full row label explains disabled state');
}

function testHostWaitStateFromSnapshot(): void {
    const model = buildLanRoomViewModel({
        serverUrl: 'ws://localhost:8787',
        connectionStatus: '已创建房间，等待玩家加入',
        roomId: 'ROOM',
        snapshot: snapshot([
            {
                clientId: 'client-a',
                playerId: 'player1',
                characterId: 'kobe',
                isReady: false,
                connected: true,
            },
        ]),
        lanRooms: [],
    });

    assertEqual(model.roomStateText, '房间 ROOM: 等待另一名玩家加入', 'host waits until second player joins');
    assert(model.statusLines.some((line) => line.includes('P1: 已加入')), 'snapshot displays host joined');
    assert(model.statusLines.some((line) => line.includes('P2: 等待中')), 'snapshot displays remote waiting');
}

function testBrowseThrottle(): void {
    assertEqual(shouldRequestLanRoomBrowse(0, 2, true), true, 'initial request runs immediately');
    assertEqual(shouldRequestLanRoomBrowse(1.5, 2, false), false, 'interval blocks early repeated browse');
    assertEqual(shouldRequestLanRoomBrowse(2, 2, false), true, 'interval allows automatic refresh');
}

testEmptyRoomListShowsActionableState();
testAdvertisedRoomsAreSingleClickJoinRows();
testHostWaitStateFromSnapshot();
testBrowseThrottle();

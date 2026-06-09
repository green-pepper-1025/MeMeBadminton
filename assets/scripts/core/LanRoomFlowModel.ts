import { LanRoomAdvertise, RoomSnapshot } from '../net/NetworkTypes';

export interface LanRoomViewModelInput {
    serverUrl: string;
    connectionStatus: string;
    roomId: string;
    snapshot: RoomSnapshot | null;
    lanRooms: LanRoomAdvertise[];
}

export interface LanRoomRowViewModel {
    room: LanRoomAdvertise;
    label: string;
    joinable: boolean;
}

export interface LanRoomViewModel {
    title: string;
    statusLines: string[];
    roomStateText: string;
    emptyListText: string | null;
    roomRows: LanRoomRowViewModel[];
}

export function shouldRequestLanRoomBrowse(
    elapsedSeconds: number,
    intervalSeconds: number,
    isInitialRequest: boolean,
): boolean {
    return isInitialRequest || elapsedSeconds >= intervalSeconds;
}

export function buildLanRoomViewModel(input: LanRoomViewModelInput): LanRoomViewModel {
    const p1 = input.snapshot?.players.find((player) => player.playerId === 'player1') ?? null;
    const p2 = input.snapshot?.players.find((player) => player.playerId === 'player2') ?? null;
    const hasTwoPlayers = Boolean(p1?.connected && p2?.connected);
    const roomStateText = input.snapshot
        ? hasTwoPlayers
            ? `房间 ${input.snapshot.roomId}: 双方已加入，进入选角`
            : `房间 ${input.snapshot.roomId}: 等待另一名玩家加入`
        : `当前房间: ${input.roomId}`;

    const roomRows = input.lanRooms.map((room) => {
        const joinable = room.players < room.max_players;
        const actionText = joinable ? '单击加入' : '已满';
        return {
            room,
            joinable,
            label: `${room.room_name} / ${room.host_name} / ${room.players}-${room.max_players} / ${actionText}`,
        };
    });

    return {
        title: '局域网房间',
        statusLines: [
            `服务器: ${input.serverUrl}`,
            `状态: ${input.connectionStatus}`,
            `P1: ${p1?.connected ? '已加入' : '等待中'}${p1?.isReady ? ' / 已确认' : ''}`,
            `P2: ${p2?.connected ? '已加入' : '等待中'}${p2?.isReady ? ' / 已确认' : ''}`,
        ],
        roomStateText,
        emptyListText: roomRows.length === 0 ? '未发现局域网房间，点击刷新或等待自动搜索' : null,
        roomRows,
    };
}

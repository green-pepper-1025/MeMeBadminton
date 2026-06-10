const { spawnSync } = require('child_process');

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function runIsolatedLanServerScenario() {
    const script = String.raw`
const { spawn } = require('child_process');
const WebSocket = require('ws');

const basePort = 19000 + Math.floor(Math.random() * 1000);
const hostPorts = {
    ws: basePort,
    discovery: basePort + 1000,
    game: basePort + 2000,
};
const remotePorts = {
    ws: basePort + 1,
    discovery: basePort + 1001,
    game: basePort + 2001,
};

function startServer(label, ports) {
    const child = spawn(process.execPath, ['server/lan-server.js'], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            PORT: String(ports.ws),
            DISCOVERY_PORT: String(ports.discovery),
            GAME_PORT: String(ports.game),
            LAN_HOST: '127.0.0.1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.output = [];
    child.stdout.on('data', (data) => child.output.push('[' + label + '] ' + String(data)));
    child.stderr.on('data', (data) => child.output.push('[' + label + ' err] ' + String(data)));
    return child;
}

const hostServer = startServer('host', hostPorts);
const remoteServer = startServer('remote', remotePorts);

function cleanup() {
    for (const child of [hostServer, remoteServer]) {
        if (!child.killed) {
            child.kill();
        }
    }
}

function allOutput() {
    return hostServer.output.concat(remoteServer.output).join('');
}

function waitFor(predicate, timeoutMs, label) {
    return new Promise((resolve, reject) => {
        const startedAt = Date.now();
        const timer = setInterval(() => {
            if (predicate()) {
                clearInterval(timer);
                resolve();
                return;
            }
            if (Date.now() - startedAt > timeoutMs) {
                clearInterval(timer);
                reject(new Error(label + '\n' + allOutput()));
            }
        }, 20);
    });
}

function connectClient(port) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket('ws://127.0.0.1:' + port);
        ws.once('open', () => resolve(ws));
        ws.once('error', reject);
    });
}

function send(ws, type, data) {
    ws.send(JSON.stringify({ type, data, timestamp: Date.now() }));
}

(async () => {
    try {
        await waitFor(
            () =>
                hostServer.output.join('').includes('[lan-server] listening') &&
                remoteServer.output.join('').includes('[lan-server] listening'),
            4000,
            'servers did not start',
        );
        const host = await connectClient(hostPorts.ws);
        const remote = await connectClient(remotePorts.ws);
        const hostMessages = [];
        const remoteMessages = [];
        host.on('message', (raw) => hostMessages.push(JSON.parse(String(raw))));
        remote.on('message', (raw) => remoteMessages.push(JSON.parse(String(raw))));

        send(host, 'create_room', { room_id: 'ROOM', room_name: 'ROOM', host_name: 'Host' });
        await waitFor(() => hostMessages.some((message) => message.type === 'ROOM_SNAPSHOT'), 2000, 'host did not create room');

        send(remote, 'join_request', {
            room_id: 'ROOM',
            host: '127.0.0.1',
            port: hostPorts.game,
            player_name: 'Remote',
        });
        await waitFor(
            () => remoteMessages.some((message) => message.type === 'ROOM_SNAPSHOT' && message.data.localPlayerId === 'player2'),
            2500,
            'remote did not join room',
        );

        send(host, 'CHARACTER_READY', { isReady: true });
        send(remote, 'CHARACTER_READY', { isReady: true });
        await waitFor(
            () =>
                hostMessages.some((message) => message.type === 'MATCH_START') &&
                remoteMessages.some((message) => message.type === 'MATCH_START'),
            3000,
            'both clients did not receive MATCH_START',
        );

        host.close();
        remote.close();
        cleanup();
    } catch (error) {
        cleanup();
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
})();
`;

    const result = spawnSync(process.execPath, ['-e', script], {
        cwd: process.cwd(),
        encoding: 'utf8',
        timeout: 12000,
    });

    assert(
        result.status === 0,
        `LAN server match-start scenario failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
}

runIsolatedLanServerScenario();

const { getDiscoveryBroadcastTargets } = require('../server/lan-discovery');

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function assertDeepEqual(actual, expected, message) {
    const actualJson = JSON.stringify(actual);
    const expectedJson = JSON.stringify(expected);
    if (actualJson !== expectedJson) {
        throw new Error(`${message}. Expected ${expectedJson}, got ${actualJson}`);
    }
}

function testBuildsDirectedBroadcastTargetsFromIPv4Interfaces() {
    const targets = getDiscoveryBroadcastTargets({
        WiFi: [
            {
                family: 'IPv4',
                internal: false,
                address: '192.168.1.10',
                netmask: '255.255.255.0',
            },
        ],
        Loopback: [
            {
                family: 'IPv4',
                internal: true,
                address: '127.0.0.1',
                netmask: '255.0.0.0',
            },
        ],
    });

    assertDeepEqual(
        targets,
        ['255.255.255.255', '192.168.1.255'],
        'LAN discovery includes global and directed broadcast targets',
    );
}

function testSkipsInvalidInterfaceData() {
    const targets = getDiscoveryBroadcastTargets({
        Bad: [
            {
                family: 'IPv4',
                internal: false,
                address: '192.168.1.10',
                netmask: 'not-a-netmask',
            },
        ],
        Good: [
            {
                family: 'IPv4',
                internal: false,
                address: '10.0.0.5',
                netmask: '255.255.255.0',
            },
        ],
    });

    assert(targets.includes('10.0.0.255'), 'valid interfaces still produce directed broadcast targets');
    assert(!targets.includes('192.168.1.255'), 'invalid netmask data is ignored');
}

testBuildsDirectedBroadcastTargetsFromIPv4Interfaces();
testSkipsInvalidInterfaceData();

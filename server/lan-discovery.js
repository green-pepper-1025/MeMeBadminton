const os = require('os');

const GLOBAL_BROADCAST_ADDRESS = '255.255.255.255';

function parseIPv4(value) {
    if (typeof value !== 'string') return null;

    const parts = value.split('.');
    if (parts.length !== 4) return null;

    const octets = parts.map((part) => Number(part));
    if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
        return null;
    }

    return octets;
}

function ipv4ToNumber(octets) {
    return octets.reduce((value, octet) => ((value << 8) | octet) >>> 0, 0);
}

function numberToIPv4(value) {
    return [
        (value >>> 24) & 255,
        (value >>> 16) & 255,
        (value >>> 8) & 255,
        value & 255,
    ].join('.');
}

function isIPv4Interface(address) {
    return address && (address.family === 'IPv4' || address.family === 4) && !address.internal;
}

function getDirectedBroadcastAddress(address, netmask) {
    const addressOctets = parseIPv4(address);
    const netmaskOctets = parseIPv4(netmask);
    if (!addressOctets || !netmaskOctets) return null;

    const ip = ipv4ToNumber(addressOctets);
    const mask = ipv4ToNumber(netmaskOctets);
    const broadcast = (ip | (~mask >>> 0)) >>> 0;
    return numberToIPv4(broadcast);
}

function getDiscoveryBroadcastTargets(interfaces = os.networkInterfaces()) {
    const targets = new Set([GLOBAL_BROADCAST_ADDRESS]);

    for (const addresses of Object.values(interfaces)) {
        for (const address of addresses || []) {
            if (!isIPv4Interface(address)) continue;

            const broadcast = getDirectedBroadcastAddress(address.address, address.netmask);
            if (broadcast) {
                targets.add(broadcast);
            }
        }
    }

    return Array.from(targets);
}

function getLocalIPv4Addresses(interfaces = os.networkInterfaces()) {
    const addresses = [];

    for (const entries of Object.values(interfaces)) {
        for (const address of entries || []) {
            if (isIPv4Interface(address) && parseIPv4(address.address)) {
                addresses.push(address.address);
            }
        }
    }

    return addresses;
}

module.exports = {
    getDirectedBroadcastAddress,
    getDiscoveryBroadcastTargets,
    getLocalIPv4Addresses,
};

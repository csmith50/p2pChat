'use strict'

const libp2p = require('libp2p');
const TCP = require('libp2p-tcp');
const WS = require ('libp2p-websockets');
const SPDY = require('libp2p-spdy');
const MPLEX = require('libp2p-mplex');
const MulticastDNS = require('libp2p-mdns');
const DHT = require('libp2p-kad-dht');
const defaultsDeep = require('defaults-deep');
const SECIO = require('libp2p-secio');
const DelegatedPeerRouter = require('libp2p-delegated-peer-routing');

//list of bootstrap ipfs servers
const bootstrapers = [
    '/ip4/104.131.131.82/tcp/4001/p2p/QmaCpDMGvV2BGHeYERUEnRQAwe3N8SzbUtfsmvsqQLuvuJ',
    '/ip4/104.236.176.52/tcp/4001/p2p/QmSoLnSGccFuZQJzRadHn95W2CrSFmZuTdDWP8HXaHca9z',
    '/ip4/104.236.179.241/tcp/4001/p2p/QmSoLPppuBtQSGwKDZT2M73ULpjvfd3aZ6ha4oFGL1KrGM',
    '/ip4/162.243.248.213/tcp/4001/p2p/QmSoLueR4xBeUbY9WZ9xGUUxunbKWcrNFTDAadQJmocnWm',
    '/ip4/128.199.219.111/tcp/4001/p2p/QmSoLSafTMBsPKadTEgaXctDQVcqN88CNLHXMkTNwMKPnu',
    '/ip4/104.236.76.40/tcp/4001/p2p/QmSoLV4Bbm51jM9C4gDYZQ9Cy3U6aXMJDAbzgu2fzaDs64',
    '/ip4/178.62.158.247/tcp/4001/p2p/QmSoLer265NRgSp2LA3dPaeykiS1J6DifTC88f5uVQKNAd',
    '/ip4/178.62.61.185/tcp/4001/p2p/QmSoLMeWqB7YGVLJN3pNLQpmmEk35v6wYtsMGLzSr5QBU3',
    '/ip4/104.236.151.122/tcp/4001/p2p/QmSoLju6m7xTh3DuokvT3886QRYqxAzb1kShaanJgW36yx'
];

class Node extends libp2p {
    constructor (_options) {
        const peerInfo = _options.peerInfo;
        const defaults = {
            modules: {
                transport: [
                    TCP//,
                    //WS
                ],
                streamMuxer: [
                    SPDY,
                    MPLEX
                ],
                connEncryption: [
                    SECIO
                ],
                peerDiscovery: [
                    MulticastDNS//,
                    //Bootstrap
                ],
                dht: DHT
            },
            config: {
                peerDiscovery: {
                    autoDial: true,
                    mdns: {
                        interval: 1000,
                        enabled: true
                    },
                    webrtcStar: {
                        interval: 1000,
                        enabled: false
                    },
                   /* bootstrap: {
                        interval: 200,
                        enabled: true,
                        list: bootstrappers
                    }*/
                },
                relay: {
                    enabled: true,
                    hop: {
                        enabled: false,
                        active: false
                    }
                },
                dht: {
                    kBucketSize: 20,
                    enabled: true,
                    randomWalk: {
                        enabled: true,
                        interval: 300e3,
                        timeout: 10e3
                    }
                },
                EXPERIMENTAL: {
                    pubsub: false
                }
            }
        };
        super(defaultsDeep(_options, defaults))
    }
}

module.exports = Node;
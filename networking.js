const Node = require("./p2p-bundle.js");
const PeerInfo = require('peer-info');
const waterfall = require('async-waterfall');

var knownNodes = [];

waterfall([ //this section of code will run asynchronously with the rest of the function
    (cb) => PeerInfo.create(cb),
    (PeerInfo, cb) => {
        PeerInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/0'); //In tcp this means give me any IP and listen on port 120
        node = new Node({peerInfo: PeerInfo});
        node.start(cb);
    }
], (e) => {
    if (e) {
        console.log("error creating libp2p node");
        console.log(e);
    }
    console.log('node has started: ', node.isStarted());
    //print the tcp ports that we are listening on
    console.log('listening on: ');
    node.peerInfo.multiaddrs.forEach((ma) => console.log(ma.toString()));
    //start listening for peers
    node.on('peer:discovery', (peer) => {
        if (!knownNodes.includes(peer.id.toB58String())) {
            console.log('peer found:', peer.id.toB58String());
            //notify main that a peer has been found
            process.send({peer: peer.id.toB58String(),
                            protocol: 'peer:found'});
            node.dial(peer, () => {});
            knownNodes.push(peer.id.toB58String());
        }
    });
    //handle a connection requeest
    node.on('peer:connect' , (peerInfo) => {
        console.log("Connection established with: ", peerInfo.id.toB58String());
        //send test dial
        node.dialProtocol(peerInfo, 'testMessage', (err, conn) => {
            if (err) {
                console.log("error sending test message to node");
            }
            console.log("sent test message to node");
        });
    });

    //handle messages from the main process
    process.on('message', (m) => {
        if (m.protocol === 'peer:send') {
            node.dialProtocol(peerInfo, 'newMessage', (err, conn) => {
                 if (err) {
                    console.log("error sending message to node");
                }
                 else {
                    console.log("sent message to node");
                }
            });
        }
    });

    //handle test dial
    node.handle('testMessage', (protocol, conn) => {
        console.log("recieved testMessage from other node");
    });
    node.handle('newMessage', (protocol, conn) => {
        process.send({protocol: 'messageRecieved', message: protocol.message});
        console.log("sent recieved message to main process");
    })
});

process.on('peer:deny', (m) => {
    console.log("recieved peer deny");
});
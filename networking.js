const Node = require("./p2p-bundle.js");
const PeerInfo = require('peer-info');
const waterfall = require('async-waterfall');
const pull = require('pull-stream');

var knownNodes = [];

waterfall([ //this section of code will run asynchronously with the rest of the function
    (cb) => PeerInfo.create(cb),
    (PeerInfo, cb) => {
        PeerInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/0'); //In tcp this means give me any IP and listen on port 120
        PeerInfo.multiaddrs.add('/ip4/0.0.0.0/tcp/0/ws'); //Do the same thing but for websockets 
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
        if (!knownNodes.includes(peer)) {
            console.log('peer found:', peer.id.toB58String());
            //notify main that a peer has been found
            process.send({peer: peer.id.toB58String(),
                            protocol: 'peer:found'});
            node.dial(peer, (e) => {
                if (e) console.log("error sending initial dial: ", e);
            });
            knownNodes.push(peer.id.toB58String());
            /*
            node.dialProtocol(peer, 'getKnownPeers', (err, conn) => {
                if (err) console.log("error dialing for known peers");
                else console.log("sent request for known peers");
            });*/
        }
    });
    //handle a connection requeest
    node.on('peer:connect' , (peerInfo) => {
        console.log("Connection established with: ", peerInfo.id.toB58String());
        //send test dial
        node.dialProtocol(peerInfo, 'testMessage', (err, conn) => {
            if (err) {
                console.log("error sending test message to node", err);
            }
            console.log("sent test message to node");
        });
    });

    //handle messages from the main process
    process.on('message', (m) => {
        if (m.protocol === 'peer:send') {
            //dial all the nodes that we know about
            for (i = 0; i < knownNodes.length; i++) {
                node.dialProtocol(knownNodes[i], 'newMessage', (err, conn) => {
                    if (err) {
                        console.log("error sending message to node: ", err);
                    }
                    else {
                        console.log("sent message to node");
                        pull(pull.values([m.message, m.time, m.name]), conn);
                    }
                });
            }
        }
    });

    //handle test dial
    node.handle('testMessage', (protocol, conn) => {
        console.log("recieved testMessage from other node");
    });
    //handle recieving message from other node
    node.handle('newMessage', (protocol, conn) => {
        pull(conn, pull.collect((err, data) => {
            if (err) {
                console.log("error getting recieved message: ", err);
            }
            console.log("sending recieved message to main process: ", data);
            process.send({protocol: 'messageRecieved', message: data[0].toString('utf8'), 
                time: data[1].toString('utf8'), name: data[2].toString('utf8')});   
        }));
    });
/*
    node.handle('getKnownPeers', (protocol, conn) => {
        node.dialProtocol(conn, 'sendingPeers', (err, conn) => {
            if (err) console.log("error sending known nodes to peer: ", err);
            else {
                for (var i = 0; i < knownNodes.length; i++) {
                    pull(pull.values(knownNodes[i]));
                } 
                console.log("sent known nodes to peer");
            }
        })
    });

    node.handle('sendingPeers', (protocol, conn) => {
        console.log("recieved known peers from other node");
        pull(conn, pull.collect((err, data) => {
            if (err) console.log("error retriving known nodes: ", err);
            else {
                for (var i = 0; i < data.length; i++) {
                    if (!knownNodes.includes(data[i])) {
                        //dial new peer and try to connect?
                        knownNodes.push(data[i]);
                        console.log("discovered new peer: ", data[i]);
                    }
                }   
            }
        }));
    });
    */
});

process.on('peer:deny', (m) => {
    console.log("recieved peer deny");
});
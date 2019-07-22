const Node = require("./p2p-bundle.js");
const PeerInfo = require('peer-info');
const waterfall = require('async-waterfall');
const pull = require('pull-stream');

var knownNodes = [];
var sendName;

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
            process.send({peer: "/" + peer.id.toB58String(),
                            protocol: 'peer:found'});
            node.dial(peer, (e) => {
                if (e) {
                    console.log("error sending initial dial: ", e);
                    if (knownNodes.includes(peer)) {
                            knownNodes = knownNodes.filter((value, index, arr) => {
                            return value !== peer;
                        });
                    }
                }
            });
            knownNodes.push(peer);
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
        sendName = peerInfo;
        //send test dial
        node.dialProtocol(peerInfo, 'testMessage', (err, conn) => {
            if (err) {
                console.log("error sending test message to node", err);
            }
            else {
                console.log("sent test message to node");
            }
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
        else if (m.protocol === 'newUserNameResponse') {
            console.log("got our name from main: ", m.name);
            node.dialProtocol(sendName, 'newUser', (protocol, conn) => {
                pull(pull.values([m.name]), conn);
                console.log("sent our name to new user");
            });
        }
        else if (m.protocol === 'disconnecting') {
            for (i = 0; i < knownNodes.length; i++) {
                node.dialProtocol(knownNodes[i], 'disconnect', (err, conn) => {
                    pull(pull.values([m.name]), conn);
                    console.log("sent disconnect notice to all peers");
                })
            }
        }
        else if (m.protocol === 'chatLogRequest') {
            console.log("got our chat log from main");
            node.dialProtocol(sendName, 'chatLogResponse', (protocol, conn) => {
                pull(pull.values([m.logs]), conn);
                console.log("sent our logs to the user");
            });
        }
        else console.log("did not recognize message protocol from main");
    });

    //handle test dial; this includes new user connections
    node.handle('testMessage', (protocol, conn) => {
        console.log("recieved testMessage from other node");
        var peerInfo = conn.getPeerInfo((e) => {
            if (e) console.log("error retriving peer info from connection object");
            else console.log("peer we are sending name to: ", peerInfo);
        });
        //ask for our name from main to send to our new peer
        process.send({protocol: 'newUserNameRequest', peer: peerInfo});
        //ask for the chat logs from our new peer
        node.dialProtocol(sendName, 'chatLogRequest', (err, conn) => {
            if (err) console.log("error sending chatlogRequest: ", err);
        });
    });

    node.handle('newUser', (protocol, conn) => {
        pull(conn, pull.collect((err, data) => {
            if (err) {
                console.log("error getting name from new user: ", err);
            }
            else {
                console.log("got the name of our new connection", data[0]);
                process.send({protocol: 'newUserConnection', name: data[0].toString('utf8')});
            }
        }));
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

    //handle disconnect notices from other peers
    node.handle('disconnect', (protocol, conn) => {
        pull(conn, pull.collect((err, data) => {
            if (err) console.log("error getting recieved message: ", err);
            else {
                process.send({protocol: 'disconnectNotice', name: data[0].toString('utf8')});
                console.log("sending disconnect notice to main");
            }
        }));
    });

    //handle requests for our chat logs
    node.handle('chatLogRequest', (protocol, conn) => {
        process.send({protocol: 'chatLogRequest'});
    });

    //handle reception of chat logs from new peer
    node.handle('chatLogResponse', (protocol, conn) => {
        console.log("recieved chat log from new peer");
        pull(conn, pull.collect((err, data) => {
            var processedLogs = data[0].toJSON();
            console.log("buffer converted to json is: ", processedLogs);
            //process.send({protocol: 'chatLodDisplay', logs: data[0]});
        }));
    })
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
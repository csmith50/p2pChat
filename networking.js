const Node = require("./p2p-bundle.js");
const PeerInfo = require('peer-info');
const waterfall = require('async-waterfall');

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
        console.log('peer found:', peer.id.toB58String());
        //notify main that a peer has been found
        process.send({peer: peer.id.toB58String(),
                        protocol: 'peer:found'});
        node.dial(peer, () => {});
    });
    //handle a connection requeest
    node.on('peer:connect' , (peerInfo) => {
        //reply for now so we don't time out
        event.reply('peer:connect', peerInfo.id.toB58String());
        
    });
    
});

process.on('peer:deny', (m) => {
    console.log("recieved peer deny");
});
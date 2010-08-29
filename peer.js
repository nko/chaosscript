var net = require('net');
var WP = require('wire_protocol');
var PieceMap = require('piecemap');

function Peer(ctx, opts) {
    this.ctx = ctx;
    this.state = 'unknown';
    if (opts.host && opts.port) {
        this.host = opts.host;
        this.port = opts.port;
    } else if (opts.socket && opts.wire) {
        this.socket = opts.socket;
        this.wire = opts.wire;
        this.state = 'connected';
        this.host = opts.socket.remoteAddress;
        this.port = 6881;  // Uh, yeah
	this.setupSocket();
        this.setupWire();
    } else
        throw 'Peer ctor opts';

    this.choked = true;
}

Peer.prototype.accept = function(sock) {
    // TODO
    // + take port
};

Peer.prototype.connect = function() {
    var that = this;

    this.socket = net.createConnection(this.port, this.host);
    // I hate that outgoing connections miss this:
    this.socket.remoteAddress = this.host + ':' + this.port;
    this.state = 'connecting';
    this.socket.on('connect', function() {
                       console.log("Connected to peer "+that.host+":"+that.port);
                       that.wire = new WP.WireInitiator(that.socket,
                                                        that.ctx.infoHash,
                                                        that.ctx.peerId);
                       that.wire.on('established', function() {
                                        that.state = 'connected';
                                        that.choked = true;
                                        that.setupWire();
                                    });
                   });
    this.setupSocket();
};

Peer.prototype.onDisconnect = function() {
    var that = this;

    delete this.socket;
    delete this.wire;
    this.choked = true;
    if (this.reqs) {
	this.reqs.forEach(function(req) {
                          that.ctx.cancelled(req);
                      });
	delete this.reqs;
    }

    this.onActivity();
};


Peer.prototype.close = function() {
    if (this.socket) {
	console.log("peer close " + this.socket.remoteAddress);
        this.socket.end();
	delete this.socket;	
    }
    this.state = 'closed';
};

Peer.prototype.setupSocket = function() {
    var that = this;

    this.socket.on('error', function(error) {
		       console.log('Socket error for '+that.host+":"+that.port+" (" + that.state + '): ' + error);
                       that.state = 'bad';
		       that.onDisconnect();
		   });
    this.socket.on('end', function() {
                       console.log("Disconnected from peer "+that.host+":"+that.port);
		       console.log(new Error().stack);
                       that.state = (that.state == 'connected') ? 'closed' : 'bad';
		       if (that.socket)
			   that.socket.end();
		       that.onDisconnect();
                   });
};

Peer.prototype.setupWire = function() {
    var that = this;

    this.score = 0;  // KB/s, stupid
    this.reqs = [];
    this.wire.bitfield(this.ctx.piecemap);
    this.wire.interested();
    this.wire.on('pkt', function(pkt) {
                     that.onPkt(pkt);
                 });
    this.wire.on('error', function(error) {
                     that.state = 'bad';
                     console.log("Peer "+that.host+":"+that.port+": "+error);
                 });
};

Peer.prototype.onPkt = function(pkt) {
    var that = this;

    pkt.on('unchoke', function() {
               that.choked = false;
               console.log(that.host+':'+that.port+" unchoked, ready=" + that.isReady());
               that.onActivity();

               // Unchoked? Decrease score periodically...
               var downScoring, intervalId;
               downScoring = function() {
                   if (that.choked || !that.socket)
                       clearInterval(intervalId);
                   else if (that.reqs && that.reqs.length > 0)
                       that.score -= 5;
               };
               intervalId = setInterval(downScoring, 100);
           });
    pkt.on('choke', function() {
               that.choked = true;
               console.log(that.host+':'+that.port+" choked");
               that.reqs.forEach(function(req) {
                                     that.wire.cancel(req.index, req.begin, req.length);
                                     that.ctx.cancelled(req);
                                 });
               that.reqs = [];
           });
    pkt.on('bitfield', function(piecemap) {
               that.piecemap = new PieceMap(piecemap);
               if (!that.choked)
                   that.onActivity();
           });
    pkt.on('have', function(index) {
               if (!that.piecemap && that.ctx.pieceNum)
                   that.piecemap = new PieceMap(that.ctx.pieceNum);
               if (that.piecemap)
                   that.piecemap.have(index);
               if (!that.choked)
                   that.onActivity();
           });

    pkt.on('pieceBegin', function(index, begin) {
	       console.log('pieceBegin '+index+' '+begin);
               that.reqs = that.reqs.filter(function(req) {
                                                return req.index === index &&
                                                    req.begin === begin;
                                            });
           });
    pkt.on('piece', function(index, begin, data) {
               that.ctx.receivePiece(index, begin, data);
               that.score += Math.ceil(data.length / 1000);
           });
    pkt.on('pieceEnd', function() {
               that.onActivity();
           });
};

Peer.prototype.onActivity = function() {
    this.ctx.onActivity();
};

Peer.prototype.isReady = function() {
    return this.state === 'connected' &&
        !this.choked &&
        this.reqs.length < 2;
};

Peer.prototype.canConnect = function() {
    return !this.socket &&
        (this.state === 'unknown' ||
         this.state === 'closed');
}

Peer.prototype.hasPiece = function(index) {
    return this.piecemap ? this.piecemap.has(index) : false;
};

Peer.prototype.requestPiece = function(index, begin, length) {
    this.wire.request(index, begin, length);
    this.reqs.push({ index: index,
                     begin: begin,
                     length: length });
};

module.exports = Peer;

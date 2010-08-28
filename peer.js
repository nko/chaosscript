var net = require('net');
var WP = require('wire_protocol');
var PieceMap = require('piecemap');

function Peer(ctx, host, port) {
    this.ctx = ctx;
    this.state = 'unknown';
    this.host = host;
    this.port = port;

    this.queue = 0;
    this.choked = true;
}

Peer.prototype.accept = function(sock) {
    // TODO
    // + take port
};

Peer.prototype.connect = function() {
    var that = this;

    this.socket = net.createConnection(this.port, this.host);
    this.socket.on('connect', function() {
		       console.log("Connected to peer "+that.host+":"+that.port);
		       that.wire = new WP.WireInitiator(that.socket,
							that.ctx.infoHash,
							that.ctx.peerId);
		       that.wire.on('established', function() {
					console.log('established');
					that.state = 'connected';
					that.wire.bitfield(that.ctx.piecemap);
					that.wire.interested();
				    });
		       that.wire.on('pkt', function(pkt) {
					that.onPkt(pkt);
				    });
		       that.wire.on('error', function(error) {
					that.state = 'bad';
					console.log("Peer "+that.host+":"+that.port+": "+error);
				    });
		   });
    this.socket.on('error', function() {
		       delete that.socket;
		       delete that.wire;
		       that.state = 'bad';
		       this.choked = true;
		   });
    this.socket.on('end', function() {
		       console.log("Disconnected from peer "+that.host+":"+that.port);
		       delete that.socket;
		       delete that.wire;
		       that.state = that.state == 'connected' ? 'closed' : 'bad';
		       this.choked = true;
		   });
};

Peer.prototype.onPkt = function(pkt) {
    var that = this;

    pkt.on('unchoke', function() {
	       that.choked = false;
	       console.log(that.host+':'+that.port+" unchoked, ready=" + that.isReady());
	       that.onActivity();
	   });
    pkt.on('choke', function() {
	       that.choked = true;
	       console.log(that.host+':'+that.port+" choked");
	   });
    pkt.on('bitfield', function(piecemap) {
	       that.piecemap = new PieceMap(piecemap);
	       that.onActivity();
	   });
    pkt.on('have', function(index) {
	       if (!that.piecemap && that.ctx.pieceNum)
		   that.piecemap = new PieceMap(that.ctx.pieceNum);
	       if (that.piecemap)
		   that.piecemap.have(index);
	       that.onActivity();
	   });

    pkt.on('piece', function(index, begin, data) {
	       that.ctx.receivePiece(index, begin, data);
	   });
    pkt.on('pieceEnd', function() {
	       that.queue--;
	       that.onActivity();
	   });
};

Peer.prototype.onActivity = function() {
    if (!this.choked)
	this.ctx.onActivity();

};

Peer.prototype.isReady = function() {
//console.log({ready:{state:this.state,choked:this.choked,queue:this.queue}});
    return this.state === 'connected' &&
	!this.choked &&
	this.queue < 1;  // TODO: increase
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
    this.queue++;
};

module.exports = Peer;

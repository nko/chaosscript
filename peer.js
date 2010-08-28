var net = require('net');
var WP = require('wire_protocol');
var PieceMap = require('piecemap');

function Peer(ctx, host, port) {
    this.ctx = ctx;
    this.state = 'unknown';
    this.host = host;
    this.port = port;

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
					that.wire.piecemap(that.ctx.piecemap);
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
		   });
    this.socket.on('end', function() {
		       delete that.socket;
		       delete that.wire;
		       that.state = 'bad';
		   });
};

Peer.prototype.onPkt = function(pkt) {
    var that = this;
    pkt.on('bitfield', function(piecemap) {
	       that.piecemap = new PieceMap(piecemap);
	       console.log({piecemap:piecemap});
	   });
    pkt.on('have', function(index) {
	       that.piecemap.have(index);
	   });
};

module.exports = Peer;
var net = require('net');
var TorrentContext = require('./torrent_context');
var WP = require('wire_protocol');

var ctxs = {};
module.exports = {
    get: function(infoHex) {
	if (ctxs.hasOwnProperty(infoHex))
	    return ctxs[infoHex];
	else {
	    return (ctxs[infoHex] = new TorrentContext(module.exports, infoHex));
	}
    },

    port: parseInt(process.env.WIRE_PORT || "6881", 10)
};

/**
 * Wire listening stuff
 */
var peerId = new Buffer("-BS00-YOYOYOYOYOYOY0");

function checkInfoHash(infoHash) {
    var infoHex = binToHex(infoHash);
    if (ctxs.hasOwnProperty(infoHex))
	return true;
    else {
	console.log("Refusing connection for " + infoHex);
	return false;
    }
}

net.createServer(function(stream) {
		     var wire = new WP.WireAcceptor(stream, checkInfoHash, peerId);
		     wire.on('established', function(infoHash, peerId) {
				 var infoHex = binToHex(infoHash);
				 // presence checked by checkInfoHash()
				 ctxs[infoHex].addIncomingPeer(stream, wire);
			     });
		 }).listen(module.exports.port, '0.0.0.0');


function hexChar(v) {
    if (v >= 0 && v <= 9)
        return v + 48;  // '0'
    else if (v >= 10 && v <= 16)
        return v - 10 + 65;  // 'A'
    else
        throw 'hexChar';
}

function binToHex(bin) {
    var r = new Buffer(bin.length * 2);
    for(var i = 0; i < bin.length; i++) {
        var c = bin[i];
        r[i * 2] = hexChar((c & 0xF0) >> 4);
        r[i * 2 + 1] = hexChar(c & 0xF);
    }
    return r.toString();
}

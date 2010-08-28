var Model = require('./model');
var BEnc = require('benc');
var URL = require('url');
var http = require('http');
var TM = require('./torrent_manager');
var Peer = require('./peer');
var PieceMap = require('piecemap');

var TorrentContext = module.exports = function(tm, infoHex) {
    var that = this;

    this.tm = tm;
    this.infoHex = infoHex;
    this.infoHash = hexToBin(infoHex);
    this.peerId = generatePeerId();
    this.trackers = {};
    this.bytesDownloaded = 0;
    this.bytesLeft = 1024 * 1024 * 1024;
    this.peers = {};
    this.size = 0;
    Model.getFileinfo(infoHex, function(error, fileinfo) {
			  if (error)
			      throw error;

			  fileinfo.files.forEach(function(file) {
						     that.size += file.length;
						 });
			  var pieceNum = Math.ceil(that.size / fileinfo.pieceLength);
			  that.piecemap = new PieceMap(pieceNum);
		      });

    this.tryAnnounce();
    setInterval(function() {
		    that.tryAnnounce();
		}, 2000);
};

TorrentContext.prototype.addPeer = function(host, port) {
    if (!this.peers.hasOwnProperty(host)) {
	var peer = this.peers[host] = new Peer(this, host, port);
	console.log({host:host,port:port});
	peer.connect();
    }
};

TorrentContext.prototype.refreshTrackers = function(cb) {
    var that = this;
    Model.getTrackers(this.infoHex, function(error, urls) {
			  if (urls.forEach)
			      urls.forEach(function(url) {
					       if (!that.trackers.hasOwnProperty(url) &&
						   /^http:/.test(url)) {

						   console.log("New tracker for " + that.infoHex + ": " + url);
						   that.trackers[url] = { next: 0 };
					       }
					   });
			  cb(error);
		      });
};

// Called periodically by ctor
TorrentContext.prototype.tryAnnounce = function() {
    var that = this;
    this.refreshTrackers(function(error) {
			     if (error)
				 return;

			     var now = Date.now();
			     for(var url in that.trackers)
				 if (that.trackers.hasOwnProperty(url) &&
				     that.trackers[url].next <= now) {
			
				     that.announce(url);
				     break;  // only one
				 }
			 });
};

TorrentContext.prototype.announce = function(url) {
    var that = this;
    console.log("Tracker request for " + this.infoHex + " to " + url);
    this.trackers[url].next = Date.now() + 600 * 1000;

    var u = URL.parse(url);
    var cl = http.createClient(u.port || 80, u.hostname);
    cl.on('error', function(e) {
	      console.log(e.stack);
	  });
    var req = cl.request('GET', u.pathname + '?' + this.makeAnnounceQuery(),
			 {'Host': u.hostname});
    req.end();
    req.on('response', function(res) {
	       if (res.statusCode == 200) {
		   var parser = new BEnc.ModelParser();
		   res.on('data', function(data) {
			      parser.write(data);
			  });
		   parser.on('model', function(resDict) {
				 if (resDict.interval)
				     that.trackers[url].next = Date.now() + resDict.interval * 1000;
				 if (resDict.peers) {
				     var peers = parsePeers(resDict.peers);
				     peers.forEach(function(peer) {
						       that.addPeer(peer.host, peer.port);
						   });
				 }
			     });
	       } else {
		   console.log("Tracker request to " + url + " failed: " + res.statusCode);
		   req.end();
		   res.socket.end();
	       }
	   });
};

TorrentContext.prototype.makeAnnounceQuery = function() {
    var queryInfoHash = '';
    for(i = 0; i < this.infoHex.length; i += 2) {
	queryInfoHash += '%' + this.infoHex.slice(i, i + 2).toUpperCase();
    }
    return "info_hash=" + queryInfoHash +
	"&peer_id=%2dBS00%2dYOYOYOYOYOYOYO" +
	"&port=" + this.tm.port +
	"&uploaded=" + 0 +
	"&downloaded=" + this.bytesDownloaded +
	"&left=" + this.bytesLeft +
	"&event=started" +  // TODO: fix this
	"&compact=1";
};


function hexValue(v) {
    if (v >= 48 && v <= 57)
	return v - 48;
    else if (v >= 65 && v <= 70)
        return v + 10 - 65;
    else if (v >= 97 && v <= 102)
        return v + 10 - 97;
    else
	throw 'hexValue';
}

function hexToBin(s) {
    var r = new Buffer(s.length / 2);
    for(var i = 0; i < r.length; i++) {
	r[i] = (hexValue(s.charCodeAt(i * 2)) << 4) | hexValue(s.charCodeAt(i * 2 + 1));
    }
console.log({s:s,r:r});
    return r;
}

function parsePeers(data) {
    var r = [];
    if (data.constructor === Array) {
	data.forEach(function(peer) {
			 r.push({ host: peer.ip,
				  port: peer.port });
		     });
    } else {
	for(var i = 0; i < data.length; i += 6) {
	    var ip = data[i] + '.' +
		data[i + 1] + '.' +
		data[i + 2] + '.' +
		data[i + 3];
	    var port = (data[i + 4] << 8) | data[i + 5];
	    r.push({ host: ip,
		     port: port });
	}
    }
    return r;
}

function generatePeerId() {
	return new Buffer("-BS00-YOYOYOYOYOYOYO");
}

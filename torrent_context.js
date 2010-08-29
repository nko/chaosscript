var Model = require('./model');
var BEnc = require('benc');
var URL = require('url');
var http = require('http');
var EventEmitter = require('events').EventEmitter;
var TM = require('./torrent_manager');
var Peer = require('./peer');
var PieceMap = require('piecemap');

// what we request:
var CHUNK_SIZE = 8 * 1024;

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
    this.streams = [];
    this.lastActivity = Date.now();
    Model.getFileinfo(infoHex, function(error, fileinfo) {
                          if (error)
                              throw error;

                          that.pieceLength = fileinfo.pieceLength;
                          fileinfo.files.forEach(function(file) {
                                                     that.size += file.length;
                                                 });
                          that.pieceNum = Math.ceil(that.size / fileinfo.pieceLength);
                          that.piecemap = new PieceMap(that.pieceNum);
                      });

    this.tryAnnounce();
    setInterval(function() {
                    if (that.streams.length > 0) {
                        // Force a tracker request after 10s idleness,
                        // don't bore our visitors.
                        // This really puts load on the trackers if many
                        // people were doing this. Luckily they don't.
                        var force = that.lastActivity && (that.lastActivity < Date.now() - 10 * 1000);
                        that.tryAnnounce(force);
                    }
                }, 2000);
};

TorrentContext.prototype.addPeer = function(host, port) {
    if (!this.peers.hasOwnProperty(host)) {
        var peer = this.peers[host] = new Peer(this, host, port);
        this.canWorkPeers();
    }
};

TorrentContext.prototype.canWorkPeers = function() {
    var that = this;

    if (!this.workPeersScheduled) {
        setTimeout(function() {
                       that.workPeersScheduled = false;
                       that.workPeers();
                   }, 50);
        this.workPeersScheduled = true;      
    }
};

TorrentContext.prototype.workPeers = function() {
    var didSomething = false;
    for(var host in this.peers) {
        if (this.peers.hasOwnProperty(host)) {
            if (this.peers[host].canConnect()) {
                this.peers[host].connect();
                didSomething = true;
                break;
            }
        }
    }

    if (didSomething)
        this.canWorkPeers();
};

TorrentContext.prototype.workStreams = function() {
    var that = this;

    this.streams.forEach(function(stream) {
                             var index = Math.floor(stream.offset / that.pieceLength);
                             var peer = that.getPieceCandidate(index);
                             if (peer) {
                                 var offset = stream.offset % that.pieceLength;
                                 peer.requestPiece(index, offset, CHUNK_SIZE);
                             }
                         });
};
TorrentContext.prototype.onActivity = function() {
    this.lastActivity = Date.now();
    this.workStreams();
    this.onInfoUpdate();
};

TorrentContext.prototype.onInfoUpdate = function() {
    if (this.infoWaiters) {
        info = { peers: { total: 0 } };
        this.peers.forEach(function(peer) {
                               if (!info.peers.hasOwnProperty(peer.state))
                                   info.peers[peer.state] = 0;
                               info.peers[peer.state]++;
                               info.peers.total++;
                           });
        this.infoWaiters.forEach(function(cb) {
                                     cb(info);
                                 });
        delete this.infoWaiters;
    }
};

TorrentContext.prototype.waitInfo = function(cb) {
    if (this.infoWaiters === undefined)
        this.infoWaiters = [];
    this.infoWaiters.push(cb);
}

TorrentContext.prototype.receivePiece = function(index, begin, data) {
    var that = this;

    var offset = this.pieceLength * index + begin;
    this.streams.forEach(function(stream) {
                             if (stream.offset >= offset && stream.offset <= offset + data.length) {
                                 stream.write(data.slice(stream.offset - stream.offset,
                                                         stream.length < data.length ? stream.length : data.length));
                             }
                       });
};

TorrentContext.prototype.getPieceCandidate = function(index) {
    var candidate;
    for(var host in this.peers) {
        var peer;
        if ((peer = this.peers[host]) && peer.isReady()) {
            if (peer.isReady() &&
                peer.hasPiece(index)) {

                if (!candidate || candidate.score < peer.score)
                    candidate = peer;
            }
        }
    }
    if (candidate)
        console.log({candidateScore: candidate.score});
    return candidate;
};

TorrentContext.prototype.stream = function(offset, length) {
    var that = this;

    var stream = new EventEmitter();
    stream.offset = offset;
    stream.length = length;
    stream.write = function(data) {
        this.emit('data', data);
        stream.offset += data.length;
        stream.length -= data.length;
        if (stream.length <= 0)
            this.end();
    };
    stream.end = function() {
        that.streams.splice(that.streams.indexOf(stream), 1);
        this.emit('end');
    };
    this.streams.push(stream);

    this.workStreams();

    return stream;
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
TorrentContext.prototype.tryAnnounce = function(force) {
    var that = this;
    this.refreshTrackers(function(error) {
                             if (error)
                                 return;

                             var now = Date.now();
                             for(var url in that.trackers)
                                 if (that.trackers.hasOwnProperty(url) &&
                                     (that.trackers[url].next <= now || force)) {

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
              console.log(e.stack ? e.stack : e.toString());
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
                                     that.onInfoUpdate();
                                 }
                             });
               } else {
                   console.log("Tracker request to " + url + " failed: " + res.statusCode);
                   req.end();
                   res.socket.end();
               }
           });

    this.lastActivity = Date.now();
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
        return new Buffer("-BS00-YOYOYOYOYOYOY0");
}

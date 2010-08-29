var Connect = require('connect');
var Formidable = require('formidable');
var BEnc = require('benc');
var Model = require('./model');
var TorrentManager = require('./torrent_manager');
var Html = require('./html');
var MIME = require('./mime');

process.on('uncaughtException', function(e) {
           console.log(e.stack ? e.stack : e.toString());
       });

Html.setTemplate('./public/template.htm');


/* Recommendations updater */
var recommendations = [];
function updateRecommendations() {
    Model.getRecommendations(function(error, r) {
                 if (r)
                     recommendations = r;
                 else
                     console.log("Cannot get recommendations: " + error);
                 });
}
setInterval(updateRecommendations, 10 * 1000);
updateRecommendations();

/*
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
*/

function handleTorrentUpload(part) {
    var form = this;

    if (part.name == 'torrentfile') {
        var parser = new BEnc.TorrentParser(), torrent, infoHex;
        parser.on('model', function(t) {
                      torrent = t;
                  });
        parser.on('infoHex', function(ih) {
                      infoHex = ih;
                  });
        parser.on('error', function(e) {
                      console.log({ TorrentParser: e });
                  });
        part.on('data', function(data) {
                    parser.write(data);
                });
        part.on('end', function() {
                    if (torrent && infoHex)
                        form.emit('file', part.name,
                                  { torrent: torrent,
                                    infoHex: infoHex });
                });
    }
}

function acceptTorrent(infoHex, torrent, cb) {
    var fileinfo = {
        pieceLength: torrent.info['piece length'],
        name: torrent.info.name.toString(),
        files: []
    };
    if (torrent.info.files) {
        var offset = 0;
        torrent.info.files.forEach(
            function(fileDict) {
                fileinfo.files.push({ name: fileDict.path.join('/'),
                                      offset: offset,
                                      length: fileDict.length
                                    });
                offset += fileDict.length;
            });
    } else if (torrent.info.name) {
        fileinfo.files.push({ name: torrent.info.name.toString(),
                              offset: 0,
                              length: torrent.info.length
                            });
    } else {
        cb('Invalid torrent file');
        return;
    }

    var trackerUrls = [torrent.announce];
    if (torrent['announce-list'])
        torrent['announce-list'].forEach(
            function(list) {
                list.forEach(
                    function(url) {
                        trackerUrls.push(url.toString());
                    });
            });

    Model.putFileinfo(infoHex, fileinfo,
                      function(error) {
                          if (error)
                              cb(error);
                          else
                              Model.putTrackers(infoHex, trackerUrls, cb);
                      });
}

function streamer(req, res, next) {
    var m;
    if (req.method == 'GET' &&
        (m = req.url.match(/^\/([0-9a-f]{40})\/(.+)/))) {

        var infoHex = m[1];
        var filename = m[2];

        Model.getFileinfo(infoHex, function(error, fileinfo) {
                              if (error === 'Not found') {
                                  res.writeHead(404, {});
                                  res.end('Not found');
                              } else if (fileinfo) {
                                  var file;
                                  fileinfo.files.forEach(function(file1) {
                                                             if (file1.name === filename)
                                                                 file = file1;
                                                         });
                                  if (!file) {
                                      res.writeHead(404, {});
                                      res.end('Not found');
                                  } else {
                                      var ctx = TorrentManager.get(infoHex);
                                      var resHeaders = {'Content-Type': MIME.fileType(filename),
                                                        'Accept-Ranges': 'bytes'};
                                      var offset = file.offset;
                                      var length = file.length;
                                      var m;
                                      if (req.headers.range &&
                                          (m = req.headers.range.match(/bytes=(\d+)/))) {

                                          var start = parseInt(m[1], 10);
                                          offset += start;
                                          var fullLength = length;
                                          length -= start;
                                          resHeaders['Content-Range'] = 'bytes ' + start +
                                              '-' + (start + length) + '/' + fullLength;
                                      }
                                      resHeaders['Content-Length'] = length;

                                      var stream = ctx.stream(offset, length);
                                      req.socket.on('end', function() {
                                                        stream.end();
                                                    });
                                      req.socket.on('error', function() {
                                                        stream.end();
                                                    });
                                      stream.on('data', function(data) {
                                                    res.write(data);
                                                });
                                      stream.on('end', function() {
                                                    res.end();
                                                });
                                      res.writeHead(resHeaders['Content-Range'] ? 206 : 200, resHeaders);
                                  }
                              } else
                                  throw error;
                          });
    } else {
        next();
    }
}

function app(app) {
    app.post('/up', function(req, res) {
                 var form = new Formidable.IncomingForm();
                 form.encoding = 'binary';
                 form.bytesExpected = 2 * 1024 * 1024;  // 2 MB max
                 form.handlePart = handleTorrentUpload;
                 form.parse(req, function(err, fields, forms) {
                                var torrentfile = forms.torrentfile;
                                if (torrentfile) {
                                    var infoHex = torrentfile.infoHex;
                                    acceptTorrent(infoHex, torrentfile.torrent,
                                                  function() {
                                                      res.writeHead(302,
                                                                    { Location: '/' + infoHex + '.html' });
                                                      res.end();
                                                  });
                                } else {
                                    res.writeHead(400, {});
                                    res.end('Please upload something here');
                                }
                            });
             });


    app.get('/:infoHex.json', function(req, res) {
                var infoHex = req.params.infoHex;
                var ctx = TorrentManager.get(infoHex);

        ctx.waitInfo(function(info) {
                 res.writeHead(200, {});
                 res.end(JSON.stringify(info));
                 });
            });
    app.get('/', function(req, res) {
        var torrentItemString = '';
        recommendations.forEach(function(r) {
            console.log(r);
            torrentItemString += Html.tag('li',[], Html.tag('a', {href:'/'+r.infoHex+'.html'},r.name));
        });
        res.writeHead(200, {});
        res.write(Html.index( torrentItemString ));
        res.end();
    });
    app.get('/:infoHex.html', function(req, res) {
        Model.getFileinfo(req.params.infoHex, function(error, fileinfo) {
                              if (error === 'Not found') {
                                  res.writeHead(404, {});
                                  res.end('Not found');
                              } else if (fileinfo) {
                                  var files = Model.parseTreeByFiles(fileinfo.files);
                                  console.log(files);
                                  res.writeHead(200, {});
                                  res.write(Html.show(files));
                                  res.end();
                              } else
                                  throw error;
                          });
            });
}

Connect.createServer(
    Connect.logger(),
    Connect.staticProvider(__dirname + '/public'),
    streamer,
    Connect.router(app),
    Connect.errorHandler({ dumpExceptions: true, showStack: true })
).listen(parseInt(process.env.PORT || "8001", 10));


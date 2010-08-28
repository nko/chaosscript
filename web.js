var Connect = require('connect');
var Formidable = require('formidable');
var BEnc = require('benc');
var Model = require('./model');
var TorrentManager = require('./torrent_manager');
var Html = require('./html');

Html.setTemplate('./public/template.htm');

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
	fileinfo.files.push({ name: torrent.info.name,
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
								    { Location: '/' + infoHex });
						      res.end();
						  });
				} else {
				    res.writeHead(400, {});
				    res.end('Please upload something here');
				}
			    });
	     });

    app.get('/test', function(req, res) {
        res.writeHead(200, {});
        var someContent = Html.tag('div', {'class':'metainfos'}, 'this is a test');
        Html.fillWith(someContent);
        res.write(Html.show());
        res.end();
    })

    app.get('/:infoHex.json', function(req, res) {
		var infoHex = req.params.path.infoHex;
		var ctx = TorrentManager.get(infoHex);

		var response = {
		};
		res.writeHead(200, {});
		res.end(JSON.stringify(response));
	    });
    app.get('/:infoHex/:filename', function(req, res) {
		var infoHex = req.params.path.infoHex;
		var filename = req.params.path.filename;
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
					  // TODO: create a Desire for this req
				      } else
					  throw error;
				  });
	    });
}

Connect.createServer(
    Connect.logger(),
    Connect.staticProvider(__dirname + '/public'),
    Connect.router(app),
    Connect.errorHandler({ dumpExceptions: true, showStack: true })
).listen(parseInt(process.env.PORT || "8001", 10));

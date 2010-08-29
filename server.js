var Connect = require('connect');
var http = require('http');

process.on('uncaughtException', function(e) {
	       console.log(e.stack);
});

function proxyMiddleware(req, res, next) {
    req.proxyTo = function(host, port) {
	var cl = http.createClient(port, host);
	var clReq = cl.request(req.method, req.url, req.headers);
	var clRes_ = null;

	// Forward body	
	req.on('data', function(data) {
		   clReq.write(data);
	       });
	req.on('end', function(data) {
		   clReq.end(data);
		   if (clRes_)
		       clRes_.end();
	       });

	// Forward response
	clReq.on('response', function(clRes) {
		     res.writeHead(clRes.statusCode, clRes.headers);
		     clRes.on('data', function(data) {
				  res.write(data);
			      });
		     clRes.on('end', function(data) {
				  res.end(data);
			      });
		     clRes_ = clRes;
		 });
	cl.on('error', function(error) {
		  res.writeHead(500, {});
		  res.end(error.toString());
	      });
    };
    next();
};

var BACKEND_HOST = "127.0.0.1";
var BACKEND_PORTS = [8001, 8002, 8003, 8004];
var rrIdx = 0;
function routingMiddleware(req, res, next) {
    var toAny = ["/", "/up", "/style.css", "/bitsuckr.png"];
    if (toAny.some(function(path) {
		       return path == req.url;
		   })) {
	req.proxyTo(BACKEND_HOST, BACKEND_PORTS[rrIdx]);

	rrIdx = (rrIdx + 1) % BACKEND_PORTS.length;
    } else {
	var idx = 0;
	for(var i = 1; i < req.url.length; i++) {
	    var c = req.url.charCodeAt(i);
	    if (c == 47 ||  // 2nd '/'
		c == 46)    // 1st '.'
		break;
	    idx += c;
	}
	idx = idx % BACKEND_PORTS.length;

	req.proxyTo(BACKEND_PORTS, BACKEND_PORTS[idx]);
    }
};

Connect.createServer(
    Connect.logger(),
    proxyMiddleware,
    routingMiddleware,
    Connect.errorHandler({ dumpExceptions: true, showStack: true })
).listen(parseInt(process.env.PORT || "8000", 10));

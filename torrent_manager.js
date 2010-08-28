var TorrentContext = require('./torrent_context');

var ctxs = {};

module.exports = {
    get: function(infoHex) {
	if (ctxs.hasOwnProperty(infoHex))
	    return ctxs[infoHex];
	else {
	    return (ctxs[infoHex] = new TorrentContext(module.exports, infoHex));
	}
    },

    port: 6881
};

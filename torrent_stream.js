var EventEmitter = require('events').EventEmitter;
var sys = require('sys');

// what we request:
var CHUNK_SIZE = 8 * 1024;
var CACHED_CHUNKS = 160;

function Stream(offset ,length) {
    EventEmitter.call(this);

    // Where the HTTP stream is actually at
    this.offset = offset;
    this.length = length;
    this.cache = [];  // desires, ordered by offset
    this.growCache();
    if (this.length <= 0) {
	var that = this;
	process.nextTick(function() {
			     that.end();
			 });
    }
}
sys.inherits(Stream, EventEmitter);

Stream.prototype.growCache = function() {
    var nextOffset = this.offset;
    this.cache.forEach(function(desire) {
			   if (nextOffset < desire.offset + desire.length)
			       nextOffset = desire.offset + desire.length;
		       });
    for(var o = nextOffset;
        o < this.offset + this.length && o < this.offset + CACHED_CHUNKS * CHUNK_SIZE;
        o += CHUNK_SIZE) {

        this.cache.push({ offset: o, length: CHUNK_SIZE, last: 0 });
    }

    /*console.log({grown:this.cache.map(function(desire) {
					  return {
					      offset: desire.offset,
					      length: desire.length,
					      last: desire.last
					  };
				      }),offset:this.offset});*/
};

Stream.prototype.nextDesired = function() {
    var that = this;

    var now = Date.now();
    var best;
    this.cache.forEach(function(desire) {
			   if (desire.offset + desire.length <= that.offset) {
			       // What's this doing here?
			       console.log('Orphaned desire ' + desire.offset + '..' + desire.length + ', bad bad batshit');
			       return;
			   }

			   // request the same piece every 4s
			   if (!desire.data && desire.last <= now - 4 * 1000) {
			       // First things first
			       if (!best || desire.offset < best.offset)
				   best = desire;
			   }
		       });

    if (best) {
	return { offset: best.offset,
		 length: best.length || CHUNK_SIZE,
		 requested: function() {
		     //console.log({next: best});
		     best.last = Date.now();
		 }
	};
    }
};

Stream.prototype.receive = function(offset, data) {
    //console.log({receive:offset,len:data.length});

    var i, desire;
    for(i = 0; i < this.cache.length; i++) {
	desire = this.cache[i];
	if (offset <= desire.offset && offset + data.length >= desire.offset) {
	    data = data.slice(desire.offset - offset, data.length);
	    if (desire.length < data.length) {
		desire.data = data.slice(0, desire.length);
		data = data.slice(desire.length, data.length);
	    } else {
		desire.data = data;
		break;
	    }
	}
    }
    if (i < this.cache.length) {
	if (desire.length > data.length) {
            // Too few data, create a smaller succeeding desire,
            // with last request set to now, so we can collect
            // succeeding buffers without re-requesting immediately.
	    var newDesire = { offset: desire.offset + desire.data.length,
			      length: desire.length - desire.data.length,
			      last: Date.now() };
	    this.cache.splice(i + 1, 0, newDesire);
	    //console.log({inserted: newDesire});
	}
	desire.length = desire.data.length;

        this.walkCaches();
    } else
	console.warn('Ouch: did not find cache desire for offset ' + offset);
};

// Resets cache entries
Stream.prototype.cancelled = function(offset, length) {
/* TODO:
    this.cache.forEach()

XXX:
    for(var o in this.cache)
        if (this.cache.hasOwnProperty(o)) {
            if (offset <= Number(o) && offset + length >= Number(o))
                this.cache[o].last = 0;
        }
*/
};

Stream.prototype.walkCaches = function() {
    if (this.cache[0] && this.cache[0].data) {
	var desire = this.cache.shift();
	//console.log("shifted desire "+desire.offset+".."+desire.length);
	if (this.offset !== desire.offset)
	    console.error("ZOMFG! Cache got out of sync. We'll proceed sending garbage...");
        this.write(desire.data);

        this.growCache();
        var that = this;
        process.nextTick(function() {
                             that.walkCaches();
                         });
    }

    // TODO: rm in production
    var s = '';
    this.cache.forEach(function(desire) {
			   s += desire.data ? '+' : '-';
		       });
    console.log(this.offset + ': ' + s);
};

Stream.prototype.write = function(data) {
    this.emit('data', data);
    //console.log("write, offset = "+this.offset+" + "+data.length+" = "+(this.offset+data.length));
    this.offset += data.length;
    this.length -= data.length;
    if (this.length <= 0)
        this.end();
};

Stream.prototype.end = function() {
    this.emit('end');
};

module.exports = Stream;
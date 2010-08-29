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

	var remaining = this.length + this.offset - o;
        this.cache.push({ offset: o,
			  length: Math.min(CHUNK_SIZE, remaining),
			  last: 0 });
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

			   if (!desire.data) {
			       // request the same piece again, if it was
			       // pending for too long. base is 1s, up to
			       // 20s depening on the square root of
			       // progress.
			       //
			       // avoids re-requesting for slightly slow senders,
			       // but should skip stuck peers quite soon.
			       var desireProgress = (desire.offset - that.offset) / (CACHED_CHUNKS * CHUNK_SIZE);
			       var timeout = (8 + 11 * Math.sqrt(desireProgress)) * 1000;

			       if (desire.last <= now - timeout) {
				   // First things first
				   if (!best || desire.offset < best.offset)
				       best = desire;
			       }
			   }
		       });

    if (best) {
	// Many many many clients need offset chunk-aligned
	var offset = Math.floor(best.offset / CHUNK_SIZE) * CHUNK_SIZE;
	//var length = best.length + best.offset - offset;

	return { offset: offset,
		 length: CHUNK_SIZE,
		 requested: function() {
		     //console.log({next: best});
		     best.last = Date.now();
		 }
	};
    }
};

// Oh shit, I fear this is full of redundancy. NodeKO leaves me no
// other choi
Stream.prototype.receive = function(offset, data) {
    //console.log({receive:offset,len:data.length});

    var i, desire;
    for(i = 0; i < this.cache.length; i++) {
	desire = this.cache[i];

	if (offset <= desire.offset &&
	    offset + data.length >= desire.offset) {

	    // data overlaps desire offset
	    data = data.slice(desire.offset - offset, data.length);
	    if (desire.length < data.length) {
		desire.data = data.slice(0, desire.length);
		data = data.slice(desire.length, data.length);
	    } else {
		desire.data = data.slice(0, Math.min(desire.length, data.length));

		if (desire.length > data.length) {
		    // Too few data, create a smaller succeeding desire,
		    // with last request set to now, so we can collect
		    // succeeding buffers without re-requesting immediately.
		    var afterDesire = { offset: desire.offset + desire.data.length,
					length: desire.length - desire.data.length,
					last: Date.now() };
		    this.cache.splice(i + 1, 0, afterDesire);
		    //console.log({inserted: newDesire});
		}
		desire.length = desire.data.length;
		break;
	    }
	} else if (offset >= desire.offset &&
		   offset < desire.offset + desire.length) {
	    // data begins within desire

	    if (offset > desire.offset) {
		var beforeDesire = { offset: desire.offset,
				     length: offset - desire.offset,
				     last: desire.last
				   };
		this.cache.splice(i, 0, beforeDesire);
		i++;
	    }
	    if (offset + data.length < desire.offset + desire.length) {
		// not enough!
		var afterDesire = { offset: offset + data.length,
				    length: desire.offset + desire.length - offset - data.length,
				    last: desire.last
				  };
		this.cache.splice(i + 1, 0, afterDesire);
		i++;
	    }
	    desire.offset = offset;
	    desire.data = data.slice(0, Math.min(desire.length, data.length));
	    desire.length = desire.data.length;
console.log({before:beforeDesire,desire:desire,afterDesire: afterDesire});
	} else if (offset + data.length <= desire.length)
	    break;
    }
    if (i < this.cache.length) {
        this.walkCaches();
    } else {
	console.warn('Ouch: did not find cache desire for offset ' + offset);
	/*this.cache.forEach(function(desire) {
			       console.log({ // no data
					       offset: desire.offset,
					       length: desire.length,
					       last: desire.last
					   });
			   });*/
    }

    // TODO: rm in production
    var s = '';
    this.cache.forEach(function(desire) {
			   s += desire.data ? '+' : '-';
		       });
    console.log(this.offset + ': ' + s);
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
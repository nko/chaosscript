var EventEmitter = require('events').EventEmitter;
var sys = require('sys');

// what we request:
var CHUNK_SIZE = 8 * 1024;
var CACHED_CHUNKS = 32;

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
    var nextOffset;
    if (this.cache.length > 0) {
	var desire = this.cache[this.cache.length - 1];
	nextOffset = desire.offset + desire.length;
    } else
	nextOffset = Math.floor(this.offset / CHUNK_SIZE) * CHUNK_SIZE;

    for(var o = nextOffset;
        o < this.offset + this.length && o < this.offset + CACHED_CHUNKS * CHUNK_SIZE;
        o += CHUNK_SIZE) {

	var remaining = this.length + this.offset - o;
	var length = Math.min(remaining, CHUNK_SIZE);
        this.cache.push({ offset: o,
			  length: length,
			  data: new Buffer(CHUNK_SIZE),
			  dataOffset: o,
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

			   if (desire.dataOffset < desire.offset + desire.length) {
			       // request the same piece again, if it was
			       // pending for too long. base is 2s, up to
			       // 30s depening on the square root of
			       // progress.
			       //
			       // avoids re-requesting for slightly slow senders,
			       // but should skip stuck peers quite soon.
			       var desireDistance = (desire.offset - that.offset) / (CACHED_CHUNKS * CHUNK_SIZE);
			       var timeout = ((desireDistance > 0) ?
					      5 + 28 * Math.sqrt(desireDistance) :
					      3) * 1000;
/*if (desire.offset === that.offset)
console.log({timeout:timeout,offset:desire.offset});*/

			       if (desire.last <= now - timeout) {
				   // First things first
				   if (!best) {
				       best = desire;

				       if (desire.last > 0)
					   console.log('re-request '+desire.offset);
				   }
			       }
			   }
		       });

    if (best) {
	return { offset: best.offset,
		 length: best.length,
		 requested: function() {
		     //console.log({next: best});
		     best.last = Date.now();
		 }
	};
    }
};

Stream.prototype.receive = function(offset, data) {
    //console.log({receive:offset,len:data.length});
    var dataEnd = offset + data.length;

    for(var i = 0;
	i < this.cache.length && dataEnd > this.cache[i].offset;
	i++) {

	var desire = this.cache[i];
	if (offset <= desire.dataOffset &&
	    offset + data.length > desire.dataOffset) {

	    var dataIndex = desire.dataOffset - offset;
	    var desireDataIndex = desire.dataOffset - desire.offset;
	    if (desireDataIndex < desire.data.length) {
		data.copy(desire.data, desireDataIndex, dataIndex);
		//console.log({dataOffset:desire.dataOffset, length: data.length, idx: dataIndex});
		desire.dataOffset += data.length - dataIndex;
		break;
	    }
	}
    }

    // TODO: rm in production
    var s = '';
    this.cache.forEach(function(desire) {
			   s += (desire.dataOffset == desire.offset + desire.length) ? '+' : '-';
		       });
    console.log(this.offset + ': ' + s);

    this.walkCaches();
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

// Additionally stores sendOffset in 1st element
Stream.prototype.walkCaches = function() {
    var desire = this.cache[0];
//console.log({walkCaches:desire});
    if (!desire)
	return;
console.log({offset:this.offset,dataOffset:desire.dataOffset});
    if (this.offset < desire.offset) {
	console.error("ZOMFG! Cache got out of sync. We'll stop.");
	this.end();
	return;	
    }

    if (desire.dataOffset > this.offset) {
	console.log({canWalk:{offset:this.offset,dataOffset:desire.dataOffset, desireOffset:desire.offset}});
	console.log("sending "+(this.offset-desire.offset)+".."+(desire.dataOffset - desire.offset)+' of '+
desire.data.length + '/' + desire.length);
        this.write(desire.data.slice(this.offset - desire.offset,
				     desire.dataOffset - desire.offset));
	console.log('->' + this.offset);

	if (this.offset >= desire.offset + desire.length) {
	    this.cache.shift();  /* PL0P */
            this.growCache();
            var that = this;
            process.nextTick(function() {
				 that.walkCaches();
                             });
	}
    }
};

Stream.prototype.write = function(data) {
    // last part is smaller, don't send more
    if (data.length > this.length)
	data = data.slice(0, this.length);

console.log('emitting '+data.length);
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

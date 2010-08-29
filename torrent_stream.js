var EventEmitter = require('events').EventEmitter;
var sys = require('sys');

// what we request:
var CHUNK_SIZE = 16 * 1024;
var CACHED_CHUNKS = 40;

function Stream(offset ,length) {
    EventEmitter.call(this);

    // Where the HTTP stream is actually at
    this.offset = offset;
    this.length = length;
    this.cache = {};  // desires by offset
    this.growCache();
}
sys.inherits(Stream, EventEmitter);

Stream.prototype.growCache = function() {
    for(var o = this.offset;
	o < this.length && o < this.offset + CACHED_CHUNKS * CHUNK_SIZE;
	o += CHUNK_SIZE) {

	if (!this.cache.hasOwnProperty(o))
	    this.cache[o] = { last: 0 };
    }
};

Stream.prototype.nextDesired = function() {
    var now = Date.now();
    var result;
    for(var o in this.cache) {
	if (this.cache.hasOwnProperty(o)) {
	    var desire = this.cache[o];
	    // request the same piece every 4s
	    if (!desire.data && desire.last <= now - 4 * 1000) {
		// First things first
		if (!result || o < result.offset)
		    result = { offset: o,
			       length: desire.length || CHUNK_SIZE };
	    }
	}
    }
    if (result) {
	this.cache[result.offset].last = now;
console.log({nextDesired: result, begin:this.cache[this.offset]});
	if (this.cache[this.offset].last === 0 && this.offset !== result.offset) {
	    console.log({offset:this.offset,result:result});
	    for(var o in this.cache) {
		if (this.cache.hasOwnProperty(o))
		    console.log({o:o, last:this.cache[o].last});
	    }
	    process.exit(1);
	}
    }
    return result;
};

Stream.prototype.receive = function(offset, data) {
    console.log({receive:offset, applicable: this.cache.hasOwnProperty(offset)});

    if (this.cache.hasOwnProperty(offset)) {
	var desire = this.cache[offset];
	desire.data = data.length <= CHUNK_SIZE ? data : data.slice(0, CHUNK_SIZE);

	if (data.length < CHUNK_SIZE) {
	    // Too few data, create a smaller succeeding desire,
	    // with last request set to now, so we can collect
	    // succeeding buffers without re-requesting immediately.
	    this.cache[offset + data.length] = { last: Date.now(),
						 length: CHUNK_SIZE - data.length };
	} else if (data.length > CHUNK_SIZE) {
	    // Too many data, recurse for next chunk
	    // (wasn't requested, shouldn't happen)
	    this.receive(offset + CHUNK_SIZE, data.slice(CHUNK_SIZE, data.length));
	}

	this.walkCaches();
    }

    var s = '';
    for(var o = this.offset; o < this.offset + CACHED_CHUNKS * CHUNK_SIZE; o += CHUNK_SIZE) {
	if (this.cache.hasOwnProperty(o))
	    s += this.cache[o].data ? '+' : '-';
	else
	    s += '.';
    }
    console.log(this.offset + ': ' + s);
};

Stream.prototype.walkCaches = function() {
    if (this.cache.hasOwnProperty(this.offset)) {
	var desire = this.cache[this.offset];
	if (desire.data) {
	    delete this.cache[this.offset];  // before write() advances offset
	    this.write(desire.data);

	    this.growCache();

	    var that = this;
	    process.nextTick(function() {
				 that.walkCaches();
			     });
	}
    }
};

Stream.prototype.write = function(data) {
    this.emit('data', data);
    this.offset += data.length;
    this.length -= data.length;
    if (this.length <= 0)
        this.end();
};

Stream.prototype.end = function() {
    this.emit('end');
};

module.exports = Stream;
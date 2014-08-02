
/**
 * creates a duplex stream out of fs.ReadStream and fs.WriteStream
 *
 * This is a direct copy/paste of nodejs PR# 8002
 * https://github.com/joyent/node/pull/8002
 *
 */

var util = require('util');

fs = require('fs');
WriteStream = fs.WriteStream;

var Stream = require('stream').Stream;
var Readable = Stream.Readable;
var Duplex = Stream.Duplex;

// had to modify ReadStream so that its end member didn't conflict w/
// WriteStream.end(...)

util.inherits(ReadStream, Readable);
ReadStream = ReadStream;

function isUndefined(value) {
    return value === undefined;
}

function isNumber(value) {
    return !(value instanceof Array) &&
        !isNaN(parseFloat(value))
        && isFinite(value);
}

var pool;

function allocNewPool(poolSize) {
  pool = new Buffer(poolSize);
  pool.used = 0;
}

function ReadStream(path, options) {
  if (!(this instanceof ReadStream))
    return new ReadStream(path, options);

  // a little bit bigger buffer and water marks by default
  options = util._extend({
    highWaterMark: 64 * 1024
  }, options || {});

  Readable.call(this, options);

  this.path = path;
  this.fd = options.hasOwnProperty('fd') ? options.fd : null;
  this.flags = options.hasOwnProperty('flags') ? options.flags : 'r';
  this.mode = options.hasOwnProperty('mode') ? options.mode : 438; /*=0666*/

  this.start = options.hasOwnProperty('start') ? options.start : undefined;
  this._end = options.hasOwnProperty('end') ? options.end : undefined;
  this.autoClose = options.hasOwnProperty('autoClose') ?
      options.autoClose : true;
  this.pos = undefined;

  if (!isUndefined(this.start)) {
    if (!isNumber(this.start)) {
      throw TypeError('start must be a Number');
    }
    if (isUndefined(this._end)) {
      this._end = Infinity;
    } else if (!isNumber(this._end)) {
      throw TypeError('end must be a Number');
    }

    if (this.start > this._end) {
      throw new Error('start must be <= end');
    }

    if (this.start < 0) {
      throw new Error('start must be >= zero');
    }


    this.pos = this.start;
  }

  if (!isNumber(this.fd))
    this.open();

  this.on('end', function() {
    if (this.autoClose) {
      this.destroy();
    }
  });
}

ReadStream.prototype.open = function() {
  var self = this;
  fs.open(this.path, this.flags, this.mode, function(er, fd) {
    if (er) {
      if (self.autoClose) {
        self.destroy();
      }
      self.emit('error', er);
      return;
    }

    self.fd = fd;
    self.emit('open', fd);
    // start the flow of data.
    self.read();
  });
};

ReadStream.prototype._read = function(n) {
  if (!isNumber(this.fd))
    return this.once('open', function() {
      this._read(n);
    });

  if (this.destroyed)
    return;

  if (!pool || pool.length - pool.used < kMinPoolSpace) {
    // discard the old pool.
    pool = null;
    allocNewPool(this._readableState.highWaterMark);
  }

  // Grab another reference to the pool in the case that while we're
  // in the thread pool another read() finishes up the pool, and
  // allocates a new one.
  var thisPool = pool;
  var toRead = Math.min(pool.length - pool.used, n);
  var start = pool.used;

  if (!isUndefined(this.pos))
    toRead = Math.min(this._end - this.pos + 1, toRead);

  // already read everything we were supposed to read!
  // treat as EOF.
  if (toRead <= 0)
    return this.push(null);

  // the actual read.
  var self = this;
  fs.read(this.fd, pool, pool.used, toRead, this.pos, onread);

  // move the pool positions, and internal position for reading.
  if (!isUndefined(this.pos))
    this.pos += toRead;
  pool.used += toRead;

  function onread(er, bytesRead) {
    if (er) {
      if (self.autoClose) {
        self.destroy();
      }
      self.emit('error', er);
    } else {
      var b = null;
      if (bytesRead > 0)
        b = thisPool.slice(start, start + bytesRead);

      self.push(b);
    }
  }
};


ReadStream.prototype.destroy = function() {
  if (this.destroyed)
    return;
  this.destroyed = true;

  if (isNumber(this.fd))
    this.close();
};


ReadStream.prototype.close = function(cb) {
  var self = this;
  if (cb)
    this.once('close', cb);
  if (this.closed || !isNumber(this.fd)) {
    if (!isNumber(this.fd)) {
      this.once('open', close);
      return;
    }
    return process.nextTick(this.emit.bind(this, 'close'));
  }
  this.closed = true;
  close();

  function close(fd) {
    fs.close(fd || self.fd, function(er) {
      if (er)
        self.emit('error', er);
      else
        self.emit('close');
    });
    self.fd = null;
  }
};


util.inherits(DuplexStream, Duplex);
exports.DuplexStream = DuplexStream;
function DuplexStream(path, options) {
  if (!(this instanceof DuplexStream))
    return new DuplexStream(path, options);

  // a little bit bigger buffer and water marks by default
  options = util._extend({
    highWaterMark: 64 * 1024
  }, options || {});

  Duplex.call(this, options);

  this.path = path;

  this.fd = options.hasOwnProperty('fd') ? options.fd : null;
  this.flags = options.hasOwnProperty('flags') ? options.flags : 'r+';
  this.mode = options.hasOwnProperty('mode') ? options.mode : 438; /*=0666*/

  this.start = options.hasOwnProperty('start') ? options.start : undefined;
  this._end = options.hasOwnProperty('end') ? options.end : undefined;
  this.autoClose = options.hasOwnProperty('autoClose') ?
      options.autoClose : true;
  this.pos = undefined;
  this.bytesWritten = 0;

  if (!isUndefined(this.start)) {
    if (!isNumber(this.start)) {
      throw TypeError('start must be a Number');
    }

    if (isUndefined(this._end)) {
      this._end = Infinity;
    } else if (!isNumber(this._end)) {
      throw TypeError('end must be a Number');
    }

    if (this.start > this._end) {
      throw new Error('start must be <= end');
    }

    if (this.start < 0) {
      throw new Error('start must be >= zero');
    }

    this.pos = this.start;
  }

  if (!isNumber(this.fd))
    this.open();

  // dispose on finish.
  this.once('finish', this.close);

  this.once('end', function() {
    if (this.autoClose) {
      this.destroy();
    }
  });
}

exports.FileDuplexStream = DuplexStream;


DuplexStream.prototype.open = function() {
  var self = this;
  fs.open(this.path, this.flags, this.mode, function(er, fd) {
    if (er) {
      if (self.autoClose) {
        self.destroy();
      }
      self.emit('error', er);
      return;
    }

    self.fd = fd;
    self.emit('open', fd);
    // start the flow of data.
    self.read();
  });
};

DuplexStream.prototype._read = ReadStream.prototype._read;
DuplexStream.prototype._write = WriteStream.prototype._write;
DuplexStream.prototype.destroy = ReadStream.prototype.destroy;
DuplexStream.prototype.close = ReadStream.prototype.close;

// There is no shutdown() for files.
DuplexStream.prototype.destroySoon = WriteStream.prototype.end;

// A node module for managing TUN/TAP virtual network interfaces.

var fs = require('fs');
var fsduplex = require('./fsduplex');
var dgram = require('dgram');
var util = require('util');
var errno = require('errno');

var ref = require('ref');
var array = require('ref-array');
var struct = require('ref-struct');
var union = require('ref-union');

var ioctl = require('ioctl');


/*
 * Creates a new TunTap device, which extends stream.Duplex
 * options:
 *   type: type of device to create, either 'tun' or 'tap', defaults to 'tap'
 *   name: name of the device to create. default: null (OS will set)
 *   address: ip address to set this device to listen on. default: os default
 *   netmask: netmask for this device. default: os default
 *   gateway: gateway for this device. default: os default
 *   broadcast: broadcast for this device. default: os default
 *   mtu: mtu for this address. default: 1500
 *   up: device will be enabled (ifconfig tunX up) if true. default: false
 *
 */
util.inherits(TunTap, fsduplex.DuplexStream);

function TunTap(options) {

    var ifr = new ifreq();
    ifr.ref().fill(0);

    ifr.ifr_ifru.ifru_flags = 0;

    if (options !== undefined && options.hasOwnProperty('type')) {
        if (options['type'].toLowerCase == 'tun') {
            ifr.ifr_ifru.ifru_flags |= IFF_TUN;
        } else {
            ifr.ifr_ifru.ifru_flags |= IFF_TAP;
        }
    } else {
        ifr.ifr_ifru.ifru_flags |= IFF_TAP;
    }

    if (options !== undefined && options.hasOwnProperty('noPacketInfo')) {
        if (options.noPacketInfo === true) {
            ifr.ifr_ifru.ifru_flags |= IFF_NO_PI;
        }
    } else {
        // set IFF_NO_PI flag by default
        ifr.ifr_ifru.ifru_flags |= IFF_NO_PI;
    }

    if (options !== undefined && options.hasOwnProperty('name')) {
        ifr.ifrn_name.buffer.write(options.name);
    } else if (options !== undefined && typeof(options) === 'string') {
        ifr.ifrn_name.buffer.write(options);
    }

    var path = '/dev/net/tun';
    var flags = 'r+';
    var fd = fs.openSync(path, flags);

    fsduplex.DuplexStream.call(this, path,
    {
        fd: fd,
        flags: flags,
        readable: true,
        writable: true,
        allowHalfOpen: false
    });

    this.once('open', function(fd) {
        try {
            ioctl(fd, TUNSETIFF, ifr.ref());
        } catch (err) {
            this.emit('error', 'Could not open TUN/TAP device due to ' +
                errno[err].code + ': ' + errno[err].description);
            this.destroy();
        }

        this.name = ifr.ifrn_name.buffer.toString();

        var lastEvent = false;

        if (options !== undefined && options.hasOwnProperty('address')) {
            lastEvent = 'address';
            this.setAddress(options.address);
        }

        if (options !== undefined && options.hasOwnProperty('netmask')) {
            if (lastEvent) {
                this.once(lastEvent, function() {
                    this.setNetmask(options.netmask);
                }.bind(this));
            } else {
                this.setNetmask(options.netmask);
            }

            lastEvent = 'netmask';
        }

        if (options !== undefined && options.hasOwnProperty('gateway')) {
            if (lastEvent) {
                this.once(lastEvent, function() {
                    this.setGateway(options.gateway);
                }.bind(this));
            } else {
                this.setGateway(options.gateway);
            }

            lastEvent = 'gateway';
        }

        if (options !== undefined && options.hasOwnProperty('broadcast')) {
            if (lastEvent) {
                this.once(lastEvent, function() {
                    this.setBroadcast(options.broadcast);
                }.bind(this));
            } else {
                this.setBroadcast(options.broadcast);
            }

            lastEvent = 'broadcast';
        }

        if (options !== undefined && options.hasOwnProperty('mtu')) {
            if (lastEvent) {
                this.once(lastEvent, function() {
                    this.setMTU(options.mtu);
                }.bind(this));
            } else {
                this.setMTU(options.mtu);
            }

            lastEvent = 'mtu';
        }

        if (options !== undefined && options.hasOwnProperty('up')) {
            if (options.up === true) {
                if (lastEvent) {
                    this.once(lastEvent, function() {
                        this.up()
                    }.bind(this));
                } else {
                    this.up();
                }
            }
        }
    }.bind(this));
}

TunTap.prototype.getAddress = function(addr) {
    this._getAddress('address', addr);
}

TunTap.prototype.setAddress = function(addr) {
    this._setAddress('address', addr);
}

TunTap.prototype.getNetmask = function(addr) {
    this._getAddress('netmask', addr);
}

TunTap.prototype.setNetmask = function(addr) {
    this._setAddress('netmask', addr);
}

TunTap.prototype.getGateway = function(addr) {
    this._getAddress('gateway', addr);
}

TunTap.prototype.setGateway = function(addr) {
    this._setAddress('gateway', addr);
}

TunTap.prototype.getBroadcast = function(addr) {
    this._getAddress('broadcast', addr);
}

TunTap.prototype.setBroadcast = function(addr) {
    this._setAddress('broadcast', addr);
}

TunTap.prototype.getMTU = function() {
    var ifr = new ifreq();
    ifr.ref().fill(0);
    
    ifr.ifrn_name.buffer.write(this.name);

    this._ifIoctl(SIOCGIFMTU, ifr, {
        success: function() {
            var mtu = ifr.ifru.ifru_mtu;
            this.emit('mtu', mtu);
        }.bind(this),

        error: function (err) {
            this.emit('error', 'error getting ' + type + ' on device ' +
                this.name + ' due to error ' + errno[err].code + ': ' +
                errno[err].description);
        }.bind(this)
    });
}

TunTap.prototype.setMTU = function(mtu) {
    var ifr = new ifreq();
    ifr.ref().fill(0);

    ifr.ifrn_name.buffer.write(this.name);

    ifr.ifr_ifru.ifru_mtu = mtu;

    this._ifIoctl(SIOCSIFMTU, ifr, {
        success: function() {
            this.emit('mtu', mtu);
        }.bind(this),

        error: function (err) {
            this.emit('error', 'error setting mtu on device ' + this.name +
                ' to ' + mtu + ' due to error ' + errno[err].code + ': ' + errno[err].description);
        }.bind(this)
    });
}


TunTap.prototype.up = function() {
    var ifr = new ifreq();
    ifr.ref().fill(0);

    ifr.ifrn_name.buffer.write(this.name);

    // kind of convoluted due to callbacks

    //first read the flags
    this._ifIoctl(SIOCGIFFLAGS, ifr, {
        success: function() {
            // read flags succeeded, set the IFF_UP flag if necessary
            if (ifr.ifr_ifru.ifru_flags & IFF_UP == 0) {
                ifr.ifr_ifru.ifru_flags |= IFF_UP;

                this._ifIoctl(SIOCSIFFLAGS, ifr, {
                    success: function() {
                        // great, we're up!
                        this.emit('up');
                    },
                    error : function() {
                        this.emit('error', 'error bringing up device ' +
                            this.name + ' due to error ' + errno[err].code +
                            ': ' + errno[err].description +
                            ' while setting device flags');
                    }
                }.bind(this));
            } else {
                // we're already up, just emit the up event in case it was
                // missed last time
                this.emit('up');
            }
        }.bind(this),

        error: function (err) {
            this.emit('error', 'error bringing up device ' + this.name +
                ' due to error ' + errno[err].code + ': ' +
                errno[err].description + ' while getting device flags');
        }.bind(this)
    });
}

TunTap.prototype._setState = function(state) {
    var ifr = new ifreq();
    ifr.ref().fill(0);

    ifr.ifrn_name.buffer.write(this.name);

    //first read the flags
    this._ifIoctl(SIOCGIFFLAGS, ifr, {
        success: function() {
            // read flags succeeded, unset the IFF_UP flag if necessary
            if ((state === 'up' && ifr.ifr_ifru.ifru_flags & IFF_UP == 0) ||
                (state === 'down' && ifr.ifr_ifru.ifru_flags & IFF_UP != 0)) {

                if (state === 'up') {
                    ifr.ifr_ifru.ifru_flags |= IFF_UP;
                } else {
                    ifr.ifr_ifru.ifru_flags &= ~IFF_UP;
                }

                this._ifIoctl(SIOCSIFFLAGS, ifr, {
                    success: function() {
                        // great, we're done!
                        this.emit(state);
                    },
                    error : function() {
                        this.emit('error', 'error bringing ' + state +
                            ' device ' + this.name + ' due to error ' +
                            errno[err].code + ': ' + errno[err].description +
                            ' while setting device flags');
                    }
                }.bind(this));
            } else {
                // we're already up/down, just emit the event in case it was
                // missed last time
                this.emit(state);
            }
        }.bind(this),

        error: function (err) {
            this.emit('error', 'error bringing ' + state + ' device ' +
                    this.name + ' due to error ' + errno[err].code + ': ' +
                errno[err].description + ' while getting device flags');
        }.bind(this)
    });
}

TunTap.prototype._ifIoctl = function(cmd, req, callbacks) {
    var socket = dgram.createSocket('udp4');
    socket.bind(function() {
        // ugly hack to work around broken dgram socket API
        var fd = socket.fd;
        if (fd == null || fd < 0) {
            fd = socket._handle.fd;
        }

        try {
            ioctl(fd, cmd, req);
            callbacks.success(req);
        } catch (err) {
            callbacks.error(err);
        }

        socket.close();
    });

    // probably will never fire, but just for safety...
    socket.on('error', function() {socket.close();});
}

var setCmdMap = {
    'address': SIOCSIFADDR,
    'netmask': SIOCSIFNETMASK,
    'gateway': SIOCSIFDSTADDR,
    'broadcast': SIOCSIFBRDADDR
}

var getCmdMap = {
    'address': SIOCGIFADDR,
    'netmask': SIOCGIFNETMASK,
    'gateway': SIOCGIFDSTADDR,
    'broadcast': SIOCGIFBRDADDR
}

// ipv4 only for now, sorry kids.
TunTap.prototype._setAddress = function(type, addr) {
    var ifr = new ifreq();
    ifr.ref().fill(0);

    ifr.ifrn_name.buffer.write(this.name);

    ifr.ifr_ifru.ifru_addr.sockaddr_in.sin_family = AF_INET;
    ifr.ifr_ifru.ifru_addr.sockaddr_in.sin_addr = inet_aton(addr);

    this._ifIoctl(setCmdMap[type], ifr, {
        success: function() {
            this.emit(type, addr);
        }.bind(this),

        error: function (err) {
            this.emit('error', 'error setting ' + type + ' on device ' + this.name +
                ' to ' + addr + ' due to error ' + errno[err].code + ': ' + errno[err].description);
        }.bind(this)
    });
}

TunTap.prototype._getAddress = function(type) {
    var ifr = new ifreq();
    ifr.ref().fill(0);

    ifr.ifrn_name.buffer.write(this.name);

    this._ifIoctl(getCmdMap[type], ifr, {
        success: function() {
            var addr = inet_ntoa(ifr.ifr_ifru.ifru_addr.sockaddr_in.sin_addr);
            this.emit(type, addr);
        }.bind(this),

        error: function (err) {
            this.emit('error', 'error getting ' + type + ' on device ' + this.name + 
                ' due to error ' + errno[err].code + ': ' + errno[err].description);
        }.bind(this)
    });
}

module.exports = TunTap;

// inet_aton and inet_ntoa shamelessly "stolen" from:
// http://stackoverflow.com/a/21559595/203705
function inet_aton(ip){
    var a = ip.split('.');
    var buffer = new Buffer(4);
    buffer.fill(0);
    for(var i = 0; i < 4; i++) {
        buffer.writeUInt8(parseInt(a[i]), i);
    }

    var intIp = buffer.readUInt32LE(0);
    console.log('0x' + intIp.toString(16));
    return intIp;
}

function inet_ntoa(num){
    var nbuffer = new ArrayBuffer(4);
    var ndv = new DataView(nbuffer);
    ndv.setUint32(0, num);

    var a = new Array();
    for(var i = 0; i < 4; i++){
        a[i] = ndv.getUint8(i);
    }
    return a.join('.');
}

var AF_INET = 0x2;

var IFF_TUN = 0x0001;
var IFF_TAP = 0x0002;
var IFF_NO_PI = 0x1000;

var IFF_UP          = 1<<0;
var IFF_BROADCAST   = 1<<1;
var IFF_DEBUG       = 1<<2;
var IFF_LOOPBACK    = 1<<3;
var IFF_POINTOPOINT = 1<<4;
var IFF_NOTRAILERS  = 1<<5;
var IFF_RUNNING     = 1<<6;
var IFF_NOARP       = 1<<7;
var IFF_PROMISC     = 1<<8;
var IFF_ALLMULTI    = 1<<9;
var IFF_MASTER      = 1<<10;
var IFF_SLAVE       = 1<<11;
var IFF_MULTICAST   = 1<<12;
var IFF_PORTSEL     = 1<<13;
var IFF_AUTOMEDIA   = 1<<14;
var IFF_DYNAMIC     = 1<<15;
var IFF_LOWER_UP    = 1<<16;
var IFF_DORMANT     = 1<<17;
var IFF_ECHO        = 1<<18;

var IFNAMSIZ = 16;
var IFALIASZ = 256;
var IFHWADDRLEN = 6;

var TUNSETIFF = 0x400454ca;
var TUNSETPERSIST = 0x400454cb;

/* Socket configuration controls. */
var SIOCGIFNAME        = 0x8910; /* get iface name */
var SIOCSIFLINK        = 0x8911; /* set iface channel */
var SIOCGIFCONF        = 0x8912; /* get iface list */
var SIOCGIFFLAGS       = 0x8913; /* get flags */
var SIOCSIFFLAGS       = 0x8914; /* set flags */
var SIOCGIFADDR        = 0x8915; /* get PA address */
var SIOCSIFADDR        = 0x8916; /* set PA address */
var SIOCGIFDSTADDR     = 0x8917; /* get remote PA address */
var SIOCSIFDSTADDR     = 0x8918; /* set remote PA address */
var SIOCGIFBRDADDR     = 0x8919; /* get broadcast PA address */
var SIOCSIFBRDADDR     = 0x891a; /* set broadcast PA address */
var SIOCGIFNETMASK     = 0x891b; /* get network PA mask */
var SIOCSIFNETMASK     = 0x891c; /* set network PA mask */
var SIOCGIFMETRIC      = 0x891d; /* get metric */
var SIOCSIFMETRIC      = 0x891e; /* set metric */
var SIOCGIFMEM         = 0x891f; /* get memory address (BSD) */
var SIOCSIFMEM         = 0x8920; /* set memory address (BSD) */
var SIOCGIFMTU         = 0x8921; /* get MTU size */
var SIOCSIFMTU         = 0x8922; /* set MTU size */
var SIOCSIFNAME        = 0x8923; /* set interface name */
var SIOCSIFHWADDR      = 0x8924; /* set hardware address */
var SIOCGIFENCAP       = 0x8925; /* get/set encapsulations */
var SIOCSIFENCAP       = 0x8926;        
var SIOCGIFHWADDR      = 0x8927; /* Get hardware address */
var SIOCGIFSLAVE       = 0x8929; /* Driver slaving support */
var SIOCSIFSLAVE       = 0x8930; 
var SIOCADDMULTI       = 0x8931; /* Multicast address lists */
var SIOCDELMULTI       = 0x8932; 
var SIOCGIFINDEX       = 0x8933; /* name -> if_index mapping */
var SIOCSIFPFLAGS      = 0x8934; /* set/get extended flags set */
var SIOCGIFPFLAGS      = 0x8935; 
var SIOCDIFADDR        = 0x8936; /* delete PA address */
var SIOCSIFHWBROADCAST = 0x8937; /* set hardware broadcast addr */
var SIOCGIFCOUNT       = 0x8938; /* get number of devices */

var sockaddr = struct({
    sa_family : ref.types.uint16,
    sa_data : array(ref.types.char, 14)
});

var sockaddr_in = struct( {
    sin_family : ref.types.short,
    sin_port : ref.types.ushort,
    sin_addr : ref.types.uint,
    sin_zero : array(ref.types.char, 8)
});

// not strictly standard, but it matches how it's packed
var sockaddr_union = union({
    sockaddr : sockaddr,
    sockaddr_in : sockaddr_in
});

var ifmap = struct({
    mem_start : ref.types.long,
    mem_end : ref.types.long,
    base_addr : ref.types.short,
    irq : ref.types.short,
    dma : ref.types.char,
    port : ref.types.char
});

var raw_hdlc_proto = struct({
    encoding : ref.types.short,
    parity : ref.types.short
});

var cisco_proto = struct({
    interval : ref.types.int,
    timeout : ref.types.int
});

var fr_proto = struct({
    t391 : ref.types.uint,
    t392 : ref.types.uint,
    n391 : ref.types.uint,
    n392 : ref.types.uint,
    n393 : ref.types.uint,
    lmi : ref.types.ushort,
    dce: ref.types.ushort
});

var fr_proto_pvc = struct({
    dlci : ref.types.uint
});

var fr_proto_pvc_info = struct({
    dlci : ref.types.uint,
    master : array(ref.types.char, IFNAMSIZ)
});

var sync_serial_settings = struct({
    clock_rate : ref.types.uint,
    clock_type : ref.types.uint,
    loopback : ref.types.ushort
});

var te1_settings = struct({
    clock_rate : ref.types.uint,
    clock_type : ref.types.uint,
    loopback : ref.types.ushort,
    slot_map : ref.types.uint
});

var ifsettings = struct({
    type : ref.types.int,
    size : ref.types.int,
    ifs_ifsu : union({
        raw_hdlc : ref.refType(raw_hdlc_proto),
        cisco : ref.refType(cisco_proto),
        fr : ref.refType(fr_proto),
        fr_pvc : ref.refType(fr_proto_pvc),
        fr_pvc_info : ref.refType(fr_proto_pvc_info),
        sync : ref.refType(sync_serial_settings),
        te1 : ref.refType(te1_settings)
    })
});

var ifrn_name = array(ref.types.char, IFNAMSIZ);

var ifr_ifru = union({
    ifru_addr : sockaddr_union,
    ifru_dstaddr : sockaddr_union,
    ifru_broadaddr : sockaddr_union,
    ifru_netmask : sockaddr_union,
    ifru_hwaddr : sockaddr_union,
    ifru_flags : ref.types.short,
    ifru_ivalue : ref.types.int,
    ifru_mtu : ref.types.int,
    ifru_map : ifmap,
    ifru_slave : array(ref.types.char, IFNAMSIZ),
    ifru_newname : array(ref.types.char, IFNAMSIZ),
    ifru_data : ref.refType(ref.types.void),
    ifru_settings : ifsettings
});

var ifreq = struct({
    ifrn_name : ifrn_name,
    ifr_ifru : ifr_ifru
});

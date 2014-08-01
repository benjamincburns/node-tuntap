// A node module for managing TUN/TAP virtual network interfaces.

var fs = require('fs');
var Duplex = require('stream').Duplex;
var util = require('util');

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
util.inherits(TunTap, Duplex);
function TunTap(options) {
    this._fd = fs.openSync('/dev/net/tun', 'r+');

    var ifr = new ifreq();

    ifr.ifr_ifru.ifru_flags = 0;

    if (options.hasOwnProperty('type')) {
        if (options['type'].toLowerCase == 'tun') {
            ifr.ifr_ifru.ifru_flags |= IFF_TUN;
        } else {
            ifr.ifr_ifru.ifru_flags |= IFF_TAP;
        }
    } else {
        ifr.ifr_ifru.ifru_flags |= IFF_TAP;
    }

    if (options.hasOwnProperty('name')) {
        if (options.name) {
            ifr.ifrn_name.ifrn_name = options.name;
        }
    }

    var ret = ioctl(this._fd, TUNSETIFF, ifr.ref());

    if(ret < 0) {
        this.emit('error', 'Could not open TUN/TAP device due to error: ' + ret);
        this._readStream.destroy();
        this._writeStream.destroy();
        return;
    }

    this.name = ifr.ifr_name;

    if (options.hasOwnProperty('address')) {
        this.SetAddress(options.address);
    }

    if (options.hasOwnProperty('netmask')) {
        this.SetNetmask(options.netmask);
    }

    if (options.hasOwnProperty('gateway')) {
        this.SetGateway(options.gateway);
    }

    if (options.hasOwnProperty('broadcast')) {
        this.SetBroadcast(options.broadcast);
    }

    if (options.hasOwnProperty('mtu')) {
        this.SetMTU(options.mtu);
    }

    if (option.hasOwnProperty('up')) {
        if (option.autoUp === true) {
            this.Up();
        }
    }

    this._readStream = fs.createReadStream('', { fd: this._fd });
    this._writeStream = fs.createWriteStream('', { fd: this._fd });

    this._readStream.on('error', function(err) {
        this.emit('error', err);
    }.bind(this));

    this._readStream.on('data', function(chunk) {
        if (!this.push(chunk)) {
            this._source.readStop();
        }
    }.bind(this));

    this._writeStream.on('error', function(err) {
        this.emit('error', err);
    }.bind(this));

    Duplex.call(this, {
        readable : true,
        writable : true,
        allowHalfOpen: false
    });
}

// ipv4 only for now, sorry kids.
TunTap.prototype.SetAddress = function(addr) {
    var ifr = new ifreq();
    ifr.ifrn_name.ifrn_name = this.name;

    ifr.ifr_ifru.ifru_addr.sockaddr_in.sin_addr = inet_aton(addr);

    var ret = ioctl(this._fd, SIOCSIFADDR, ifr.ref());

    if (ret < 0) {
        this.emit('error', 'error setting address on device ' + this.name +
                ' to ' + addr + ' due to error: ' + err);
    }
}

TunTap.prototype.GetAddress = function() {
    var ifr = new ifreq();
    ifr.ifrn_name.ifrn_name = this.name;

    var ret = ioctl(this._fd, SIOCGIFADDR, ifr.ref());

    if (ret < 0) {
        this.emit('error', 'error reading address on device ' + this.name);
        return null;
    }

    return inet_ntoa(ifr.ifr_ifru.ifru_addr.sockaddr_in.sin_addr);
}

TunTap.prototype.SetNetmask = function(addr) {
    var ifr = new ifreq();
    ifr.ifrn_name.ifrn_name = this.name;

    ifr.ifr_ifru.ifru_netmask.sockaddr_in.sin_addr = inet_aton(addr);

    var ret = ioctl(this._fd, SIOCSIFNETMASK, ifr.ref());

    if (ret < 0) {
        this.emit('error', 'error setting netmask on device ' + this.name +
                ' to ' + addr + ' due to error: ' + err);
    }
}

TunTap.prototype.GetNetmask = function() {
    var ifr = new ifreq();
    ifr.ifrn_name.ifrn_name = this.name;

    var ret = ioctl(this._fd, SIOCGIFNETMASK, ifr.ref());

    if (ret < 0) {
        this.emit('error', 'error reading netmask on device ' + this.name);
        return null;
    }

    return inet_ntoa(ifr.ifr_ifru.ifru_netmask.sockaddr_in.sin_addr);
}

TunTap.prototype.SetGateway = function(addr) {
    var ifr = new ifreq();
    ifr.ifrn_name.ifrn_name = this.name;

    ifr.ifr_ifru.ifru_netmask.sockaddr_in.sin_addr = inet_aton(addr);

    var ret = ioctl(this._fd, SIOCSIFDSTADDR, ifr.ref());

    if (ret < 0) {
        this.emit('error', 'error setting gateway on device ' + this.name +
                ' to ' + addr + ' due to error: ' + err);
    }
}

TunTap.prototype.GetGateway = function() {
    var ifr = new ifreq();
    ifr.ifrn_name.ifrn_name = this.name;

    var ret = ioctl(this._fd, SIOCGIFDSTADDR, ifr.ref());

    if (ret < 0) {
        this.emit('error', 'error reading gateway on device ' + this.name);
        return null;
    }

    return inet_ntoa(ifr.ifr_ifru.ifru_netmask.sockaddr_in.sin_addr);
}

TunTap.prototype.SetBroadcast = function(addr) {
    var ifr = new ifreq();
    ifr.ifrn_name.ifrn_name = this.name;

    ifr.ifr_ifru.ifru_netmask.sockaddr_in.sin_addr = inet_aton(addr);

    var ret = ioctl(this._fd, SIOCSIFBRDADDR, ifr.ref());

    if (ret < 0) {
        this.emit('error', 'error setting broadcast on device ' + this.name +
                ' to ' + addr + ' due to error: ' + err);
    }
}

TunTap.prototype.GetBroadcast = function() {
    var ifr = new ifreq();
    ifr.ifrn_name.ifrn_name = this.name;

    var ret = ioctl(this._fd, SIOCGIFBRDADDR, ifr.ref());

    if (ret < 0) {
        this.emit('error', 'error reading broadcast on device ' + this.name);
        return null;
    }

    return inet_ntoa(ifr.ifr_ifru.ifru_netmask.sockaddr_in.sin_addr);
}

TunTap.prototype.SetMTU = function(mtu) {
    var ifr = new ifreq();
    ifr.ifrn_name.ifrn_name = this.name;

    ifr.ifr_ifru.ifru_mtu = mtu;

    var ret = ioctl(this._fd, SIOCSIFMTU, ifr.ref());

    if (ret < 0) {
        this.emit('error', 'error setting mtu on device ' + this.name +
                ' to ' + addr + ' due to error: ' + err);
    }
}

TunTap.prototype.GetMTU = function() {
    var ifr = new ifreq();
    ifr.ifrn_name.ifrn_name = this.name;

    var ret = ioctl(this._fd, SIOCGIFMTU, ifr.ref());

    if (ret < 0) {
        this.emit('error', 'error reading mtu on device ' + this.name);
        return null;
    }

    return ifr.ifru.ifru_mtu;
}

TunTap.prototype.Up = function() {
    var ifr = new ifreq();
    ifr.ifrn_name.ifrn_name = this.name;

    var ret = ioctl(this._fd, SIOCGIFFLAGS, ifr.ref());
    if (ret < 0) {
        this.emit('error', 'error reading IFFLAGS on device ' + this.name);
    }

    if (ifr.ifr_ifru.ifru_flags & IFF_UP == 0) {
        req.ifr_ifru.ifru_flags |= IFF_UP;
        ret = ioctl(this._fd, SIOCSIFFLAGS, ifr.ref());
        if (ret < 0) {
            this.emit('error', 'error setting IFFLAGS on device ' + this.name);
        }
    }
}

TunTap.prototype.Down = function() {
    var ifr = new ifreq();
    ifr.ifrn_name.ifrn_name = this.name;

    var ret = ioctl(this._fd, SIOCGIFFLAGS, ifr.ref());
    if (ret < 0) {
        this.emit('error', 'error reading IFFLAGS on device ' + this.name);
    }

    if (ifr.ifr_ifru.ifru_flags & IFF_UP != 0) {
        req.ifr_ifru.ifru_flags &= ~IFF_UP;
        ret = ioctl(this._fd, SIOCSIFFLAGS, ifr.ref());
        if (ret < 0) {
            this.emit('error', 'error setting IFFLAGS on device ' + this.name);
        }
    }
}

TunTap.prototype._read = function(highWaterMark) {
    this._readStream.readStart();
}

TunTap.prototype._write = function(chunk, encoding, callback) {
    this._writeStream.write(chunk, encoding, callback);
}

TunTap.prototype.destroy = function () {
    this._readStream.destroy();
    this._writeStream.destroy();
}

TunTap.prototype.close = function(cb) {
    if (cb) {
        this.once('close', cb);
    }

    this._readStream.close(function() {
        this._writeStream.close(function() {
            this.emit('close');
        }.bind(this));
    }.bind(this));
}

module.exports.TunTap = TunTap;

// inet_aton and inet_ntoa shamelessly "stolen" from:
// http://stackoverflow.com/a/21559595/203705
function inet_aton(ip){
    var a = ip.split('.');
    var buffer = new ArrayBuffer(4);
    var dv = new DataView(buffer);
    for(var i = 0; i < 4; i++){
        dv.setUint8(i, a[i]);
    }
    return(dv.getUint32(0));
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

var in_addr = struct({
    s_addr : ref.types.ulong
});

var sockaddr = struct({
    sa_family : ref.types.uint16,
    sa_data : array(ref.types.char, 14)
});

var sockaddr_in = struct( {
    sin_family : ref.types.short,
    sin_port : ref.types.ushort,
    sin_addr : in_addr,
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

var ifreq = struct({
    ifr_ifrn : union({
        ifrn_name : array(ref.types.char, IFNAMSIZ)
    }),
    ifr_ifru : union({
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
    })
});

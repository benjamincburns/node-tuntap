#tuntap

A node module for managing TUN/TAP virtual network interfaces on linux.

```js
TunTap = require('tuntap');

tap = new TunTap({
    type : 'tap',
    address : '10.0.0.1',
    netmask : '255.255.255.0',
    broadcast : '10.0.0.255',
    up : true
}); // extends stream.Duplex

tap.on('data', function(frame) {
    // handle ethernet frame here
});

var frame = getEthernetFrameSomehow();
tap.write(frame);
```

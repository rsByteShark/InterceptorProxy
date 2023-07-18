# InterceptorProxy: a Node.js Proxy module that allows for intercept and analyze of application layer protocols

InterceptorProxy sets up an HTTP proxy server and
provides node js event-like interface for analyze and interception of application layer data protocols such as HTTP/HTTPS and Websocket.

## Table of Contents

- [How does it works](#how-does-it-works)
- [Setting up enviroment](#setting-up-enviroment)
- [Api docs](#api-docs)

## How does it works

InterceptorProxy sets up http proxy server on your machine `localhost`.

Then it awaits for `connection call` wich is an http CONNECT request from `source`.

Source may be any program that has capability of tunneling it's TCP traffic through http proxy and
don't uses inbuild central authority tls certificates that cannot be modified.

When InterceptorProxy recive `connection call` it will create `virtual server` with it's `virtual certificate`
as well as `sink socket (tls socket)` to `target` requested by`source`.

Then it's notify `source` that tunnel is ready by sending http response with code 200.

When `source` starts sending data for `target` this data is sent to `virtual server` instead where is interpreted and forwarded to `target`.

During data interpreting `virtual server` emits informational events that informs about what is happening in curent connection (it is worth noting that for each connection call a new `virtual server` is created wich occupy port on user machine).

While `virtual server` interprets recived data it is possible with use of exposed interfaces to apply so called `filters` for events emitted by `virtual server` for specific connection.

Filters are callback functions that will be executed in order to modify some aspects of connection 'on fly' (for example you can apply filter for HTTPS_REQUEST event,to your callback will be passed headers object that you can modify in order to change headers that will be recived by `target`).

**Note**: This describes encrypted connections. This module is still in development and for now don't hanlde unencrypted HTTP connections and don't support some advanced protocol mechanisms such as http2 stream pull feature or websocket extensions. Due to this conditions many connections may fail and process may crash so it is recommended to always listen for node process 'uncaught exception' event to properly handle unexpected behaviours.

## Setting up enviroment

**Important Note**: Remember to never tunneling important data through InterceptorProxy and don't use you `daily-use` sources such as your personal web browser 
cause this may create some serious security vulnerabilities. It is highly recommended to download separate web browser with it's own certificate storage (for example Firefox Developer Edition) that you will use for testing.

### Firefox browser as a source

When you run for the first time your node script where you creating instance of InterceptorProxy class like this:

```js
const InterceptorProxy = require("./InterceptorProxy");

const proxyInstance = new InterceptorProxy();

const proxyInstanceEventsEmiter = proxyInstance.proxyEventsEmitter;

proxyInstanceEventsEmiter.on("PROXY_SERVER_READY", (proxyPort) => {

    console.log(`InterceptorProxy server ready on port ${proxyPort}`);

})
```

It will create `caCert.pem` and `caCertPrivateKey.pem` files in the same directory as your script.

**Note**: Remember to not delete or move those files as they are required in the same directory as your script to properly handle connections form source.

Now open your firefox browser go to `Settings -> Privacy & Security -> Certificates`.

Click `View Certificates` then in `Authorities` tab `Import`.

Select `caCert.pem` file created by your script then select `trust this CA to identify websites` and click `Ok`.

**Note**: Each time you run script that creates InterceptorProxy class instance in the directory wich does not contain `caCert.pem` and `caCertPrivateKey.pem` files it will create from scratch new central authority certificate for auth of recived connections.

Now your browser will authenticate virtual servers created by InterceptorProxy as target servers wich will allow for flawless intercepting and analyze of connections traffic.

### Chrome browser and system-wide traffic capture

```js
//TODO
```

## Api Docs

See [`/doc/InterceptorProxy.md`](./doc/InterceptorProxy.md) for Node.js-like documentation of InterceptorProxy class and other classes used to describe connections.


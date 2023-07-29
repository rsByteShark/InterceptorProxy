# InterceptorProxy: a Node.js Proxy module that allows for intercept and analyze of application layer protocols

InterceptorProxy sets up an HTTP proxy server and
provides node js event-like interface for analyze and interception of application layer data protocols such as HTTP/HTTPS and Websocket.

## Table of Contents

- [How does it works](#how-does-it-works)
- [Setting up enviroment](#setting-up-enviroment)
- [Example usage](#example-usage)
    - [Loging to console connections types and hosts to wich source is connecting](#loging-to-console-connections-types-and-hosts-to-wich-source-is-connecting)
    - [Gathering http2 connections streams, requests and responses headers into simple database](#gathering-http2-connections-streams-requests-and-responses-headers-into-simple-database)
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

**Note**: This describes encrypted connections. This module is still in development and for now don't handle unencrypted HTTP connections and don't support some advanced protocol mechanisms such as http2 stream pull feature or websocket extensions. Due to this conditions many connections may fail and process may crash so it is recommended to always listen for node process 'uncaught exception' event to properly handle unexpected behaviours.

## Setting up enviroment

**Important Note**: Remember to never tunneling important data through InterceptorProxy and don't use your `daily-use` sources such as your personal web browser 
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

**Note**: Remember to not delete or move those files as they are required in the same directory as your script to properly handle connections from source.

Now open your firefox browser go to `Settings -> Privacy & Security -> Certificates`.

Click `View Certificates` then in `Authorities` tab `Import`.

Select `caCert.pem` file created by your script then select `trust this CA to identify websites` and click `Ok`.

**Note**: Each time you run script that creates InterceptorProxy class instance in the directory wich does not contain `caCert.pem` and `caCertPrivateKey.pem` files it will create from scratch new central authority certificate for auth of recived connections.

Now go to `Settings -> General -> Network Settings`

Click `Settings` select `Manual proxy configuration`.

In `HTTP Proxy` write 127.0.0.1 for port enter port number wich you specified in InterceptorProxy options (defaults to 8000).

Mark `Also use this proxy for HTTPS` then click `OK`.

Now your browser will redirect it's traffic and authenticate virtual servers created by InterceptorProxy as target servers wich will allow for flawless intercepting and analyze of connections.

### Chrome browser and system-wide traffic capture

```js
//TODO
```

## Example Usage

### Loging to console connections types and hosts to wich source is connecting

```js
const InterceptorProxy = require("./InterceptorProxy");

//create instance of InterceptorProxy class to create http proxy server
//select ignore browser telemetry option to see only calls that sites you will analyze will make
//proxy will start listen on port
const proxyInstance = new InterceptorProxy({ ignoreBrowserTelemetry: true });


//make reference to proxyEventEmitter for easier access
const proxyEventsEmitter = proxyInstance.proxyEventsEmitter;


//you can listen for "PROXY_SERVER_READY" event to check if proxy was initialized correctly
proxyEventsEmitter.on("PROXY_SERVER_READY", (port) => {

    //log on wich port http proxy server is listen. (defaults to 8000)
    console.log(`Proxy server is listen on port ${port}`);

})

//here we will store telemetry hosts to wich call was made before for clearer console log.
const detectedTelemetryHosts = [];

//add listener for "PROXY_CONNECTION_REFUSED" event
//when browser will make call to telemetry host connection will be refused and terminated by our proxy server
//blocked hosts are specified in telemetryList.js and are loaded on proxy instance creation.
//you can add your own hosts for wich you want to refuse connection in telemetryList.js file.
proxyEventsEmitter.on("PROXY_CONNECTION_REFUSED", (host) => {

    //filter if browser don't make another call to the same host
    if (!detectedTelemetryHosts.includes(host)) {

        //log unique host for wich connection was refused
        console.log(`Connection to ${host} refused due to browser telemetry list`);

        detectedTelemetryHosts.push(host);
    }

})


//add listener for "PROXY_CONNECTION_REFUSED" event
//when proxy server will establish virtual connection beetween source and target this even is emitted
proxyEventsEmitter.on("H2_PROXY_CONNECTION", (connection) => {

    //log host name to wich browser make http2 connection
    console.log(`H2 Connection to ${connection.destination}`);

})

//the same for https connections
proxyEventsEmitter.on("HTTPS_PROXY_CONNECTION", (connection) => {

    console.log(`Https Connection to ${connection.destination} `);

})

//the same for websocket connection
proxyEventsEmitter.on("WSS_PROXY_CONNECTION", (connection) => {

    console.log(`Websocket connection to ${connection.destination}`);

    console.log(`Websocket path: ${connection.wssPath}`);


})
```

### Gathering http2 connections streams, requests and responses headers into simple database

```js
const InterceptorProxy = require("./InterceptorProxy");

const proxyInstance = new InterceptorProxy({ ignoreBrowserTelemetry: true });

const proxyEventsEmitter = proxyInstance.proxyEventsEmitter;


//let's create provisional database for gathering data about http2 connections
/**@type {ConnectionsDB} */
const connectionsDB = {};

//let's define some types for easier access to our database
/**
 * @typedef {object} Stream
 * @property {array} requestsHeaders
 * @property {array} responsesHeaders
 */

/**@typedef {Object.<string,Stream>} StreamsStash */
/**
 * @typedef {object} Connection
 * @property {string} destination
 * @property {StreamsStash} streams
*/
/**@typedef {Object.<string,Connection} ConnectionsDB */


//add listener for http2 connection
proxyEventsEmitter.on("H2_PROXY_CONNECTION", (connection) => {

    //create reference to http2 connection events emitter for easier access
    const h2EventsEmitter = connection.connectionEventEmitter;

    //create http2 connection entry in provisional db
    connectionsDB[connection.UID] = {};

    //create http2 streams stash for this connection
    connectionsDB[connection.UID].streams = {};

    //put connection destination host into connection entry
    connectionsDB[connection.UID].destination = connection.destination;

    //create streams stash ref for easier access
    const streamsStash = connectionsDB[connection.UID].streams;

    //listen for requests
    h2EventsEmitter.on("H2_REQUEST", (source, headers) => {

        //check if stream already exists
        if (!streamsStash[String(source.sourceID)]) {

            //if new stream is created, create stream entry in stash
            streamsStash[String(source.sourceID)] = {

                requestsHeaders: [headers],

                responsesHeaders: [],

            }

        } else {

            //if stream already exist push headers
            streamsStash[String(source.sourceID)].requestsHeaders.push(headers);

        }




    })

    //listen for responses
    h2EventsEmitter.on("H2_RESPONSE", (source, headers) => {

        //push response headers
        streamsStash[String(source.sourceID)].responsesHeaders.push(headers);

    })

})

//whe proxy server is initialized log comunicate
proxyEventsEmitter.on("PROXY_SERVER_READY", (port) => {

    console.log(`Proxy server started on port ${port}`);


})

const fs = require("fs");
//press ctrl + c to terminate proxy server and save data to file
process.on("SIGINT", () => {

    fs.writeFileSync(`${__dirname}\\gatheredConnectionData.json`, JSON.stringify(connectionsDB));

    process.exit();

})
```

## Api Docs

See [`/doc/InterceptorProxy.md`](./doc/InterceptorProxy.md) for documentation of InterceptorProxy class and other classes used to describe connections.


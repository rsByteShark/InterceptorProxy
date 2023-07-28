# InterceptorProxy

## Table of Contents

- [Class: InterceptorProxy](#class-interceptorproxy)
    - [new InterceptorProxy(options)](#new-interceptorproxyoptions)
    - [interceptorproxy.proxyEventsEmitter](#interceptorproxyproxyeventsemitter)
    - [interceptorproxy.proxyConnectionsStash](#interceptorproxyproxyconnectionsstash)
- [Class: GlobalEventEmitter](#class-globaleventemitter)
    - [Event: 'PROXY_SERVER_READY'](#event-proxy_server_ready)
    - [Event: 'VIRTUAL_SERVER_READY'](#event-virtual_server_ready)
    - [Event: 'H2_PROXY_CONNECTION'](#event-h2_proxy_connection)
    - [Event: 'HTTPS_PROXY_CONNECTION'](#event-https_proxy_connection)
    - [Event: 'WSS_PROXY_CONNECTION'](#event-wss_proxy_connection)
    - [Event: 'PROXY_CONNECTION_REFUSED'](#event-proxy_connection_refused)
    - [Event: 'SOURCE_CONNECTION_END'](#event-source_connection_end)
    - [Event: 'TARGET_CONNECTION_END'](#event-target_connection_end)
- [Class: H2Connection](#class-h2connection)
    - [h2connection.connectionEventEmitter](#h2connectionconnectioneventemitter)
    - [h2connection.UID](#h2connectionuid)
    - [h2connection.destination](#h2connectiondestination)
    - [h2connection.destinationPort](#h2connectiondestinationport)
    - [h2connection.ALPN](#h2connectionalpn)
    - [h2connection.connectionState](#h2connectionconnectionstate)
    - [h2connection.applyFilter(eventName,callback](#h2connectionapplyfiltereventnamecallback)
- [Class: H2ConnectionEventsEmitter](#class-h2connectioneventsemitter)
    - [Event: 'H2_SESSION_CREATED'](#event-h2_session_created)
    - [Event: 'H2_REQUEST'](#event-h2_request)
    - [Event: 'H2_REQUEST_DATA'](#event-h2_request_data)
    - [Event: 'H2_REQUEST_DATA_END'](#event-h2_request_data_end)
    - [Event: 'H2_RESPONSE'](#event-h2_response)
    - [Event: 'H2_RESPONSE_DATA'](#event-h2_response_data)
    - [Event: 'H2_RESPONSE_DATA_END'](#event-h2_response_data_end)
- [Class: WSSConnection](#class-wssconnection)
    - [wssconnection.connectionEventEmitter](#wssconnectionconnectioneventemitter)
    - [wssconnection.UID](#wssconnectionuid)
    - [wssconnection.destination](#wssconnectiondestination)
    - [wssconnection.destinationPort](#wssconnectiondestinationport)
    - [wssconnection.ALPN](#wssconnectionalpn)
    - [wssconnection.wssPath](#wssconnectionwsspath)
    - [wssconnection.applyFilter(eventName,callback)](#wssconnectionapplyfiltereventnamecallback)
- [Class: WSSConnectionEventsEmitter](#class-wssconnectioneventsemitter)
    - [Event: 'WSS_OUTBOUND_DATA'](#event-wss_outbound_data)
    - [Event: 'WSS_INBOUND_DATA'](#event-wss_inbound_data)
- [Class: HTTPSConnection](#class-httpsconnection)
    - [httpsconnection.connectionEventEmitter](#httpsconnectionconnectioneventemitter)
    - [httpsconnection.UID](#httpsconnectionuid)
    - [httpsconnection.destination](#httpsconnectiondestination)
    - [httpsconnection.destinationPort](#httpsconnectiondestinationport)
    - [httpsconnection.ALPN](#httpsconnectionalpn)
    - [httpsconnection.connectionState](#httpsconnectionconnectionstate)
    - [httpsconnection.applyFilter(eventName,callback)](#httpsconnectionapplyfiltereventnamecallback)
- [Class: HTTPSConnectionEventsEmitter](#class-httpsconnectioneventsemitter)
    - [Event: 'HTTPS_REQUEST'](#event-https_request)
    - [Event: 'HTTPS_REQUEST_DATA'](#event-https_request_data)
    - [Event: 'HTTPS_REQUEST_DATA_END'](#event-https_request_data_end)
    - [Event: 'HTTPS_RESPONSE'](#event-https_response)
    - [Event: 'HTTPS_RESPONSE_DATA'](#event-https_response_data)
    - [Event: 'HTTPS_RESPONSE_DATA_END'](#event-https_response_data_end)

## Class: InterceptorProxy

Creating instance of this class initiates http proxy server and creates virtual certificate.

> **Note**: for now creating more then one instance of this class will throw error. In future it will be possible to create multiple proxy servers.

### new InterceptorProxy(options)

- `options` {Object}
    - `ignoreBrowserTelemetry` {boolean} indicates if virtual servers has to refuse connection calls to domains includes in [telemetryList.js](../telemetryList.js) file. (defaults to false) 
    - `proxyPort` {number} indicates on wich localhost port http proxy server will listen for connection calls.

After creation of this class instance use [proxyEventsEmitter](#proxyeventsemitter) property to listen for events of proxy server.

```js
const InterceptorProxy = require("./InterceptorProxy");

const  { proxyEventsEmitter } = new InterceptorProxy({ ignoreBrowserTelemetry: true });

//after creation of InterceptorProxy class instance use proxyEventsEmitter to listen for proxy server events
proxyEventsEmitter.on("PROXY_SERVER_READY", (proxyPort) => {

    console.log(`http proxy server ready on port ${proxyPort}`);

})
```

### interceptorproxy.proxyEventsEmitter

- {[GlobalEventEmitter](#class-globaleventemitter)}

Event emitter that informs about intercepted connections and http proxy server related events.

### interceptorproxy.proxyConnectionsStash

- {ProxyStash}

Object that contains information about managed connections.Access it with connection UID to get connection object.

## Class: GlobalEventEmitter

This class emitts global events that inform about what is happening with proxy server. It extends the `EventEmitter`. 

### Event: 'PROXY_SERVER_READY'

- `port` {number} port on wich http proxy server is listening

Emited when proxy server is ready for reciving connection calls.

### Event: 'VIRTUAL_SERVER_READY'

- `connectionUID` {string} randomly generated connection unique identificator used to differ curently managed connection.

- `creationSucces` {boolean} describes if virtual server was created succesfully.

Emitted when virtual server for incoming source connection is created.

### Event: 'H2_PROXY_CONNECTION'

- `connection` {[H2Connection](#class-h2connection)} object that represents http2 connection

Emited when http2 tunnel is created beetween source and target.

### Event: 'HTTPS_PROXY_CONNECTION'

- `connection` [HTTPSConnection](#class-httpsconnection) object that represents https connection

Emited when https tunnel is created beetween source and target.

### Event: 'WSS_PROXY_CONNECTION'

- `connection` {[WSSConnection](#class-wssconnection)} object that represents websocket connection

Emited when https tunnel transist into websocket.

### Event: 'PROXY_CONNECTION_REFUSED'

- `targetHostName` {string} taget host name of refused connection

Emited when proxy server refuses connection to specific target usually when ignoreBrowserTelemetry option is set to true or some connection filter is used. 

### Event: 'SOURCE_CONNECTION_END'

- `connectionUID` {string} uid of ended connection

Emitted when source indicates end of connection with proxy server

### Event: 'TARGET_CONNECTION_END'

- `connectionUID` {string} uid of ended connection

Emitted when target indicates end of connection with source socket

## Class: H2Connection

Instance of this is passed in callback for "H2_PROXY_CONNECTION" event emited by [GlobalEventEmitter](#class-globaleventemitter) it exposes interfaces for listening on intercepted http2 connection events, applying filters for this connection and contains informations about connection.

### h2connection.connectionEventEmitter

- {[H2ConnectionEventsEmitter](#class-h2connectioneventsemitter)}

instance of EventEmitter class that emits events related with http2 connection

### h2connection.UID

- {string}

unique identificator of this connection

### h2connection.destination

- {string}

target host

### h2connection.destinationPort

- {number}

target port

### h2connection.ALPN

- {string}

application layer protocol of this connection.(in case of this class always "h2")

### h2connection.connectionState

- {"none" | "open" | "closed"}

When both source socket and alpn connection to target are ready it's open. On error or connection ended by source or target it's close. Initialy it's none


### h2connection.applyFilter(eventName,callback)

This function can be used to apply `filters` for events emitted by this class `connectionEventEmitter`. When event specified by `eventName` occure  then `callback` function is executed. Look on signatures of this function below to know what is passed into your callback function for specific event:

```js
    applyFilter(eventName: "H2_REQUEST", callback: (stream: ServerHttp2Stream, headers: IncomingHttpHeaders) => IncomingHttpHeaders): void
```

When applying filter for `H2_REQUEST` you can modify request http2 headers that target of this connection will recive. 

Modify `headers` object passed to your callback and then return it to modify headers. You can also return `null` to don't send any headers wich will cause end of http2 stream from wich those headers came. Note that this needs to be `null` and not `false` or `undefined` wich will cause sending headers without any modification.

`stream` parameter is an reference to http2 stream wich connects source with VirtualServer wich is handling this connection.

```js
    applyFilter(eventName: "H2_REQUEST_DATA", callback: (requestDataSource: ServerHttp2Stream, requestDataSink: ClientHttp2Stream, data: string | Buffer) => string | Buffer): void
```

When applying filter for `H2_REQUEST_DATA` you can modify data that target of this connection will recive. 

String or Buffer that you will return will be passed to target. Be careful as data may by sended in chunks or may be encoded (ussualy gziped). Return `null` to don't send any data. When you gathering data or modification takes some time remember to listen to `H2_REQUEST_DATA_END` event on this class `connectionEventEmitter` and compare passed to this event listener callback parameter `streamID` with `requestDataSource.id` if it's the same that means you should flush your data with `requestDataSink.write(yourModifiedData)` as returning data may cause `WRITE_AFTER_END` error on connection.

`requestDataSource` parameter is an reference to http2 stream wich connects source with VirtualServer wich is handling this connection.

```js
    applyFilter(eventName: "H2_RESPONSE", callback: (stream: ClientHttp2Stream, headers: IncomingHttpHeaders) => IncomingHttpHeaders): void
```

When applying filter for `H2_RESPONSE` you can modify response http2 headers that source of this connection will recive. 

Modify `headers` object passed to your callback and then return it to modify headers. You can also return `null` to don't send any headers wich will cause end of http2 stream from wich those headers came. Note that this needs to be `null` and not `false` or `undefined` wich will cause sending headers without any modification.

`stream` parameter is an reference to http2 stream wich connects to target.

```js
    applyFilter(eventName: "H2_RESPONSE_DATA", callback: (responseDataSource: ClientHttp2Session, responseDataSink: ServerHttp2Stream, data: string | Buffer) => string | Buffer): void
```

When applying filter for `H2_RESPONSE_DATA` you can modify data that source of this connection will recive. 

String or Buffer that you will return will be passed to source. Be careful as data may by sended in chunks or may be encoded (ussualy gziped). Return `null` to don't send any data. When you gathering data or modification takes some time remember to listen to `H2_RESPONSE_DATA_END` event on this class `connectionEventEmitter` and compare passed to this event listener callback parameter `streamID` with `responseDataSource.id` if it's the same that means you should flush your data with `responseDataSink.write(yourModifiedData)` as returning data may cause `WRITE_AFTER_END` error on connection.

## Class: H2ConnectionEventsEmitter

This class emitts connection events that inform about what is happening in http2 connection. It extends the `EventEmitter`. 

### Event: 'H2_SESSION_CREATED'

- `h2SessionObjectRef` {ClientHttp2Session} reference to http2 session to target

This event is emitted when VirtualServer creates http2 session to target.

### Event: 'H2_REQUEST'

- `requestDataSource` {ServerHttp2Stream} reference to http2 stream between source and VirtualServer  

- `headers` {IncomingHttpHeaders} http2 request headers from source

This event is emited when VirtualServer recives http2 stream that indicates http request from source.

### Event: 'H2_REQUEST_DATA'

- `requestDataSource` {ServerHttp2Stream} reference to http2 stream between source and VirtualServer  

- `data` {string | Buffer} data from source for target

This event is emited when http2 source stream recived by VirtualServer instance sends some request data.

### Event: 'H2_REQUEST_DATA_END'

- `streamID` {number} id of a stream that call it's end

This event is emited when source indicates that there will be no more request data

### Event: 'H2_RESPONSE'

- `responseDataSource` {ClientHttp2Stream} reference to http2 stream between VirtualServer and target

- `headers` {IncomingHttpHeaders} http2 response headers from target

This event is emited when VirtualServer recives http2 response on stream to wich ref is in responseDataSource.

### Event: 'H2_RESPONSE_DATA'

- `responseDataSource` {ClientHttp2Session} reference to http2 stream between VirtualServer and target

- `data` {string | Buffer} data from target for source

This event is emited when http2 stream to target created by VirtualServer instance sends some response data

### Event: 'H2_RESPONSE_DATA_END'

- `streamID` {number} id of a stream that call it's end

This event is emited when target indicates that there will be no more response data

## Class: WSSConnection

Instance of this is passed in callback for "WSS_PROXY_CONNECTION" event emited by [GlobalEventEmitter](#class-globaleventemitter) it exposes interfaces for listening on intercepted websocket connection events, applying filters for this connection and contains informations about connection.

### wssconnection.connectionEventEmitter

- {[WSSConnectionEventsEmitter](#class-wssconnectioneventsemitter)}

instance of EventEmitter class that emits events related with websocket connection

### wssconnection.UID

- {string}

unique identificator of this connection

### wssconnection.destination

- {string}

target host

### wssconnection.destinationPort

- {number}

target port

### wssconnection.ALPN

- {string}

application layer protocol of this connection.(in case of this class always "wss")

### wssconnection.wssPath

- {string}

websocket endpoint

### wssconnection.applyFilter(eventName,callback)

This function can be used to apply `filters` for events emitted by this class `connectionEventEmitter`. When event specified by `eventName` occure  then `callback` function is executed. Look on signatures of this function below to know what is passed into your callback function for specific event:

```js
 applyFilter(eventName: "WSS_OUTBOUND_DATA", callback: (dataSource: WebsocketConnection, data: Buffer | string) => Buffer): void
```

When applying filter for `WSS_OUTBOUND_DATA` you can modify data that target of this connection will recive. 

String or Buffer that you will return will be passed to target. Be careful as data may by sended in chunks or may be encoded (ussualy gziped). Return `null` to don't send any data. Note that this needs to be `null` and not `false` or `undefined` wich will cause orginal data to be send.

`dataSource` is an reference to `connection` class from [websocket](https://www.npmjs.com/package/websocket) library.

```js
 applyFilter(eventName: "WSS_INBOUND_DATA", callback: (dataSource: WebsocketConnection, data: Buffer | string) => Buffer): void
```

When applying filter for `WSS_INBOUND_DATA` you can modify data that source of this connection will recive. 

String or Buffer that you will return will be passed to target. Be careful as data may by sended in chunks or may be encoded (ussualy gziped). Return `null` to don't send any data. Note that this needs to be `null` and not `false` or `undefined` wich will cause orginal data to be send.

`dataSource` is an reference to `connection` class from [websocket](https://www.npmjs.com/package/websocket) library.

## Class: WSSConnectionEventsEmitter

This class emitts connection events that inform about what is happening in websocket connection. It extends the `EventEmitter`. 

### Event: 'WSS_OUTBOUND_DATA'

- `dataSource` {connection} reference to `connection` class from [websocket](https://www.npmjs.com/package/websocket) library.

- `data` {Buffer | string} data from source for target

This event is emitted when source sent websocket data for target

### Event: 'WSS_INBOUND_DATA'

- `dataSource` {connection} reference to `connection` class from [websocket](https://www.npmjs.com/package/websocket) library.

- `data` {Buffer | string} data from target for source

This event is emitted when target sent websocket data for source

## Class: HTTPSConnection

Instance of this is passed in callback for "HTTPS_PROXY_CONNECTION" event emited by [GlobalEventEmitter](#class-globaleventemitter) it exposes interfaces for listening on intercepted websocket connection events, applying filters for this connection and contains informations about connection.

### httpsconnection.connectionEventEmitter

- {[HTTPSConnectionEventsEmitter](#class-httpsconnectioneventsemitter)}

instance of EventEmitter class that emits events related with https connection

### httpsconnection.UID

- {string}

unique identificator of this connection

### httpsconnection.destination

- {string}

target host

### httpsconnection.destinationPort

- {number}

target port

### httpsconnection.ALPN

- {string}

application layer protocol of this connection.(in case of this class it's initialy "https" but it can transist into "wss" when https connection is upgraded to websocket)

### httpsconnection.connectionState

- {"none" | "open" | "closed"}

When both source socket and alpn connection to target are ready it's open. On error or connection ended by source or target it's close. Initialy it's none

### httpsconnection.applyFilter(eventName,callback)

This function can be used to apply `filters` for events emitted by this class `connectionEventEmitter`. When event specified by `eventName` occure  then `callback` function is executed. Look on signatures of this function below to know what is passed into your callback function for specific event:

```js
    applyFilter(eventName: "HTTPS_REQUEST", callback: (headers: IncomingHttpHeaders, path: string, requestMethod: string) => ResolvedHttpsRequest): void
```

When applying filter for `HTTPS_REQUEST` you can modify request https headers, path and request method that target of this connection will recive. 

To modify request content make callback function return object in form :

```js
interface ResolvedHttpsRequest {

    //headers that target will recive
    resolvedHeaders: IncomingHttpHeaders

    //http method of this request
    resolvedRequestMethod: string

    //resource path for wich this request calls
    resolvedRequestPath: string
}
```

After filter is applied you must return object in form of `ResolvedHttpsRequest` otherwise entire connection will be terminated.

Ensure that you use exacly this object form with it's property names as it is. Object returned isn't validated in any way and passing worng values may create error on connection or even uncaugth exception on entire program.

```js
    applyFilter(eventName: "HTTPS_REQUEST_DATA", callback: (requestDataSource: IncomingMessage, requestDataSink: ClientRequest, data: Buffer) => Buffer): void
```

When applying filter for `HTTPS_REQUEST_DATA` you can modify data that target of this connection will recive. 

Buffer that you will return from your callback function will be passed to target. Be careful as data may by sended in chunks or may be encoded (ussualy gziped). Return `null` to don't send any data. When you gathering data or modification takes some time remember to listen to `HTTPS_REQUEST_DATA_END` event on this class `connectionEventEmitter`. When this event occure you should flush your data with `requestDataSink.write(yourModifiedData)` as returning data may cause `WRITE_AFTER_END` error on connection.

```js
    applyFilter(eventName: "HTTPS_RESPONSE", callback: (headers: IncomingHttpHeaders, statusCode: number, statusMessage: string) => ResolvedHttpsResponse): void
```

When applying filter for `HTTPS_RESPONSE` you can modify response https headers, status code and status message that source of this connection will recive. 

To modify response content make callback function return object in form :

```js
interface ResolvedHttpsResponse {

    resolvedHeaders: IncomingHttpHeaders

    resolvedStatusCode: number

    resolvedStatusMessage: string

}
```

After filter is applied you must return object in form of `ResolvedHttpsResponse` otherwise entire connection will be terminated.

Ensure that you use exacly this object form with it's property names as it is. Object returned isn't validated in any way and passing worng values may create error on connection or even uncaugth exception on entire program.

```js
    applyFilter(eventName: "HTTPS_RESPONSE_DATA", callback: (responseDataSource: IncomingMessage, responseDataSink: ClientRequest, data: Buffer) => Buffer): void
```

When applying filter for `HTTPS_RESPONSE_DATA` you can modify data that target of this connection will recive. 

Buffer that you will return from your callback function will be passed to target. Be careful as data may by sended in chunks or may be encoded (ussualy gziped). Return `null` to don't send any data. When you gathering data or modification takes some time remember to listen to `HTTPS_RESPONSE_DATA_END` event on this class `connectionEventEmitter`. When this event occure you should flush your data with `responseDataSink.write(yourModifiedData)` as returning data may cause `WRITE_AFTER_END` error on connection.

## Class: HTTPSConnectionEventsEmitter

This class emitts connection events that inform about what is happening in https connection. It extends the `EventEmitter`.

### Event: 'HTTPS_REQUEST'

- `headers` {IncomingHttpHeaders} http request headers

- `path` {string} http request path

- `requestMethod` {string} http request method

This event is emited when VirtualServer recives http request from source.

### Event: 'HTTPS_REQUEST_DATA'

- `requestDataSource` {IncomingMessage} node js IncomingMessage recived from source by VirtualServer

- `data` {Buffer} request data from source

This event is emited when source sent some http request data. 

### Event: 'HTTPS_REQUEST_DATA_END'

This event is emited when source indicates that there will be no more request data, request ends and now connection is waiting for response.

### Event: 'HTTPS_RESPONSE'

- `headers` {IncomingHttpHeaders} http response headers

- `statusCode` {number} http response status code

- `statusMessage` {string} http response status message

This event is emited when http response is recived from target server.

### Event: 'HTTPS_RESPONSE_DATA'

- `responseDataSource` {IncomingMessage} node js IncomingMessage recived from target by VirtualServer

- `data` {Buffer} http response data

This event is emited when target sent some response data.

### Event: 'HTTPS_RESPONSE_DATA_END'

This event is emited when target indicates that there will be no more response data and response has ended.  

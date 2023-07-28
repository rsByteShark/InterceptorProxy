import { Server as serverHTTP, ClientRequest, IncomingMessage } from "http";
import { Http2SecureServer, OutgoingHttpHeaders, IncomingHttpHeaders, ClientHttp2Session, ServerHttp2Stream, } from "http2";
import { Server as serverHTTPS } from "https";
import { Server, Socket } from "net";
import { EventEmitter } from "stream";
import { Server as serverTLS, TLSSocket } from "tls";
import { WebSocketServer, connection as WebsocketConnection } from "websocket";


interface GlobalEventReciver extends EventEmitter {

    //listeners for internal use in GlobalEventManager class
    on(event: string, listener: (...args: any[]) => void): this;

    /**emited when proxy server is ready for reciving connections */
    on(event: "PROXY_SERVER_READY", listener: (port: number) => void): this

    /**emited when virtual server is ready for connection with provided UID */
    on(event: "VIRTUAL_SERVER_READY", listener: (connectionUID: string, creationSucces: boolean) => void): this

    /**emited when http2 tunnel is created beetween source and target */
    on(event: "H2_PROXY_CONNECTION", listener: (connection: H2Connection) => void): this

    /**emited when https tunnel is created beetween source and target */
    on(event: "HTTPS_PROXY_CONNECTION", listener: (connection: HTTPSConnection) => void): this

    /**emited when https tunnel transist into websocket */
    on(event: "WSS_PROXY_CONNECTION", listener: (connection: WSSConnection) => void): this

    /**emited when proxy server refuses connection to specific target usually when ignoreBrowserTelemetry option is set to true or some connection filter is used */
    on(event: "PROXY_CONNECTION_REFUSED", listener: (targetHostName: string) => void): this

    /**emitted when target indicates end of connection with source socket */
    on(event: "TARGET_CONNECTION_END", listener: (connectionUID: string) => void): this

    /**emitted when source indicates end of connection with proxy server */
    on(event: "SOURCE_CONNECTION_END", listener: (connectionUID: string) => void): this

    //by call to emit this emitter 'recives' events from entire program
    //then GlobalEventManager class handles this events and then
    //GlobalEventEmitter emits those events across entire program
    emit(event: string, ...args: any[]): boolean

    /**emited when proxy server is ready for reciving connections */
    emit(event: "PROXY_SERVER_READY", port: number): boolean

    /**emited when virtual server is ready for connection with provided UID */
    emit(event: "VIRTUAL_SERVER_READY", connectionUID: string, creationSucces: boolean): boolean

    /**emited when http2 tunnel is created beetween source and target */
    emit(event: "H2_PROXY_CONNECTION", connection: H2Connection): boolean

    /**emited when https tunnel is created beetween source and target */
    emit(event: "HTTPS_PROXY_CONNECTION", connection: HTTPSConnection): boolean

    /**emited when https tunnel transist into websocket */
    emit(event: "WSS_PROXY_CONNECTION", connection: WSSConnection): boolean

    /**emited when proxy server refuses connection to specific target usually when ignoreBrowserTelemetry option is set to true or some connection filter is used */
    emit(event: "PROXY_CONNECTION_REFUSED", targetHostName: string): boolean

    /**emitted when target indicates end of connection with source socket */
    emit(event: "TARGET_CONNECTION_END", connectionUID: string): boolean

    /**emitted when source indicates end of connection with proxy server */
    emit(event: "SOURCE_CONNECTION_END", connectionUID: string): boolean
}


interface GlobalEventEmitter extends EventEmitter {

    //listeners
    on(event: string, listener: (...args: any[]) => void): this

    /**emited when proxy server is ready for reciving connection calls */
    on(event: "PROXY_SERVER_READY", listener: (port: number) => void): this

    /**emited when virtual server is ready for connection with provided UID */
    on(event: "VIRTUAL_SERVER_READY", listener: (connectionUID: string, creationSucces: boolean) => void): this

    /**emited when http2 tunnel is created beetween source and target */
    on(event: "H2_PROXY_CONNECTION", listener: (connection: H2Connection) => void): this

    /**emited when https tunnel is created beetween source and target */
    on(event: "HTTPS_PROXY_CONNECTION", listener: (connection: HTTPSConnection) => void): this

    /**emited when https tunnel transist into websocket */
    on(event: "WSS_PROXY_CONNECTION", listener: (connection: WSSConnection) => void): this

    /**emited when proxy server refuses connection to specific target usually when ignoreBrowserTelemetry option is set to true or some connection filter is used */
    on(event: "PROXY_CONNECTION_REFUSED", listener: (targetHostName: string) => void): this

    /**emitted when target indicates end of connection with source socket */
    on(event: "TARGET_CONNECTION_END", listener: (connectionUID: string) => void): this

    /**emitted when source indicates end of connection with proxy server */
    on(event: "SOURCE_CONNECTION_END", listener: (connectionUID: string) => void): this

    //emitters for internal use in GlobalEventManager class
    emit(event: string, ...args: any[]): boolean
    emit(event: "PROXY_SERVER_READY", port: number): boolean
    emit(event: "VIRTUAL_SERVER_READY", connectionUID: string, creationSucces: boolean): boolean
    emit(event: "H2_PROXY_CONNECTION", connection: H2Connection): boolean
    emit(event: "HTTPS_PROXY_CONNECTION", connection: HTTPSConnection): boolean
    emit(event: "WSS_PROXY_CONNECTION", connection: WSSConnection): boolean
    emit(event: "PROXY_CONNECTION_REFUSED", targetHostName: string): boolean
    emit(event: "TARGET_CONNECTION_END", connectionUID: string): boolean
    emit(event: "SOURCE_CONNECTION_END", connectionUID: string): boolean

}

interface GlobalEventManager {

    globalEventReciver: GlobalEventReciver

    globalEventEmitter: GlobalEventEmitter
}





//ProxyConnection class interface and related types
interface ProxyConnection {

    connectionEventEmitter: ConnectionEventEmitter

    connectionEventReciver: ConnectionEventReciver

    h2Stash: h2Stash

    UID: string

    /**target host */
    destination: string

    /**target port */
    destinationPort: number

    /**connection ALPN */
    ALPN: string

    /**When both source socket and alpn connection to target are ready it's open.
     * On error or connection ended by source or target it's close.
     * Initialy it's none  */
    connectionState: "none" | "open" | "closed"

    errors: ProxyConnectionErrorObject[]

    filters: ProxyConnectionFilters

    /**websocket endpoint */
    wssPath: string

    applyFilter(eventName: string, callback: (...args: any[]) => any): void

    applyFilter(eventName: "H2_REQUEST", callback: (stream: ServerHttp2Stream, headers: IncomingHttpHeaders) => IncomingHttpHeaders): void

    applyFilter(eventName: "H2_REQUEST_DATA", callback: (requestDataSource: ServerHttp2Stream, requestDataSink: ClientHttp2Stream, data: string | Buffer) => string | Buffer): void

    applyFilter(eventName: "H2_RESPONSE", callback: (stream: ClientHttp2Stream, headers: IncomingHttpHeaders) => IncomingHttpHeaders): void

    applyFilter(eventName: "H2_RESPONSE_DATA", callback: (responseDataSource: ClientHttp2Session, responseDataSink: ServerHttp2Stream, data: string | Buffer) => string | Buffer): void

    applyFilter(eventName: "HTTPS_REQUEST", callback: (headers: IncomingHttpHeaders, path: string, requestMethod: string) => ResolvedHttpsRequest): void

    applyFilter(eventName: "HTTPS_REQUEST_DATA", callback: (requestDataSource: IncomingMessage, requestDataSink: ClientRequest, data: Buffer) => Buffer): void

    applyFilter(eventName: "HTTPS_RESPONSE", callback: (headers: IncomingHttpHeaders, statusCode: number, statusMessage: string) => ResolvedHttpsResponse): void

    applyFilter(eventName: "HTTPS_RESPONSE_DATA", callback: (responseDataSource: IncomingMessage, responseDataSink: ClientRequest, data: Buffer) => Buffer): void

    applyFilter(eventName: "WSS_OUTBOUND_DATA", callback: (dataSource: WebsocketConnection, data: Buffer | string) => Buffer): void

    applyFilter(eventName: "WSS_INBOUND_DATA", callback: (dataSource: WebsocketConnection, data: Buffer | string) => Buffer): void

}

//interface for HTTPS connection
interface HTTPSConnection {

    connectionEventEmitter: HTTPSConnectionEventsEmitter

    UID: string

    /**target host */
    destination: string

    /**target port */
    destinationPort: number

    /**connection ALPN */
    ALPN: string

    /**When both source socket and alpn connection to target are ready it's open.
     * On error or connection ended by source or target it's close.
     * Initialy it's none  */
    connectionState: "none" | "open" | "closed"

    errors: ProxyConnectionErrorObject[]

    filters: HTTPSProxyConnectionFilters

    applyFilter(eventName: "HTTPS_REQUEST", callback: (headers: IncomingHttpHeaders, path: string, requestMethod: string) => ResolvedHttpsRequest): void

    applyFilter(eventName: "HTTPS_REQUEST_DATA", callback: (requestDataSource: IncomingMessage, requestDataSink: ClientRequest, data: Buffer) => Buffer): void

    applyFilter(eventName: "HTTPS_RESPONSE", callback: (headers: IncomingHttpHeaders, statusCode: number, statusMessage: string) => ResolvedHttpsResponse): void

    applyFilter(eventName: "HTTPS_RESPONSE_DATA", callback: (responseDataSource: IncomingMessage, responseDataSink: ClientRequest, data: Buffer) => Buffer): void


}
/**emitts connection related events in HTTPSConnection class */
interface HTTPSConnectionEventsEmitter {

    /**This event is emited when VirtualServer recives http request from source. */
    on(event: "HTTPS_REQUEST", listener: (headers: IncomingHttpHeaders, path: string, requestMethod: string) => void): this

    /**This event is emited when source sent some http request data */
    on(event: "HTTPS_REQUEST_DATA", listener: (requestDataSource: IncomingMessage, data: Buffer) => void): this

    /**This event is emited when source indicates that there will be no more request data */
    on(event: "HTTPS_REQUEST_DATA_END", listener: () => void): this

    /**This event is emited when http response is recived from target server */
    on(event: "HTTPS_RESPONSE", listener: (headers: IncomingHttpHeaders, statusCode: number, statusMessage: string) => void): this

    /**This event is emited when target sent some response data */
    on(event: "HTTPS_RESPONSE_DATA", listener: (responseDataSource: IncomingMessage, data: Buffer) => void): this

    /**This event is emited when target indicates that there will be no more response data */
    on(event: "HTTPS_RESPONSE_DATA_END", listener: () => void): this

}

interface HTTPSProxyConnectionFilters {

    ["HTTPS_REQUEST"]?: Array<(headers: IncomingHttpHeaders, path: string, requestMethod: string) => ResolvedHttpsRequest>
    ["HTTPS_REQUEST_DATA"]?: Array<(requestDataSource: IncomingMessage, requestDataSink: ClientRequest, data: Buffer) => Buffer>
    ["HTTPS_RESPONSE"]?: Array<(headers: IncomingHttpHeaders, statusCode: number, statusMessage: string) => ResolvedHttpsResponse>
    ["HTTPS_RESPONSE_DATA"]?: Array<(responseDataSource: IncomingMessage, responseDataSink: ClientRequest, data: Buffer) => Buffer>

}


//interface for http2 connection
interface H2Connection {

    connectionEventEmitter: H2ConnectionEventsEmitter

    UID: string

    /**target host */
    destination: string

    /**target port */
    destinationPort: number

    /**connection ALPN */
    ALPN: string

    /**When both source socket and alpn connection to target are ready it's open.
     * On error or connection ended by source or target it's close.
     * Initialy it's none  */
    connectionState: "none" | "open" | "closed"

    applyFilter(eventName: "H2_REQUEST", callback: (stream: ServerHttp2Stream, headers: IncomingHttpHeaders) => IncomingHttpHeaders): void

    applyFilter(eventName: "H2_REQUEST_DATA", callback: (requestDataSource: ServerHttp2Stream, requestDataSink: ClientHttp2Stream, data: string | Buffer) => string | Buffer): void

    applyFilter(eventName: "H2_RESPONSE", callback: (stream: ClientHttp2Stream, headers: IncomingHttpHeaders) => IncomingHttpHeaders): void

    applyFilter(eventName: "H2_RESPONSE_DATA", callback: (responseDataSource: ClientHttp2Session, responseDataSink: ServerHttp2Stream, data: string | Buffer) => string | Buffer): void


}

interface H2ConnectionEventsEmitter {

    /**This event is emited when source created http2 session with target */
    on(event: "H2_SESSION_CREATED", listener: (h2SessionObjectRef: ClientHttp2Session) => void): this

    /**This event is emited when VirtualServer recives http2 stream that indicates http request from source.*/
    on(event: "H2_REQUEST", listener: (requestDataSource: ServerHttp2Stream, headers: IncomingHttpHeaders) => void): this

    /**This event is emited when http2 source stream recived by VirtualServer instance sends some request data.*/
    on(event: "H2_REQUEST_DATA", listener: (requestDataSource: ServerHttp2Stream, data: string | Buffer) => void): this

    /**This event is emited when source indicates that there will be no more request data. */
    on(event: "H2_REQUEST_DATA_END", listener: (streamID: number) => void): this

    /**This event is emited when VirtualServer recives http2 response on stream to wich ref is in responseDataSource.*/
    on(event: "H2_RESPONSE", listener: (responseDataSource: ClientHttp2Stream, headers: IncomingHttpHeaders) => void): this

    /**This event is emited when http2 stream to target created by VirtualServer instance sends some response data.*/
    on(event: "H2_RESPONSE_DATA", listener: (responseDataSource: ClientHttp2Session, data: string | Buffer) => void): this

    /**This event is emited when target indicates that there will be no more response data */
    on(event: "H2_RESPONSE_DATA_END", listener: (streamID: number) => void): this

}

interface H2ProxyConnectionFilters {

    ["H2_REQUEST"]?: Array<(dataSourceStream: ServerHttp2Stream, headers: IncomingHttpHeaders) => IncomingHttpHeaders>
    ["H2_REQUEST_DATA"]?: Array<(requestDataSource: ServerHttp2Stream, requestDataSink: ClientHttp2Stream, data: string | Buffer) => string | Buffer>
    ["H2_RESPONSE"]?: Array<(responseDataSource: ClientHttp2Stream, headers: IncomingHttpHeaders) => IncomingHttpHeaders>
    ["H2_RESPONSE_DATA"]?: Array<(responseDataSource: ClientHttp2Session, responseDataSink: ServerHttp2Stream, data: string | Buffer) => string | Buffer>

}

//interface for websocket connection
interface WSSConnection {

    connectionEventEmitter: WSSConnectionEventsEmitter

    UID: string

    /**target host */
    destination: string

    /**target port */
    destinationPort: number

    /**connection ALPN */
    ALPN: string

    /**When both source socket and alpn connection to target are ready it's open.
     * On error or connection ended by source or target it's close.
     * Initialy it's none  */
    connectionState: "none" | "open" | "closed"

    errors: ProxyConnectionErrorObject[]

    filters: WSSProxyConnectionFilters

    /**websocket endpoint */
    wssPath: string

    applyFilter(eventName: "WSS_OUTBOUND_DATA", callback: (dataSource: WebsocketConnection, data: Buffer | string) => Buffer): void

    applyFilter(eventName: "WSS_INBOUND_DATA", callback: (dataSource: WebsocketConnection, data: Buffer | string) => Buffer): void

}

interface WSSConnectionEventsEmitter {

    on(event: "WSS_OUTBOUND_DATA", listener: (dataSource: WebsocketConnection, data: Buffer | string) => void): this

    on(event: "WSS_INBOUND_DATA", listener: (dataSource: WebsocketConnection, data: Buffer | string) => void): this

}

interface WSSProxyConnectionFilters {

    ["WSS_OUTBOUND_DATA"]?: Array<(dataSource: WebsocketConnection, data: Buffer | string) => Buffer | string>
    ["WSS_INBOUND_DATA"]?: Array<(dataSource: WebsocketConnection, data: Buffer | string) => Buffer | string>

}

interface ProxyConnectionFilters {

    ["H2_REQUEST"]?: Array<(dataSourceStream: ServerHttp2Stream, headers: IncomingHttpHeaders) => IncomingHttpHeaders>
    ["H2_REQUEST_DATA"]?: Array<(requestDataSource: ServerHttp2Stream, requestDataSink: ClientHttp2Stream, data: string | Buffer) => string | Buffer>
    ["H2_RESPONSE"]?: Array<(responseDataSource: ClientHttp2Stream, headers: IncomingHttpHeaders) => IncomingHttpHeaders>
    ["H2_RESPONSE_DATA"]?: Array<(responseDataSource: ClientHttp2Session, responseDataSink: ServerHttp2Stream, data: string | Buffer) => string | Buffer>
    ["HTTPS_REQUEST"]?: Array<(headers: IncomingHttpHeaders, path: string, requestMethod: string) => ResolvedHttpsRequest>
    ["HTTPS_REQUEST_DATA"]?: Array<(requestDataSource: IncomingMessage, requestDataSink: ClientRequest, data: Buffer) => Buffer>
    ["HTTPS_RESPONSE"]?: Array<(headers: IncomingHttpHeaders, statusCode: number, statusMessage: string) => ResolvedHttpsResponse>
    ["HTTPS_RESPONSE_DATA"]?: Array<(responseDataSource: IncomingMessage, responseDataSink: ClientRequest, data: Buffer) => Buffer>
    ["WSS_OUTBOUND_DATA"]?: Array<(dataSource: WebsocketConnection, data: Buffer | string) => Buffer | string>
    ["WSS_INBOUND_DATA"]?: Array<(dataSource: WebsocketConnection, data: Buffer | string) => Buffer | string>

}

/**recives connection events from virtual server that manages ProxyConnection instance */
interface ConnectionEventReciver extends EventEmitter {

    //listeners for internal use in ProxyConnection class
    on(event: string, listener: (...args: any[]) => void): this;
    on(event: "H2_SESSION_CREATED", listener: (h2SessionObjectRef: ClientHttp2Session) => void): this
    on(event: "H2_REQUEST", listener: (stream: ServerHttp2Stream, headers: IncomingHttpHeaders) => void): this
    on(event: "H2_REQUEST_DATA", requestDataSource: ServerHttp2Stream, requestDataSink: ClientHttp2Stream, data: string | Buffer): this
    on(event: "H2_REQUEST_DATA_END", listener: (streamID: number) => void): this
    on(event: "H2_RESPONSE", listener: (responseDataSource: ClientHttp2Stream, headers: IncomingHttpHeaders) => void): this
    on(event: "H2_RESPONSE_DATA", listener: (responseDataSource: ClientHttp2Session, responseDataSink: ServerHttp2Stream, data: string | Buffer) => void): this
    on(event: "H2_RESPONSE_DATA_END", listener: (streamID: number) => void): this
    on(event: "HTTPS_REQUEST", listener: (headers: IncomingHttpHeaders, path: string, requestMethod: string) => void): this
    on(event: "HTTPS_REQUEST_DATA", listener: (requestDataSource: IncomingMessage, requestDataSink: ClientRequest, data: Buffer) => void): this
    on(event: "HTTPS_REQUEST_DATA_END", listener: () => void): this
    on(event: "HTTPS_RESPONSE", listener: (headers: IncomingHttpHeaders, statusCode: number, statusMessage: string) => void): this
    on(event: "HTTPS_RESPONSE_DATA", listen: (responseDataSource: IncomingMessage, responseDataSink: ClientRequest, data: Buffer) => void): this
    on(event: "HTTPS_RESPONSE_DATA_END", listener: () => void): this
    on(event: "WSS_OUTBOUND_DATA", listener: (dataSource: WebsocketConnection, data: Buffer | string) => void): this
    on(event: "WSS_INBOUND_DATA", listener: (dataSource: WebsocketConnection, data: Buffer | string) => void): this
    on(event: "CONNECTION_ERROR", listener: (errorInfo: ProxyConnectionErrorObject) => void): this


    /**VirtualServer class makes call to emit function in order to indicate some events that occures in proxy connection. 
    *
    * While emiting some kind of event to ConnectionEventReciver it's returns Promise 
    * that is managed by ProxyConnection class and is responsible for applying filters and transforms that can be defined by user or are predefined by default.
    *
    * Basicly most of this promise resolves to true indicating that VirtualServer class instance should perform some actions by default.
    *
    * If promise resolves to null ProxyConnection class instance tells virtual server that it should discard some actions.
    *
    * In some special cases like for example outgoing http headers promise can resolves with an object that contains new or modified headers content along with
    * some informations about applying it wich should be used instead of original ones by VirtualServer class instance.
    */
    emit(event: string, ...args: any[]): Promise<boolean>

    /**This event is emited when source established http2 session with target.
     * 
    * Promise can resolve to false wich tells VirtualServer that session should be terminated
    */
    emit(event: "H2_SESSION_CREATED", h2SessionObjectRef: ClientHttp2Session): Promise<boolean>

    /**This event is emited when VirtualServer recives http2 stream that indicates http request from source.
     * 
     * Promise resolves to headers that should be forwarded to target by VirtualServer.
     * 
     * Also when promise resolves to null stream on wich request coming is terminated.
     */
    emit(event: "H2_REQUEST", requestDataSource: ServerHttp2Stream, headers: IncomingHttpHeaders): Promise<IncomingHttpHeaders>

    /**This event is emited when http2 source stream recived by VirtualServer instance sends some request data.
     * 
     * Promise resolves to Buffer of data that will be sent to target by VirtualServer
     * 
     * Also when this promise return null then any data isn't sent.This can be used when handling chunked data.
     * 
     * If no more data will came for this request and you still don't return gathered data use requestDataSink to flush gathered data. (requestDataSink.write(data))
    */
    emit(event: "H2_REQUEST_DATA", requestDataSource: ServerHttp2Stream, requestDataSink: ClientHttp2Stream, data: string | Buffer): Promise<Buffer>


    /**This event is emited when source indicates that there will be no more request data 
    * 
    * This event is pure informational listen for it if you gathering data from H2_REQUEST_DATA event
    * to know when to flush gathered data.
   */
    emit(event: "H2_REQUEST_DATA_END", streamID: number): void


    /**This event is emited when VirtualServer recives http2 response on stream to wich ref is in responseDataSource.
    * 
    * Promise resolves to headers that should be forwarded to source by VirtualServer
    */
    emit(event: "H2_RESPONSE", responseDataSource: ClientHttp2Stream, headers: IncomingHttpHeaders): Promise<IncomingHttpHeaders>

    /**This event is emited when http2 stream to target created by VirtualServer instance sends some response data .
    * 
    * Promise resolves to Buffer of data that will be sent to source by VirtualServer
    * 
    * Also when this promise return null then any data isn't sent.This can be used when handling chunked data.
    * 
    * If no more data will came for this response and you still don't return gathered data use responseTargetSink to flush gathered data. (responseTargetSink.write(data))
    */
    emit(event: "H2_RESPONSE_DATA", responseDataSource: ClientHttp2Session, data: string | Buffer): Promise<Buffer>


    /**This event is emited when target indicates that there will be no more response data 
     * 
     * This event is pure informational listen for it if you gathering data from H2_RESPONSE_DATA event
     * to know when to flush gathered data.
    */
    emit(event: "H2_RESPONSE_DATA_END", streamID: number): void


    /**This event is emited when VirtualServer recives http request from source.
    * 
    * Promise resolves to object that contains headers and http method that should be forwarded to target by VirtualServer.
    * 
    * Also when promise resolves to null request is terminated as well as source connection that was used to sent it.
    */
    emit(event: "HTTPS_REQUEST", headers: IncomingHttpHeaders, path: string, requestMethod: string): Promise<ResolvedHttpsRequest>

    /**This event is emited when source sent some request data
     * 
     * Promise resolves to Buffer of data that will be sent to target or to null that tells VirtualServer to not send any data
     * 
     * If you want to gather recived data (for example in case of chunked transfer) then remember to handle HTTPS_REQUEST_DATA_END event
     * that will tell you when source indicates end of request data.To flush gathered data to target use "requestDataSink.write(data)".
     * 
     * Also remember that many target servers may look on Content-Length header to indicate when end of request data occures.
     * In that case remember to apply filter for HTTPS_REQUEST and change Content-Length header to new data length. 
     */
    emit(event: "HTTPS_REQUEST_DATA", requestDataSource: IncomingMessage, requestDataSink: ClientRequest, data: Buffer): Promise<Buffer>

    /**This event is emited when source indicates that there will be no more request data 
     * 
     * This event is pure informational listen for it if you gathering data from HTTPS_REQUEST_DATA event
     * to know when to flush gathered data.
    */
    emit(event: "HTTPS_REQUEST_DATA_END"): void

    /**This event is recived when http response is recived from target server.
     * 
     * Promise resolves to object that contains headers,status code and status message that will be forwarded to source
     * 
     * If promise returns null then response will be not redirected to source and both connections to source and target will be terminated
     */
    emit(event: "HTTPS_RESPONSE", headers: IncomingHttpHeaders, statusCode: number, statusMessage: string): Promise<ResolvedHttpsResponse>


    /**This event is emited when target sent some response data
     * 
     * Promise resolves to Buffer of data that will be sent to source or to null that tells VirtualServer to not send any data
     * 
     * If you want to gather recived data (for example in case of chunked transfer) then remember to handle HTTPS_RESPONSE_DATA_END event
     * that will tell you when target indicates end of request data.To flush gathered data to source use "responseDataSink.write(data)".
     */
    emit(event: "HTTPS_RESPONSE_DATA", responseDataSource: IncomingMessage, responseDataSink: ClientRequest, data: Buffer): Promise<Buffer>

    /**This event is emited when target indicates that there will be no more response data 
       * 
       * This event is pure informational listen for it if you gathering data from HTTPS_RESPONSE_DATA event
       * to know when to flush gathered data.
      */
    emit(event: "HTTPS_RESPONSE_DATA_END"): void

    /**This event is emitted when source sent websocket data for target
     * 
     * Promise resolves to Buffer or string of data that will be sent to target or to null that tells VirtualServer to not send any data
     */
    emit(event: "WSS_OUTBOUND_DATA", dataSource: WebsocketConnection, data: Buffer | string): Promise<Buffer | string>

    /**This event is emitted when target sent websocket data for source
     * 
     * Promise resolves to Buffer or string of data that will be sent to source or to null that tells VirtualServer to not send any data
     */
    emit(event: "WSS_INBOUND_DATA", dataSource: WebsocketConnection, data: Buffer | string): Promise<Buffer | string>

    /**When this event is called connection occured some error and was terminated.
     * 
     * Multiple errors can be emitted but after the first error connection is already terminated.
     * 
     * Handle futher error events for more information about error.
     * 
     * Promise resolves only to true.
     */
    emit(event: "CONNECTION_ERROR", errorInfo: ProxyConnectionErrorObject): Promise<true>

}

/**emitts connection related events in ProxyConnection class */
interface ConnectionEventEmitter extends EventEmitter {

    //listeners
    on(event: string, listener: (...args: any[]) => void): this

    /**This event is emited when source created http2 session with target */
    on(event: "H2_SESSION_CREATED", listener: (h2SessionObjectRef: ClientHttp2Session) => void): this

    /**This event is emited when VirtualServer recives http2 stream that indicates http request from source.*/
    on(event: "H2_REQUEST", listener: (requestDataSource: ServerHttp2Stream, headers: IncomingHttpHeaders) => void): this

    /**This event is emited when http2 source stream recived by VirtualServer instance sends some request data.*/
    on(event: "H2_REQUEST_DATA", listener: (requestDataSource: ServerHttp2Stream, data: string | Buffer) => void): this

    /**This event is emited when source indicates that there will be no more request data */
    on(event: "H2_REQUEST_DATA_END", listener: (streamID: number) => void): this

    /**This event is emited when VirtualServer recives http2 response on stream to wich ref is in responseDataSource.*/
    on(event: "H2_RESPONSE", listener: (responseDataSource: ClientHttp2Stream, headers: IncomingHttpHeaders) => void): this

    /**This event is emited when http2 stream to target created by VirtualServer instance sends some response data.*/
    on(event: "H2_RESPONSE_DATA", listener: (responseDataSource: ClientHttp2Session, data: string | Buffer) => void): this

    /**This event is emited when target indicates that there will be no more response data */
    on(event: "H2_RESPONSE_DATA_END", listener: (streamID: number) => void): this

    /**This event is emited when VirtualServer recives http request from source. */
    on(event: "HTTPS_REQUEST", listener: (headers: IncomingHttpHeaders, path: string, requestMethod: string) => void): this

    /**This event is emited when source sent some http request data */
    on(event: "HTTPS_REQUEST_DATA", listener: (requestDataSource: IncomingMessage, data: Buffer) => void): this

    /**This event is emited when source indicates that there will be no more request data */
    on(event: "HTTPS_REQUEST_DATA_END", listener: () => void): this

    /**This event is recived when http response is recived from target server */
    on(event: "HTTPS_RESPONSE", listener: (headers: IncomingHttpHeaders, statusCode: number, statusMessage: string) => void): this

    /**This event is emited when target sent some response data */
    on(event: "HTTPS_RESPONSE_DATA", listener: (responseDataSource: IncomingMessage, data: Buffer) => void): this

    /**This event is emited when target indicates that there will be no more response data */
    on(event: "HTTPS_RESPONSE_DATA_END", listener: () => void): this

    on(event: "WSS_OUTBOUND_DATA", listener: (dataSource: WebsocketConnection, data: Buffer | string) => void): this

    on(event: "WSS_INBOUND_DATA", listener: (dataSource: WebsocketConnection, data: Buffer | string) => void): this

    /**When this event is called connection occured some error and was terminated.
     * Multiple errors can be emitted but after the first connection is already terminated.
     * Handle futher error events for more information about error.
     * Promise resolves only to true.
     */
    on(event: "CONNECTION_ERROR", listener: (errorInfo: ProxyConnectionErrorObject) => void): this


    //emitters for internal use in ProxyConnection class
    emit(event: string, ...args: any[]): boolean
    emit(event: "H2_SESSION_CREATED", h2SessionObjectRef: ClientHttp2Session): boolean
    emit(event: "H2_REQUEST", requestDataSource: ServerHttp2Stream, headers: IncomingHttpHeaders): boolean
    emit(event: "H2_REQUEST_DATA", requestDataSource: ServerHttp2Stream, data: string | Buffer): boolean
    emit(event: "H2_REQUEST_DATA_END", streamID: number): boolean
    emit(event: "H2_RESPONSE", responseDataSource: ClientHttp2Stream, headers: IncomingHttpHeaders): boolean
    emit(event: "H2_RESPONSE_DATA", responseDataSource: ClientHttp2Session, data: string | Buffer): boolean
    emit(event: "H2_RESPONSE_DATA_END", streamID: number): boolean
    emit(event: "HTTPS_REQUEST", headers: IncomingHttpHeaders, path: string, requestMethod: string): boolean
    emit(event: "HTTPS_REQUEST_DATA", requestDataSource: IncomingMessage, data: Buffer): boolean
    emit(event: "HTTPS_REQUEST_DATA_END"): boolean
    emit(event: "HTTPS_RESPONSE", headers: IncomingHttpHeaders, statusCode: number, statusMessage: string): boolean
    emit(event: "HTTPS_RESPONSE_DATA", responseDataSource: IncomingMessage, responseDataSink: ClientRequest, data: Buffer): boolean
    emit(event: "HTTPS_RESPONSE_DATA_END"): boolean
    emit(event: "WSS_OUTBOUND_DATA", dataSource: WebsocketConnection, data: Buffer | string): boolean
    emit(event: "WSS_INBOUND_DATA", dataSource: WebsocketConnection, data: Buffer | string): Promise<Buffer | string>
    emit(event: "CONNECTION_ERROR", errorInfo: ProxyConnectionErrorObject): boolean

}

interface ProxyStash {

    [key: string]: ProxyConnection

}


type ProxyConnectionError = "H2_SESSION_ERROR" | "H2_FRAME_ERROR" | "TLS_SOCKET_ERROR"

interface ProxyConnectionErrorObject {

    code: ProxyConnectionError,

    message: string,
}




interface h2Stash {

    h2Streams: h2StreamsStorage

}

interface h2StreamsStorage {

    [streamID: string]: h2Stream

}

interface h2Stream {

    streamID: string

    h2requests: h2Request[]

    h2responses: h2Response[]

}

interface h2Response {

    responseDataEmitter: h2DataTransmisionManagmentEmitter

    headers: IncomingHttpHeaders

    gatheredData: Buffer
}

interface h2Request {

    requestDataEmitter: h2DataTransmisionManagmentEmitter

    headers: OutgoingHttpHeaders

    gatheredData: Buffer

}






interface VirtualServer {

    server: serverHTTP | serverHTTPS | serverTLS | Http2SecureServer

    websocketOverlay: WebSocketServer

    type: "tls" | "http" | "https" | "h2"

    port: number

    creationSucces: boolean

    globalEventReciver: GlobalEventReciver

    globalEventEmitter: GlobalEventEmitter

    connectionUID: string

    sink: TLSSocket | Socket

    sinkALPN: string

    proxyStash: ProxyStash

}

interface VirtualServerOptions {

    /**UID of connection this server needs to interpret*/
    connectionUID: string

    /**ref to all connections objects (acces it with UID for info about connection )*/
    proxyStash: ProxyStash

    /**as who this server needs to figure out */
    destinationHostName: string;

    /**optional ca certificate to use defaults to ./caCert.pem in curent directory */
    caCertToUse?: string;

    /**socket connected through tls or tcp to target */
    sink: TLSSocket | Socket

    /**ALPN of sink socket */
    sinkALPN: string
}

interface VirtualClient {

    ALPN: string

    proxyStash: ProxyStash

    connectionUID: string

}

interface VirtualClientOptions {

    /**UID of connection this client needs to interpret*/
    connectionUID: string

    /**ref to all connections objects (acces it with UID for info about connection )*/
    proxyStash: ProxyStash

}


interface ProxyServer {

    server: Server

    connections: ProxyStash

    globalEventReciver: GlobalEventReciver

    globalEventEmitter: GlobalEventEmitter

}

interface ProxyServerOptions {

    ignoreBrowserTelemetry: boolean

    proxyPort: number
}


interface ResolvedHttpsRequest {

    resolvedHeaders: IncomingHttpHeaders

    resolvedRequestMethod: string

    resolvedRequestPath: string
}

interface ResolvedHttpsResponse {

    resolvedHeaders: IncomingHttpHeaders

    resolvedStatusCode: number

    resolvedStatusMessage: string

}
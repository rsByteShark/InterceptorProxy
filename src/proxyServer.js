const net = require("net");
const tls = require("tls");
const forge = require('node-forge');
const { HTTPObject } = require("../utils/InterceptorHTTP.js");
const { VirtualServer } = require("./virtualServer.js");
const { ProxyConnection } = require("./proxyConnection.js");
const telemetryList = require("../telemetryList.js");

class ProxyServer {

    /**@type {net.Server} */
    server;

    /**@type {import("../typings/index.js").ProxyStash} */
    connections = {};

    /**@type {import("../typings/index.js").GlobalEventReciver} */
    globalEventReciver;

    /**@type {import("../typings/index.js").GlobalEventEmitter} */
    globalEventEmitter;

    /**@type {boolean} */
    ignoreBrowserTelemetry;

    /**@type {string[]} */
    telemetryHostsArr = [];

    /**
     * @param {import("../typings/index.js").ProxyServerOptions} proxyServerOptions 
     */
    constructor(proxyServerOptions) {

        this.ignoreBrowserTelemetry = proxyServerOptions?.ignoreBrowserTelemetry || false;

        if (this.ignoreBrowserTelemetry) {

            this.telemetryHostsArr = telemetryList;


        }

        this.globalEventReciver = process.globalEventReciver;

        this.globalEventEmitter = process.globalEventEmitter;

        this.server = net.createServer(this.sourceConnectionListener.bind(this)).listen(proxyServerOptions?.proxyPort || 8000, () => {

            this.globalEventReciver.emit("PROXY_SERVER_READY", this.server.address().port);

        })

    }

    /**
     * here we awaits for http proxy request
     * then when we identify it we're starting chaining data through multiple virtual servers to interpret it 
     * @param {net.Socket} socket 
     */
    sourceConnectionListener(socket) {

        //tcp connection with source established create Connection object in connections stash

        //generate UID for connection
        let connectionUID = forge.util.bytesToHex(forge.random.getBytesSync(4));

        while (connectionUID in this.connections) {

            connectionUID = forge.util.bytesToHex(forge.random.getBytesSync(4));

        }

        socket.UID = connectionUID;

        /**@type {net.Socket | tls.TLSSocket} */
        let socketToTargetRef;
        let socketToVirtualServerRef;
        socket.on("data", (data) => {

            if (!socket.proxyConnected) {

                const request = new HTTPObject(data);
                //detect TLS
                if (request.method === "CONNECT") {

                    const destination = HTTPObject.getPortAndHost(request.headers["Host"]);


                    if (this.ignoreBrowserTelemetry && this.telemetryHostsArr.includes(destination.host)) {

                        ProxyServer.closeSocketSafe(socket);

                        this.globalEventEmitter.emit("PROXY_CONNECTION_REFUSED", destination.host)

                        // console.log(`connection to ${destination.host} refused (ignoring browser telemetry calls)`);

                        return

                    }

                    this.connections[socket.UID] = new ProxyConnection(socket.UID);

                    //create tls connection to target
                    const sinkSocket = tls.connect({
                        host: destination.host,
                        port: destination.port || 443, ALPNProtocols: ["h2", "http/1.1"],
                        servername: destination.host,
                        rejectUnauthorized: false,
                        ciphers: ProxyServer.shuffleCiphers(ProxyServer.tlsCiphers),
                    }, () => {

                        socketToTargetRef = sinkSocket;

                        //connected

                        const sinkALPN = sinkSocket.alpnProtocol || "http/1.1";

                        if (!sinkALPN || !destination.host) {

                            console.log('weird behavior in ALPN and destination');

                        }

                        this.connections[socket.UID].ALPN = sinkALPN;

                        this.connections[socket.UID].destination = destination.host;

                        this.connections[socket.UID].destinationPort = destination.port || 443;

                        const virtualServerType = sinkALPN === "h2" ? "h2" : "https";



                        //create virtual tls server
                        const virtualTLSServer = new VirtualServer(virtualServerType, {
                            connectionUID: socket.UID,
                            proxyStash: this.connections,
                            destinationHostName: destination.host,
                            sink: sinkSocket,
                            sinkALPN,
                        })


                        const serverReadyEventCallback = (UID, creationSucces) => {

                            if (UID === socket.UID && creationSucces) {

                                if (this.connections[UID].ALPN === "h2") this.globalEventReciver.emit("H2_PROXY_CONNECTION", this.connections[UID]);
                                else if (this.connections[UID].ALPN === "http/1.1") this.globalEventReciver.emit("HTTPS_PROXY_CONNECTION", this.connections[UID]);


                                this.globalEventEmitter.removeListener("VIRTUAL_SERVER_READY", serverReadyEventCallback);


                                const socketToVirtualServer = net.createConnection({ port: virtualTLSServer.port }, () => {

                                    socketToVirtualServerRef = socketToVirtualServer;

                                    socket.on("data", (data) => {

                                        socketToVirtualServer.write(data);

                                    })

                                    socketToVirtualServer.on("data", (data) => {

                                        socket.write(data);

                                    })

                                    socket.proxyConnected = true;

                                    socket.write("HTTP/1.1 200 OK\r\n\r\n")
                                })

                            } else if (UID === connectionUID && !creationSucces) {

                                this.globalEventEmitter.removeListener("VIRTUAL_SERVER_READY", serverReadyEventCallback);

                                socket.end();

                            }

                        }

                        //wait for when virtual server is ready and then create pipe connection with tls server
                        this.globalEventEmitter.on("VIRTUAL_SERVER_READY", serverReadyEventCallback);


                        const connectionEndEventCallback = (UID) => {

                            if (UID === connectionUID) {
                                ProxyServer.closeSocketSafe(socket);

                                ProxyServer.closeSocketSafe(socketToTargetRef);

                                ProxyServer.closeSocketSafe(socketToVirtualServerRef);

                                this.globalEventEmitter.removeListener("TARGET_CONNECTION_END", connectionEndEventCallback)
                            }

                        }

                        //watch for an event that indicates that target ends connection with source socket
                        this.globalEventEmitter.on("TARGET_CONNECTION_END", connectionEndEventCallback);

                    });

                    sinkSocket.on("error", (error) => {

                        console.log(`error while connecting to requested host: ${destination.host} \r\n ${error}`);

                        this.globalEventEmitter.emit("TARGET_CONNECTION_END", connectionUID);

                        /**@type {import("../typings").ProxyConnectionErrorObject} */
                        const errObject = {

                            code: "TLS_SOCKET_ERROR",

                            message: error.message,

                        }

                        this.connections[socket.UID].connectionEventReciver.emit("CONNECTION_ERROR", errObject);

                    })


                } else if (request.isHttp) {

                    //forward http request

                    socket.removeAllListeners();

                    ProxyServer.closeSocketSafe(socket);

                } else {

                    //terminate connection when recive garbage

                    socket.removeAllListeners();

                    ProxyServer.closeSocketSafe(socket);

                }

            }

        })

        socket.on("error", (error) => {



            this.globalEventEmitter.emit("SOURCE_CONNECTION_END", socket.UID)


            ProxyServer.closeSocketSafe(socketToTargetRef);

            ProxyServer.closeSocketSafe(socketToVirtualServerRef);

        });


        socket.on("close", (hadErr) => {


            this.globalEventEmitter.emit("SOURCE_CONNECTION_END", socket.UID)

            ProxyServer.closeSocketSafe(socketToVirtualServerRef);

            ProxyServer.closeSocketSafe(socketToTargetRef);


        })

    }


    static closeSocketSafe(socketRef) {

        if (socketRef) {

            if (socketRef?.encrypted) {

                if (socketRef.connecting) {

                    socketRef.removeAllListeners();

                    socketRef.on("secureConnect", () => {

                        socketRef.end(() => {

                            socketRef.destroy();

                        })

                    })


                } else {

                    socketRef.removeAllListeners();

                    socketRef.end(() => {

                        socketRef.destroy();

                    })

                }

            } else {

                if (socketRef?.connecting) {

                    socketRef.removeAllListeners();

                    socketRef.on("connect", () => {

                        socketRef.end(() => {

                            socketRef.destroy();

                        })

                    })

                } else {

                    socketRef.removeAllListeners();

                    socketRef.end(() => {

                        socketRef.destroy();

                    })

                }

            }

        }

    }

    //shuffle tls ciphers to prevent TLS fingerprinting
    static shuffleCiphers(ciphers) {

        /**
         * firefox order:
         * 'TLS_AES_128_GCM_SHA256'
         * 'TLS_CHACHA20_POLY1305_SHA256'
         * 'TLS_AES_256_GCM_SHA384'
         */
        const shuffledCiphers = [
            ciphers[2],
            ciphers[1],
            ciphers[0],
            ...ciphers.slice(3)
        ].join(':');



        return shuffledCiphers

    }


    static tlsCiphers = tls.DEFAULT_CIPHERS.split(':');

}


module.exports.ProxyServer = ProxyServer;
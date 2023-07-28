const WebSocketServer = require('websocket').server;
const WebSocketClient = require('websocket').client;
const http = require("http");
const https = require("https");
const net = require("net");
const tls = require("tls");
const fs = require("fs");
const h2 = require("http2");
const { createTempCertificate } = require("../utils/InterceptorCertificate.js")

class VirtualServer {

    /**@type {http.Server | https.Server | tls.Server | h2.Http2SecureServer} */
    server;

    /**@type {WebSocketServer} */
    websocketOverlay;

    /**@type {"tls" | "http" | "https" | "h2"} */
    type;

    /**@type {number} */
    port;

    /**@type {boolean} */
    creationSucces = true;

    /**@type {import("../typings/index.js").GlobalEventReciver} */
    globalEventReciver;

    /**@type {import("../typings/index.js").GlobalEventEmitter} */
    globalEventEmitter;

    /**@type {string} */
    connectionUID;

    /**@type {tls.TLSSocket | net.Socket} */
    sink;

    /**@type {string} */
    sinkALPN;

    /**@type {import("../typings/index.js").ProxyStash } */
    proxyStash;

    /**
     * @param {"tls" | "http" | "https" | "h2"} serverType 
     * @param {import("../typings/index.js").VirtualServerOptions} optionsAndRefs
     */
    constructor(serverType, optionsAndRefs) {

        this.type = serverType;

        this.proxyStash = optionsAndRefs.proxyStash;

        this.connectionUID = optionsAndRefs.connectionUID;

        this.globalEventReciver = process.globalEventReciver;

        this.globalEventEmitter = process.globalEventEmitter;

        this.sink = optionsAndRefs.sink;

        this.sinkALPN = optionsAndRefs.sinkALPN;


        switch (this.type) {
            case "tls":

                this.createTlsContext(optionsAndRefs);

                break;
            case "http":
                break;
            case "https":

                this.createHttpsContext(optionsAndRefs);

                break;
            case "h2":

                this.createh2Context(optionsAndRefs);

                break;

            default:
                break;
        }

    }

    /**
     * @param {import("../typings/index.js").VirtualServerOptions} optionsAndRefs 
     */
    createh2Context(optionsAndRefs) {

        //generate fake cert
        const caCert = fs.readFileSync("./caCert.pem");

        const caCertPrivateKey = fs.readFileSync("./caCertPrivateKey.pem");

        const tempCertObject = createTempCertificate(optionsAndRefs.destinationHostName, caCert, caCertPrivateKey);

        /**@type {h2.SecureServerOptions} */
        const options = {

            key: tempCertObject.tempCertPrivateKey,

            cert: tempCertObject.tempCert,

        };


        this.server = h2.createSecureServer(options)

        /**@type {h2.Http2SecureServer} */
        const typedServer = this.server;

        let sesionStarted = 0;

        typedServer.on("session", (sessionFromSource) => {

            if (sesionStarted) console.log('Second session for single connection');

            sesionStarted = 1;

            /**@type {import("http2").ClientHttp2Session} */
            let h2SessionToTarget = null;

            const sourceConEndListener = (conUID) => {

                if (this.connectionUID === conUID) {

                    h2SessionToTarget.removeAllListeners();

                    h2SessionToTarget.close();

                    h2SessionToTarget.destroy();

                    this.globalEventEmitter.removeListener("SOURCE_CONNECTION_END", sourceConEndListener);
                }

            }

            this.globalEventEmitter.on("SOURCE_CONNECTION_END", sourceConEndListener);

            //create connection(session) to target with settings recived from source
            sessionFromSource.on("remoteSettings", (sourceSettings) => {

                if (!h2SessionToTarget) {

                    h2SessionToTarget = h2.connect(`https://${optionsAndRefs.destinationHostName}`, { settings: sourceSettings, createConnection: () => this.sink }, () => {

                        // this.proxyStash[this.connectionUID].connectionEventReciver.emit("H2_SESSION_CREATED", h2SessionToTarget).then((resolveResult) => {

                        //     // if (resolveResult) {

                        //     //     // console.log(`interpreter server bound for ${this.proxyStash[this.connectionUID].destination}`);

                        //     //     this.globalEventEmitter.emit("VIRTUAL_SERVER_READY", this.connectionUID, this.creationSucces);

                        //     // } else {

                        //     //     h2SessionToTarget.close();

                        //     //     this.creationSucces = false;

                        //     //     this.globalEventEmitter.emit("VIRTUAL_SERVER_READY", this.connectionUID, this.creationSucces);

                        //     // }


                        // })

                    });

                    h2SessionToTarget.on("remoteSettings", (targetSettings) => {

                        const ss = sourceSettings;

                        const newSettings = {};

                        for (let key in ss) {

                            if (ss[key] !== targetSettings[key]) newSettings[key] = targetSettings[key];

                        }

                        if (Object.keys(newSettings).length) sessionFromSource.settings(targetSettings);



                    })


                    h2SessionToTarget.on("altsvc", (alt, origin, streamID) => {


                        console.log(`Altsvc handling is needed for connection to ${this.proxyStash[this.connectionUID].destination}.Terminating connection ...`);


                        h2SessionToTarget.close(() => {

                            h2SessionToTarget.destroy();

                        });


                        sessionFromSource.close(() => {

                            sessionFromSource.destroy();

                        })

                        this.globalEventEmitter.emit("TARGET_CONNECTION_END", this.connectionUID);

                    })

                    h2SessionToTarget.on("origin", (origins) => {

                        console.log(`Origin handling is needed for connection to ${this.proxyStash[this.connectionUID].destination}.Terminating connection ...`);

                        h2SessionToTarget.close(() => {

                            h2SessionToTarget.destroy();

                        });


                        sessionFromSource.close(() => {

                            sessionFromSource.destroy();

                        })


                        this.globalEventEmitter.emit("TARGET_CONNECTION_END", this.connectionUID);

                    })

                    h2SessionToTarget.on("error", (err) => {

                        h2SessionToTarget.close(() => {

                            h2SessionToTarget.destroy();

                        });

                        sessionFromSource.close(() => {

                            sessionFromSource.destroy();

                        })

                        /**@type {import("../typings/index.js").ProxyConnectionErrorObject} */
                        const errObject = {

                            code: "H2_SESSION_ERROR",

                            message: err.message,

                        }

                        this.proxyStash[this.connectionUID].connectionEventReciver.emit("CONNECTION_ERROR", errObject);

                        this.globalEventEmitter.emit("TARGET_CONNECTION_END", this.connectionUID);
                    })

                    h2SessionToTarget.on("close", () => {

                        h2SessionToTarget.destroy();

                        sessionFromSource.close(() => {

                            sessionFromSource.destroy();

                        })

                        this.globalEventEmitter.emit("TARGET_CONNECTION_END", this.connectionUID);

                    })


                } else {

                    h2SessionToTarget.settings(sourceSettings);

                }





            })

            sessionFromSource.on('stream', (stream, headers, flags) => {

                //notify ProxyConnection instance 
                this.proxyStash[this.connectionUID].connectionEventReciver.emit("H2_REQUEST", stream, headers).then((resolvedHeaders) => {

                    if (resolvedHeaders) {

                        //when stream came create the same stream to target
                        const streamToTarget = h2SessionToTarget.request(resolvedHeaders, {

                        });

                        // console.log(`stream created for ${headers[":authority"]} for source stream with id ${stream.id}`);

                        //here comes http2 headers from target
                        streamToTarget.once("response", (headers, flags) => {

                            this.proxyStash[this.connectionUID].connectionEventReciver.emit("H2_RESPONSE", streamToTarget, headers).then(resolvedHeaders => {

                                //here we respond with http2 headers to our source
                                try {

                                    if (!stream.headersSent) {

                                        stream.respond(resolvedHeaders);

                                    }
                                    //  console.log(`Recived headers for response inited stream in connection to ${this.proxyStash[this.connectionUID].destination}:\n\n${resolvedHeaders}\n\n`);



                                } catch (err) {

                                    //terminate source stream
                                    stream.close(undefined, () => {

                                        stream.destroy();

                                    });



                                    //terminate target session
                                    streamToTarget.close(undefined, () => {

                                        streamToTarget.destroy();

                                    });



                                    this.proxyStash[this.connectionUID].connectionEventReciver.emit("CONNECTION_ERROR", { code: null, message: err })

                                    // console.log(`Error was trigered in connection to ${this.proxyStash[this.connectionUID].destination}`, err);

                                }

                            })




                        })


                        let responseDataPromiseResolved;
                        //here comes data from target in chunks or not
                        streamToTarget.on("data", (data) => {

                            stream.cork();

                            this.proxyStash[this.connectionUID].connectionEventReciver.emit("H2_RESPONSE_DATA", streamToTarget, stream, data).then((resolvedData) => {

                                if (resolvedData) {

                                    if (!stream.writableEnded) {

                                        stream.write(resolvedData, undefined, () => {

                                            responseDataPromiseResolved = true;


                                        });

                                        stream.uncork();

                                        return

                                    } else {

                                        // console.log(`Source stream ended before all data was sent in connection to ${this.proxyStash[this.connectionUID].destination}`);

                                    }


                                }


                                responseDataPromiseResolved = true;

                            })

                            responseDataPromiseResolved = false;

                        })

                        streamToTarget.on("end", () => {

                            this.proxyStash[this.connectionUID].connectionEventReciver.emit("H2_RESPONSE_DATA_END", stream.id);

                            if (responseDataPromiseResolved !== undefined) {

                                const emitResponseDataEndAttempt = setInterval(() => {

                                    if (!stream.writableEnded && responseDataPromiseResolved) {

                                        stream.end()

                                        clearInterval(emitResponseDataEndAttempt);


                                        responseDataPromiseResolved = undefined;


                                    }


                                }, 5);

                            } else { stream.end(); }



                        })

                        let requestDataPromiseResolved;
                        //data from source is send to target
                        stream.on("data", (data) => {

                            this.proxyStash[this.connectionUID].connectionEventReciver.emit("H2_REQUEST_DATA", stream, streamToTarget, data).then((resolvedData) => {

                                if (resolvedData) {

                                    streamToTarget.write(resolvedData, undefined, () => {

                                        requestDataPromiseResolved = true;

                                    });

                                    return
                                }

                                requestDataPromiseResolved = true;

                            })


                            requestDataPromiseResolved = false;

                        })


                        stream.on("end", () => {

                            this.proxyStash[this.connectionUID].connectionEventReciver.emit("H2_REQUEST_DATA_END", stream.id);

                            if (requestDataPromiseResolved !== undefined) {

                                const emitRequestDataEndAttempt = setInterval(() => {

                                    if (!streamToTarget.writableEnded && requestDataPromiseResolved) {

                                        streamToTarget.end();

                                        clearInterval(emitRequestDataEndAttempt);

                                        requestDataPromiseResolved = undefined;


                                    }

                                }, 5)
                            } else { streamToTarget.end(); }


                        })



                    } else {

                        stream.close();

                    }


                })


            });


            sessionFromSource.on("close", () => {


            })


            sessionFromSource.on('goaway', (err, smt, data) => {


                // const x = data.toString("utf-8");

            })

        })



        this.server.listen(() => {


            this.port = this.server.address().port;


            this.globalEventEmitter.emit("VIRTUAL_SERVER_READY", this.connectionUID, this.creationSucces);


        });

    }


    /**
     * @param {import("../typings/index.js").VirtualServerOptions} optionsAndRefs 
     */
    createHttpsContext(optionsAndRefs) {

        //generate fake cert

        const caCert = fs.readFileSync("./caCert.pem");

        const caCertPrivateKey = fs.readFileSync("./caCertPrivateKey.pem");

        const tempCertObject = createTempCertificate(optionsAndRefs.destinationHostName, caCert, caCertPrivateKey);

        /**@type {https.ServerOptions} */
        const options = {

            key: tempCertObject.tempCertPrivateKey,

            cert: tempCertObject.tempCert,

        };

        this.server = https.createServer(options);

        /**@type {https.Server} */
        const typedServer = this.server;

        //here comes request from source
        typedServer.on("request", (sourceReq, resToSource) => {

            this.proxyStash[this.connectionUID].connectionEventReciver.emit("HTTPS_REQUEST", sourceReq.headers, sourceReq.url, sourceReq.method).then((resolvedRequestObject) => {

                if (sourceReq.headers?.["upgrade"] === undefined) {


                    //make request to target with use of tlsSocket sink
                    const reqToTarget = https.request({
                        headers: resolvedRequestObject.resolvedHeaders,
                        method: resolvedRequestObject.resolvedRequestMethod,
                        path: resolvedRequestObject.resolvedRequestPath,
                        createConnection: () => this.sink,
                    })


                    const sourceConEndListender = (conUID) => {

                        if (this.connectionUID === conUID) {

                            reqToTarget.removeAllListeners()

                            reqToTarget.end();

                            reqToTarget.destroy();

                            this.globalEventEmitter.removeListener("SOURCE_CONNECTION_END", sourceConEndListender);
                        }


                    }

                    this.globalEventEmitter.on("SOURCE_CONNECTION_END", sourceConEndListender);

                    reqToTarget.on("response", (targetRes) => {

                        this.proxyStash[this.connectionUID].connectionEventReciver.emit("HTTPS_RESPONSE", targetRes.headers, targetRes.statusCode, targetRes.statusMessage).then(resolvedResponseObject => {

                            if (resolvedResponseObject) {

                                for (let targetResponseHeader in resolvedResponseObject.resolvedHeaders) {

                                    resToSource.setHeader(targetResponseHeader, resolvedResponseObject.resolvedHeaders[targetResponseHeader]);

                                }

                                resToSource.statusCode = resolvedResponseObject.resolvedStatusCode;

                                resToSource.statusMessage = resolvedResponseObject.resolvedStatusMessage;


                                let responseDataPromiseResolved;

                                targetRes.on("data", (chunk) => {

                                    this.proxyStash[this.connectionUID].connectionEventReciver.emit("HTTPS_RESPONSE_DATA", targetRes, resToSource, chunk).then(resolvedData => {

                                        if (resolvedData) {

                                            resToSource.write(resolvedData, () => {

                                                responseDataPromiseResolved = true;

                                            });

                                            return
                                        }

                                        responseDataPromiseResolved = true;

                                    })

                                    responseDataPromiseResolved = false

                                })

                                targetRes.on("end", () => {


                                    this.proxyStash[this.connectionUID].connectionEventReciver.emit("HTTPS_RESPONSE_DATA_END");

                                    if (responseDataPromiseResolved !== undefined) {

                                        const emitResponseDataEndAttempt = setInterval(() => {

                                            if (!resToSource.writableEnded && responseDataPromiseResolved) {

                                                resToSource.end()

                                                clearInterval(emitResponseDataEndAttempt);

                                                responseDataPromiseResolved = undefined;

                                            }

                                        }, 5);

                                    } else { resToSource.end(); };

                                })

                            }

                        });



                    })



                    let requestDataPromiseResolved;

                    sourceReq.on("data", (chunk) => {

                        this.proxyStash[this.connectionUID].connectionEventReciver.emit("HTTPS_REQUEST_DATA", sourceReq, reqToTarget, chunk).then(resolvedData => {

                            if (resolvedData) {

                                reqToTarget.write(resolvedData, () => {

                                    requestDataPromiseResolved = true;

                                })

                                return
                            }

                            requestDataPromiseResolved = true;

                        });


                        requestDataPromiseResolved = false;

                    })

                    sourceReq.on("end", () => {

                        this.proxyStash[this.connectionUID].connectionEventReciver.emit("HTTPS_REQUEST_DATA_END");

                        if (requestDataPromiseResolved !== undefined) {

                            const emitRequestDataEndAttempt = setInterval(() => {

                                if (!reqToTarget.writableEnded && requestDataPromiseResolved) {

                                    reqToTarget.end();

                                    clearInterval(emitRequestDataEndAttempt);

                                    requestDataPromiseResolved = undefined;


                                }

                            }, 5)

                        } else { reqToTarget.end(); }


                    })


                }

            })



        })


        typedServer.listen(() => {

            this.port = typedServer.address().port;

            this.globalEventEmitter.emit("VIRTUAL_SERVER_READY", this.connectionUID, this.creationSucces);

            //create websocket overlay for virtual https server

            const wsServer = new WebSocketServer({
                httpServer: typedServer,

                autoAcceptConnections: false
            });

            this.websocketOverlay = wsServer;

            function originIsAllowed(origin) {
                // put logic here to detect whether the specified origin is allowed.
                return true;
            }

            wsServer.on('request', (request) => {

                if (request.httpRequest.headers?.["upgrade"] === "websocket") {

                    //create websocket connection to target
                    const clientToTarget = new WebSocketClient();

                    const clientToTargetHostName = this.proxyStash[this.connectionUID].destination;

                    const clientToTargetOrigin = request.httpRequest.headers.origin;

                    const clientToTargetWebsocketHandshakeHeaders = {};

                    console.log(request.httpRequest.headers);

                    const headersToExclude = ["upgrade", "sec-websocket-version", "sec-websocket-extensions", "sec-websocket-protocol", "sec-websocket-key", "origin", "host"]

                    for (let id = 0; id < request.httpRequest.rawHeaders.length; id += 2) {
                        const headerName = request.httpRequest.rawHeaders[id];
                        const headerValue = request.httpRequest.rawHeaders[id + 1];

                        if (!headersToExclude.includes(headerName.toLowerCase())) {

                            clientToTargetWebsocketHandshakeHeaders[headerName] = headerValue;

                        }

                    }


                    clientToTarget.on("httpResponse", (res) => {

                        if (res.statusCode !== 101) {

                            let responseString = `HTTP/1.1 ${res.statusCode} ${res.statusMessage}\r\n`

                            for (let header in res.headers) {

                                responseString += `${header}: ${res.headers[header]}\n`;

                            }

                            responseString += "\r\n";

                            console.log(responseString);

                            request.httpRequest.socket.write(responseString);

                            res.on("data", (chunk) => {

                                request.httpRequest.socket.write(chunk);

                            })

                            res.on("end", () => {

                                request.httpRequest.socket.end();

                            })



                        }



                    })

                    clientToTarget.on('connectFailed', function (error) {
                        console.log('Websocket Connect Error: ' + error.toString());

                    });

                    clientToTarget.on('connect', (connectionToTarget) => {
                        // console.log('Virtual WebSocket Client Connected to target');

                        connectionToTarget.on('error', function (error) {

                            connectionToTarget.removeAllListeners();

                            connectionToTarget.close();

                            this.globalEventEmitter.emit("TARGET_CONNECTION_END", this.connectionUID);
                        });



                        const sourceConEndListender = (conUID) => {

                            if (this.connectionUID === conUID) {

                                connectionToTarget.removeAllListeners();

                                connectionToTarget.close();

                                this.globalEventEmitter.removeListener("SOURCE_CONNECTION_END", sourceConEndListender);
                            }


                        }

                        this.globalEventEmitter.on("SOURCE_CONNECTION_END", sourceConEndListender);


                        connectionToTarget.on('close', function () {

                            this.globalEventEmitter.emit("TARGET_CONNECTION_END", this.connectionUID);

                        });

                        connectionToTarget.on('message', (message) => {

                            //here comes incoming data from target

                            if (message.type === 'utf8') {

                                this.proxyStash[this.connectionUID].connectionEventReciver.emit("WSS_INBOUND_DATA", connectionToTarget, message.utf8Data).then(resolvedData => {

                                    if (resolvedData) sourceConnection.sendUTF(resolvedData);


                                })


                            } else if (message.type === "binary") {

                                this.proxyStash[this.connectionUID].connectionEventReciver.emit("WSS_INBOUND_DATA", connectionToTarget, message.binaryData).then(resolvedData => {

                                    if (resolvedData) sourceConnection.sendBytes(resolvedData);

                                })


                            }

                        });


                        if (!originIsAllowed(request.origin)) {
                            // Make sure we only accept requests from an allowed origin
                            request.reject();
                            console.log(' Connection from origin ' + request.origin + ' rejected.');
                            return;
                        }

                        const sourceConnection = request.accept(undefined, request.origin);

                        this.proxyStash[this.connectionUID].ALPN = "wss";

                        this.proxyStash[this.connectionUID].wssPath = request.httpRequest.url;

                        this.globalEventEmitter.emit("WSS_PROXY_CONNECTION", this.proxyStash[this.connectionUID]);

                        console.log(`Virtual websocket server accepted Connection from origin ${request.origin}`);



                        sourceConnection.on('message', (message) => {

                            //here comes outgoing data from source

                            if (message.type === 'utf8') {

                                this.proxyStash[this.connectionUID].connectionEventReciver.emit("WSS_OUTBOUND_DATA", sourceConnection, message.utf8Data).then(resolvedData => {


                                    if (resolvedData) connectionToTarget.sendUTF(resolvedData);


                                })


                            } else if (message.type === 'binary') {


                                this.proxyStash[this.connectionUID].connectionEventReciver.emit("WSS_OUTBOUND_DATA", sourceConnection, message.binaryData).then(resolvedData => {


                                    if (resolvedData) connectionToTarget.sendBytes(resolvedData);


                                })


                            }

                        });

                        sourceConnection.on("error", () => {

                            this.globalEventEmitter.emit("SOURCE_CONNECTION_END", this.connectionUID);

                        })


                        sourceConnection.on('close', function (reasonCode, description) {

                            this.globalEventEmitter.emit("SOURCE_CONNECTION_END", this.connectionUID);

                        });




                    });


                    const sourceConEndListender = (conUID) => {

                        if (this.connectionUID === conUID) {

                            clientToTarget.removeAllListeners()

                            clientToTarget.abort();

                            this.globalEventEmitter.removeListener("SOURCE_CONNECTION_END", sourceConEndListender);
                        }


                    }

                    this.globalEventEmitter.on("SOURCE_CONNECTION_END", sourceConEndListender);


                    clientToTarget.connect(`wss://${clientToTargetHostName}:${this.proxyStash[this.connectionUID].destinationPort}${request.httpRequest.url}`, undefined, clientToTargetOrigin, clientToTargetWebsocketHandshakeHeaders, {
                        createConnection: (url, options) => {

                            return this.sink

                        },
                        rejectUnauthorized: false,
                        agent: undefined,
                    });





                }


            });

        })

    }

    /**
     * @param {import("../typings/index.js").VirtualServerOptions} optionsAndRefs 
     */
    createTlsContext(optionsAndRefs) {

        //generate fake cert

        const caCert = fs.readFileSync("./caCert.pem");

        const caCertPrivateKey = fs.readFileSync("./caCertPrivateKey.pem");

        const tempCertObject = createTempCertificate(optionsAndRefs.destinationHostName, caCert, caCertPrivateKey);

        /**@type {tls.TlsOptions} */
        const options = {

            key: tempCertObject.tempCertPrivateKey,

            cert: tempCertObject.tempCert,

            ALPNProtocols: [this.sinkALPN]
        };

        this.server = tls.createServer(options, (socket) => {

            // console.log(`single connection ${this.connectionUID} came`);

            socket.setEncoding('utf8');

            //here comes decrypted outgoing data from source
            socket.on("data", (dataFromSource) => {


                //send incoming data back to source
                this.sink.on("data", (dataFromTarget) => {

                    socket.write(dataFromTarget);

                })

                this.sink.write(dataFromSource);

            })

        });

        this.server.listen(() => {
            // console.log(`interpreter server bound for ${this.proxyStash[this.connectionUID].destination}`);

            this.port = this.server.address().port;

            this.globalEventEmitter.emit("VIRTUAL_SERVER_READY", this.connectionUID, this.creationSucces);

        });

    }

}


module.exports.VirtualServer = VirtualServer;
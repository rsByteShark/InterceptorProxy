const { EventEmitter } = require("stream");

class ProxyConnection {

    /**@type {import("../typings/index.js").GlobalEventReciver} */
    globalEventReciver;

    /**@type {import("../typings/index.js").GlobalEventEmitter} */
    globalEventEmitter;

    /**@type {import("../typings").ConnectionEventEmitter} */
    connectionEventEmitter = new EventEmitter();

    /**@type {import("../typings").ConnectionEventReciver} */
    connectionEventReciver = new EventEmitter();

    /**@type {import("../typings").h2Stash} */
    h2Stash = {};

    /**@type {string} */
    UID;

    /**@type {string} */
    destination;

    /**@type {string} */
    ALPN;

    /**@type {"none" | "open" | "closed"} */
    connectionState = "none"

    /**@type {import("../typings").ProxyConnectionErrorObject[]} */
    errors = [];

    /**@type {import("../typings/index.js").ProxyConnectionFilters} */
    filters = {};

    /**@type {string} */
    wssPath;

    constructor(connectionUID) {

        this.globalEventReciver = process.globalEventReciver;

        this.globalEventEmitter = process.globalEventEmitter;

        this.UID = connectionUID;

        this.h2Stash.h2Streams = {};

        this.createPromisefullEmitter();

        this.initHandlers();

    }


    initHandlers() {

        //handle internal recived events

        //TODO handle recording of connection activity
        //event came  -> save data into connection stash

        //http2 events
        this.connectionEventReciver.on("H2_SESSION_CREATED", (h2SessionObjectRef) => {

            this.connectionState = "open"

            this.connectionEventEmitter.emit("H2_SESSION_CREATED", h2SessionObjectRef);

        })


        this.connectionEventReciver.on("H2_REQUEST", (requestDataSource, headers) => {

            let requestStream = this.h2Stash.h2Streams?.[requestDataSource.id];

            //if stream already exist create new request object
            if (requestStream) {




            } else {

                //create

                this.h2Stash.h2Streams[requestDataSource.id] = {

                    streamID: requestDataSource.id,

                    h2requests: [],

                    h2responses: [],

                }


            }



            this.connectionEventEmitter.emit("H2_REQUEST", requestDataSource, headers);

        })


        this.connectionEventReciver.on("H2_REQUEST_DATA", (requestDataSource, requestDataSink, data) => {


            this.connectionEventEmitter.emit("H2_REQUEST_DATA", requestDataSource, data);

        })

        this.connectionEventReciver.on("H2_RESPONSE", (responseDataSource, headers) => {

            let responseStream = this.h2Stash.h2Streams?.[responseDataSource.id];


            //acces responses arr and create res object in it


            this.h2Stash.h2Streams[responseDataSource.id] = {

                streamID: responseDataSource.id,

                h2requests: [],

                h2responses: [],

            }


            this.connectionEventEmitter.emit("H2_RESPONSE", responseDataSource, headers);

        })


        this.connectionEventReciver.on("H2_RESPONSE_DATA", (responseDataSource, responseDataSink, data) => {

            this.connectionEventEmitter.emit("H2_RESPONSE_DATA", responseDataSource, responseDataSink, data);

        })


        //https events
        this.connectionEventReciver.on("HTTPS_REQUEST", (headers, path, requestMethod) => {

            this.connectionEventEmitter.emit("HTTPS_REQUEST", headers, path, requestMethod);

        })

        this.connectionEventReciver.on("HTTPS_REQUEST_DATA", (requestDataSource, requestDataSink, data) => {

            this.connectionEventEmitter.emit("HTTPS_REQUEST_DATA", requestDataSource, data);

        })

        this.connectionEventReciver.on("HTTPS_REQUEST_DATA_END", () => {


            this.connectionEventEmitter.emit("HTTPS_REQUEST_DATA_END");

        })

        this.connectionEventReciver.on("HTTPS_RESPONSE", (headers, statusCode, statusMessage) => {

            this.connectionEventEmitter.emit("HTTPS_RESPONSE", headers, statusCode, statusMessage);

        })


        this.connectionEventReciver.on("HTTPS_RESPONSE_DATA", (responseDataSource, responseDataSink, data) => {

            this.connectionEventEmitter.emit("HTTPS_RESPONSE_DATA", responseDataSource, data);

        })

        this.connectionEventReciver.on("HTTPS_RESPONSE_DATA_END", () => {

            this.connectionEventEmitter.emit("HTTPS_RESPONSE_DATA_END");

        })

        //websocket events
        this.connectionEventReciver.on("WSS_OUTBOUND_DATA", (dataSource, data) => {

            this.connectionEventEmitter.emit("WSS_OUTBOUND_DATA", dataSource, data);

        })

        this.connectionEventReciver.on("WSS_INBOUND_DATA", (dataSource, data) => {

            this.connectionEventEmitter.emit("WSS_INBOUND_DATA", dataSource, data);

        })

        //error events
        this.connectionEventReciver.on("CONNECTION_ERROR", (errInfo) => {

            this.connectionState = "closed";

            this.errors.push(errInfo);

            this.connectionEventEmitter.emit("CONNECTION_ERROR", errInfo);

        })
        //handle global events

        const connectionEndEventCallback = (UID) => {

            if (UID === this.UID) { this.connectionState = "closed"; this.globalEventEmitter.removeListener("TARGET_CONNECTION_END", connectionEndEventCallback) }

        }

        //watch for an event that indicates that target ends connection with source socket
        this.globalEventEmitter.on("TARGET_CONNECTION_END", connectionEndEventCallback);

    }

    createPromisefullEmitter() {

        /**@type {Function} */
        const originalEmit = this.connectionEventReciver.emit.bind(this.connectionEventReciver);

        const promisefullEmitter = function () {

            return new Promise((resolve, reject) => {

                /**@type {ProxyConnection} */
                const proxyConnectionInstanceRef = this;

                //http2 switch
                switch (arguments[0]) {
                    case "H2_REQUEST":

                        /**@type {import("http").IncomingHttpHeaders} */
                        const requestHeaders = arguments[2];

                        const requestSourceStreamRef = arguments[1];


                        let modifiedRequestHeaders = false;

                        if (proxyConnectionInstanceRef.filters?.H2_REQUEST) {


                            for (let requestHeadersFiltersIterator = 0; requestHeadersFiltersIterator < proxyConnectionInstanceRef.filters.H2_REQUEST.length; requestHeadersFiltersIterator++) {

                                const filterFunction = proxyConnectionInstanceRef.filters.H2_REQUEST[requestHeadersFiltersIterator];

                                if (modifiedRequestHeaders !== null) {

                                    if (modifiedRequestHeaders) modifiedRequestHeaders = filterFunction(requestSourceStreamRef, modifiedRequestHeaders);
                                    else modifiedRequestHeaders = filterFunction(requestSourceStreamRef, requestHeaders);

                                } else break;

                            }



                        }

                        let requestHeadersToReturn;

                        if (modifiedRequestHeaders === null) {

                            requestHeadersToReturn = null;

                        } else requestHeadersToReturn = modifiedRequestHeaders || requestHeaders;


                        if (requestHeadersToReturn !== null) {

                            const reqArgs = ["H2_REQUEST", requestSourceStreamRef, requestHeadersToReturn];

                            originalEmit.apply(null, reqArgs);

                        }

                        resolve(requestHeadersToReturn);

                        break;
                    case "H2_REQUEST_DATA":

                        /**@type {import("http2").ServerHttp2Stream} */
                        const requestDataSourceStreamRef = arguments[1];

                        /**@type {import("http2").ClientHttp2Stream} */
                        const requestDataSink = arguments[2];

                        /**@type {string | Buffer} */
                        const requestData = arguments[3];

                        /**@type {string | Buffer | false | null} */
                        let modifiedRequestData = false;

                        if (proxyConnectionInstanceRef.filters?.H2_REQUEST_DATA) {


                            for (let requestDataFiltersIterator = 0; requestDataFiltersIterator < proxyConnectionInstanceRef.filters.H2_REQUEST_DATA.length; requestDataFiltersIterator++) {

                                const filterFunction = proxyConnectionInstanceRef.filters.H2_REQUEST_DATA[requestDataFiltersIterator];

                                if (modifiedRequestData !== null) {

                                    if (modifiedRequestData) modifiedRequestData = filterFunction(requestDataSourceStreamRef, requestDataSink, modifiedRequestData);
                                    else modifiedRequestData = filterFunction(requestDataSourceStreamRef, requestDataSink, requestData);

                                } else break;


                            }

                        }


                        let requestDataToReturn;

                        if (modifiedRequestData === null) {

                            requestDataToReturn = null;

                        } else requestDataToReturn = modifiedRequestData || requestData;

                        if (requestDataToReturn !== null) {

                            const reqDataArgs = ["H2_REQUEST_DATA", requestDataSourceStreamRef, requestDataToReturn];

                            originalEmit.apply(null, reqDataArgs);

                        }

                        resolve(requestDataToReturn);

                        break;
                    case "H2_RESPONSE":

                        /**@type {import("http").IncomingHttpHeaders} */
                        const responseHeaders = arguments[2];

                        const responseSourceStreamRef = arguments[1];


                        let modifiedResponseHeaders = false;

                        if (proxyConnectionInstanceRef.filters?.H2_RESPONSE) {

                            for (let responseHeadersFiltersIterator = 0; responseHeadersFiltersIterator < proxyConnectionInstanceRef.filters.H2_RESPONSE.length; responseHeadersFiltersIterator++) {

                                const filterFunction = proxyConnectionInstanceRef.filters.H2_RESPONSE[responseHeadersFiltersIterator];


                                if (modifiedResponseHeaders !== null) {

                                    if (modifiedResponseHeaders) modifiedResponseHeaders = filterFunction(responseSourceStreamRef, modifiedResponseHeaders)
                                    else modifiedResponseHeaders = filterFunction(responseSourceStreamRef, responseHeaders);

                                } else break;


                            }

                        }

                        let responseHeadersToReturn;

                        if (modifiedResponseHeaders === null) {

                            responseHeadersToReturn = null;

                        } else responseHeadersToReturn = modifiedResponseHeaders || responseHeaders;


                        if (responseHeadersToReturn !== null) {

                            const resArgs = ["H2_RESPONSE", responseSourceStreamRef, responseHeadersToReturn];

                            originalEmit.apply(null, resArgs);

                        }

                        resolve(responseHeadersToReturn);

                        break;
                    case "H2_RESPONSE_DATA":

                        /**@type {import("http2").ClientHttp2Stream} */
                        const responseDataSourceStreamRef = arguments[1];

                        /**@type {import("http2").ServerHttp2Stream} */
                        const responseDataSink = arguments[2];

                        /**@type {string | Buffer} */
                        const responseData = arguments[3];

                        /**@type {string | Buffer | false | null} */
                        let modifiedResponseData = false;

                        if (proxyConnectionInstanceRef.filters?.H2_RESPONSE_DATA) {

                            for (let responseDataFiltersIterator = 0; responseDataFiltersIterator < proxyConnectionInstanceRef.filters.H2_RESPONSE_DATA.length; responseDataFiltersIterator++) {

                                const filterFunction = proxyConnectionInstanceRef.filters.H2_RESPONSE_DATA[responseDataFiltersIterator];

                                if (modifiedResponseData !== null) {

                                    if (modifiedResponseData) modifiedResponseData = filterFunction(responseDataSourceStreamRef, responseDataSink, modifiedResponseData);
                                    else modifiedResponseData = filterFunction(responseDataSourceStreamRef, responseDataSink, responseData);

                                } else break;

                            }

                        }


                        let responseDataToReturn;

                        if (modifiedResponseData === null) {

                            responseDataToReturn = null;

                        } else responseDataToReturn = modifiedResponseData || responseData;


                        if (responseDataToReturn !== null) {

                            const resDataArgs = ["H2_RESPONSE_DATA", responseDataSourceStreamRef, responseDataToReturn];

                            originalEmit.apply(null, resDataArgs);

                        }

                        resolve(responseDataToReturn);

                        break;

                }

                if (!arguments[0].includes("H2")) {

                    //https switch
                    switch (arguments[0]) {
                        case "HTTPS_REQUEST":

                            /**@type {import("http").IncomingHttpHeaders} */
                            const requestHeaders = arguments[1];

                            const requestPath = arguments[2]

                            const requestMethod = arguments[3];

                            /**@type {import("../typings/index.js").ResolvedHttpsRequest | false | null} */
                            let resolvedHttpsRequest = false;

                            if (proxyConnectionInstanceRef.filters?.HTTPS_REQUEST) {

                                for (let httpsRequestFiltersIterator = 0; httpsRequestFiltersIterator < proxyConnectionInstanceRef.filters.HTTPS_REQUEST.length; httpsRequestFiltersIterator++) {

                                    const filterFunction = proxyConnectionInstanceRef.filters.HTTPS_REQUEST[httpsRequestFiltersIterator];

                                    if (resolvedHttpsRequest !== null) {

                                        if (resolvedHttpsRequest) resolvedHttpsRequest = filterFunction(resolvedHttpsRequest.resolvedHeaders, resolvedHttpsRequest.resolvedRequestPath, resolvedHttpsRequest.resolvedRequestMethod);
                                        else resolvedHttpsRequest = filterFunction(requestHeaders, requestPath, requestMethod);

                                    } else break;

                                }

                            }

                            let resolvedHttpsRequestToReturn;

                            if (resolvedHttpsRequest === null) {

                                resolvedHttpsRequestToReturn = null

                            } else resolvedHttpsRequestToReturn = resolvedHttpsRequest || { resolvedHeaders: requestHeaders, resolvedRequestPath: requestPath, resolvedRequestMethod: requestMethod };


                            if (resolvedHttpsRequestToReturn !== null) {

                                const reqEventArgs = ["HTTPS_REQUEST", resolvedHttpsRequestToReturn.resolvedHeaders, resolvedHttpsRequestToReturn.resolvedRequestPath, resolvedHttpsRequestToReturn.resolvedRequestMethod]

                                originalEmit.apply(null, reqEventArgs);

                            }


                            resolve(resolvedHttpsRequestToReturn);

                            break;
                        case "HTTPS_REQUEST_DATA":

                            /**@type {import("http").IncomingMessage} */
                            const requestDataSourceStreamRef = arguments[1];

                            /**@type {import("http").ClientRequest} */
                            const requestDataSink = arguments[2];

                            /**@type {Buffer} */
                            const requestData = arguments[3];

                            /**@type {Buffer | false | null} */
                            let modifiedRequestData = false;


                            if (proxyConnectionInstanceRef.filters?.HTTPS_REQUEST_DATA) {

                                for (let requestDataFiltersIterator = 0; requestDataFiltersIterator < proxyConnectionInstanceRef.filters.HTTPS_REQUEST_DATA.length; requestDataFiltersIterator++) {

                                    const filterFunction = proxyConnectionInstanceRef.filters.HTTPS_REQUEST_DATA[requestDataFiltersIterator];

                                    if (modifiedRequestData !== null) {

                                        if (modifiedRequestData) modifiedRequestData = filterFunction(requestDataSourceStreamRef, requestDataSink, modifiedRequestData);
                                        else modifiedRequestData = filterFunction(requestDataSourceStreamRef, requestDataSink, requestData);

                                    } else break;


                                }

                            }


                            let requestDataToReturn;

                            if (modifiedRequestData === null) {

                                requestDataToReturn = null;

                            } else requestDataToReturn = modifiedRequestData || requestData;

                            if (requestDataToReturn !== null) {

                                const reqDataArgs = ["HTTPS_REQUEST_DATA", requestDataSourceStreamRef, requestDataSink, requestDataToReturn];

                                originalEmit.apply(null, reqDataArgs);

                            }

                            resolve(requestDataToReturn);

                            break;
                        case "HTTPS_RESPONSE":

                            /**@type {import("http").IncomingHttpHeaders} */
                            const responseHeaders = arguments[1];

                            const responseStatusCode = arguments[2];

                            const responseStatusMessage = arguments[3];

                            /**@type {import("../typings/index.js").ResolvedHttpsResponse | false | null} */
                            let resolvedHttpsResponse = false;

                            if (proxyConnectionInstanceRef.filters?.HTTPS_RESPONSE) {


                                for (let httpsResponseFiltersIterator = 0; httpsResponseFiltersIterator < proxyConnectionInstanceRef.filters.HTTPS_RESPONSE.length; httpsResponseFiltersIterator++) {

                                    const filterFunction = proxyConnectionInstanceRef.filters.HTTPS_RESPONSE[httpsResponseFiltersIterator];

                                    if (resolvedHttpsResponse !== null) {

                                        if (resolvedHttpsResponse) resolvedHttpsResponse = filterFunction(resolvedHttpsResponse.resolvedHeaders, resolvedHttpsResponse.resolvedStatusCode, resolvedHttpsResponse.resolvedStatusMessage);
                                        else resolvedHttpsResponse = filterFunction(responseHeaders, responseStatusCode, responseStatusMessage);

                                    } else break;

                                }


                            }

                            let resolvedHttpsResponseToReturn;

                            if (resolvedHttpsResponse === null) {

                                resolvedHttpsResponseToReturn = null;
                            } else resolvedHttpsResponseToReturn = resolvedHttpsResponse || { resolvedHeaders: responseHeaders, resolvedStatusCode: responseStatusCode, resolvedStatusMessage: responseStatusMessage }


                            if (resolvedHttpsResponseToReturn !== null) {

                                const reqEventArgs = ["HTTPS_RESPONSE", resolvedHttpsResponseToReturn.resolvedHeaders, resolvedHttpsResponseToReturn.resolvedStatusCode, resolvedHttpsResponseToReturn.resolvedStatusMessage]

                                originalEmit.apply(null, reqEventArgs);

                            }


                            resolve(resolvedHttpsResponseToReturn);

                            break;
                        case "HTTPS_RESPONSE_DATA":

                            /**@type {import("http").IncomingMessage} */
                            const responseDataSourceStreamRef = arguments[1];

                            /**@type {import("http").ClientRequest} */
                            const responseDataSink = arguments[2];

                            /**@type {Buffer} */
                            const responseData = arguments[3];

                            /**@type {Buffer | false | null} */
                            let modifiedResponseData = false;


                            if (proxyConnectionInstanceRef.filters?.HTTPS_RESPONSE_DATA) {

                                for (let responseDataFiltersIterator = 0; responseDataFiltersIterator < proxyConnectionInstanceRef.filters.HTTPS_RESPONSE_DATA.length; responseDataFiltersIterator++) {

                                    const filterFunction = proxyConnectionInstanceRef.filters.HTTPS_RESPONSE_DATA[responseDataFiltersIterator];

                                    if (modifiedResponseData !== null) {

                                        if (modifiedResponseData) modifiedResponseData = filterFunction(responseDataSourceStreamRef, responseDataSink, modifiedResponseData);
                                        else modifiedResponseData = filterFunction(responseDataSourceStreamRef, responseDataSink, responseData);

                                    } else break;


                                }

                            }

                            let responseDataToReturn;

                            if (modifiedResponseData === null) {

                                responseDataToReturn = null;

                            } else responseDataToReturn = modifiedResponseData || responseData;


                            if (responseDataToReturn !== null) {

                                const resDataArgs = ["HTTPS_RESPONSE_DATA", responseDataSourceStreamRef, responseDataSink, responseDataToReturn];

                                originalEmit.apply(null, resDataArgs);

                            }

                            resolve(responseDataToReturn);
                            break;
                        case "WSS_OUTBOUND_DATA":

                            /**@type {import("websocket").connection} */
                            const wssOutboundDataSource = arguments[1];

                            /**@type {Buffer | string} */
                            const wssOutboundData = arguments[2];


                            let modifiedOutboundData = false;

                            if (proxyConnectionInstanceRef.filters?.WSS_OUTBOUND_DATA) {

                                for (let wssOutboundDataFiltersIterator = 0; wssOutboundDataFiltersIterator < proxyConnectionInstanceRef.filters.WSS_OUTBOUND_DATA.length; wssOutboundDataFiltersIterator++) {

                                    const filterFunction = proxyConnectionInstanceRef.filters.WSS_OUTBOUND_DATA[wssOutboundDataFiltersIterator];

                                    if (modifiedOutboundData !== null) {

                                        if (modifiedOutboundData) modifiedOutboundData = filterFunction(wssOutboundDataSource, modifiedOutboundData);
                                        else modifiedOutboundData = filterFunction(wssOutboundDataSource, wssOutboundData);

                                    } else break;

                                }

                            }


                            let outboundDataToReturn;

                            if (modifiedOutboundData === null) {

                                outboundDataToReturn = null;

                            } else outboundDataToReturn = modifiedOutboundData || wssOutboundData;



                            if (outboundDataToReturn !== null) {

                                const outDataArgs = ["WSS_OUTBOUND_DATA", wssOutboundDataSource, outboundDataToReturn];

                                originalEmit.apply(null, outDataArgs);

                            }

                            resolve(outboundDataToReturn);

                            break;
                        case "WSS_INBOUND_DATA":

                            /**@type {import("websocket").connection} */
                            const wssInboundDataSource = arguments[1];

                            /**@type {Buffer | string} */
                            const wssInboundData = arguments[2];


                            let modifiedInboundData = false;

                            if (proxyConnectionInstanceRef.filters?.WSS_INBOUND_DATA) {

                                for (let wssInboundDataFiltersIterator = 0; wssInboundDataFiltersIterator < proxyConnectionInstanceRef.filters.WSS_OUTBOUND_DATA.length; wssInboundDataFiltersIterator++) {

                                    const filterFunction = proxyConnectionInstanceRef.filters.WSS_INBOUND_DATA[wssInboundDataFiltersIterator];

                                    if (modifiedInboundData !== null) {

                                        if (modifiedInboundData) modifiedInboundData = filterFunction(wssInboundDataSource, modifiedInboundData);
                                        else modifiedInboundData = filterFunction(wssInboundDataSource, wssInboundData);

                                    } else break;

                                }

                            }


                            let inboundDataToReturn;

                            if (modifiedInboundData === null) {

                                inboundDataToReturn = null;

                            } else inboundDataToReturn = modifiedInboundData || wssInboundData;



                            if (inboundDataToReturn !== null) {

                                const inDataArgs = ["WSS_INBOUND_DATA", wssInboundDataSource, inboundDataToReturn];

                                originalEmit.apply(null, inDataArgs);

                            }

                            resolve(inboundDataToReturn);

                            break;
                        default:


                            originalEmit.apply(null, arguments);

                            resolve(true)

                            break;
                    }


                }




            });

        }


        this.connectionEventReciver.emit = promisefullEmitter.bind(this);

    }

    /**
     * @param {string} eventName 
     * @param {Function} callback 
     */
    applyFilter(eventName, callback) {

        /**@type {Array} */
        const filtersArr = this.filters?.[eventName];

        if (filtersArr) {

            filtersArr.push(callback);

        } else {

            this.filters[eventName] = [];

            this.filters[eventName].push(callback);
        }

    }


}

module.exports.ProxyConnection = ProxyConnection
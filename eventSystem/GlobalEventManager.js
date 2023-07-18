const { EventEmitter } = require("stream");

class GlobalEventManager {

    /**@type {import("../typings").GlobalEventReciver} */
    globalEventReciver = new EventEmitter();

    /**@type {import("../typings").GlobalEventEmitter} */
    globalEventEmitter = new EventEmitter();

    constructor() {

        this.globalEventEmitter.setMaxListeners(500);

        this.initHandlers();

    }

    initHandlers() {

        //handle recived events
        this.globalEventReciver.on("PROXY_SERVER_READY", (port) => {

            // console.log(`Proxy server ready on port ${port}`);

            this.globalEventEmitter.emit("PROXY_SERVER_READY", port)

        })

        this.globalEventReciver.on("VIRTUAL_SERVER_READY", (connectionUID) => {

            this.globalEventEmitter.emit("VIRTUAL_SERVER_READY", connectionUID);

        })

        this.globalEventReciver.on("H2_PROXY_CONNECTION", (connection) => {

            this.globalEventEmitter.emit("H2_PROXY_CONNECTION", connection);

        })


        this.globalEventReciver.on("HTTPS_PROXY_CONNECTION", (connection) => {

            this.globalEventEmitter.emit("HTTPS_PROXY_CONNECTION", connection);

        })

        this.globalEventReciver.on("PROXY_CONNECTION_REFUSED", (targetHostName) => {

            this.globalEventEmitter.emit("PROXY_CONNECTION_REFUSED", targetHostName);

        })

        this.globalEventReciver.on("TARGET_CONNECTION_END", (connectionUID) => {

            this.globalEventEmitter.emit("TARGET_CONNECTION_END", connectionUID);

        })


        this.globalEventReciver.on("SOURCE_CONNECTION_END", (connectionUID) => {

            this.globalEventEmitter.emit("SOURCE_CONNECTION_END", connectionUID);

        })

    }
}

module.exports.GlobalEventManager = GlobalEventManager;
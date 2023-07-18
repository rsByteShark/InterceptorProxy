const { GlobalEventManager } = require("./eventSystem/GlobalEventManager.js");
const { createCACertificate } = require("./utils/InterceptorCertificate.js");
const { ProxyServer } = require("./src/proxyServer.js");
const fs = require("fs");


class InterceptorProxy {

    /**@type {import("./typings").GlobalEventEmitter} */
    proxyEventsEmitter;

    /**@type {import("./typings").ProxyStash} */
    proxyConnectionsStash;

    /**
     * @param {import("./typings/index.js").ProxyServerOptions} proxyOptions 
     */
    constructor(proxyOptions) {


        //check if some other instance of this class don't exist by checking if globaleventemiter is set

        if (process?.globalEventEmitter === undefined && process?.globalEventReciver === undefined) {

            //init global events system
            const globalEventsManager = new GlobalEventManager()
            process.globalEventReciver = globalEventsManager.globalEventReciver;
            process.globalEventEmitter = globalEventsManager.globalEventEmitter;

        } else {

            throw "It seems that some other instance of InterceptorProxy already is running in this process"

        }

        this.proxyEventsEmitter = process.globalEventEmitter;

        //check if caCer already exist
        fs.access("./caCert.pem", fs.constants.F_OK, (err) => {

            let generateCert = true;

            if (!err) {

                generateCert = false;

            }

            if (generateCert) {

                const caCertObject = createCACertificate("InterceptorProxy");

                fs.writeFileSync("./caCert.pem", caCertObject.cert);

                fs.writeFileSync("./caCertPrivateKey.pem", caCertObject.privateKey);

                console.log('cert created');

            }

            //create http proxy server
            const proxyServerInstance = new ProxyServer(proxyOptions);

            this.proxyConnectionsStash = proxyServerInstance.connections;

        });


    }


}


module.exports = InterceptorProxy;











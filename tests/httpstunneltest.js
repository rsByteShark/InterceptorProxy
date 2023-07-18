const https = require("https");
const http = require("http");
const tls = require("tls");
const InterceptorProxy = require("../InterceptorProxy.js");
const { createTempCertificate, createCACertificate } = require("../utils/InterceptorCertificate.js");





//create target server
const caCert = createCACertificate("localhostCa");

const certForServer = createTempCertificate("localhost", caCert.cert, caCert.privateKey)


const serverOptions = {

    key: certForServer.tempCertPrivateKey,
    cert: certForServer.tempCert,
}



const httpsServer = https.createServer(serverOptions);


httpsServer.on("request", (req, res) => {

    let headersString = '';

    for (let header in req.headers) {

        headersString += `${header} : ${req.headers[header]}\n`;

    }
    console.log(`Server recived request headers:\n`);

    console.log(headersString);


    let gatheredData = "";
    req.on("data", (chunk) => {

        gatheredData += chunk.toString();

    })

    req.on("end", () => {

        console.log(`Server recived request data: ${gatheredData}`);

    })

    res.setHeader("Content-Type", 'text/html; charset=utf-8');

    res.end("<h1>Cool HTML<h1/>");

})

httpsServer.listen(() => {


    //run proxy
    const proxyInstance = new InterceptorProxy();

    //here we testing if interception and modification works
    proxyInstance.proxyEventsEmitter.on("HTTPS_PROXY_CONNECTION", connection => {



        //response data content change example

        //we will change target server response data to this
        let htmlData = "Modified response data";


        //here we apply filter that will modify target server response headers 
        connection.applyFilter("HTTPS_RESPONSE", (headers, responseStatusCode, responseStatusMessage) => {

            //here we add custom heder to check if adding new headers works
            headers["x-added-header"] = "1";

            //here we modify existing header to check if modifying headers value works
            headers["content-length"] = htmlData.length;

            //we return modified response headers object along with status code and message that client will recived
            return { resolvedHeaders: headers, resolvedStatusCode: responseStatusCode, resolvedStatusMessage: responseStatusMessage }
        })


        //here we applying filter for target server response data
        connection.applyFilter("HTTPS_RESPONSE_DATA", (source, sink, data) => {

            //here we changing response data from target server
            data = Buffer.from(htmlData);

            return data

        })

        //request chunked content data gather and modify example

        //here we applying filter that will modify request headers for target
        connection.applyFilter("HTTPS_REQUEST", (headers, path, method) => {


            delete headers["transfer-encoding"];

            headers["content-length"] = "Modified request data".length;

            headers["x-added-header"] = "1";

            return { resolvedHeaders: headers, resolvedMethod: method }

        })


        //here we define variables in wich we will store gathered chunked data and ref to data sink
        let gatheredData = ""
        let sinkRef;

        //here we listen for event that indicates source telling request data end
        connection.connectionEventEmitter.on("HTTPS_REQUEST_DATA_END", () => {

            //flush gathered data

            gatheredData = "Modified request data";
            sinkRef.write(Buffer.from(gatheredData));

        })

        connection.applyFilter("HTTPS_REQUEST_DATA", (source, sink, data) => {

            sinkRef = sink;
            gatheredData += data.toString();

            return null

        })




    })

    proxyInstance.proxyEventsEmitter.on("PROXY_SERVER_READY", (port) => {


        //make call for connection to proxy
        /**@type {http.RequestOptions} */
        const connectionRequestOptions = {
            method: "CONNECT",
            port: port,
            host: "localhost",
            path: "/",
            headers: {
                "Host": `localhost:${httpsServer.address().port}`
            }
        }


        const connectionRequest = http.request(connectionRequestOptions);

        connectionRequest.on("connect", (res, socket, head) => {


            //create tls socket to target server
            /**@type {tls.ConnectionOptions} */
            const tlsOptions = {
                socket: socket,
                host: "localhost",
                port: httpsServer.address().port,
                rejectUnauthorized: false,
                ALPNProtocols: ["http/1.1"],
            };

            const tlsSocketToTarget = tls.connect(tlsOptions, () => {


                //create https client

                /**@type {https.RequestOptions} */
                const httpsClientOptions = {

                    method: "POST",

                    host: "localhost",

                    port: httpsServer.address().port,

                    rejectUnauthorized: false,

                    createConnection: function (url, options) {

                        return tlsSocketToTarget

                    }

                }


                const clientRequest = https.request(httpsClientOptions);


                clientRequest.on("response", (res) => {

                    let headersString = '';

                    for (let header in res.headers) {

                        headersString += `${header} : ${res.headers[header]}\n`;

                    }

                    console.log(`\nClient recived repsonse head: ${res.statusCode} ${res.statusMessage}`);


                    console.log(`\nclient recived response headers:\n\n ${headersString}`);

                    let responseData = "";
                    res.on("data", (chunk) => {

                        responseData += chunk;

                    })

                    res.on("end", () => {

                        console.log(`Client recived response data: ${responseData}\n`);


                        console.log('Test passed evrything works fine...');

                        process.exit();

                    })


                })

                clientRequest.write("Hello");

                clientRequest.write(" World");

                clientRequest.end();



            })





        })


        connectionRequest.end();


    })



})

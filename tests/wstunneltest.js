const WebSocketServer = require('websocket').server;
const https = require('https');
const http = require("http");
const tls = require("tls");
const fs = require("fs");
const InterceptorProxy = require("../InterceptorProxy.js");
const { createTempCertificate, createCACertificate } = require("../utils/InterceptorCertificate.js");


//set up target server

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

    //set up websocket overlay for https server
    const wsServer = new WebSocketServer({
        httpServer: httpsServer,
        // You should not use autoAcceptConnections for production
        // applications, as it defeats all standard cross-origin protection
        // facilities built into the protocol and the browser.  You should
        // *always* verify the connection's origin and decide whether or not
        // to accept it.
        autoAcceptConnections: false
    });

    function originIsAllowed(origin) {
        // put logic here to detect whether the specified origin is allowed.
        return true;
    }

    wsServer.on('request', function (request) {
        if (!originIsAllowed(request.origin)) {
            // Make sure we only accept requests from an allowed origin
            request.reject();
            console.log(' Connection from origin ' + request.origin + ' rejected.');
            return;
        }

        if (request.httpRequest.headers["upgrade"] !== undefined) {

            const connection = request.accept();

            console.log(`Connection accepted from origin ${request.origin}`);



            connection.on('message', function (message) {

                if (message.type === 'utf8') {
                    console.log('Received Message: ' + message.utf8Data);

                    connection.sendUTF("OK");

                }
                else if (message.type === 'binary') {
                    console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
                    connection.sendBytes(message.binaryData);
                }

            });
            connection.on('close', function (reasonCode, description) {
                console.log(' Peer ' + connection.remoteAddress + ' disconnected.');
            });

        }


    });



    //run proxy
    const proxyInstance = new InterceptorProxy();

    proxyInstance.proxyEventsEmitter.on("WSS_PROXY_CONNECTION", connection => {

        console.log('WSS CONNECTION DETECTED');

        let coolCounter = 0

        connection.applyFilter("WSS_OUTBOUND_DATA", (source, data) => {

            data = coolCounter.toString();

            coolCounter++;

            return data

        })

        connection.applyFilter("WSS_INBOUND_DATA", (source, data) => {

            data = `OK ${coolCounter - 1}`;


            return data
        })

        connection.connectionEventEmitter.on("WSS_OUTBOUND_DATA", (source, data) => {

            // console.log('Source sent websocket data to target ');

        })


        connection.connectionEventEmitter.on("WSS_INBOUND_DATA", (source, data) => {

            // console.log('Target sent websocket data to source ');

        })

    })

    proxyInstance.proxyEventsEmitter.on("PROXY_SERVER_READY", (proxyServerPort) => {


        //set up source client


        //make call for connection to proxy
        /**@type {http.RequestOptions} */
        const connectionRequestOptions = {
            method: "CONNECT",
            port: proxyServerPort,
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


                const WebSocketClient = require('websocket').client;

                const client = new WebSocketClient();

                client.on('connectFailed', function (error) {
                    console.log('Connect Error: ' + error.toString());
                });

                client.on('connect', function (connection) {
                    console.log('WebSocket Client Connected');
                    connection.on('error', function (error) {
                        console.log("Connection Error: " + error.toString());
                    });
                    connection.on('close', function () {
                        console.log('echo-protocol Connection Closed');
                    });
                    connection.on('message', function (message) {
                        if (message.type === 'utf8') {
                            console.log("Received: " + message.utf8Data);
                        }
                    });

                    function sendNumber() {
                        if (connection.connected) {
                            let number = Math.round(Math.random() * 0xFFFFFF);
                            connection.sendUTF(number.toString());
                            setTimeout(sendNumber, 1000);
                        }
                    }
                    sendNumber();
                });

                client.connect(`wss://localhost:${httpsServer.address().port}/`, undefined, "localhost", { "Custom-Header": "data" }, {
                    createConnection: function (url, options) {

                        return tlsSocketToTarget

                    },
                    rejectUnauthorized: false,
                    agent: undefined,
                });


            })



        })


        connectionRequest.end();

    })




});




const h2 = require("http2");
const tls = require("tls");
const InterceptorProxy = require("../InterceptorProxy.js");
const { createTempCertificate, createCACertificate } = require("../utils/InterceptorCertificate.js");
const http = require("http");


/**
 * This program is test created for InterceptorProxy.
 * 
 * This test should be run after http2tunneltest.js wich checks if tunneling http2 traffic works correctly.
 * 
 * Target of this test is to check if "Filters" functionality of InterceptorProxy works correctly.
 * 
 * "Filters" are functionality that allows for intercepting and modifying some aspects of specific connections"
 * 
 * This test checks if modifying http2 requests,responses,incoming and outgoing data works correctly.
 * 
 * This test consists of several stages:
 * 
 * Stage 0:
 * We applying filters for specific connetion
 * 
 * Stage 1:
 * http2 client sends request with some data. (we're targeting x-custom-request-header s: "1" and data that is send within request and is "Hello World")
 * 
 * Stage 2:
 * Filters recives and modifying x-custom-request-header value to 0 and change "Hello World" request data to "Hello Void".
 * 
 * Stage 3:
 * Server recives modified content and create standard response for any request. (we're now targeting x-custom-response-header : "1" and response data "<h1>Cool HTML</h1>" )
 * 
 * Stage 4:
 * Filters recives and modifying x-custom-response-header value to 0 and change data "<h1>Cool HTML</h1>" to "<h1>Lame HTML</h1>".
 * 
 * Stage5:
 * Client recives modified response.
 */









let curentStage = 0;

// process.on("uncaughtException", (error) => {

//     const throwstring = `something went wrong in stage ${curentStage}:\n${error.message}`

//     throw throwstring

// })


//create target server
const caCert = createCACertificate("localhostCa");

const certForh2Server = createTempCertificate("localhost", caCert.cert, caCert.privateKey)


const h2serverOptions = {

    key: certForh2Server.tempCertPrivateKey,
    cert: certForh2Server.tempCert,
}

const h2Server = h2.createSecureServer(h2serverOptions);

//handle incoming h2 stream from client
h2Server.on('stream', (stream, headers) => {
    console.log('\ntarget server recived request headers from client:');

    let headersString = '';

    for (let header in headers) {

        headersString += `${header} : ${headers[header]}\n`;

    }

    console.log(headersString);

    if (headers["x-custom-request-header"] == "0") console.log('Server recived modified request header as expected');
    else if ((headers["x-custom-request-header"] == "1")) throw "Server recived unmodified request header ";
    else throw "Server recived unexpected value of request header"

    stream.on("data", (data) => {

        data = data.toString();
        stream.setEncoding("utf-8");

        console.log(`\ntarget server recived request data from client: ${data}`);

        if (data === "Hello Void") console.log('Server recived modified request data as expected');
        else if (data === "Hello World") throw 'Something went wrong server recived unmodified data';
        else throw 'Something went wrong server recived unexpected data'


        stream.respond({
            'content-type': 'text/html; charset=utf-8',
            'x-custom-response-header': 1,
            ':status': 200,
        });
        stream.end('<h1>Cool HTML</h1>');

        console.log(`\ntarget server sent http2 response to source with original response headers:\n'content-type': 'text/html; charset=utf-8'\n'x-custom-response-header': 1\n':status': 200\n\ntarget server sent http2 response data to source: <h1>Cool HTML</h1>`);

        curentStage = 4;

    })




});

h2Server.listen(() => {

    //run proxy
    const proxyInstance = new InterceptorProxy();


    proxyInstance.proxyEventsEmitter.on("PROXY_SERVER_READY", () => {

        //set filters
        proxyInstance.proxyEventsEmitter.on("H2_PROXY_CONNECTION", (connection) => {

            //apply client request filter
            connection.applyFilter("H2_REQUEST", (sourceStream, headers) => {

                headers["x-custom-request-header"] = "0";

                return headers

            })

            //apply client request data filter
            connection.applyFilter("H2_REQUEST_DATA", (sourceStream, dataSink, data) => {

                data = "Hello Void";

                curentStage = 3;

                return data

            })

            //apply client response filter
            connection.applyFilter("H2_RESPONSE", (sourceStream, headers) => {

                headers["x-custom-response-header"] = "0"

                return headers

            })


            //apply client response data filter
            connection.applyFilter("H2_RESPONSE_DATA", (sourceStream, dataSink, data) => {

                data = "<h1>Lame HTML</h1>";

                curentStage = 5;

                return data

            })

            curentStage = 1;
        })


        //make call for connection to proxy
        /**@type {http.RequestOptions} */
        const connectionRequestOptions = {
            method: "CONNECT",
            port: 8000,
            host: "localhost",
            path: "/",
            headers: {
                "Host": `localhost:${h2Server.address().port}`
            }
        }

        const connectionRequest = http.request(connectionRequestOptions, (res) => {

            console.log(res.statusCode, res.statusMessage);

        });

        connectionRequest.end();

        connectionRequest.on("connect", (res, socket, head) => {


            //create tls socket to target server
            /**@type {tls.ConnectionOptions} */
            const tlsOptions = {
                socket: socket,
                host: "localhost",
                port: h2Server.address().port,
                rejectUnauthorized: false,
                ALPNProtocols: ["h2"],
            };

            const tlsSocketToTarget = tls.connect(tlsOptions, () => {


                //create http2 session to target server
                const h2s = h2.connect(`https://localhost:${h2Server.address().port}`, {
                    createConnection: function (url, options) {

                        return tlsSocketToTarget

                    },
                    settings: { enablePush: true }
                });




                const reqStream = h2s.request({
                    ':authority': 'localhost',
                    ':method': 'POST',
                    ':scheme': 'https',
                    ':path': '/',
                    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'accept-encoding': 'gzip, deflate, br',
                    'accept-language': 'en-US,en;q=0.5',
                    'cache-control': 'no-cache',
                    'dnt': '1',
                    'pragma': 'no-cache',
                    'sec-fetch-dest': 'document',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-site': 'none',
                    'sec-fetch-user': '?1',
                    'x-test-session': "1",
                    'x-custom-request-header': "1",
                    "Content-Length": "11",
                });

                reqStream.on('response', (headers, flags) => {

                    console.log(`\nclient recived http2 response headers:`);

                    let headersString = '';

                    for (let header in headers) {

                        headersString += `${header} : ${headers[header]}\n`;

                    }

                    console.log(headersString);

                    if (headers["x-custom-response-header"] == "0") console.log('Client recived modified response header as expected');
                    else if ((headers["x-custom-response-header"] == "1")) throw "Client recived unmodified response header ";
                    else throw "Client recived unexpected value of response header"


                });

                let data = '';
                reqStream.on('data', (chunk) => { data += chunk; });
                reqStream.on('end', () => {
                    console.log(`\nClient recived http2 response data: ${data} `);

                    if (data === "<h1>Lame HTML</h1>") console.log('Client recived modified request data as expected');
                    else if (data === "<h1>Cool HTML</h1>") throw 'Something went wrong client recived unmodified data';
                    else throw 'Something went wrong client recived unexpected data'

                    h2s.close();

                    console.log('\nTest passed evrything is fine...');

                    process.exit();

                });

                reqStream.write("Hello World");


                console.log(`\nclient sent http2 request to target server with orginal headers:\n
                ':authority': 'localhost'\n
                ':method': 'GET'\n
                ':scheme': 'https'\n
                ':path': '/'\n
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'\n
                'accept-encoding': 'gzip, deflate, br'\n
                'accept-language': 'en-US,en;q=0.5'\n
                'cache-control': 'no-cache'\n
                'dnt': '1'\n
                'pragma': 'no-cache'\n
                'sec-fetch-dest': 'document'\n
                'sec-fetch-mode': 'navigate'\n
                'sec-fetch-site': 'none'\n
                'sec-fetch-user': '?1'\n
                'x-test-session': "1"\n
                'x-custom-request-header': "1"\n
                \nClient sent request data original request data: Hello World\n`);


                curentStage = 2;

            });







        })


    })


})
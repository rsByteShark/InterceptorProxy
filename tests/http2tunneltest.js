const h2 = require("http2");
const tls = require("tls");
const InterceptorProxy = require("../InterceptorProxy.js");
const { createTempCertificate, createCACertificate } = require("../utils/InterceptorCertificate.js");
const http = require("http");

/**
 * This program is test created for InterceptorProxy.
 * Target of this test is to check if connecting,intercepting and modify traffic from source to external server through InterceptorProxy works flawless.
 * This test consists of several stages:
 * Stage 1:
 * Create http2 secure server with node js http2 module on random port of localhost.
 * 
 * Stage 2: 
 * Run InterceptorProxy as child process with node js exec command.
 * 
 * Stage 3:
 * Make http CONNECT request to InterceptorProxy to indicate that we want to connect to remote target that was set up in Stage 1.
 * If we recive response status code 200 it means that tunnel was created.
 * 
 * Stage 4:
 * Connect source to target through tls
 * 
 * Stage 5
 * Create http2 client session to target server
 * 
 * Stage 6
 * Create http2 stream to target server.
 * Then send request and recive response.
 * 
 */


let curentStage = 0;

process.on("uncaughtException", (error,) => {

    const throwstring = `something went wrong in stage ${curentStage}:\n${error.message}`

    throw throwstring

})


curentStage = 1;

//create target server
const caCert = createCACertificate("localhostCa");

const certForh2Server = createTempCertificate("localhost", caCert.cert, caCert.privateKey)


const h2serverOptions = {

    key: certForh2Server.tempCertPrivateKey,
    cert: certForh2Server.tempCert,
}

const h2Server = h2.createSecureServer(h2serverOptions);

h2Server.on('stream', (stream, headers) => {
    console.log('\ntarget server recived http2 stream from source through proxy');

    stream.respond({
        'content-type': 'text/html; charset=utf-8',
        ':status': 200,
    });
    stream.end('<h1>Hello World</h1>');

    console.log('\ntarget send http2 response to source');


    console.log('\ntarget http2 stream closed');

});

h2Server.listen(() => {

    console.log(`\nhttp2 server ready on port ${h2Server.address().port} [Stage 1 completed with succes]`);

    curentStage = 2;
    //run proxy
    const proxyInstance = new InterceptorProxy();

    proxyInstance.proxyEventsEmitter.on("PROXY_SERVER_READY", (proxyServerPort) => {

        console.log(`\nProxy server ready on port ${proxyServerPort} [Stage 2 completed with succes]`);

        curentStage = 3;

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


            if (res.statusCode == 200) console.log('\nproxy established connection with target server [Stage 3 completed with succes] ');
            else { const throwstring = `error in stage 3 while proxy tries to connect with external target` }

            curentStage = 4

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

                console.log('\ntls connection with target server established by source through proxy [Stage 4 completed with succes]');

                curentStage = 5;

                //create http2 session to target server
                const h2s = h2.connect(`https://localhost:${h2Server.address().port}`, {
                    createConnection: function (url, options) {

                        return tlsSocketToTarget

                    }
                });

                h2s.on("connect", (session, socket) => {

                    curentStage = 6

                    console.log('\nhttp2 connection with target server established by source through proxy [Stage 5 completed with succes]');

                    const reqStream = session.request({
                        ':authority': 'localhost',
                        ':method': 'GET',
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
                        'x-test-session': "1"
                    });


                    reqStream.on('response', (headers, flags) => {

                        console.log(`\nsource recived http2 response headers with status code ${headers[":status"]}`);


                    });

                    reqStream.setEncoding('utf8');
                    let data = '';
                    reqStream.on('data', (chunk) => { data += chunk; });
                    reqStream.on('end', () => {
                        console.log(`\nsource recived http2 response data of length ${data.length} `);
                        h2s.close();

                        console.log('\nsource http2 stream closed [Stage 6 completed with succes]');

                        console.log('\nTest passed evrything is fine...');

                        process.exit();

                    });

                    reqStream.end();

                })


            });







        })

    })


})
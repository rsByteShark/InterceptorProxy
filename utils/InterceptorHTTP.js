const { EventEmitter } = require("node:events");



class HTTPObject {

    //fields specific for request object type 

    /**@type {string | null} */
    method = null;

    /**@type {string | "null"} */
    path = "null";

    //fields specific for response object type 

    /**@type {string | "none"} */
    responseCode = "none";

    /**@type {string | "-"} */
    responseCodeCommunicat = "-";


    //general fields

    /**@type {"request" | "response" | "raw-binary"} */
    type = null;

    /**@type {number} */
    headersCount = 0;

    /**@type {Buffer | import("./InterceptorHTTP").ChunkInfoObject[] | null} */
    httpEntity = null;

    /**@type {string} */
    httpVersion = null;

    /**@type {boolean} */
    chunked = false;

    /**@type {boolean} */
    isHttp = false;

    /** @type {import("./InterceptorHTTP").HTTPHeaders} */
    headers = {};

    /**@type {boolean | undefined} */
    payloadCompleted;

    /**@type {boolean | undefined} */
    payloadOverflow;

    /**@type {Buffer} */
    overflowBuffer;

    /**
     * @param {Buffer} rawHttpData 
     */
    constructor(rawHttpData) {

        if (!Buffer.isBuffer(rawHttpData)) {

            if (typeof rawHttpData === "string") {

                rawHttpData = Buffer.from(rawHttpData);

            } else {

                throw `unexpected data type in HTTPObject : recived ${typeof rawHttpData} expected Buffer `;

            }


        }

        const result = HTTPObject.resolveHttpDataType(rawHttpData);

        if (result.isHttp) {

            this.type = result.type;

            this.isHttp = true;

            const httpInfoObject = HTTPObject.parseHttp(rawHttpData, result.type);


            this.chunked = httpInfoObject.chunked;

            this.httpVersion = httpInfoObject.httpVersion;

            this.headers = httpInfoObject.headers;

            this.headersCount = httpInfoObject.headersCount;

            this.httpEntity = httpInfoObject.httpData;

            if (this.type === "request") {

                delete this.responseCode;

                delete this.responseCodeCommunicat;

                this.method = httpInfoObject.method;

                this.path = httpInfoObject.path;

            } else {

                delete this.path;

                delete this.method;

                this.responseCode = httpInfoObject.responseCode ? httpInfoObject.responseCode : this.responseCode;

                this.responseCodeCommunicat = httpInfoObject.responseCodeCommunicat ? httpInfoObject.responseCodeCommunicat : this.responseCodeCommunicat;

            }

            this.checkPayloadCompletion();

            const x = 1;

        } else {

            this.type = "raw-binary";

            this.httpEntity = rawHttpData;
        }


    }

    toBinaryForm() {

        let retBuff = Buffer.from("");

        switch (this.type) {
            case "request":

                const methodBuffer = Buffer.from(this.method + " ");

                retBuff = Buffer.concat([retBuff, methodBuffer]);

                const pathBuffer = Buffer.from(this.path + " ");

                retBuff = Buffer.concat([retBuff, pathBuffer]);

                const versionBuffer = Buffer.from(this.httpVersion + "\r\n");

                retBuff = Buffer.concat([retBuff, versionBuffer]);

                for (let header in this.headers) {

                    const headerString = `${header}: ${this.headers[header]}\r\n`;

                    const headerBuffer = Buffer.from(headerString);

                    retBuff = Buffer.concat([retBuff, headerBuffer]);

                }

                retBuff = Buffer.concat([retBuff, Buffer.from("\r\n")]);

                if (this.httpEntity) this.chunked ? retBuff = Buffer.concat([retBuff, this.getChunkedEntityBuffer(true)]) : retBuff = Buffer.concat([retBuff, this.httpEntity]);

                break;
            case "response":

                const resVersionBuffer = Buffer.from(this.httpVersion + " ");

                retBuff = Buffer.concat([retBuff, resVersionBuffer]);

                const codeBuffer = Buffer.from(this.responseCode + " ");

                retBuff = Buffer.concat([retBuff, codeBuffer]);

                const CodeCommunicatBuffer = Buffer.from(this.responseCodeCommunicat + "\r\n");

                retBuff = Buffer.concat([retBuff, CodeCommunicatBuffer]);

                for (let header in this.headers) {

                    const headerString = `${header}: ${this.headers[header]}\r\n`;

                    const headerBuffer = Buffer.from(headerString);

                    retBuff = Buffer.concat([retBuff, headerBuffer]);

                }

                retBuff = Buffer.concat([retBuff, Buffer.from("\r\n")]);

                if (this.httpEntity) this.chunked ? retBuff = Buffer.concat([retBuff, this.getChunkedEntityBuffer(true)]) : retBuff = Buffer.concat([retBuff, this.httpEntity]);

                break;
            case "raw-binary":

                return null

            default:
                throw "error while parsing HTTPObject to rawBinary form"
        }

        return retBuff
    }

    /**@returns {Buffer | null} */
    getChunkedEntityBuffer(encoded = false) {

        if (this.chunked) {

            let decodedEntityBuffer = Buffer.from("");

            for (let i = 0; i < this.httpEntity.length; i++) {

                const chunkInfoObject = this.httpEntity[i];

                if (encoded) {


                    if (chunkInfoObject.size !== 0) {

                        decodedEntityBuffer = Buffer.concat([decodedEntityBuffer, Buffer.from(`${chunkInfoObject.size.toString(16)}\r\n`)]);

                        decodedEntityBuffer = Buffer.concat([decodedEntityBuffer, chunkInfoObject.chunkData]);

                        decodedEntityBuffer = Buffer.concat([decodedEntityBuffer, Buffer.from(`\r\n`)]);

                    } else {

                        decodedEntityBuffer = Buffer.concat([decodedEntityBuffer, Buffer.from(`0\r\n\r\n`)]);

                    }


                } else {

                    if (chunkInfoObject.size !== 0) decodedEntityBuffer = Buffer.concat([decodedEntityBuffer, chunkInfoObject.chunkData]);

                }



            }

            return decodedEntityBuffer

        } else return null

    }

    checkPayloadCompletion() {

        if (this.chunked) {

            if (this.httpEntity.at(-1)?.size === 0) {

                this.payloadCompleted = true;

                this.payloadOverflow = false;

            } else {

                this.payloadCompleted = false;

                this.payloadOverflow = false;

            }

        } else if (this?.headers["Content-Length"]) {

            let expectedPayloadDataLength = Number(this.headers["Content-Length"]);

            if (this.httpEntity.length === expectedPayloadDataLength) {

                this.payloadCompleted = true;

                this.payloadOverflow = false;

            } else if (this.httpEntity.length > expectedPayloadDataLength) {

                this.overflowBuffer = Buffer.from(this.httpEntity.subarray(this.httpEntity.length));

                this.httpEntity = Buffer.from(this.httpEntity.subarray(0, this.httpEntity.length));

                this.payloadOverflow = true;

            } else {

                this.payloadCompleted = false;

            }

        } else {

            this.payloadCompleted = undefined;

        }

    }

    /**
     * 
     * @param {Buffer} rawHttpData 
     * @returns {import("./InterceptorHTTP").ReslovedHttpTypeInfo}
     */
    static resolveHttpDataType(rawHttpData) {

        let retObj = { isHttp: false, type: null };

        let httpData = rawHttpData;

        typeof httpData === "string" ? null : httpData = httpData.toString();

        //check if response
        if (httpData.slice(0, 4) === "HTTP") {

            retObj.isHttp = true;

            retObj.type = "response";


        }

        //check if request
        for (let i = 0; i < HTTPObject.HTTP_METHODS_TABLE.length; i++) {

            const method = HTTPObject.HTTP_METHODS_TABLE[i];

            if (httpData.slice(0, 8).includes(method + " ")) {

                retObj.isHttp = true;

                retObj.type = "request";


            }

        }

        return retObj
    }

    static parseHttp(httpData, type) {

        const retObj = {

            method: "",

            path: "",

            responseCode: "",

            responseCodeCommunicat: "",

            httpVersion: "",

            headers: {},

            headersCount: 0,

            httpData: [],

            chunked: false,
        }


        let iterator = 0;

        let parse = true;

        let parseStage = 0;

        let curentProcessedHeaderName = "";

        let curentProcessedHeaderValue = "";

        let headersCount = 0;

        let processedHeaderMode = "name";


        if (type === "request") {

            while (parse && (iterator < httpData.length)) {

                const curentChar = httpData[iterator];

                switch (parseStage) {

                    case 0:

                        curentChar === 0x20 ? parseStage++ : retObj.method += String.fromCharCode(curentChar);

                        iterator++;

                        break;
                    case 1:

                        curentChar === 0x20 ? parseStage++ : retObj.path += String.fromCharCode(curentChar);

                        iterator++;

                        break;
                    case 2:

                        if (curentChar !== 0xd) {

                            curentChar === 0xa ? parseStage++ : retObj.httpVersion += String.fromCharCode(curentChar);

                        }

                        iterator++;

                        break;
                    case 3:


                        if (processedHeaderMode === "name") {

                            if (curentChar === 0x20) {

                                processedHeaderMode = "value";

                            } else {

                                curentChar !== 0x3a ? curentProcessedHeaderName += String.fromCharCode(curentChar) : null;

                            }


                        } else {

                            if (curentChar !== 0xd) {


                                if (curentChar === 0xa &&
                                    httpData[iterator + 1] !== 0xa &&
                                    httpData[iterator + 2] !== 0xa) {

                                    processedHeaderMode = "name";

                                    headersCount++;

                                    retObj.headers[curentProcessedHeaderName] = curentProcessedHeaderValue;

                                    curentProcessedHeaderName = "";

                                    curentProcessedHeaderValue = "";


                                } else if (curentChar !== 0xa) {

                                    curentProcessedHeaderValue += String.fromCharCode(curentChar);

                                } else if (httpData[iterator + 1] === 0xa) {

                                    parseStage++;


                                    processedHeaderMode = "name";

                                    headersCount++;

                                    retObj.headers[curentProcessedHeaderName] = curentProcessedHeaderValue;

                                    curentProcessedHeaderName = "";

                                    curentProcessedHeaderValue = "";

                                    iterator += 2;

                                    break;

                                } else if (httpData[iterator + 2] === 0xa) {

                                    parseStage++;


                                    processedHeaderMode = "name";

                                    headersCount++;

                                    retObj.headers[curentProcessedHeaderName] = curentProcessedHeaderValue;

                                    curentProcessedHeaderName = "";

                                    curentProcessedHeaderValue = "";

                                    iterator += 3;

                                    break;

                                }

                            }

                        }




                        iterator++;

                        break;
                    case 4:

                        //if headers contains transfer-encoding chunked parse recived chunks
                        if (retObj.headers?.["Transfer-Encoding"] && (retObj.headers["Transfer-Encoding"] === "chunked")) {

                            //mark recived http data as chunked
                            retObj.chunked = true;

                            const retChunks = HTTPObject.handleChunkedData(httpData.subarray(iterator));

                            retObj.httpData = retChunks;

                            iterator = httpData.length


                        } else {

                            retObj.httpData.push(curentChar);


                        }

                        iterator++;
                        break;
                    default:

                        throw "http parse stage error";

                }

            }



        } else if (type === "response") {



            while (parse && (iterator < httpData.length)) {

                const curentChar = httpData[iterator];

                switch (parseStage) {

                    case 0:

                        curentChar === 0x20 ? parseStage++ : retObj.httpVersion += String.fromCharCode(curentChar);

                        iterator++;

                        break;
                    case 1:

                        if (curentChar !== 0xd) {

                            curentChar === 0x20 ? parseStage++ : retObj.responseCode += String.fromCharCode(curentChar);

                            curentChar === 0xa ? parseStage += 2 : null;

                        }



                        iterator++;

                        break;
                    case 2:

                        if (curentChar !== 0xd) {

                            curentChar === 0xa ? parseStage++ : retObj.responseCodeCommunicat += String.fromCharCode(curentChar);

                        }

                        iterator++;

                        break;
                    case 3:


                        if (processedHeaderMode === "name") {

                            if (curentChar === 0x20) {

                                processedHeaderMode = "value";

                            } else {

                                curentChar !== 0x3a ? curentProcessedHeaderName += String.fromCharCode(curentChar) : null;

                            }


                        } else {

                            if (curentChar !== 0xd) {


                                if (curentChar === 0xa &&
                                    httpData[iterator + 1] !== 0xa &&
                                    httpData[iterator + 2] !== 0xa) {

                                    processedHeaderMode = "name";

                                    headersCount++;

                                    retObj.headers[curentProcessedHeaderName] = curentProcessedHeaderValue;

                                    curentProcessedHeaderName = "";

                                    curentProcessedHeaderValue = "";

                                } else if (curentChar !== 0xa) {

                                    curentProcessedHeaderValue += String.fromCharCode(curentChar);

                                } else if (httpData[iterator + 1] === 0xa) {

                                    parseStage++;

                                    processedHeaderMode = "name";

                                    headersCount++;

                                    retObj.headers[curentProcessedHeaderName] = curentProcessedHeaderValue;

                                    curentProcessedHeaderName = "";

                                    curentProcessedHeaderValue = "";

                                    iterator += 2;

                                    break;

                                } else if (httpData[iterator + 2] === 0xa) {

                                    parseStage++;

                                    processedHeaderMode = "name";

                                    headersCount++;

                                    retObj.headers[curentProcessedHeaderName] = curentProcessedHeaderValue;

                                    curentProcessedHeaderName = "";

                                    curentProcessedHeaderValue = "";

                                    iterator += 3;

                                    break;

                                }

                            }

                        }

                        iterator++;

                        break;
                    case 4:

                        //mark http entity as chunked
                        if (retObj.headers?.["Transfer-Encoding"] && (retObj.headers["Transfer-Encoding"] === "chunked")) {

                            retObj.chunked = true;

                            const retChunks = HTTPObject.handleChunkedData(httpData.subarray(iterator));

                            retObj.httpData = retChunks;

                            iterator = httpData.length

                        } else {

                            retObj.httpData.push(curentChar);



                        }

                        iterator++;

                        break;
                    default:

                        throw "http parse stage error";

                }

            }

        }

        retObj.headersCount = headersCount;

        if (!retObj.chunked) {

            retObj.httpData = Buffer.from(retObj.httpData);

        }



        return retObj;

    }

    static getPortAndHost(host) {

        let retObj = { port: null, host: null };

        const indexOfSeparator = host.indexOf(":");

        if (indexOfSeparator === -1) { retObj.host = host; return retObj; };

        retObj.host = host.substring(0, indexOfSeparator);

        retObj.port = host.substring(indexOfSeparator + 1);

        return retObj

    }

    /**
     * @param {Buffer} chunkedData 
     * @returns {import("./InterceptorHTTP").ChunkInfoObject[]}
     */
    static handleChunkedData(chunkedData) {

        /**@type {import("./InterceptorHTTP").ChunkInfoObject[]} */
        const retChunksArr = [];

        let iterator = 0;

        //check if buffer not overflows
        while (chunkedData[iterator + 1] !== undefined) {

            //read chunk size
            let chunkSize = "";

            while (chunkedData[iterator] !== 0xa && (iterator < chunkedData.length)) {

                if (chunkedData[iterator] !== 0xd) {

                    chunkSize += String.fromCharCode(chunkedData[iterator]);

                }

                iterator++;

            }

            chunkSize = Number(`0x${chunkSize}`);

            iterator++;

            //check if buffer contains entire data declared in chunk size

            const expectedChunkEndOffset = (iterator + chunkSize);

            let chunkIsCompleted = true;
            if (chunkedData.length < expectedChunkEndOffset && chunkSize !== 0) {

                //handle lack of data
                chunkIsCompleted = false;

            }

            const chunkData = chunkedData.subarray(iterator, expectedChunkEndOffset);

            //create entry in array
            retChunksArr.push({ size: chunkSize, chunkData: chunkData, completed: chunkIsCompleted });

            //skip trailing \r\n
            iterator += chunkSize === 0 ? 4 : (chunkSize + 2);


        }


        return retChunksArr

    }


    static HTTP_METHODS_TABLE = ["GET", "HEAD", "POST", "PUT", "DELETE", "CONNECT", "OPTIONS", "TRACE", "PATCH"];

}



module.exports.HTTPObject = HTTPObject;




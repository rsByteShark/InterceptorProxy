const forge = require('node-forge');
const fs = require("fs");
const filePath = require("path");
/**
 * @typedef {object} InterceptorCertificate
 * @property {string} tempCert
 * @property {string} tempCertPublicKey
 * @property {string} tempCertPrivateKey
 */

/**
* @param {string} tempCertTarget Usually domain name of page for wich Interceptor has to create fake certificate.
* @param {string} caCertToUse Pem encoded CA certificate ,if not passed then it is readed from "cacert.pem" file
* @param {string} caCertPrivateKey Pem encoded private key of CA certificate ,if not passed then it is readed from "caCertPrivateKey.pem" file.
* @returns {InterceptorCertificate} Object that contains created cert and it's keys (both public and private).
*/
module.exports.createTempCertificate = (tempCertTarget, caCertToUse, caCertPrivateKey) => {


    if (!caCertToUse) caCertToUse = fs.readFileSync(filePath.join(__dirname, "cacert.pem"));

    if (!caCertPrivateKey) caCertPrivateKey = fs.readFileSync(filePath.join(__dirname, "caCertPrivateKey.pem"));


    /**@type {InterceptorCertificate} */
    const retObj = {

        tempCert: null,

        tempCertPublicKey: null,

        tempCertPrivateKey: null

    }


    const loadedCaCert = forge.pki.certificateFromPem(caCertToUse);

    const loadedCaCertPrivateKey = forge.pki.privateKeyFromPem(caCertPrivateKey);

    const tempCertKeys = forge.pki.rsa.generateKeyPair(2048);

    retObj.tempCertPrivateKey = forge.pki.privateKeyToPem(tempCertKeys.privateKey);

    retObj.tempCertPublicKey = forge.pki.publicKeyToPem(tempCertKeys.publicKey);

    // create a new certificate
    const cert = forge.pki.createCertificate();

    // set the public key of the certificate
    cert.publicKey = tempCertKeys.publicKey;

    //create and set serial number
    cert.serialNumber = module.exports.generateRandomSerialNumber();

    // set the validity period of the certificate
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    // set the subject and issuer of the certificate
    const subjectAttrs = [{
        name: 'commonName',
        value: `${tempCertTarget}`
    }, {
        name: 'organizationName',
        value: "InterceptorProject CA"
    }];


    cert.setSubject(subjectAttrs);
    cert.setIssuer(loadedCaCert.issuer.attributes);


    cert.setExtensions([

        {
            name: 'subjectAltName',
            altNames: [{
                type: 2,
                value: `${tempCertTarget}`
            }]
        },

    ])


    // sign the certificate
    cert.sign(loadedCaCertPrivateKey, forge.md.sha256.create());


    retObj.tempCert = forge.pki.certificateToPem(cert) + caCertToUse;

    // verify the certificate
    try {

        loadedCaCert.verify(cert);

    } catch (err) {


        console.log(`there was an error while generating temp cert for ${tempCertTarget} : ${err} `);


    }



    return retObj

}


module.exports.generateRandomSerialNumber = () => {

    let retStr = "";

    let createdSerialNumber = forge.util.bytesToHex(forge.random.getBytesSync(20));

    const firstHalfByte = Number(createdSerialNumber[0]) ? Number(createdSerialNumber[0]) : Number(`0x${createdSerialNumber[0]}`);

    firstHalfByte >= 8 ? createdSerialNumber = `${0}${createdSerialNumber.slice(1)}` : null;

    retStr = createdSerialNumber;



    return retStr

}


/**
 * @typedef {object} InterceptorCaCertificate
 * @property {string} cert pem encoded caCert in form of string
 * @property {string} privateKey pem encoded private key of caCert
 */

/**
 * @param {string} certName name of central authority this cert represents 
 * @returns {InterceptorCaCertificate}
 */
module.exports.createCACertificate = (certName = "InterceptorProject") => {

    const retObj = {
        cert: null,
        privateKey: null,
    }

    // generate a private key
    const caCertKeys = forge.pki.rsa.generateKeyPair(2048);

    // create a new certificate
    const caCert = forge.pki.createCertificate();

    // set the public key of the certificate
    caCert.publicKey = caCertKeys.publicKey;

    //create and set serial number
    caCert.serialNumber = module.exports.generateRandomSerialNumber();

    // set the validity period of the certificate
    caCert.validity.notBefore = new Date();
    caCert.validity.notAfter = new Date();
    caCert.validity.notAfter.setFullYear(caCert.validity.notBefore.getFullYear() + 1);

    // set the subject and issuer of the certificate
    const caCertAttrs = [{
        name: 'commonName',
        value: `${certName} CA`
    }, {
        shortName: 'ST',
        value: certName
    }, {
        name: 'localityName',
        value: certName
    }, {
        name: 'organizationName',
        value: certName
    }, {
        shortName: 'OU',
        value: `${certName} CA`
    }];
    caCert.setSubject(caCertAttrs);
    caCert.setIssuer(caCertAttrs);

    // set the extensions of the certificate
    caCert.setExtensions([{
        name: 'basicConstraints',
        cA: true,
        critical: true,
    }]);

    // sign the certificate with the private key
    caCert.sign(caCertKeys.privateKey, forge.md.sha256.create());

    retObj.cert = forge.pki.certificateToPem(caCert);

    retObj.privateKey = forge.pki.privateKeyToPem(caCertKeys.privateKey);

    return retObj

}






// const xz = InterceptorCertificate.createCACertificate();

// fs.writeFileSync("./cacert.pem", xz.cert);

// fs.writeFileSync("./caCertPrivateKey.pem", xz.privateKey);


// const x = InterceptorCertificate.createTempCertificate("InterceptorServer", fs.readFileSync("./cacert.pem"), fs.readFileSync("./caCertPrivateKey.pem"));

// fs.writeFileSync("./proxyCert.pem", x.tempCert);

// fs.writeFileSync("./proxyCertPrivateKey.pem", x.tempCertPrivateKey);


// const cert = fs.readFileSync("./proxyCert.pem")

// const caCert = fs.readFileSync("./cacert.pem")

// const forgeCert = forge.pki.certificateFromPem(cert);

// const forgecaCert = forge.pki.certificateFromPem(caCert);

// console.log(forgecaCert.verify(forgeCert));


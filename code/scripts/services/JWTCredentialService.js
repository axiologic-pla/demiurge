const openDSU = require('opendsu');
const credentials = openDSU.loadAPI('credentials');
const JWT_ERRORS = credentials.JWT_ERRORS;

class JWTCredentialService {
  async createVerifiableCredential(issuer, subject, options = {}) {
    const jwtVcInstance = await credentials.createJWTVerifiableCredentialAsync(issuer, subject, options);
    const subjectClaims = options.subjectClaims || {};
    for (const claimKey of Object.keys(subjectClaims)) {
      await jwtVcInstance.embedClaimAsync(claimKey, subjectClaims[claimKey]);
    }

    const encodedJwtVc = await jwtVcInstance.getEncodedJWTAsync();
    console.log('encoded jwtVc: ', encodedJwtVc);
    return encodedJwtVc;
  }

  async verifyCredential(encodedJWTVerifiableCredential, rootsOfTrust = []) {
    const jwtVcInstance = await credentials.loadJWTVerifiableCredentialAsync(encodedJWTVerifiableCredential);
    const verifyCredentialStatus = await jwtVcInstance.verifyJWTAsync(rootsOfTrust);

    console.log(jwtVcInstance, verifyCredentialStatus);
    return { jwtVcInstance, verifyCredentialStatus };
  }

  async createVerifiablePresentation(issuer, options) {
    return await credentials.createJWTVerifiablePresentationAsync(issuer, options);
  }

  async verifyPresentation(encodedJWTVerifiablePresentation, rootsOfTrust = []) {
    const loadedPresentation = await credentials.loadJWTVerifiablePresentationAsync(encodedJWTVerifiablePresentation);
    const verifyPresentationStatus = await loadedPresentation.verifyJWTAsync(rootsOfTrust);

    console.log(verifyPresentationStatus);
    return verifyPresentationStatus;
  }
}

function base64UrlDecode(source, keepAsBuffer = false) {
  const buffer = $$.Buffer.from(source, 'base64');
  if (keepAsBuffer) {
    return buffer;
  }

  return buffer.toString('utf-8');
}


function safeParseEncodedJson(data, keepBuffer = false) {
  try {
    return JSON.parse(base64UrlDecode(data, keepBuffer));
  } catch (e) {
    return e;
  }
}

function parseJWTSegments(jwt) {
  if (!jwt) throw new Error(JWT_ERRORS.EMPTY_JWT_PROVIDED);
  if (typeof jwt !== 'string') throw new Error(JWT_ERRORS.INVALID_JWT_FORMAT);

  const segments = jwt.split('.');
  if (segments.length !== 3) throw new Error(JWT_ERRORS.INVALID_JWT_FORMAT);

  const jwtHeader = safeParseEncodedJson(segments[0]);
  if (jwtHeader instanceof Error || !jwtHeader) throw new Error(JWT_ERRORS.INVALID_JWT_HEADER);

  const jwtPayload = safeParseEncodedJson(segments[1]);
  if (jwtPayload instanceof Error || !jwtPayload) throw new Error(JWT_ERRORS.INVALID_JWT_PAYLOAD);

  const jwtSignature = base64UrlDecode(segments[2], true);
  if (jwtSignature instanceof Error || !jwtSignature) throw new Error(JWT_ERRORS.INVALID_JWT_SIGNATURE);

  return { jwtHeader, jwtPayload, jwtSignature };
}

const getCredentialService = () => {
  if (!$$.credentialService) {
    $$.credentialService = new JWTCredentialService();
  }

  return $$.credentialService;
};

export {
  getCredentialService,
  parseJWTSegments
};
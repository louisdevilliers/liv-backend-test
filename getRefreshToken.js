const jsforce = require("jsforce");
const readline = require("readline");
const crypto = require("crypto");
const axios = require('axios');
require("dotenv").config();

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

// need this for oauth
const generateCodeVerifier = () => {
  return crypto.randomBytes(32).toString("hex");
};

// need this for oauth
const generateCodeChallenge = (verifier) => {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
};

const codeVerifier = generateCodeVerifier();
const codeChallenge = generateCodeChallenge(codeVerifier);

const oauth2 = new jsforce.OAuth2({
  loginUrl: "https://test.salesforce.com", // 'test' for sandbox vs 'https://login.salesforce.com'
  clientId: CLIENT_ID,
  clientSecret: CLIENT_SECRET,
  redirectUri: REDIRECT_URI,
  codeVerifier: codeVerifier,
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log(
  "Open the following URL in your browser to authorize the application:"
);
console.log(
  oauth2.getAuthorizationUrl({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope: 'full refresh_token offline_access', //refresh_token offline_access
  })
);

rl.question("Enter the authorization code: ", async (code) => {
  const decodedCode = decodeURIComponent(code.trim());
  try {
    const response = await axios.post('https://test.salesforce.com/services/oauth2/token', null, { //vs login.salesforce
        params: {
            grant_type: 'authorization_code',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            code: decodedCode,
            code_verifier: codeVerifier // Include code verifier
        },
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    });

    const tokenData = response.data;

    console.log('Access Token:', tokenData.access_token);
    console.log('Refresh Token:', tokenData.refresh_token);
    console.log('Instance URL:', tokenData.instance_url);

} catch (err) {
    if (err.response) {
        console.error('Error:', err.response.data.error, err.response.data.error_description);
    } else {
        console.error('Error:', err.message);
    }
} finally {
    rl.close();
}

});
/*
  const conn = new jsforce.Connection({ oauth2 });
  conn.authorize(code, (err, userInfo) => {
    if (err) {
      return console.error('Error: ', err);
    }
    console.log('Access Token:', conn.accessToken);
    console.log('Refresh Token:', conn.refreshToken);
    console.log('Instance URL:', conn.instanceUrl);
    rl.close();
  });
  */
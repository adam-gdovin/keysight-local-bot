const express = require("express");
const CLIENT_ID = process.env.CLIENT_ID;
const fs = require("fs");

const TOKEN_FILE = process.env.TOKENS_FILE || "tokens.json";

function saveToken(token) {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ access_token: token }, null, 4));
}

function loadToken() {
    if (fs.existsSync(TOKEN_FILE)) {
        try {
            return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8")).access_token;
        }
        catch {
            return null;
        }
    }
    return null;
}

async function getAccessTokenData(accessToken) {
    try {
        const response = await fetch('https://id.twitch.tv/oauth2/validate', {
            method: 'GET',
            headers: {
                'Authorization': `OAuth ${accessToken}`
            }
        });

        if (!response.ok) {
            throw new Error(response.statusText)
        } else {
            const data = await response.json();
            return { channel: data.login, expires_in: data.expires_in, access_token: accessToken };
        }
    } catch (error) {
        console.error('❌ Error validating token:', error);
        return null;
    }
}

async function getValidAccessTokenData() {
    let accessToken = loadToken();

    if (accessToken) {
        console.log("🔹 Validating saved access token...");
        const tokenData = await getAccessTokenData(accessToken);
        if (!tokenData || tokenData.expires_in <= 60 * 60 * 24) {
            console.log("❌ Token expired or is about to expire. User must log in again.");
        } else {
            console.log("✅ Token is valid. Channel:", tokenData.channel)
            return tokenData;
        }
    } else {
        console.log("🔹 No saved token found. Logging in...");
    }

    accessToken = await authenticateUser();
    saveToken(accessToken)

    const tokenData = await getAccessTokenData(accessToken);
    if (!tokenData || tokenData.expires_in <= 60 * 60 * 24) {
        console.error("❌ There was an issue with the login process.");
    }
    return tokenData;
}

function authenticateUser() {
    return new Promise(async (resolve, reject) => {
        const { default: getPort, portNumbers } = await import("get-port");
        const port = await getPort({ port: portNumbers(58470, 58479) });

        const app = express();
        const server = app.listen(port, () => {
            console.log("Auth server listening on port", port);
        });

        // Endpoint to handle the OAuth redirect
        app.get('/auth', (req, res) => {
            // This HTML page will be served to the user when the redirect occurs
            res.send(`
                  <html>
                    <head><title>Authentication Successful</title></head>
                    <body>
                      <script>
                        const urlParams = new URLSearchParams(window.location.hash.substr(1)); // Skip the '#'
                        const accessToken = urlParams.get('access_token');
                        fetch("/token?access_token="+accessToken)
                            .then(() => {
                                window.close();
                            })
                      </script>
                    </body>
                  </html>
                `);
        });
        // Endpoint to handle the forwarding of the access token from the redirect page
        app.get("/token", (req, res) => {
            if (req.query && req.query.access_token) {
                resolve(req.query.access_token);
            } else {
                reject();
            }
            res.status(200).send("Success");
            server.close();
            console.log("Auth server closing down");
        });

        //Finally open an external browser window to show the auth page
        const redirectUri = `http://localhost:${port}/auth`;
        const oauthUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=chat:read+chat:edit`;
        const { default: open } = await import("open");
        const authWindow = open(oauthUrl);
    })
}

module.exports = { getValidAccessTokenData };
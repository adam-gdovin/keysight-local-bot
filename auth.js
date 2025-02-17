const express = require("express");
const { select } = require("@inquirer/prompts");
const portfinder = require("portfinder")
const fs = require("fs");
const minimist = require("minimist");
const DebugLog = require("./debug-log");

const ARGS = minimist(process.argv.slice(2));
const CLIENT_ID = ARGS.clientID || process.env.CLIENT_ID;
const TOKEN_FILE = ARGS.tokenFile || process.env.TOKEN_FILE || "token.json";

/**
 * Saves the access token in a local JSON file
 * @param {string} access_token - User's access token to be saved 
 */
function saveToken(access_token) {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ access_token: access_token }, null, 4));
}

/**
 * Reads and parses local JSON file containing the access token
 * @returns {string | null} access_token
 */
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

/**
 * Validates an eixsting access token
 * @param {string} accessToken - Existing twitch user access token 
 * @returns {Object} TokenData
 * @returns {string} TokenData.user - Username of the account that the access token belongs to
 * @returns {number} TokenData.expires_in - Duration in seconds until token's expiry
 * @returns {string} TokenData.access_token - Access token itself
 */
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
            return { user: data.login, expires_in: data.expires_in, access_token: accessToken };
        }
    } catch (error) {
        DebugLog.error("Error validating token:", error);
        return null;
    }
}

/**
 * Checks for the locally stored access_token and its validity, alternatively prompts user to sign in and authorize the app
 * @returns {Object} TokenData
 * @returns {string} TokenData.user - Username of the account that the access token belongs to
 * @returns {number} TokenData.expires_in - Duration in seconds until token's expiry
 * @returns {string} TokenData.access_token - Access token itself
 */
async function getValidAccessTokenData() {
    let accessToken;
    if (ARGS.login) {
        DebugLog.info("Login flag enabled, skipping locally saved token and forcing re-login");
    } else {
        accessToken = loadToken();
        if (accessToken) {
            DebugLog.info("Validating saved access token...");
            const tokenData = await getAccessTokenData(accessToken);
            if (!tokenData || tokenData.expires_in <= 60 * 60 * 24) {
                DebugLog.error("Token expired or is about to expire. User must log in again.");
            } else {
                DebugLog.success(`Token is valid. Signed in as '${tokenData.user}'`)
                return tokenData;
            }
        } else {
            DebugLog.info("No saved token found. Logging in...");
        }
    }

    accessToken = await authenticateUser();
    saveToken(accessToken)

    const tokenData = await getAccessTokenData(accessToken);
    if (!tokenData || tokenData.expires_in <= 60 * 60 * 24) {
        DebugLog.error("There was an issue with the login process.");
    }
    return tokenData;
}

/**
 * Creates a temporary http server to recieve Twitch's redirect with the access token. 
 * @returns {string} access_token 
 */
function authenticateUser() {
    return new Promise(async (resolve, reject) => {
        const port = await portfinder.getPortPromise({ port: 58470, stopPort: 58479 });

        const app = express();
        const server = app.listen(port);
        await new Promise(res => {
            server.once("listening", res);
        });
        DebugLog.info("Auth server listening on port", port);

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
            DebugLog.info("Auth server closing down");
        });

        const redirectUri = `http://localhost:${port}/auth`;
        const oauthUrl = `https://id.twitch.tv/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=chat:read+chat:edit`;

        //We offer the user to select their preferred browser to sign in with. This is useful when the user's bot account is signed in through non-default browser
        const browser = await select({
            default: "browser",
            message: "Select the browser for authentication:",
            choices: [
                { name: "🌍 Default Browser", value: "browser" },
                { name: "🕶️ Default Browser (Incognito Mode)", value: "browserPrivate" },
                { name: "🔵 Google Chrome", value: "chrome" },
                { name: "🦊 Mozilla Firefox", value: "firefox" },
                { name: "🎯 Microsoft Edge", value: "edge" },
                { name: "❌ None (manually open a URL)", value: "manual" }
            ],
        });
        if (browser === "manual") {
            //Let the user manually copy the redirect URL in case they are using non-standard browser
            DebugLog.line(oauthUrl.length);
            console.log(oauthUrl);
            DebugLog.line(oauthUrl.length);
        } else {
            //Finally open an external browser window to show the auth page
            const open = ((await import("open")).default);
            const apps = ((await import("open")).apps);
            const authWindow = await open(oauthUrl, {
                app: {
                    name: apps[browser]
                }
            });
        }
    })
}

module.exports = { getValidAccessTokenData }
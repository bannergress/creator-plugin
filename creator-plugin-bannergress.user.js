// ==UserScript==
// @id           mission-creator-to-bannergress
// @name         Mission Creator to Bannergress
// @category     Misc
// @match        https://missions.ingress.com/*
// @require      https://unpkg.com/jso@4.1.1/dist/jso.js
// @version      0.3.1
// @namespace    https://github.com/bannergress/creator-plugin
// @updateURL    https://bannergress.com/creator-plugin-bannergress.user.js
// @downloadURL  https://bannergress.com/creator-plugin-bannergress.user.js
// @run-at       document-idle
// ==/UserScript==

;

(async function() {
    const api = "https://api.bannergress.com";
    const realm = "bannergress";
    const clientId = "bannergress-creator-plugin";
    const keycloakUrl = "https://login.bannergress.com/auth";

    const getHash = function () {
        for (let i = 0; i < document.scripts.length; i++) {
            const script = document.scripts[i];
            const match = script.src.match(/gen_bg_([a-f0-9]+).js/);
            if (match) {
                return match[1];
            };
        }
    }

    const createHeaders = function() {
        return {
            "content-type": "application/json;charset=UTF-8",
            "version-sha1": getHash(),
            "x-xsrf-token": document.cookie.match(/XSRF-TOKEN=([^,.]+)/)[1]
        };
    }

    const executeApiCall = async function(path, payload) {
        const payloadString = JSON.stringify({
            ...payload,
            b: "",
            c: "mxkd"
        });
        const response = await fetch(path, {
            method: "POST",
            headers: createHeaders(),
            body: payloadString,
            credentials: "include"
        });
        return await response.json();
    }

    const getMissionIds = async function(bannerId) {
        const response = await fetch(`${api}/bnrs/${encodeURIComponent(bannerId)}`);
        const banner = await response.json();
        return Object.values(banner.missions).map(m => m.id).filter(id => id);
    }

    const importMission = async function(request, response, token) {
        const payloadString = JSON.stringify({
            request,
            response
        });
        const importResponse = await fetch(`${api}/import/getMissionForProfile`, {
            method: "POST",
            mode: "cors",
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            },
            body: payloadString
        })
        if (!importResponse.ok) {
            console.error({request, response, importResponse});
            throw "Error importing!";
        }
    }

    // Check whether we are already logged into Niantic
    if (document.querySelector(".sign-in-button")) {
        return;
    }

    // Extract the banner to refresh
    const params = new URLSearchParams(document.location.search);
    const bannerId = params.get("bgRefresh");
    const missionId = params.get("bgRefreshMission");
    if (!bannerId && !missionId) {
        return;
    }

    const outer = document.createElement("div");
    outer.id = "mcbgBlur";
    outer.style = "position: fixed; left: 0; right: 0; top: 0; bottom: 0; z-index: 10000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(5px)";
    document.body.appendChild(outer);

    const message = document.createElement("div");
    message.id = "mcbgMessage";
    message.style = "background: black; width: 80%; height: 5em; margin: 2em; display: flex; justify-content: center; align-items: center; border: 1px solid #5afbea";
    outer.appendChild(message);

    try {
        // Authenticate
        message.innerText = `Authenticating...`;
        const client = new jso.JSO({ // eslint-disable-line no-undef
            providerID: "bannergress",
            client_id: clientId,
            redirect_uri: window.location.href,
            authorization: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/auth`,
            scopes: { request: ["openid"] }
        });
        client.callback();
        await client.getToken();

        let missionIds;
        if (bannerId) {
            // Request mission IDs for given banner
            message.innerText = `Requesting missions for banner ${bannerId}...`;
            missionIds = await getMissionIds(bannerId);
        } else if (missionId) {
            const missionIdString = missionId === 'prompt' ? prompt('Mission IDs') : missionId;
            missionIds = missionIdString.split(/[\s,;]+/);
        }

        // Confirm refresh
        if (!confirm("Refresh missions:\n" + missionIds.join("\n"))) {
            return;
        }

        for (const missionId of missionIds) {
            // Request mission
            const request = {
                "mission_guid": missionId
            };
            message.innerText = `Downloading mission ${missionId}...`;
            const response = await executeApiCall("/api/author/getMissionForProfile", request);

            // Import mission
            message.innerText = `Getting upload token...`;
            const token = await client.getToken({allowredir: false});
            message.innerText = `Importing mission ${missionId}...`;
            try {
                await importMission(request, response, token.access_token);
            } catch (e) {
                console.warn("Failed to import mission, trying again in 10 seconds...");
                await new Promise(resolve => setTimeout(resolve, 10000));
                await importMission(request, response, token.access_token);
            }
        }

        message.innerText = "🗹 Import completed.";
    } catch (e) {
        message.innerText = "❌ Import failed, check console for details.";
        throw e;
    }

    // add close button
    const button = document.createElement("button");
    button.id = "mcbgButton";
    button.title = "X"
    button.innerText = "X";
    button.value = "Close";
    button.type = "button";
    button.style = "margin-left:2em; padding: revert;";
    button.onclick = function (){const e = document.querySelector('#mcbgBlur');e.parentElement.removeChild(e);};
    message.appendChild(button);
})();

// ==UserScript==
// @name         Mission Creator to Bannergress
// @match        https://missions.ingress.com/*
// @require      https://unpkg.com/jso/dist/jso.js
// @version      0.2
// @namespace    https://github.com/bannergress/creator-plugin
// @updateURL    https://bannergress.com/creator-plugin-bannergress.user.js
// @downloadURL  https://bannergress.com/creator-plugin-bannergress.user.js
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
    const bannerId = new URLSearchParams(document.location.search).get("bgRefresh");
    if (!bannerId) {
        return;
    }

    const outer = document.createElement("div");
    outer.style = "position: absolute; left: 0; right: 0; top: 0; bottom: 0; z-index: 10000; display: flex; justify-content: center; align-items: center; backdrop-filter: blur(5px)";
    document.body.appendChild(outer);

    const message = document.createElement("div");
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

        // Request mission IDs
        message.innerText = `Requesting missions for banner ${bannerId}...`;
        const missionIds = await getMissionIds(bannerId);

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
            const token = await client.getToken();
            message.innerText = `Importing mission ${missionId}...`;
            await importMission(request, response, token.access_token);
        }

        message.innerText = "🗹 Import completed.";
    } catch (e) {
        message.innerText = "❌ Import failed, check console for details.";
        throw e;
    }
})();

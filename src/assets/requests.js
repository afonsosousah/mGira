let ws;

async function make_post_request(url, body, accessToken=null){
    response = await fetch("proxy.php", {
        method: "POST",
        headers: {
            "User-Agent": "Gira/3.2.8 (Android 34)",
            "X-Proxy-URL": url,
            "Content-Type": "application/json",
            "Priority": "high",
            "X-Authorization": `Bearer ${accessToken}`
        },
        body: body
    });
    if(response.status == 401) {
        // refresh token
        token_refresh();
    } else if(response.ok) {
        responseObject = await response.json();

        // Handle wrong credentials error
        if (responseObject.error && responseObject.error.message == "Invalid credentials.") { 
            alert("Crendenciais inválidas");
            return;
        }

        return responseObject;
    } else if(response.status == 400) {
        responseObject = await response.json();
        if (responseObject.errors[0].message == "trip_interval_limit") {
            alert("Tem de esperar 5 minutos entre viagens.");
            return;
        }
        else if (responseObject.errors[0].message == "already_active_trip") {
            alert("Já tem uma viagem a decorrer!");
            return;
        }
        else if (responseObject.errors[0].message == "unable_to_start_trip") {
            alert("Não foi possível iniciar a viagem.");
            return;
        }
        else if (responseObject.errors[0].message == "trip_not_found") {
            alert("Viagem não encontrada.");
            return;
        }
        else if (responseObject.errors[0].message == "invalid_arguments") {
            alert("Argumentos inválidos.");
            return;
        }
        else if (responseObject.errors[0].message != "Error executing document.")
            alert(responseObject.errors[0].message);

        // Hide login menu if it is showing
        if (document.querySelector('.login-menu'))
        document.querySelector('.login-menu').remove();

        // Wait before making next request (to allow token to get refreshed)
        await delay(200);

        return await make_post_request(url, body, accessToken);
        //return responseObject;
    }
}

async function make_get_request(url, accessToken=null){
    response = await fetch("proxy.php", {
        method: "GET",
        headers: {
            "X-Proxy-URL": url,
            "X-Authorization": `Bearer ${accessToken}`
        }
    });
    if(response.status == 401) {
        // refresh token
        token_refresh();
    } else if(response.ok) {
        responseObject = await response.json();
        return responseObject;
    } else if(response.status == 400) {
        responseObject = await response.json();
        //alert(responseObject.errors[0].message);
        return await make_get_request(url, accessToken);
        //return responseObject;
    }
}

function startWSConnection(force=false) {
    console.log('startWSConnection was called');
    // if connection already exists, close the old one first
    if(typeof ws !== "undefined" && ws.readyState === WebSocket.OPEN) {
        console.log('An open connection already existed');

        if(force === true) {
            ws.send(JSON.stringify({"type":"stop"}));
            ws.onopen = ws.onmessage = ws.onerror = ws.onclose = undefined;
        }
        else
            return;
    }

    ws = new WebSocket('wss://apigira.emel.pt/graphql', 'graphql-ws');

    ws.onopen = function(){
        ws.send(JSON.stringify({"type":"connection_init"}));
        ws.send(JSON.stringify({
            "type": "start",
            "id": crypto.randomUUID(),
            "payload": {
                "operationName": "activeTripSubscription",
                "query": "subscription activeTripSubscription($_access_token: String) { activeTripSubscription(_access_token: $_access_token) { code bike startDate endDate cost finished canPayWithMoney canUsePoints clientPoints tripPoints canceled period periodTime error}}",
                "variables": {
                    "_access_token": user.accessToken
                }
            }
        }));
        ws.send(JSON.stringify({
            "type": "start",
            "id": crypto.randomUUID(),
            "payload": {
               "operationName": "operationalStationsSubscription",
               "query": "subscription operationalStationsSubscription {operationalStationsSubscription {assetCondition, assetStatus, assetType, code, description, latitude, longitude, name, bikes, docks, serialNumber, stype}}",
               "variables": {
                  "_access_token": user.accessToken
               }
            }
        }));
    }    

    ws.onmessage = function(msg) {
        //console.log(msg);
        if(typeof msg.data != "undefined") {
            let msgObj = JSON.parse(msg.data);
            if(Object.hasOwn(msgObj, 'payload') && msgObj.payload)
            {
                if(Object.hasOwn(msgObj.payload, 'data') && msgObj.payload.data && Object.hasOwn(msgObj.payload.data, 'activeTripSubscription')) {
                    activeTripObj = msgObj.payload.data.activeTripSubscription;
                    //console.log(activeTripObj);
                    if(activeTripObj.code != "no_trip" && activeTripObj.code != "unauthorized"){
                        // Real trip info
                        if(activeTripObj.finished === true && !ratedTripsList.includes(activeTripObj.code)) {
                            // End trip
                            tripEnded = true;
                            cancel_bike_reserve();

                            // Show the rate trip menu
                            if (!document.getElementById("rateTripMenu"))  // check if there is a menu already open
                                openRateTripMenu(activeTripObj);
                        }
                        else if (activeTripObj.finished === false) {
                            // Show the trip overlay if it is not shown already and the user is not on navigation
                            if (!document.querySelector('#tripOverlay') && !navigationActive) {
                                // show the trip overlay if user is not in navigation
                                let tripOverlay = document.createElement("div");
                                tripOverlay.className = "trip-overlay";
                                tripOverlay.id = "tripOverlay"
                                tripOverlay.innerHTML = 
                                `
                                    <span id="onTripText">Em viagem</span>
                                    <img src="assets/images/mGira_bike_black.png" alt="bike" id="bikeLogo">
                                    <span id="tripCost">0.00€</span>
                                    <span id="tripTime">00:00:00</span>
                                    <img src="assets/images/gira_footer.svg" alt="footer" id="footer">
                                `.trim();
                                document.body.appendChild(tripOverlay);
                        
                                // start the trip timer
                                tripEnded = false;
                                tripTimer(new Date(activeTripObj.startDate));
                            }
                            // If there is navigation happening and ther is no trip timer already running, start the trip timer
                            else if (navigationActive && !tripTimerRunning) {
                                // start the trip timer
                                tripEnded = false;
                                tripTimer(new Date(activeTripObj.startDate));
                            }
                        }
                    }
                    else if (activeTripObj.code == "unauthorized") {
                        // close current connection
                        ws.send(JSON.stringify({"type":"stop"}));
                        ws = undefined;

                        // refresh token
                        token_refresh();
                    }
                }
                else if(Object.hasOwn(msgObj.payload, 'errors') && msgObj.payload.errors) {
                    //alert(msgObj.payload.errors[0].message);

                    // The subscription errored out, restart connection
                    startWSConnection(true);
                }
            }
        }
    }

    ws.onerror = function(ev) {
        console.log(ev);
    }

    ws.onclose = function(ev) {
        console.log(ev);
        startWSConnection(); // reconnect automatically if the connection gets closed
    }
}

function checkToken(callback) {
    if(tokenRefreshed === false)
        setTimeout(checkToken.bind(null, callback, arguments[1], arguments[2], user.accessToken), 0);
    else {
        tokenRefreshSuccessHandler()

        // always use the latest access token
        return callback(arguments[1], arguments[2], user.accessToken);
    }
}

function tokenRefreshSuccessHandler() {
    console.log("Token has been refreshed!");

    // Hide login menu if it is showing
    if (document.querySelector('.login-menu'))
        document.querySelector('.login-menu').remove();
}
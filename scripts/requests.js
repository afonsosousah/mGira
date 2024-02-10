let ws;
let proxyURL;
let activeTripObj;
let numberOfRequestTries = 5;
let currentRequestTry = 0;

async function makePostRequest(url, body, accessToken = null) {
	// Increment current request try
	currentRequestTry += 1;

	const response = await fetch(proxyURL, {
		method: "POST",
		headers: {
			"User-Agent": "Gira/3.2.8 (Android 34)",
			"X-Proxy-URL": url,
			"Content-Type": "application/json",
			Priority: "high",
			"X-Authorization": `Bearer ${accessToken}`,
		},
		body: body,
	});
	if (response.status === 401) {
		// refresh token
		accessToken = await tokenRefresh();

		// check if token refresh was successful
		if (typeof accessToken !== "undefined") {
			// try to make request again
			return await makePostRequest(url, body, accessToken); // be sure to use latest available token
		}
	} else if (response.ok) {
		const responseObject = await response.json();

		// Handle wrong credentials error
		if (responseObject.error && responseObject.error.message === "Invalid credentials.") {
			alert("Crendenciais inválidas");
			return;
		}

		// Reset currentRequestTry
		currentRequestTry = 0;

		return responseObject;
	} else if (response.status === 400) {
		const responseObject = await response.json();
		if (Object.hasOwn(responseObject, "statusDescription")) {
			if (
				responseObject.statusDescription.includes("The Email field is required.") ||
				responseObject.statusDescription.includes("The Password field is required.")
			)
				alert("Por favor preencha os campos de email e password!");
		} else if (responseObject.errors[0].message === "trip_interval_limit") {
			alert("Tem de esperar 5 minutos entre viagens.");
		} else if (responseObject.errors[0].message === "already_active_trip") {
			alert("Já tem uma viagem a decorrer!");
		} else if (responseObject.errors[0].message === "unable_to_start_trip") {
			alert("Não foi possível iniciar a viagem.");
		} else if (responseObject.errors[0].message === "trip_not_found") {
			alert("Viagem não encontrada.");
		} else if (responseObject.errors[0].message === "invalid_arguments") {
			alert("Argumentos inválidos.");
		} else if (responseObject.errors[0].message === "bike_already_in_trip") {
			alert("Bicicleta já em viagem.");
		} else if (responseObject.errors[0].message === "already_has_active_trip") {
			alert("Já tem uma viagem a decorrer.");
		} else if (responseObject.errors[0].message === "no_bike_found") {
			alert("Bicicleta não encontrada.");
		} else if (responseObject.errors[0].message === "bike_on_repair") {
			alert("Bicicleta a ser reparada.");
		} else if (responseObject.errors[0].message !== "Error executing document.") {
			// Show general error message for unknown errors
			alert(responseObject.errors[0].message);
		} else if (responseObject.errors[0].message === "Error executing document.") {
			// Common API processing error
			// try for x times to do the request, otherwise just error out
			if (currentRequestTry < numberOfRequestTries) {
				// Wait before making next request (reduce error rate)
				await delay(200);
				return await makePostRequest(url, body, accessToken);
			} else {
				// Warn user about the API error
				alert("Erro da API");

				// Hide user menu if it is showing
				hideUserSettings();

				// Hide search place menu if it is showing
				hidePlaceSearchMenu();

				// Hide bike list menu if it is showing
				let bikeListMenu = document.getElementById("bikeMenu");
				if (bikeListMenu) {
					bikeListMenu.classList.add("smooth-slide-to-bottom");
					setTimeout(() => bikeListMenu.remove(), 500); // remove element after animation
					return; // prevent station card from being hidden if there was a bike list menu
				}

				// Hide station card if it is showing
				let menu = document.getElementById("stationMenu");
				if (menu) {
					menu.classList.add("smooth-slide-to-left");
					setTimeout(() => menu.remove(), 500); // remove element after animation
					document.getElementById("zoomControls").classList.add("smooth-slide-down-zoom-controls"); // move zoom controls back down
				}

				// Reset currentRequestTry
				currentRequestTry = 0;

				return;
			}
		}
	}
}

async function makeGetRequest(url, accessToken = null) {
	// Proxy is not needed for these GET requests
	const response = await fetch(url, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${accessToken}`,
		},
	});
	if (response.status === 401) {
		// refresh token
		tokenRefresh();
	} else if (response.ok) {
		const responseObject = await response.json();
		return responseObject;
	} else if (response.status === 400) {
		const responseObject = await response.json();
		//alert(responseObject.errors[0].message);
		return await makeGetRequest(url, accessToken);
		//return responseObject;
	}
}

function startWSConnection(force = false) {
	console.log("startWSConnection was called");
	// if connection already exists, close the old one first
	if (typeof ws !== "undefined" && ws.readyState === WebSocket.OPEN) {
		console.log("An open connection already existed");

		if (force === true) {
			ws.send(JSON.stringify({ type: "stop" }));
			ws.onopen = ws.onmessage = ws.onerror = ws.onclose = undefined;
		} else return;
	}

	ws = new WebSocket("wss://apigira.emel.pt/graphql", "graphql-ws");

	ws.onopen = () => {
		ws.send(JSON.stringify({ type: "connection_init" }));
		ws.send(
			JSON.stringify({
				type: "start",
				id: crypto.randomUUID(),
				payload: {
					operationName: "activeTripSubscription",
					query:
						"subscription activeTripSubscription($_access_token: String) { activeTripSubscription(_access_token: $_access_token) { code bike startDate endDate cost finished canPayWithMoney canUsePoints clientPoints tripPoints canceled period periodTime error}}",
					variables: {
						_access_token: user.accessToken,
					},
				},
			})
		);
		ws.send(
			JSON.stringify({
				type: "start",
				id: crypto.randomUUID(),
				payload: {
					operationName: "operationalStationsSubscription",
					query:
						"subscription operationalStationsSubscription {operationalStationsSubscription {assetCondition, assetStatus, assetType, code, description, latitude, longitude, name, bikes, docks, serialNumber, stype}}",
					variables: {
						_access_token: user.accessToken,
					},
				},
			})
		);
	};

	ws.onmessage = msg => {
		//console.log(msg);
		if (typeof msg.data !== "undefined") {
			let msgObj = JSON.parse(msg.data);
			if (Object.hasOwn(msgObj, "payload") && msgObj.payload) {
				if (
					Object.hasOwn(msgObj.payload, "data") &&
					msgObj.payload.data &&
					Object.hasOwn(msgObj.payload.data, "activeTripSubscription")
				) {
					activeTripObj = msgObj.payload.data.activeTripSubscription;
					//console.log(activeTripObj);
					if (activeTripObj.code !== "no_trip" && activeTripObj.code !== "unauthorized") {
						// Real trip info
						if (activeTripObj.finished === true && !ratedTripsList.includes(activeTripObj.code)) {
							// End trip
							tripEnded = true;

							// Show the rate trip menu
							if (!document.getElementById("rateTripMenu")) openRateTripMenu(activeTripObj);
						} else if (activeTripObj.finished === false) {
							// Show the trip overlay if it is not shown already and the user is not on navigation
							if (!document.querySelector("#tripOverlay") && !navigationActive) {
								// show the trip overlay if user is not in navigation
								let tripOverlay = document.createElement("div");
								tripOverlay.className = "trip-overlay";
								tripOverlay.id = "tripOverlay";
								tripOverlay.innerHTML = `
									<span id="onTripText">Em viagem</span>
									<img src="assets/images/mGira_riding.gif" alt="bike" id="bikeLogo">
									<span id="tripCost">0.00€</span>
									<span id="tripTime">00:00:00</span>
									<a id="callAssistance" href="tel:211163125"><i class="bi bi-exclamation-triangle"></i></a>
									<img src="assets/images/gira_footer_white.svg" alt="footer" id="footer">
                                `.trim();
								document.body.appendChild(tripOverlay);

								// start the trip timer
								tripEnded = false;
								tripTimer(Date.parse(activeTripObj.startDate));
							}
							// If there is navigation happening and there is no trip timer already running, start the trip timer
							else if (navigationActive && !tripTimerRunning) {
								// start the trip timer
								tripEnded = false;
								tripTimer(Date.parse(activeTripObj.startDate));
							}
						}
					} else if (activeTripObj.code === "unauthorized") {
						// close current connection
						ws.send(JSON.stringify({ type: "stop" }));
						ws = undefined;

						// refresh token
						tokenRefresh();
					}
				} else if (Object.hasOwn(msgObj.payload, "errors") && msgObj.payload.errors) {
					//alert(msgObj.payload.errors[0].message);

					// The subscription errored out, restart connection
					startWSConnection(true);
				}
			}
		}
	};

	ws.onerror = ev => console.log(ev);
	ws.onclose = ev => {
		console.log(ev);
		startWSConnection(); // reconnect automatically if the connection gets closed
	};
}

function checkToken(callback) {
	if (tokenRefreshed === false)
		return setTimeout(() => checkToken(callback, arguments[1], arguments[2], user.accessToken), 0);
	else {
		tokenRefreshSuccessHandler();

		// always use the latest access token
		return callback(arguments[1], arguments[2], user.accessToken);
	}
}

function tokenRefreshSuccessHandler() {
	console.log("Token has been refreshed!");

	// Hide login menu if it is showing
	if (document.querySelector(".login-menu")) document.querySelector(".login-menu").remove();
}

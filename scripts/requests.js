let ws;
let proxyURL = null;
let activeTripObj;
let currentRequestTry = 0;

const NUMBER_OF_RETRIES = 5;
const DEFAULT_PROXY = "https://corsproxy.afonsosousah.workers.dev/";

async function makePostRequest(url, body, accessToken = null) {
	// Increment current request try
	currentRequestTry += 1;

	const response = await fetch(proxyURL ?? DEFAULT_PROXY, {
		method: "POST",
		headers: {
			"User-Agent": "Gira/3.4.0 (Android 34)",
			"X-Proxy-URL": url,
			"Content-Type": "application/json",
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
		if (responseObject.errors[0].message === "trip_interval_limit") {
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
		} else if (
			responseObject.errors[0].message === "bike_on_repair" ||
			responseObject.errors[0].message === "bike_in_repair"
		) {
			alert("Bicicleta a ser reparada.");
		} else if (responseObject.errors[0].message !== "Error executing document.") {
			// Show general error message for unknown errors
			alert(responseObject.errors[0].message);
		} else if (responseObject.errors[0].message === "Error executing document.") {
			// Common API processing error
			// try for x times to do the request, otherwise just error out
			if (currentRequestTry < NUMBER_OF_RETRIES) {
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
	} else if (response.status === 403) {
		// Common API processing error
		// try for x times to do the request, otherwise just error out
		if (currentRequestTry < NUMBER_OF_RETRIES) {
			// Wait before making next request (reduce error rate)
			await delay(200);
			return await makePostRequest(url, body, accessToken);
		} else {
			// Warn user about the API error
			alert("Erro da API (403)");

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
		accessToken = await tokenRefresh();

		// check if token refresh was successful
		if (accessToken) {
			// try to make request again
			return await makeGetRequest(url, accessToken); // be sure to use latest available token
		}
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
	// if connection already exists, close the old one first
	if (typeof ws !== "undefined" && ws.readyState === WebSocket.OPEN) {
		if (force === true) {
			ws.send(JSON.stringify({ type: "stop" }));
			ws.onopen = ws.onmessage = ws.onerror = ws.onclose = undefined;
		} else return;
	}

	if (!user.accessToken) return;

	ws = new WebSocket("wss://egira-proxy-arqetk5clq-ew.a.run.app/ws/graphql", "graphql-ws");

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

	ws.onmessage = async msg => {
		if (typeof msg.data !== "undefined") {
			let msgObj = JSON.parse(msg.data);
			if (Object.hasOwn(msgObj, "payload") && msgObj.payload) {
				if (
					Object.hasOwn(msgObj.payload, "data") &&
					msgObj.payload.data &&
					Object.hasOwn(msgObj.payload.data, "activeTripSubscription")
				) {
					activeTripObj = msgObj.payload.data.activeTripSubscription;
					if (activeTripObj.code !== "no_trip" && activeTripObj.code !== "unauthorized") {
						// Real trip info
						if (activeTripObj.finished) {
							// End trip
							tripEnded = true;

							// Add trip to the finished trips list
							if (!finishedTripsList.includes(activeTripObj.code)) finishedTripsList.push(activeTripObj.code);

							// Show the rate trip menu (if trip has not been rated)
							if (!ratedTripsList.includes(activeTripObj.code) && !tripBeingRated) openRateTripMenu(activeTripObj);
						} else if (!finishedTripsList.includes(activeTripObj.code) && !onFakeTrip) {
							// Show the trip overlay if it is not shown already and the user is not on navigation
							if (!document.querySelector("#tripOverlay") && !navigationActive) {
								// show the trip overlay if user is not in navigation
								appendElementToBodyFromHTML(
									`
								<div class="trip-overlay" id="tripOverlay">
									<span id="onTripText">Em viagem</span>
									<img src="assets/images/mGira_riding.gif" alt="bike" id="bikeLogo">
									<span id="tripBike">${activeTripObj.bike}</span>
									<span id="tripCost">0.00€</span>
									<span id="tripTime">00:00:00</span>
									<a id="callAssistance" href="tel:211163125"><i class="bi bi-exclamation-triangle"></i></a>
									<img src="assets/images/gira_footer_white.svg" alt="footer" id="footer">
								<div>
								`.trim()
								);

								// Change map dots to available docks
								loadStationMarkersFromArray(stationsArray, true);

								// If user is in landscape when the trip starts, put into navigation UI
								if (window.matchMedia("(orientation: landscape)").matches && !navigationActive) {
									goIntoLandscapeNavigationUI();
								}

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
					} else if (activeTripObj.code === "no_trip" && !onFakeTrip) {
						// End trip
						tripEnded = true;
						// If in navigation UI, change to default UI
						exitLandscapeNavigationUI();
					} else if (activeTripObj.code === "unauthorized") {
						// refresh token
						await tokenRefresh();

						// close current connection
						ws.send(JSON.stringify({ type: "stop" }));
						ws = undefined;
					}
				} else if (
					Object.hasOwn(msgObj.payload, "data") &&
					msgObj.payload.data &&
					Object.hasOwn(msgObj.payload.data, "operationalStationsSubscription")
				) {
					let newStationsArray = msgObj.payload.data.operationalStationsSubscription;

					if (!document.getElementById("placeSearchMenu")) {
						loadStationMarkersFromArray(newStationsArray, !tripEnded); // Load the stations to the map
					}

					// update stations array
					stationsArray = newStationsArray;
				} else if (Object.hasOwn(msgObj.payload, "errors") && msgObj.payload.errors) {
					console.log(msgObj.payload.errors[0].message);
					// The subscription errored out, restart connection
					//startWSConnection(true);
				}
			}
		}
	};

	ws.onerror = ev => console.log(ev);
	ws.onclose = ev => {
		startWSConnection(); // reconnect automatically if the connection gets closed
	};
}

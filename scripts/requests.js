let ws;
let proxyURL = null;
let activeTripObj;
let currentRequestTry = 0;

const GIRA_GRAPHQL_ENDPOINT = "https://c2g091p01.emel.pt/api/graphql";
const GIRA_GRAPHQL_WS_ENDPOINT = "wss://c2g091p01.emel.pt/ws/graphql";
const GIRA_AUTH_ENDPOINT = "https://api-auth.emel.pt/auth";
const GIRA_TOKEN_REFRESH_ENDPOINT = "https://api-auth.emel.pt/token/refresh";
const GIRA_USER_ENDPOINT = "https://api-auth.emel.pt/user";
const FIREBASE_TOKEN_URL = "https://luk.moe/girabot_tokens/exchange";

const NUMBER_OF_RETRIES = 3;
const DEFAULT_PROXY = "https://corsproxy.afonsosousah.workers.dev/";

async function makeProxyRequest(url, init) {
	return fetch(proxyURL ?? DEFAULT_PROXY, {
		...init,
		headers: {
			...init.headers,
			"X-Proxy-URL": url,
		},
	});
}

const errorTranslations = {
	trip_interval_limit: "Tem de esperar 5 minutos entre viagens.",
	already_active_trip: "Já tem uma viagem a decorrer!",
	unable_to_start_trip: "Não foi possível iniciar a viagem.",
	trip_not_found: "Viagem não encontrada.",
	invalid_arguments: "Argumentos inválidos.",
	bike_already_in_trip: "Bicicleta já em viagem.",
	bike_already_reserved: "Bicicleta já reservada.",
	already_has_active_trip: "Já tem uma viagem a decorrer.",
	no_bike_found: "Bicicleta não encontrada.",
	bike_on_repair: "Bicicleta a ser reparada.",
	bike_in_repair: "Bicicleta a ser reparada.",
	not_enough_balance:
		'Saldo negativo. Se isto se deve a uma viagem mal terminada, por favor contacte <a href="mailto:gira@emel.pt">gira@emel.pt</a>',
	has_no_active_subscriptions: "Não tem um passe ativo.",
};

async function makePostRequest(body, accessToken = null) {
	const url = user.firebaseToken ? GIRA_GRAPHQL_ENDPOINT : GIRA_GRAPHQL_WS_ENDPOINT.replace("wss", "https");
	// Increment current request try
	currentRequestTry += 1;

	const response = await makeProxyRequest(url, {
		method: "POST",
		headers: {
			"User-Agent": "Gira/3.4.3 (Android 34)",
			"Content-Type": "application/json",
			"X-Authorization": `Bearer ${accessToken}`,
			...(user.firebaseToken
				? { "X-Firebase-Token": await encryptFirebaseToken(user.firebaseToken, user.accessToken) }
				: {}),
		},
		body: body,
	});
	if (response.status === 401) {
		// Request unauthorized, retry x times

		// refresh token
		accessToken = await tokenRefresh();
		// se o token tiver expirado
		if (!getCookie("firebaseToken")) {
			const firebaseToken = await fetchFirebaseToken(user.accessToken);
			if (!firebaseToken) delete user.firebaseToken;
		}

		// check if token refresh was successful
		if (typeof accessToken !== "undefined") {
			// try to make request again
			return await retryPostRequest(body, accessToken, "Erro da API (401)"); // be sure to use latest available token
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
		const responseObject = await response.json(),
			errorTranslation = errorTranslations[responseObject.errors[0].message];
		// Try to display the countdown if not set already
		if (responseObject.errors[0].message === "trip_interval_limit") countdownFromLatestTrip();
		if (errorTranslation) {
			alert(errorTranslation);
			return;
		}

		if (responseObject.errors[0].message !== "Error executing document.") {
			// Show general error message for unknown errors
			alert(responseObject.errors[0].message);
			return;
		} else {
			// Common API processing error
			// try for x times to do the request, otherwise just error out
			if (currentRequestTry < NUMBER_OF_RETRIES) {
				// Wait before making next request (reduce error rate)
				await delay(200);
				return await makePostRequest(body, accessToken);
			} else {
				// Warn user about the API error
				alert("Erro da API");
			}
			// Do not return, this will return the app to its default state
		}
	} else if (response.status === 403) {
		// Common API processing error
		// try for x times to do the request, otherwise just error out
		return await retryPostRequest(body, accessToken, "Erro da API (403)");

		// if (currentRequestTry < NUMBER_OF_RETRIES) {
		// 	// Wait before making next request (reduce error rate)
		// 	await delay(200);
		// 	return await makePostRequest(body, accessToken);
		// } else {
		// 	// Warn user about the API error
		// 	alert("Erro da API (403)");

		// 	// Hide user menu if it is showing
		// 	hideUserSettings();

		// 	// Hide search place menu if it is showing
		// 	hidePlaceSearchMenu();

		// 	// Hide bike list menu if it is showing
		// 	let bikeListMenu = document.getElementById("bikeMenu");
		// 	if (bikeListMenu) {
		// 		bikeListMenu.classList.add("smooth-slide-to-bottom");
		// 		setTimeout(() => bikeListMenu.remove(), 500); // remove element after animation
		// 		return; // prevent station card from being hidden if there was a bike list menu
		// 	}

		// 	// Hide station card if it is showing
		// 	let menu = document.getElementById("stationMenu");
		// 	if (menu) {
		// 		menu.classList.add("smooth-slide-to-left");
		// 		setTimeout(() => menu.remove(), 500); // remove element after animation
		// 		document.getElementById("zoomControls").classList.add("smooth-slide-down-zoom-controls"); // move zoom controls back down
		// 	}

		// 	// Reset currentRequestTry
		// 	currentRequestTry = 0;

		// 	return;
		// }
	}
	returnToDefaultState();
}

// source: trust me bro
async function encryptFirebaseToken(firebaseToken, authToken) {
	const { sub, jti } = getJWTPayload(authToken);

	// 1. Create key from sub (hex string)
	const key = new TextEncoder().encode(sub.replaceAll("-", ""));

	// 2. IV from jti.slice(0, 16) using UTF-8 encoding
	const iv = new TextEncoder().encode(jti.slice(0, 16));

	// 3. Import key
	const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "AES-CBC" }, false, ["encrypt"]);

	// 4. Encrypt
	const tokenEncoded = new TextEncoder().encode(firebaseToken);
	const encryptedBuffer = await crypto.subtle.encrypt({ name: "AES-CBC", iv }, cryptoKey, tokenEncoded);

	// 5. Convert to base64
	return bufferToBase64(encryptedBuffer);
}

function hexStringToBytes(hex) {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) {
		bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
	}
	return bytes;
}

function bufferToBase64(buffer) {
	const binary = String.fromCharCode(...new Uint8Array(buffer));
	return btoa(binary);
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

	ws = new WebSocket(GIRA_GRAPHQL_WS_ENDPOINT, "graphql-ws");

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

async function retryPostRequest(body, accessToken, errorMessage) {
	if (currentRequestTry < NUMBER_OF_RETRIES) {
		// Wait before making next request (reduce error rate)
		await delay(200);
		return await makePostRequest(body, accessToken);
	} else {
		// Warn user about the API error
		alert(errorMessage);

		returnToDefaultState();

		// Reset currentRequestTry
		currentRequestTry = 0;
	}
}

function returnToDefaultState() {
	// Return to app starting state
	hideUserSettings();
	hidePlaceSearchMenu();
	let bikeListMenu = document.getElementById("bikeMenu");
	if (bikeListMenu) {
		bikeListMenu.classList.add("smooth-slide-to-bottom");
		setTimeout(() => bikeListMenu.remove(), 500); // remove element after animation
		return; // prevent station card from being hidden if there was a bike list menu
	}
	let menu = document.getElementById("stationMenu");
	if (menu) {
		menu.classList.add("smooth-slide-to-left");
		setTimeout(() => menu.remove(), 500); // remove element after animation
		document.getElementById("zoomControls").classList.add("smooth-slide-down-zoom-controls"); // move zoom controls back down
	}
}

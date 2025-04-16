let tripEnded = true;
let tripTimerCode = null;
let ratedTripsList = [];
let finishedTripsList = [];
let tripBeingRated = false;

// reserves the bike and returns a success boolean
async function reserveBike(serialNumber) {
	const response = await makePostRequest(
		GIRA_GRAPHQL_ENDPOINT,
		JSON.stringify({
			operationName: "reserveBike",
			variables: { input: serialNumber },
			query: "mutation reserveBike($input: String) {reserveBike(input: $input)}",
		}),
		user.accessToken
	);
	if (typeof response !== "undefined") return response.data.reserveBike;
}

// cancels the bike reserve and returns a success boolean
async function cancelBikeReserve() {
	const response = await makePostRequest(
		GIRA_GRAPHQL_ENDPOINT,
		JSON.stringify({
			operationName: "cancelBikeReserve",
			variables: {},
			query: "mutation cancelBikeReserve {cancelBikeReserve}",
		}),
		user.accessToken
	);
	if (typeof response !== "undefined") return response.data.cancelBikeReserve;
}

// starts a trip and returns a success boolean
async function startTrip() {
	const response = await makePostRequest(
		GIRA_GRAPHQL_ENDPOINT,
		JSON.stringify({
			operationName: "startTrip",
			variables: {},
			query: "mutation startTrip {startTrip}",
		}),
		user.accessToken
	);
	if (typeof response !== "undefined") return response.data.startTrip;
}

// returns an int or float of the active trip cost
async function getActiveTripCost() {
	const response = await makePostRequest(
		GIRA_GRAPHQL_ENDPOINT,
		JSON.stringify({
			operationName: "activeTripCost",
			variables: {},
			query: "query activeTripCost {activeTripCost}",
		}),
		user.accessToken
	);
	return response.data.activeTripCost;
}

// returns the activeTrip object
async function getActiveTrip() {
	const response = await makePostRequest(
		GIRA_GRAPHQL_ENDPOINT,
		JSON.stringify({
			operationName: "activeTrip",
			variables: {},
			query: "query activeTrip {activeTrip {code, startDate, endDate, cost, client, tripStatus, version}}",
		}),
		user.accessToken
	);
	return response.data.activeTrip;
}

// returns success boolean
async function rateTripAPI(tripCode, tripRating, tripComment) {
	const response = await makePostRequest(
		GIRA_GRAPHQL_ENDPOINT,
		JSON.stringify({
			operationName: "rateTrip",
			variables: {
				in: {
					code: tripCode,
					rating: tripRating,
					description: "",
					attachment: { bytes: null, fileName: `img_${tripCode}.png`, mimeType: "image/png" },
				},
			},
			query: "mutation rateTrip($in: RateTrip_In) { rateTrip(in: $in) }",
		}),
		user.accessToken
	);
	return response.data.rateTrip;
}

// returns int? (0 for success)
async function tripPayWithNoPoints(tripCode) {
	const response = await makePostRequest(
		GIRA_GRAPHQL_ENDPOINT,
		JSON.stringify({
			operationName: "tripPayWithNoPoints",
			variables: { input: tripCode },
			query: "mutation tripPayWithNoPoints($input: String) { tripPayWithNoPoints(input: $input) }",
		}),
		user.accessToken
	);
	return response.data.tripPayWithNoPoints;
}

// returns int? (0 for success)
async function tripPayWithPoints(tripCode) {
	const response = await makePostRequest(
		GIRA_GRAPHQL_ENDPOINT,
		JSON.stringify({
			operationName: "tripPayWithPoints",
			variables: { input: tripCode },
			query: "mutation tripPayWithPoints($input: String) { tripPayWithPoints(input: $input) }",
		}),
		user.accessToken
	);
	return response.data.tripPayWithPoints;
}

async function openUnlockBikeCard(stationSerialNumber, bikeObjJSON, dockSerialNumber, unregistered = false) {
	let stationObj;

	if (lastStationObj !== null && !unregistered) {
		// get station object
		//stationObj = stationsArray.find(obj => obj.serialNumber === stationSerialNumber);
		stationObj = lastStationObj;

		// check if the app has access to the user location
		if (!pos) {
			alert("A aplicação não sabe a sua localização!");
			return;
		}

		// check if the user is close to the station (less than 50 meters)
		if (!(distance(pos, [stationObj.longitude, stationObj.latitude]) < minimumDistanceToStation)) {
			alert("Não está próximo da estação!");
			return;
		}
	}

	// get bike object
	let bikeObj;

	if (!unregistered) {
		bikeObj = JSON.parse(bikeObjJSON);
	} else {
		bikeObj = JSON.parse(bikeObjJSON);
		bikeObj.battery = "?";
		stationObj = { name: "Bicicleta não registada" };
	}

	// get dock object
	let dockObj;

	if (!unregistered && stationObj.dockList) {
		dockObj = stationObj.dockList.find(obj => obj.serialNumber === dockSerialNumber);
	} else {
		dockObj = { name: "?" };
	}

	// Create card element and show spinner
	const card = document.createElement("div");
	card.className = "bike-reserve";
	card.id = "unlockBikeCard";
	card.innerHTML = `
		<div id="bikeReserveCard">	
			<img src="assets/images/mGira_spinning.gif" id="spinner">
		</div>
	`.trim();
	document.body.appendChild(card);

	// reserve the bike
	if (!(await reserveBike(bikeObj.serialNumber))) {
		card.remove();
		alert("Ocorreu um erro ao reservar a bicicleta.");
		return;
	}

	// Populate card element
	card.innerHTML = `
        <div id="bikeReserveCard">			
			<div id="backButton" onclick="closeUnlockBikeCard()"><i class="bi bi-arrow-90deg-left"></i></div>
			<div id="textContent">
				<div id="bikeName">${bikeObj.name}</div>
				<div id="bikeDock">Doca ${dockObj.name}</div>
				<div id="bikeBattery">${bikeObj.name[0] === "E" ? `${bikeObj.battery}%` : ``}</div>
			</div>
			<div class="timer animatable">
				<svg>
					<circle cx="50%" cy="50%" r="7dvh"/>
					<circle cx="50%" cy="50%" r="7dvh" pathLength="1" />
					<text x="50%" y="50%" text-anchor="middle"><tspan id="timeLeft"></tspan></text>
					<text x="50%" y="65%" text-anchor="middle">segundos</text>
				</svg>
			</div>
			<input type="range" name="unlockSlider" id="unlockSlider" onchange="startBikeTrip(event, '${
				bikeObj.name
			}');" min="0" max="100" value="0">
			<img src="assets/images/gira_footer.svg" id="footer" alt="footer">
        </div>
    `.trim();

	// Run the timer (30 seconds)
	let timeLeft = 30;
	let timerText = document.getElementById("timeLeft");
	let timerElement = document.querySelector(".timer");
	const timerCircle = timerElement.querySelector("svg > circle + circle");
	timerElement.classList.add("animatable");
	timerCircle.style.strokeDashoffset = 1;

	let countdownHandler = async function () {
		if (!document.getElementById("unlockBikeCard")) clearInterval(countdownTimer);
		let isTimeLeft = timeLeft > -1;
		if (isTimeLeft) {
			const timeRemaining = timeLeft--;
			const normalizedTime = (timeRemaining - 30) / 30;
			timerCircle.style.strokeDashoffset = normalizedTime;
			timerText.innerHTML = timeRemaining;
		} else {
			clearInterval(countdownTimer);
			timerElement.classList.remove("animatable");
			// No time left, cancel the reservation if the user didn't start the trip
			if (tripEnded) {
				// Cancel the bike reserve after the countdown
				console.log("The reserve was cancelled.");
				if (typeof (await cancelBikeReserve()) === "undefined") {
					alert("Ocorreu um erro ao cancelar a reserva da bicicleta");
					return;
				}

				// hide the unlock card if it is showing
				if (document.querySelector("#unlockBikeCard")) document.querySelector("#unlockBikeCard").remove();
			}
		}
	};

	countdownHandler(); // call once to start the timer immediately
	let countdownTimer = setInterval(countdownHandler, 1000);

	// If there is navigation going, make the card still appear
	if (navigationActive) card.style.zIndex = 99;
}

async function closeUnlockBikeCard() {
	console.log("The reserve was cancelled.");
	if (typeof (await cancelBikeReserve()) === "undefined") {
		alert("Ocorreu um erro ao cancelar a reserva da bicicleta");
		return;
	}
	document.getElementById("unlockBikeCard").remove();
}

function openTakeUnregisteredBikeMenu(stationSerialNumber) {
	// get station object
	const stationObj = stationsArray.find(obj => obj.serialNumber === stationSerialNumber);

	// check if the app has access to the user location
	if (!pos) {
		alert("A aplicação não sabe a sua localização!");
		return;
	}

	// check if the user is close to the station (less than 50 meters)
	if (!(distance(pos, [stationObj.longitude, stationObj.latitude]) < minimumDistanceToStation)) {
		alert("Não está próximo da estação!");
		return;
	}

	appendElementToBodyFromHTML(
		`
        <div id="takeUnregisteredBike">
			<div id="unregisteredBikeNameInputContainer">
				<select id="unregisteredBikeNameSelect">
					<option value="E">E</option>
					<option value="C">C</option>
				</select>
				<input type="number" id="unregisteredBikeNameInput" placeholder="Insira o código da bicicleta" min="1" max="9999" oninput="formatBikeNumber(this)">
			</div>
            <div id="cancelButton" onclick="document.getElementById('takeUnregisteredBike').remove()">Cancelar</div>
            <div id="takeUnregisteredBikeButton" onclick="takeUnregisteredBike()">Tentar retirar bicicleta</div>
        </div>
    `
	);

	// If there is navigation going, make the menu still appear
	if (navigationActive) document.getElementById("takeUnregisteredBike").style.zIndex = 99;
}

function formatBikeNumber(element) {
	let value = element.value.replace(/\D/g, "");

	if (!Number(value)) element.value = "";
	// Pad the value with leading zeros to make it 4 digits
	else element.value = value.slice(-4).padStart(4, "0");
}

function takeUnregisteredBike() {
	// Get the bike object from the name written on the input element
	const bikeName =
		document.getElementById("unregisteredBikeNameSelect").value +
		document.getElementById("unregisteredBikeNameInput").value;
	const bikeSerialNum = bikeSerialNumberMapping[bikeName];

	// Try to open the unlock bike card, to take bike
	if (typeof bikeSerialNum !== "undefined") {
		openUnlockBikeCard(null, JSON.stringify({ name: bikeName, serialNumber: bikeSerialNum }), null, true);
		document.getElementById("takeUnregisteredBike")?.remove();
	} else {
		alert("A bicicleta não foi encontrada...");
		document.getElementById("takeUnregisteredBike")?.remove();
	}
}

// Handles the range input value changed event, and starts the bike trip if the slider is all the way to the right
async function startBikeTrip(event, bikeName) {
	if (event.target.value === "100") {
		// Show the bike leaving dock animation in the card
		let bikeReserveCardElem = document.getElementById("bikeReserveCard");
		if (bikeReserveCardElem) {
			bikeReserveCardElem.innerHTML = `
				<div id="backButton" onclick="document.getElementById('unlockBikeCard').remove()"><i class="bi bi-arrow-90deg-left"></i></div>
				<img src="assets/images/mGira_leaving_dock.gif" id="bikeLeavingDock" alt="bike leaving dock animation">
				<img src="assets/images/gira_footer.svg" id="footer" alt="footer">`;
		}

		// start the trip
		if (typeof (await startTrip()) === "undefined") {
			// Alert the user that an error occured
			alert("Ocorreu um erro ao iniciar a viagem.");

			// hide the unlock card if it is showing
			if (document.querySelector("#unlockBikeCard")) document.querySelector("#unlockBikeCard").remove();

			return;
		}

		// Only hide card with animation after 2 seconds
		setTimeout(() => {
			// hide the unlock card if it is showing
			if (document.querySelector("#unlockBikeCard")) document.querySelector("#unlockBikeCard").remove();

			// hide the station menu if it is showing
			if (document.querySelector("#stationMenu")) hideStationMenu();

			// hide bike list if it is showing
			if (document.querySelector("#bikeMenu")) document.querySelector("#bikeMenu").remove();

			const oldTrip = document.getElementById("tripOverlay");
			if (oldTrip) oldTrip.remove(); // remove the trip overlay if it is showing
			// show the trip overlay
			appendElementToBodyFromHTML(
				`
				<div class="trip-overlay" id="tripOverlay">
					<span id="onTripText">Em viagem</span>
					<img src="assets/images/mGira_riding.gif" alt="bike" id="bikeLogo">
					<span id="tripBike">${bikeName}</span>
					<span id="tripCost">0.00€</span>
					<span id="tripTime">00:00:00</span>
					<a id="callAssistance" href="tel:211163125"><i class="bi bi-exclamation-triangle"></i></a>
					<img src="assets/images/gira_footer_white.svg" alt="footer" id="footer">
				<div>
			`.trim()
			);

			// Change map dots to available docks
			loadStationMarkersFromArray(stationsArray, true);

			// start the trip timer
			tripEnded = false;
			tripTimer(Date.now(), true);
		}, 3000);
	}
}

async function tripTimer(startTime, isStarting) {
	// Only need to clear the previous trip if this trip is starting
	if (tripTimerCode && isStarting) {
		clearTimeout(tripTimerCode); // clear the previous timer if it exists
		tripTimerCode = null;
	}
	// Update only is trip has not ended, and websocket is connected
	if (!tripEnded && ws?.readyState === WebSocket.OPEN) {
		// Calculate elapsed time
		const elapsedTime = Date.now() - startTime;

		// Update timer on trip overlay
		if (document.querySelector("#tripTime")) {
			for (let element of document.querySelectorAll("#tripTime")) {
				element.innerHTML = parseMillisecondsIntoTripTime(elapsedTime);
			}
		}

		// Update cost on trip overlay
		if (document.querySelector("#tripCost") && activeTripObj) {
			let cost = 0;

			// Set the cost based on values on the website (API doesn't return the cost)
			const numberOf45MinPeriods = Math.floor(elapsedTime / (45 * 60 * 1000));
			if (numberOf45MinPeriods === 1) cost = 1;
			else if (numberOf45MinPeriods > 1) cost = 2 * numberOf45MinPeriods;

			// Update the element
			if (cost) {
				for (let element of document.querySelectorAll("#tripCost")) {
					element.innerHTML = parseFloat(cost).toFixed(2) + "€";
				}
			}
		}
		tripTimerCode = setTimeout(() => tripTimer(startTime), 1000);
	} else if (ws?.readyState !== WebSocket.OPEN) {
		console.log("WebSocket has disconnected...");
		setTimeout(() => tripTimer(startTime), 1000);
	} else {
		console.log("Trip has ended...");
		tripTimerCode = null;

		// Hide trip overlay if it is showing
		if (document.querySelector("#tripOverlay")) document.querySelector("#tripOverlay").remove();

		// Cancel the bike reserve
		if (typeof (await cancelBikeReserve()) === "undefined") {
			alert("Ocorreu um erro ao cancelar a reserva da bicicleta");
			return;
		}
	}
}

function openRateTripMenu(tripObj) {
	// Calculate the trip time
	const elapsedTime = Date.parse(tripObj.endDate) - Date.parse(tripObj.startDate);
	const formattedTime = parseMillisecondsIntoTripTime(elapsedTime, true);

	// Don't rate trips under 90 seconds
	if (elapsedTime < 90 * 1000) return;

	// Set that there is a trip being rated (don't show any new ratings while this is true)
	tripBeingRated = true;

	// Show the rate trip menu
	appendElementToBodyFromHTML(`
    <div class="rate-trip-menu" id="rateTripMenu">
        <div id="rateTripMenuCard">
            <div id="backButton" onclick="document.getElementById('rateTripMenu').remove()"><i class="bi bi-arrow-90deg-left"></i></div>
			<div id="tripInfo">
				<div id="bikeName">
					<img id="bikeIcon" src="assets/images/mGira_bike.png">
					${tripObj.bike}
				</div>
				<div id="time">
					<i class="bi bi-clock"></i>
					${formattedTime}
				</div>
				<div id="cost">
					<i class="bi bi-cash-coin"></i>
					${parseFloat(tripObj.cost).toFixed(2)}€
				</div>
				<div id="points">
					<i class="bi bi-piggy-bank"></i>
					${tripObj.tripPoints ?? 0} pontos
				</div>
            </div>
            <img src="assets/images/mGira_station.png" alt="station" id="stationImg">
            <div id="ratingLabel">Como foi a viagem?</div>
            <div class="ratingFormContainer">
				<form id="rating" class="rating">
					<input type="radio" id="star5" name="rating" value="5" />
					<label for="star5" class="star">&#9733;</label>
					<input type="radio" id="star4" name="rating" value="4" />
					<label for="star4" class="star">&#9733;</label>
					<input type="radio" id="star3" name="rating" value="3" />
					<label for="star3" class="star">&#9733;</label>
					<input type="radio" id="star2" name="rating" value="2" />
					<label for="star2" class="star">&#9733;</label>
					<input type="radio" id="star1" name="rating" value="1" />
					<label for="star1" class="star">&#9733;</label>
				</form>
			</div>
            <div id="sendButton" onclick="rateTrip('${tripObj.code}',${tripObj.cost})">Enviar</div>
        </div>
    </div>
    `);
}

async function rateTrip(tripCode, tripCost) {
	// Get the selected input for the stars
	const starsInput = document.querySelector(`input[type="radio"]:checked`);
	const tripRating = Number(starsInput?.value);
	const rateTripMenu = document.getElementById("rateTripMenu");
	const rateTripCard = document.getElementById("rateTripMenuCard");

	// Could not get rating
	if (!starsInput) {
		alert("Não foi possível obter a classificação.");
		tripBeingRated = false;
		return;
	}

	// if the rating is 3 stars or less, prompt the user to comment on the trip
	if (tripRating <= 3) {
		rateTripCard.innerHTML = `
			<div id="title">Descreva a sua experiência</div>
			<textarea id="commentTextarea" spellcheck=false placeholder="Escreva aqui..."></textarea>
			<div id="ignoreButton">Ignorar</div>
			<div id="sendButton">Enviar</div>
		`.trim();

		// Send button handler
		document.querySelector("#rateTripMenuCard #sendButton").addEventListener("click", async () => {
			let comment = document.getElementById("commentTextarea").value;
			let success = await rateTripAPI(tripCode, tripRating, comment);
			if (success) {
				ratedTripsList.push(tripCode); // store that this trip was already rated, to not prompt again
				payTrip(tripCode, tripCost); // Pay the trip after rating it
				alert("Agradecemos o feedback!", `<i class="bi bi-heart"></i>`); // Thank the user for the feedback
			} else {
				alert("Não foi possível avaliar a viagem."); // Error
			}
			rateTripMenu?.remove(); // Hide rate trip menu
			tripBeingRated = false;
		});

		// Ignore button handler
		document.querySelector("#rateTripMenuCard #ignoreButton").addEventListener("click", async () => {
			// No handler
			let success = await rateTripAPI(tripCode, tripRating, ""); // send empty comment if the user ignored
			if (success) {
				ratedTripsList.push(tripCode); // store that this trip was already rated, to not prompt again
				payTrip(tripCode, tripCost); // Pay the trip after rating it
				alert("Agradecemos o feedback!", `<i class="bi bi-heart"></i>`); // Thank the user for the feedback
			} else {
				alert("Não foi possível avaliar a viagem."); // Error
			}
			rateTripMenu?.remove(); // Hide rate trip menu
			tripBeingRated = false;
		});
	} else {
		let success = await rateTripAPI(tripCode, tripRating, ""); // send empty comment if the user gave a good rating
		if (success) {
			ratedTripsList.push(tripCode); // store that this trip was already rated, to not prompt again
			payTrip(tripCode, tripCost); // Pay the trip after rating it
			alert("Agradecemos o feedback!", `<i class="bi bi-heart"></i>`); // Thank the user for the feedback
		} else {
			alert("Não foi possível avaliar a viagem.");
		}
		rateTripMenu?.remove(); // Hide rate trip menu
		tripBeingRated = false;
	}
}

async function payTrip(tripCode, tripCost) {
	// Allow the user to select if he wants to use points to pay the trip
	if (tripCost !== 0) {
		createCustomYesNoPrompt(
			`Deseja pagar a viagem com ${tripCost * 500} pontos?`,
			async () => {
				if ((await tripPayWithPoints(tripCode)) !== tripCost * 500)
					// the success response is the number of points paid
					alert("Não foi possível pagar a viagem.");
			},
			async () => {
				if ((await tripPayWithNoPoints(tripCode)) !== 0)
					// the success response is a 0
					alert("Não foi possível pagar a viagem.");
			}
		);
	} else {
		// If the trip cost 0, then just pay with no points
		if ((await tripPayWithNoPoints(tripCode)) !== 0) alert("Não foi possível pagar a viagem.");
	}
}

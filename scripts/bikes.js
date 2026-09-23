let tripEnded = true;
let tripTimerCode = null;
let ratedTripsList = [];
let finishedTripsList = [];
let tripBeingRated = false;

// Sends the trip rating to VAIMOO, returns a success boolean
async function rateTripAPI(tripCode, bikeName, tripRating, tripComment) {
	const tripId = Number(tripCode);
	if (!Number.isInteger(tripId) || tripId <= 0) return false;

	try {
		const details = await getTripDetails(tripId);
		// Same payload as the official Gira Android app
		await submitTripFeedback({
			createDate: vaimooLocalTimestamp(new Date()),
			osVersion: "Android",
			appVersion: "1.0.0",
			rating: tripRating,
			comment: [tripComment ?? ""],
			reportType: "Opinion",
			vehicleVisualId: bikeName,
			geoFenceId: details?.endStation?.stationId ?? null,
			tripId,
		});
		return true;
	} catch (error) {
		console.error("Could not rate the trip", error);
		return false;
	}
}

// Shows the trip overlay (on top of the map, while on a trip)
function showTripOverlay(bikeName) {
	document.getElementById("tripOverlay")?.remove(); // remove the trip overlay if it is showing
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
}

async function openUnlockBikeCard(stationSerialNumber, bikeObjJSON) {
	// get station object
	const stationObj = lastStationObj;

	if (stationObj) {
		// check if the app has access to the user location
		if (!pos) {
			alert("A aplicação não sabe a sua localização!");
			return;
		}

		// check if the user is close to the station
		if (!(distance(pos, [stationObj.longitude, stationObj.latitude]) < minimumDistanceToStation)) {
			alert("Não está próximo da estação!");
			return;
		}
	}

	// get bike object
	const bikeObj = JSON.parse(bikeObjJSON);

	// There are no reservations anymore, the bike is unlocked right away when the slider is used
	document.getElementById("unlockBikeCard")?.remove();
	const card = document.createElement("div");
	card.className = "bike-reserve";
	card.id = "unlockBikeCard";
	card.innerHTML = `
        <div id="bikeReserveCard">
			<div id="backButton" onclick="closeUnlockBikeCard()"><i class="bi bi-arrow-90deg-left"></i></div>
			<div id="textContent">
				<div id="bikeName">${bikeObj.name}</div>
				<div id="bikeDock">Doca ${bikeObj.dockName ?? "?"}</div>
				<div id="bikeBattery">${bikeObj.type === "electric" ? `${bikeObj.battery ?? "?"}%` : ``}</div>
			</div>
			<input type="range" name="unlockSlider" id="unlockSlider" onchange="startBikeTrip(event, '${htmlEncode(
				bikeObj.name
			)}', '${htmlEncode(bikeObj.serialNumber)}');" min="0" max="100" value="0">
			<img src="assets/images/gira_footer.svg" id="footer" alt="footer">
        </div>
    `.trim();
	document.body.appendChild(card);

	// If there is navigation going, make the card still appear
	if (navigationActive) card.style.zIndex = 99;
}

function closeUnlockBikeCard() {
	document.getElementById("unlockBikeCard")?.remove();
}

// Unlisted-bike lookup disabled: VAIMOO's Firestore feed lists every dockable bike, so the legacy
// bikeSerialNumberMapping workaround isn't needed (same decision as gira-mais).
// If this is ever re-enabled, look the bike up with window.vaimooFirestore.findBike(visualId) instead of the mapping.
/*
function openTakeUnregisteredBikeMenu(stationSerialNumber) {
	if (document.getElementById("takeUnregisteredBike")) return;
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
		alert(`A bicicleta ${bikeName} não foi encontrada...`);
		document.getElementById("takeUnregisteredBike")?.remove();
	}
}
*/

// Handles the range input value changed event, and starts the bike trip if the slider is all the way to the right
async function startBikeTrip(event, bikeName, communicationId) {
	if (event.target.value !== "100") return;

	// Show the bike leaving dock animation in the card
	let bikeReserveCardElem = document.getElementById("bikeReserveCard");
	if (bikeReserveCardElem) {
		bikeReserveCardElem.innerHTML = `
			<div id="backButton" onclick="closeUnlockBikeCard()"><i class="bi bi-arrow-90deg-left"></i></div>
			<img src="assets/images/mGira_leaving_dock.gif" id="bikeLeavingDock" alt="bike leaving dock animation">
			<img src="assets/images/gira_footer.svg" id="footer" alt="footer">`;
	}

	const unlockTime = Date.now();
	const animationEnd = unlockTime + 3000;

	// Unlock the bike, which starts the trip
	try {
		await quickStartTrip(communicationId);
	} catch (error) {
		let started = false;
		if (error instanceof VaimooNetworkError) {
			// The unlock is not retried, so the connection may have dropped after VAIMOO started the trip
			started = Boolean(await refreshTripStatus("quick-start-network-error"));
		}
		if (!started) {
			// hide the unlock card if it is showing
			closeUnlockBikeCard();
			showApiError(error, "Ocorreu um erro ao iniciar a viagem.");
			return;
		}
	}

	// Only hide card with animation after it has played
	setTimeout(() => {
		// hide the unlock card if it is showing
		closeUnlockBikeCard();

		// hide the station menu if it is showing
		if (document.querySelector("#stationMenu")) hideStationMenu();

		// hide bike list if it is showing
		if (document.querySelector("#bikeMenu")) hideBikeList();

		// Show the trip overlay and wait for VAIMOO to confirm the trip (unless it already did)
		if (!localTrip?.confirmed) startLocalTrip(bikeName, unlockTime);
	}, Math.max(0, animationEnd - Date.now()));
}

async function tripTimer(startTime, isStarting) {
	// Only need to clear the previous trip if this trip is starting
	if (tripTimerCode && isStarting) {
		clearTimeout(tripTimerCode); // clear the previous timer if it exists
		tripTimerCode = null;
	}
	// Update only if trip has not ended
	if (!tripEnded) {
		// Calculate elapsed time
		const elapsedTime = Date.now() - startTime;

		// Update timer on trip overlay
		for (let element of document.querySelectorAll("#tripTime")) {
			element.innerHTML = parseMillisecondsIntoTripTime(elapsedTime);
		}

		// Update cost on trip overlay
		// Set the cost based on values on the website (API doesn't return the cost)
		let cost = 0;
		const numberOf45MinPeriods = Math.floor(elapsedTime / (45 * 60 * 1000));
		if (numberOf45MinPeriods === 1) cost = 1;
		else if (numberOf45MinPeriods > 1) cost = 2 * numberOf45MinPeriods;

		// Update the element
		if (cost) {
			for (let element of document.querySelectorAll("#tripCost")) {
				element.innerHTML = parseFloat(cost).toFixed(2) + "€";
			}
		}
		tripTimerCode = setTimeout(() => tripTimer(startTime), 1000);
	} else {
		console.log("Trip has ended...");
		tripTimerCode = null;

		// Hide trip overlay if it is showing
		if (document.querySelector("#tripOverlay")) document.querySelector("#tripOverlay").remove();
	}
}

function openRateTripMenu(tripObj) {
	// Calculate the trip time
	const endDate = Date.parse(tripObj.endDate);
	const elapsedTime = endDate - Date.parse(tripObj.startDate);
	const formattedTime = parseMillisecondsIntoTripTime(elapsedTime, true);

	// Don't rate trips under 90 seconds
	if (elapsedTime < 90 * 1000) return;
	startCountdownBetweenTrips(endDate);

	// Set that there is a trip being rated (don't show any new ratings while this is true)
	tripBeingRated = true;

	// Show the rate trip menu
	appendElementToBodyFromHTML(`
    <div class="rate-trip-menu" id="rateTripMenu">
        <div id="rateTripMenuCard">
            <div id="backButton" onclick="closeRateTripMenu('${tripObj.code}')"><i class="bi bi-arrow-90deg-left"></i></div>
			<div id="tripInfo">
				<div id="bikeName">
					<img id="bikeIcon" src="assets/images/mGira_bike.png">
					${tripObj.bikeName}
				</div>
				<div id="time">
					<i class="bi bi-clock"></i>
					${formattedTime}
				</div>
				<div id="cost">
					<i class="bi bi-cash-coin"></i>
					${parseFloat(tripObj.cost).toFixed(2)}€
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
            <div id="sendButton" onclick="rateTrip('${tripObj.code}','${htmlEncode(tripObj.bikeName)}')">Enviar</div>
        </div>
    </div>
    `);
}

// Marks the trip as rated, so the rating is not prompted again
function markTripRated(tripCode) {
	ratedTripsList.push(tripCode);
	customCreateCookie("lastRatedTrip", tripCode);
}

function closeRateTripMenu(tripCode) {
	markTripRated(tripCode);
	document.getElementById("rateTripMenu")?.remove();
	tripBeingRated = false;
}

async function rateTrip(tripCode, bikeName) {
	// Get the selected input for the stars
	const starsInput = document.querySelector(`input[type="radio"]:checked`);
	const tripRating = Number(starsInput?.value);
	const rateTripMenu = document.getElementById("rateTripMenu");
	const rateTripCard = document.getElementById("rateTripMenuCard");

	// Could not get rating
	if (!starsInput) {
		alert("Não foi possível obter a classificação.");
		return;
	}

	const sendRating = async comment => {
		if (await rateTripAPI(tripCode, bikeName, tripRating, comment)) {
			markTripRated(tripCode); // store that this trip was already rated, to not prompt again
			alert("Agradecemos o feedback!", `<i class="bi bi-heart"></i>`); // Thank the user for the feedback
		} else {
			alert("Não foi possível avaliar a viagem."); // Error
		}
		rateTripMenu?.remove(); // Hide rate trip menu
		tripBeingRated = false;
	};

	// if the rating is 3 stars or less, prompt the user to comment on the trip
	if (tripRating <= 3) {
		rateTripCard.innerHTML = `
			<div id="title">Descreva a sua experiência</div>
			<textarea id="commentTextarea" spellcheck=false placeholder="Escreva aqui..."></textarea>
			<div id="ignoreButton">Ignorar</div>
			<div id="sendButton">Enviar</div>
		`.trim();

		// Send button handler
		document
			.querySelector("#rateTripMenuCard #sendButton")
			.addEventListener("click", () => sendRating(document.getElementById("commentTextarea").value));

		// Ignore button handler, send empty comment if the user ignored
		document.querySelector("#rateTripMenuCard #ignoreButton").addEventListener("click", () => sendRating(""));
	} else {
		// send empty comment if the user gave a good rating
		await sendRating("");
	}
}

/**
 * Starts a 5 minute countdown until the user can start a new trip.
 * @param {number} lastTripEndDate Time at which the last trip ended
 */
function startCountdownBetweenTrips(lastTripEndDate) {
	const timerDurationMs = 5 * 60_000; // 5 minutes in milliseconds
	const timeForStartingNextTrip = lastTripEndDate + timerDurationMs;
	if (timeForStartingNextTrip < Date.now()) return;

	// Remove previous countdown if it exists
	document.querySelector("#countdown")?.remove();

	/**
	 * Formats the time in MM:SS format
	 * @param {number} time The time in seconds
	 * @returns The formatted time in M:SS format
	 */
	const formatTime = time => `${Math.floor(time / 60)}:${(time % 60).toString().padStart(2, "0")}`;

	// Populate card element
	(document.getElementById("bikeMenu") ?? document.body).insertAdjacentHTML(
		"beforeend",
		`
			<div class="timer animatable" id="countdown" onclick="alert('Este é o tempo que falta até poderes iniciar uma nova viagem', '<i class=\\'bi bi-hourglass\\'></i>')">
				<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
					<circle class="bg" cx="50" cy="50" r="45"/>
					<circle class="base" cx="50" cy="50" r="45"/>
					<circle class="progress" cx="50" cy="50" r="45" pathLength="1" />
					<text x="50" y="57" text-anchor="middle"><tspan id="timeLeft"></tspan></text>
				</svg>
			</div>
    `.trim()
	);

	// Run the timer
	const timerText = document.getElementById("timeLeft");
	const timerElement = document.querySelector("#countdown");
	const timerCircle = timerElement.querySelector("svg > circle.progress");

	// Initialize differently for iOS Safari
	timerCircle.style.strokeDashoffset = getCurrentTimerProgress(timeForStartingNextTrip, timerDurationMs);

	const countdownHandler = function () {
		// stop the countdown if the element is removed
		if (!document.body.contains(timerElement)) return;

		const currentProgress = getCurrentTimerProgress(timeForStartingNextTrip, timerDurationMs);
		const timeRemaining = Math.round(((1 - Math.abs(currentProgress)) * timerDurationMs) / 1000);
		if (timeRemaining >= 0) {
			timerCircle.style.strokeDashoffset = currentProgress;
			timerText.innerHTML = formatTime(timeRemaining);
			setTimeout(countdownHandler, 1000);
		} else {
			timerElement.remove();
		}
	};

	countdownHandler();
}

/**
 * Returns the current progress of a timer based on the end date, current and total time.
 * @param {number} endDate The timestamp, in ms, when this timer is supposed to end
 * @param {number} totalTimeMs The total length of the timer in ms
 */
function getCurrentTimerProgress(endDate, totalTimeMs) {
	const start = endDate - totalTimeMs;
	const normalizedTime = (Date.now() - start) / totalTimeMs;
	return normalizedTime;
}

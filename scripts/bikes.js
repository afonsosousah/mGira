let tripEnded = true;
let tripTimerRunning = false;
let ratedTripsList = [];

// reserves the bike and returns a success boolean
async function reserveBike(serialNumber) {
	const response = await makePostRequest(
		"https://apigira.emel.pt/graphql",
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
		"https://apigira.emel.pt/graphql",
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
		"https://apigira.emel.pt/graphql",
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
		"https://apigira.emel.pt/graphql",
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
		"https://apigira.emel.pt/graphql",
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
async function rateTrip(tripCode, tripRating, tripComment) {
	const response = await makePostRequest(
		"https://apigira.emel.pt/graphql",
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
		"https://apigira.emel.pt/graphql",
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
		"https://apigira.emel.pt/graphql",
		JSON.stringify({
			operationName: "tripPayWithPoints",
			variables: { input: tripCode },
			query: "mutation tripPayWithPoints($input: String) { tripPayWithPoints(input: $input) }",
		}),
		user.accessToken
	);
	return response.data.tripPayWithPoints;
}

function openUnlockBikeCard(stationSerialNumber, bikeSerialNumber, dockSerialNumber, unregistered = false) {

	let stationObj;

	if (stationSerialNumber !== null) {
		// get station object
		stationObj = stationsArray.find(obj => obj.serialNumber === stationSerialNumber);

		console.log(stationSerialNumber);

		// check if the app has access to the user location
		if (!pos) {
			alert("A aplicação não sabe a sua localização!");
			return;
		}

		// check if the user is close to the station (less than 50 meters)
		if (!(distance(pos, [stationObj.longitude, stationObj.latitude]) < 50)) {
			alert("Não está próximo da estação!");
			return;
		}
	}

	// get bike object
	let bikeObj;

	if (!unregistered) {
		bikeObj = stationObj.bikeList.find(obj => obj.serialNumber === bikeSerialNumber);
	} else {
		bikeObj = bikeSerialNumberMapping.find(obj => obj.serialNumber === bikeSerialNumber);
		bikeObj.battery = "?";
		stationObj = { name: "Bicicleta não registada" };
	}

	// get dock object
	let dockObj;

	if (!unregistered) {
		dockObj = stationObj.dockList.find(obj => obj.serialNumber === dockSerialNumber);
	} else {
		dockObj = { name: "?" };
	}
	

	let card = document.createElement("div");
	card.className = "bike-reserve";
	card.id = "unlockBikeCard";
	card.innerHTML = `
        <div id="bikeReserveCard">
            <div id="backButton" onclick="document.getElementById('unlockBikeCard').remove()"><i class="bi bi-arrow-90deg-left"></i></div>
            <div id="textContent">
				<div id="bikeName">${bikeObj.name}</div>
				<div id="bikeDock">Doca ${dockObj.name}</div>
				<div id="bikeBattery">${bikeObj.name[0] === "E" ? `${bikeObj.battery}%` : ``}</div>
            </div>
			<div id="stationName">${stationObj.name}</div>
            <img id="bikeLogo" src="assets/images/mGira_bike.png" alt="bike">
            <input type="range" name="unlockSlider" id="unlockSlider" onchange="startBikeTrip(event, '${bikeSerialNumber}')" min="0" max="100" value="0">
            <img src="assets/images/gira_footer.svg" id="footer" alt="footer">
        </div>
    `.trim();
	document.body.appendChild(card);

	// If there is navigation going, make the card still appear
	if (navigationActive) card.style.zIndex = 99;
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
	if (!(distance(pos, [stationObj.longitude, stationObj.latitude]) < 50)) {
		alert("Não está próximo da estação!");
		return;
	}

	appendElementToBodyFromHTML(
		`
        <div id="takeUnregisteredBike">
            <input type="text" id="unregisteredBikeNameInput" placeholder="Insira o código da bicicleta (ex. E1234)">
            <div id="cancelButton" onclick="document.getElementById('takeUnregisteredBike').remove()">Cancelar</div>
            <div id="takeUnregisteredBikeButton" onclick="takeUnregisteredBike()">Tentar retirar bicicleta</div>
        </div>
    `
	);

	// If there is navigation going, make the menu still appear
	if (navigationActive) document.getElementById("takeUnregisteredBike").style.zIndex = 99;
}

function takeUnregisteredBike() {
	// Get the bike object from the name written on the input element
	let bikeName = document.getElementById("unregisteredBikeNameInput").value;
	let bikeObj = bikeSerialNumberMapping.filter(bike => bike.name === bikeName)[0];

	// Try to open the unlock bike card, to take bike
	if (typeof bikeObj !== "undefined") {
		let serialNumber = bikeObj.serialNumber;
		openUnlockBikeCard(null, serialNumber, null, true);
		if (document.getElementById("takeUnregisteredBike")) document.getElementById("takeUnregisteredBike").remove();
	} else {
		alert("A bicicleta não foi encontrada...");
		if (document.getElementById("takeUnregisteredBike")) document.getElementById("takeUnregisteredBike").remove();
	}
}

// Handles the range input value changed event, and starts the trip if the slider is all the way to the right
async function startBikeTrip(event, bikeSerialNumber) {
	if (event.target.value === 100) {
		console.log("The bike will be reserved!");

		// reserve the bike
		if (typeof (await reserveBike(bikeSerialNumber)) === "undefined") return;

		// start the trip
		if (typeof (await startTrip()) === "undefined") return;

		// hide the unlock card if it is showing
		if (document.querySelector("#unlockBikeCard")) document.querySelector("#unlockBikeCard").remove();

		// hide the station menu if it is showing
		if (document.querySelector("#stationMenu")) document.querySelector("#stationMenu").remove();

		// show the trip overlay if user is not in navigation
		if (!navigationActive) {
			let tripOverlay = document.createElement("div");
			tripOverlay.className = "trip-overlay";
			tripOverlay.id = "tripOverlay";
			tripOverlay.innerHTML = `
                <span id="onTripText">Em viagem</span>
                <img src="assets/images/mGira_bike_black.png" alt="bike" id="bikeLogo">
                <span id="tripCost">0.00€</span>
                <span id="tripTime">00:00:00</span>
                <img src="assets/images/gira_footer_white.svg" alt="footer" id="footer">
            `.trim();
			document.body.appendChild(tripOverlay);
		}

		// start the trip timer
		tripEnded = false;
		tripTimer(Date.now());
	}
}

function tripTimer(startTime) {
	if (tripEnded === false) {
		// Update timer on trip overlay
		if (document.querySelector("#tripTime")) {
			// Calculate elapsed time
			const elapsedTime = new Date(Date.now() - startTime);
			elapsedTime.setTime(elapsedTime.getTime() + elapsedTime.getTimezoneOffset() * 60 * 1000); // Correct because of Daylight Saving Time
			for (let element of document.querySelectorAll("#tripTime")) {
				element.innerHTML = elapsedTime.toLocaleTimeString("pt");
			}
		}
		if (document.querySelector("#tripCost") && activeTripObj) {
			let cost = activeTripObj.cost;
			if (cost) {
				for (let element of document.querySelectorAll("#tripCost")) {
					element.innerHTML = parseFloat(cost).toFixed(2) + "€";
				}
			}
		}
		tripTimerRunning = true;
		setTimeout(() => tripTimer(startTime), 1000);
	} else {
		console.log("Trip has ended...");
		tripTimerRunning = false;

		// Hide trip overlay if it is showing
		if (document.querySelector("#tripOverlay")) document.querySelector("#tripOverlay").remove();

		// Cancel the bike reserve
		cancelBikeReserve();
	}
}

function openRateTripMenu(tripObj) {
	// Calculate the trip time
	const elapsedTime = new Date(Date.parse(tripObj.endDate) - Date.parse(tripObj.startDate));
	elapsedTime.setTime(elapsedTime.getTime() + elapsedTime.getTimezoneOffset() * 60 * 1000); // Correct because of Daylight Saving Time
	// Only keeps the hours and minutes (first 2 elements)
	const formattedTime = elapsedTime.toLocaleTimeString("pt").split(":", 2).join();

	// Show the rate trip menu
	appendElementToBodyFromHTML(`
    <div class="rate-trip-menu" id="rateTripMenu">
        <div id="rateTripMenuCard">
            <div id="backButton" onclick="document.getElementById('rateTripMenu').remove()"><i class="bi bi-arrow-90deg-left"></i></div>
            <div id="textContent">
                <i class="bi bi-clock"></i>&nbsp;${formattedTime} &nbsp;&nbsp;&nbsp;&nbsp; <i class="bi bi-cash-coin"></i>&nbsp;${parseFloat(
		tripObj.cost
	).toFixed(2)}€
                <br><br>
                Bicicleta: ${tripObj.bike}
                <br><br>
                +${tripObj.tripPoints ?? 0} <i class="bi bi-arrow-right"></i> ${tripObj.clientPoints} pontos totais
            </div>
            <img src="assets/images/mGira_station.png" alt="station">
            <div id="ratingLabel">Como foi a viagem?</div>
            <div id="ratingFormContainer">
                <form class="rating">
                    <label>
                    <input type="radio" name="stars" value="1" />
                    <span class="icon">★</span>
                    </label>
                    <label>
                    <input type="radio" name="stars" value="2" />
                    <span class="icon">★</span>
                    <span class="icon">★</span>
                    </label>
                    <label>
                    <input type="radio" name="stars" value="3" />
                    <span class="icon">★</span>
                    <span class="icon">★</span>
                    <span class="icon">★</span>   
                    </label>
                    <label>
                    <input type="radio" name="stars" value="4" />
                    <span class="icon">★</span>
                    <span class="icon">★</span>
                    <span class="icon">★</span>
                    <span class="icon">★</span>
                    </label>
                    <label>
                    <input type="radio" name="stars" value="5" />
                    <span class="icon">★</span>
                    <span class="icon">★</span>
                    <span class="icon">★</span>
                    <span class="icon">★</span>
                    <span class="icon">★</span>
                    </label>
                </form>
            </div>
            <div id="sendButton" onclick="rateTrip('${tripObj.code}',${tripObj.cost})">Enviar</div>
        </div>
    </div>
    `);
}

async function rateTrip(tripCode, tripCost) {
	// Get the selected input for the stars
	const tripRating = Number(document.querySelector(`input[type="radio"]:checked`).value);

	// hide the rate trip menu
	if (document.getElementById("rateTripMenu")) document.getElementById("rateTripMenu").remove();

	// if the rating is 3 stars or less, prompt the user to comment on the trip
	if (tripRating <= 3) {
		createCustomTextPrompt(
			"Descreva a sua experiência",
			async () => {
				// Yes handler
				let comment = document.getElementById("customTextPromptInput").value;
				let success = await rateTrip(tripCode, tripRating, comment);
				if (success) {
					// store that this trip was already rated, to not prompt again
					ratedTripsList.push(tripCode);

					// Pay the trip after rating it
					payTrip(tripCode, tripCost);

					// Thank the user for the feedback
					alert("Agradecemos o feedback!");
				} else {
					alert("Não foi possível avaliar a viagem.");
				}
			},
			async () => {
				// No handler
				let success = await rateTrip(tripCode, tripRating, ""); // send empty comment if the user ignored
				if (success) {
					// store that this trip was already rated, to not prompt again
					ratedTripsList.push(tripCode);

					// Pay the trip after rating it
					payTrip(tripCode, tripCost);

					// Thank the user for the feedback
					alert("Agradecemos o feedback!");
				} else {
					alert("Não foi possível avaliar a viagem.");
				}
			}
		);
	} else {
		let success = await rateTrip(tripCode, tripRating, ""); // send empty comment if the user gave a good rating
		if (success) {
			// store that this trip was already rated, to not prompt again
			ratedTripsList.push(tripCode);

			// Pay the trip after rating it
			payTrip(tripCode, tripCost);

			// Thank the user for the feedback
			alert("Agradecemos o feedback!");
		} else {
			alert("Não foi possível avaliar a viagem.");
		}
	}
}

async function payTrip(tripCode, tripCost) {
	// Allow the user to select if he wants to use points to pay the trip
	if (tripCost !== 0) {
		createCustomYesNoPrompt(
			`Deseja pagar a viagem com ${tripCost * 500} pontos?`,
			async () => {
				if ((await tripPayWithPoints(tripCode)) !== 0)
					// the success response is a 0
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
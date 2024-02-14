let stationsArray;
let lastStationObj;
let userClickedNavigateToStation = false;

// returns an array with all the bikes in a station
async function getBikes(stationID) {
	const response = await makePostRequest(
		"https://apigira.emel.pt/graphql",
		JSON.stringify({
			operationName: "getBikes",
			variables: { input: stationID },
			query:
				"query getBikes($input: String) {getBikes(input: $input) { battery, code, name, kms, serialNumber, type, parent }}",
		}),
		user.accessToken
	);
	if (typeof response !== "undefined") return response.data.getBikes;
}

// returns an array with all the docks in a station
async function getDocks(stationID) {
	const response = await makePostRequest(
		"https://apigira.emel.pt/graphql",
		JSON.stringify({
			operationName: "getDocks",
			variables: { input: stationID },
			query:
				"query getDocks($input: String) {getDocks(input: $input) { ledStatus, lockStatus, serialNumber, code, name }}",
		}),
		user.accessToken
	);
	if (typeof response !== "undefined") return response.data.getDocks;
}

// using batch querying to get bikes and docks faster
// returns an object with both getBikes and getDocks properties
async function getBikesAndDocks(stationID) {
	const response = await makePostRequest(
		"https://apigira.emel.pt/graphql",
		JSON.stringify({
			query: `query { 
            getBikes(input: "${stationID}") { battery, code, name, kms, serialNumber, type, parent }
            getDocks(input: "${stationID}") { ledStatus, lockStatus, serialNumber, code, name }
        }`,
		}),
		user.accessToken
	);
	if (typeof response !== "undefined") return response.data;
}

// sets the global array stationArray
async function getStations() {
	const response = await makePostRequest(
		"https://apigira.emel.pt/graphql",
		JSON.stringify({
			operationName: "getStations",
			variables: {},
			query:
				"query getStations {getStations { code, description, latitude, longitude, name, bikes, docks, serialNumber }}",
		}),
		user.accessToken
	);

	if (typeof response !== "undefined") {
		// Load the stations to the map
		stationsArray = response.data.getStations;
		loadStationMarkersFromArray(stationsArray);

		// Hide login menu if it is showing
		if (document.querySelector(".login-menu")) document.querySelector(".login-menu").remove();

		// Start WebSocket connection
		startWSConnection();

		// Get all user details
		getUserInformation();

		// Check if update info should be shown
		showUpdateInfoIfNeeded();

		return response.data.getStations;
	} else {
		// Wait for token refresh
		checkToken(getStations);
	}
}

// Open the station menu element and populate it
async function openStationMenu(stationSerialNumber) {
	if (stationSerialNumber === null) {
		alert("A estação não está ativa!");
		return;
	}

	// get station object
	const stationObj = stationsArray.find(obj => obj.serialNumber === stationSerialNumber);
	lastStationObj = stationObj;

	// remove previous station card
	if (document.getElementById("stationMenu")) document.getElementById("stationMenu").remove();

	// move zoom controls up, to not be behind the station card
	document
		.getElementById("zoomControls")
		.classList.remove(
			"smooth-slide-top-zoom-controls",
			"smooth-slide-bottom-zoom-controls",
			"smooth-slide-up-zoom-controls",
			"smooth-slide-down-zoom-controls"
		); // reset classes
	document.getElementById("zoomControls").classList.add("smooth-slide-up-zoom-controls"); // move zoom controls up

	// show the bottom panel from the start so that the request delay is less noticeable
	let menu = document.createElement("div");
	menu.className = "station-card";
	menu.id = "stationMenu";
	document.body.appendChild(menu);

	// If there is navigation going, make the menu still appear
	if (navigationActive) menu.style.zIndex = 99;

	// show loading animation
	menu.innerHTML = `<img src="assets/images/mGira_bike.png" id="spinner">`;

	// get list of available bikes and docks
	const bikeAndDocks = await getBikesAndDocks(stationSerialNumber);
	stationObj.bikeList = bikeAndDocks.getBikes;
	stationObj.dockList = bikeAndDocks.getDocks;
	const numBikes = stationObj.bikeList.length;
	const numDocks = stationObj.dockList.length - numBikes; // number of free docks

	// set the inner HTML after the animation has started
	if (typeof bikeAndDocks.getBikes !== "undefined" && typeof bikeAndDocks.getDocks !== "undefined") {
		menu.innerHTML = `
            <img src="assets/images/gira_footer.svg" alt="footer" id="graphics">
            <div id="stationName">${stationObj.name}</div>
			<div id="navigateToButton" onclick="routeToStation('${stationSerialNumber}')"><i class="bi bi-sign-turn-right"></i></div>
            <img id="docksImage" src="assets/images/mGira_station.png" alt="Gira station" width="25%">
            <div id="docksButton">${numDocks === 1 ? "1 doca" : `${numDocks} docas`}</div>
            <img id="bikesImage" src="assets/images/mGira_bike.png" alt="Gira bike" width="25%">
            <div id="bikesButton${
							stationObj.docks === 0 ? 'Disabled"' : `" onclick="openBikeList('${stationSerialNumber}')"`
						} >
				${numBikes === 1 ? "1 bicicleta" : `${numBikes} bicicletas`}
			</div>`;
	} else {
		menu.innerHTML = `
            <div id="availableBikesNumber">Ocorreu um erro.</div>
            <div id="cancelButton" onclick="hideStationMenu()">Voltar</div>
        `.trim();
	}

	// Set that the user has not clicked navigate to station button
	userClickedNavigateToStation = false;

	// Add swipe event for hiding the station card
	addSwipeEvent(
		menu,
		() => {
			hideStationMenu();
		},
		() => {
			hideStationMenu(true);
		}
	);
}

function hideStationMenu(exitToRight = false) {
	const menu = document.getElementById("stationMenu");

	if (menu) {
		// animate menu exiting
		if (exitToRight) menu.classList.add("smooth-slide-to-right");
		else menu.classList.add("smooth-slide-to-left");

		// remove element after animation
		menu.addEventListener('transitionend', function(event) {
    		// Check if the transition property that ended is the one you are interested in
    		if (event.propertyName === 'transform') {
     		   // Remove the menu element after the sliding animation finishes
    		    menu.remove();
		    }
		});

		// move zoom controls back down
		document.getElementById("zoomControls").classList.add("smooth-slide-down-zoom-controls");
	}

	if (userClickedNavigateToStation) {
		// Remove the results layer
		map
			.getLayers()
			.getArray()
			.filter(layer => ["placesLayer", "stationsLayer", "routeLayer"].includes(layer.get("name")))
			.forEach(layer => map.removeLayer(layer));

		// Show cycleways layer
		map
			.getLayers()
			.getArray()
			.find(layer => layer.get("name") === "cyclewaysLayer").setVisible(true);

		// Add back the stations layer (only if user has clicked navigate to stations)
		getStations();
	}
}

function routeToStation(stationSerialNumber) {
	// get station object
	const stationObj = stationsArray.find(obj => obj.serialNumber === stationSerialNumber);

	// Calculate and display the route on the map when we have the user position
	calculateFullRoute(pos, [stationObj.longitude, stationObj.latitude]);

	// Set that the user has clicked navigate to station button
	userClickedNavigateToStation = true;
}

// Open the bike list element and populate it
async function openBikeList(stationSerialNumber) {
	// get station object
	const stationObj = stationsArray.find(obj => obj.serialNumber === stationSerialNumber);

	let menu = document.createElement("div");
	menu.className = "bike-list";
	menu.id = "bikeMenu";
	menu.innerHTML = `
        <img src="assets/images/gira_footer.svg" alt="footer" id="graphics">
        <div id="backButton" onclick="hideBikeList();"><i class="bi bi-arrow-90deg-left"></i></div>
        <div id="stationName">${stationObj.name}</div>
        <img id="stationImage" src="assets/images/mGira_station.png" alt="Gira station" width="25%">
        <ul id="bikeList">
            <!-- Populate with the list here -->
        </ul>
    `.trim();
	document.body.appendChild(menu);

	// If there is navigation going, make the menu still appear
	if (navigationActive) menu.style.zIndex = 99;

	// get the bikes in the station
	for (let bike of stationObj.bikeList) {
		const bikeListElement = document.createElement("li");
		bikeListElement.className = "bike-list-element";

		// get the name of the dock in which the bike is
		const dockObj = stationObj.dockList.find(obj => obj.code === bike.parent);

		bikeListElement.innerHTML = `
            <div id="battery" style="width: ${bike.name[0] === "E" ? `${bike.battery}%` : `0`}"></div>
            <div id="content" onclick="openUnlockBikeCard('${stationSerialNumber}','${bike.serialNumber}','${
			dockObj.serialNumber
		}')">
				<img id="bikeIcon" src="assets/images/${bike.name[0] === "E" ? `ebike.png` : `classic.png`}">
				<div id="bikeInfo">
					<div id="bikeName">${bike.name}</div>
					<div id="bikeDock">Doca ${dockObj.name}</div>
				</div>
                <i id="reserveBikeIcon" class="bi bi-arrow-bar-right"></i></div>
            </div>
        `.trim();
		document.getElementById("bikeList").appendChild(bikeListElement);
	}

	// if there are no bikes, put a message saying that
	if (document.getElementById("bikeList").childElementCount === 0)
		document.getElementById("bikeList").innerHTML = "Não há bicicletas na estação.";

	// allow user to try to take bike not appearing in app
	appendElementToElementFromHTML(
		`
        <div id="openTakeUnregisteredBikeButton" onclick="openTakeUnregisteredBikeMenu('${stationSerialNumber}')">Tentar retirar bicicleta que não aparece no sistema</div>
    `,
		document.getElementById("bikeList")
	);
}

function hideBikeList() {
	let bikeListMenu = document.getElementById("bikeMenu");
	if (bikeListMenu) {
		bikeListMenu.classList.add("smooth-slide-to-bottom");
		setTimeout(() => bikeListMenu.remove(), 500); // remove element after animation
	}
}

async function updateBikeList() {
	// Make a batch query to speed up the request
	let queryString = "query {";
	let i = 0;

	for (station of stationsArray) {
		queryString += ` station_${i}: getBikes(input: "${station.serialNumber}") { battery, code, name, kms, serialNumber, type, parent } `;
		i += 1;
	}

	queryString += "}";

	const response = await makePostRequest(
		"https://apigira.emel.pt/graphql",
		JSON.stringify({
			query: queryString,
		}),
		user.accessToken
	);

	if (typeof response !== "undefined") {
		// Flatten the resulting array
		const allBikesList = Object.values(response.data).flat(1);

		// get the bikes not in the bikeSerialNumberMapping
		let missingBikes = allBikesList.filter(
			({ name: name1 }) => !bikeSerialNumberMapping.some(({ name: name2 }) => name2 === name1)
		);

		// compact the missing bikes list
		const newList = bikeSerialNumberMapping
			.concat(
				...missingBikes.map(bike => ({
					name: bike.name,
					serialNumber: bike.serialNumber,
				}))
			)
			// Account for classic bikes converted into electric, filters our the classic bikes that had an electric one added
			.filter(({ name }, _, arr) => name.startsWith("E") || !arr.find(bike => bike.name === name.replace("C", "E")))
			.sort((a, b) => Number(a.name.slice(1)) - Number(b.name.slice(1)));

		console.log(newList);
		return newList;
	} else {
		console.log("The request failed.");
	}
}

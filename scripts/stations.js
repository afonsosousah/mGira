let stationsArray;
let lastStationObj;
let userClickedNavigateToStation = false;
let stopBikeListListener = null;

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
	menu.innerHTML = `<img src="assets/images/mGira_spinning.gif" id="spinner">`;

	// get list of available bikes
	let bikeList;
	try {
		bikeList = await getStationBikes(stationSerialNumber);
	} catch (error) {
		console.error("Could not get the bikes of the station", error);
	}

	// The menu may have been closed or replaced in the meantime
	if (!document.body.contains(menu)) return;

	if (bikeList) {
		stationObj.bikeList = bikeList;
		// The station counter includes bikes that can't be unlocked, so use the observed count
		if (recordObservedBikeCount(stationSerialNumber, bikeList.length) && !document.getElementById("placeSearchMenu"))
			loadStationMarkersFromArray(stationsArray, !tripEnded);
	}
	const numBikes = bikeList?.length ?? 0;
	const numDocks = stationObj.freeDocks; // number of free docks
	const distanceToStation = distance(pos, [lastStationObj.longitude, lastStationObj.latitude]);

	// set the inner HTML after the animation has started
	if (bikeList) {
		menu.innerHTML = `
            <img src="assets/images/gira_footer.svg" alt="footer" id="graphics">
			<div id="stationIDandDistanceContainer">
				<div id="stationID">Estação ${stationObj.name.split("-")[0].trim()}</div>
				<div id="stationDistance">${formatDistance(distanceToStation)}</div>
			</div>
            <div id="stationName">${stationObj.name.split("-")[1]?.trim() ?? ""}</div>
			<div id="navigateToButton" onclick="routeToStation('${stationSerialNumber}')"><i class="bi bi-sign-turn-right"></i></div>
            <img id="docksImage" src="assets/images/mGira_station.png" alt="Gira station" width="25%">
            <div id="docksButton">${numDocks === 1 ? "1 doca" : `${numDocks} docas`}</div>
            <img id="bikesImage" src="assets/images/mGira_bike.png" alt="Gira bike" width="25%">
            <div id="bikesButton${
							stationObj.assetStatus === "repair" && !devMode
								? 'Disabled"'
								: `" onclick="openBikeList('${stationSerialNumber}')"`
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
		menu.addEventListener("animationend", event => {
			// Check if the animation that ended is the one you are interested in
			if (event.animationName === `smooth-slide-to-${exitToRight ? "right" : "left"}`) {
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
			.find(layer => layer.get("name") === "cyclewaysLayer")
			.setVisible(true);

		// Add back the stations layer (only if user has clicked navigate to stations)
		loadStationMarkersFromArray(stationsArray);
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
	const distanceToStation = distance(pos, [lastStationObj.longitude, lastStationObj.latitude]);

	let menu = document.createElement("div");
	menu.className = "bike-list";
	menu.id = "bikeMenu";
	menu.innerHTML = `
        <div id="backButton" onclick="hideBikeList();"><i class="bi bi-arrow-90deg-left"></i></div>
		<div id="stationIDandDistanceContainer">
			<div id="stationID">Estação ${stationObj.name.split("-")[0].trim()}</div>
			<div id="stationDistance">${formatDistance(distanceToStation)}</div>
		</div>
		<div id="stationName">${stationObj.name.split("-")[1]?.trim() ?? ""}</div>
		<div id="listGradient"></div>
        <ul id="bikeList">
            <!-- Populate with the list here -->
        </ul>
    `.trim();
	document.body.appendChild(menu);
	const nextTripCountdown = document.getElementById("countdown");
	if (nextTripCountdown) menu.appendChild(nextTripCountdown);

	// If there is navigation going, make the menu still appear
	if (navigationActive) menu.style.zIndex = 99;

	// Keep the bike list live while it is open
	stopBikeListListener?.();
	stopBikeListListener = null;
	renderBikeList(stationSerialNumber, stationObj.bikeList);
	const firestore = await waitForFirestore();
	if (!document.body.contains(menu)) return;
	stopBikeListListener = firestore.subscribeStationBikes(
		Number(stationSerialNumber),
		bikes => {
			const bikeList = mapAvailableBikes(bikes);
			stationObj.bikeList = bikeList;
			if (recordObservedBikeCount(stationSerialNumber, bikeList.length) && !document.getElementById("placeSearchMenu"))
				loadStationMarkersFromArray(stationsArray, !tripEnded);
			if (document.body.contains(menu)) renderBikeList(stationSerialNumber, bikeList);
		},
		error => console.error("Station bikes listener failed", error)
	);

	if (devMode && stationObj.assetStatus !== "active")
		createCustomAlert(
			"Esta funcionalidade só está disponível no modo de desenvolvimento.\nPor esse motivo, não podemos garantir que funcione corretamente.\nA partir deste momento, não nos responsabilizamos por quaisquer problemas que possam surgir.",
			"⚠️ ATENÇÃO ⚠️"
		);
}

function renderBikeList(stationSerialNumber, bikeList) {
	const bikeListElement = document.getElementById("bikeList");
	if (!bikeListElement) return;

	// Still loading
	if (!bikeList) {
		bikeListElement.innerHTML = `<img src="assets/images/mGira_spinning.gif" id="spinner">`;
		return;
	}

	bikeListElement.innerHTML = "";

	// get the bikes in the station
	for (let bike of bikeList) {
		const bikeElement = document.createElement("li");
		bikeElement.className = "bike-list-element";

		bikeElement.innerHTML = `
            <div id="battery" style="width: ${bike.type === "electric" ? `${bike.battery ?? 0}%` : `0`}"></div>
            <div id="content" onclick="openUnlockBikeCard('${stationSerialNumber}','${htmlEncode(JSON.stringify(bike))}')">
				<img id="bikeIcon" src="assets/images/${bike.type === "electric" ? `ebike.png` : `classic.png`}">
				<div id="bikeInfo">
					<div id="bikeName">${bike.name}</div>
					<div id="bikeDock">Doca ${bike.dockName}</div>
					${devMode ? `<div id="serialNum">ID de comunicação: ${bike.serialNumber}</div>` : ""}
				</div>
                <i id="reserveBikeIcon" class="bi bi-arrow-bar-right"></i></div>
            </div>
        `.trim();
		bikeListElement.appendChild(bikeElement);
	}

	// if there are no bikes, put a message saying that
	if (bikeListElement.childElementCount === 0) bikeListElement.innerHTML = `<div id="noBike">Não há bicicletas na estação.</div>`;

	// Unlisted-bike lookup disabled: VAIMOO's Firestore feed lists every dockable bike, so the legacy
	// bikeSerialNumberMapping workaround isn't needed (same decision as gira-mais).
	/*
	// allow user to try to take bike not appearing in app
	appendElementToElementFromHTML(
		`
        <div id="openTakeUnregisteredBikeButton" onclick="openTakeUnregisteredBikeMenu('${stationSerialNumber}')">
			<div id="upperText">
				Bicicleta com luz verde,<br>
				mas não aparece?
			</div>
			<div id="lowerText">
				Tenta retirar!
			</div>
			<img src="assets/images/mGira_station_forbidden.png" alt="forbidden">
		</div>
    `,
		bikeListElement
	);
	*/
}

function hideBikeList() {
	// Stop listening for bike updates
	stopBikeListListener?.();
	stopBikeListListener = null;

	const bikeListMenu = document.getElementById("bikeMenu");
	if (bikeListMenu) {
		const nextTripCountdown = bikeListMenu.querySelector("#countdown");
		bikeListMenu.classList.add("smooth-slide-to-bottom");
		setTimeout(() => {
			if (nextTripCountdown) document.body.appendChild(nextTripCountdown);
			bikeListMenu.remove();
		}, 500); // remove element after animation
	}
}

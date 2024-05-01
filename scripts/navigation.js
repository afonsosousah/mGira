let navigationActive = false;
let navigationMode = null;
let deviceOrientation = "portrait";
let wakeLock = null;
let lastRoutePointIndex = null;
let promptedDropoffStation;
let promptedDestination;
let rotationMode = null;
let travelledDistance = 0;
let lastUserPosition = null;

async function startNavigation(walkingOnly = false) {
	navigationActive = true;

	// Tell the user that there is navigation going, so he needs to rotate the screen to portrait
	if (window.matchMedia("(orientation: landscape)").matches) showRotationNotice();

	// Make the device awake
	try {
		wakeLock = await navigator.wakeLock.request("screen");
	} catch (err) {
		// The Wake Lock request has failed - usually system related, such as battery.
		console.log(`${err.name}, ${err.message}`);
	}

	// Navigation on-foot from user location to nearest station
	navigationMode === "foot";

	// Set rotation mode
	rotationMode = "route";

	// Zoom in to an approppriate level
	map.getView().setZoom(17);

	// Append the buttons
	appendElementToBodyFromHTML(`
		<div id="changeRotationModeButtonPortrait" onclick="changeRotationMode()"><i class="bi bi-sign-turn-right"></i></div>
		<div id="endNavigationButtonPortrait" onclick="stopNavigation()"><i class="bi bi-sign-stop"></i></div>
	`);
	if (!walkingOnly) {
		appendElementToBodyFromHTML(`
			<div id="onBikeButton" onclick="onBikeNavigation()">Estou na bicicleta</div>
		`);
	}

	// Update the map style to hide the standard UI
	const mapElement = document.getElementById("map");
	mapElement.style.zIndex = "10";

	// Set the map to 3D effect
	mapElement.style.transform = "perspective(100dvh) rotateX(30deg) translateZ(25dvh) translateY(-3.5dvh)";
	mapElement.style.transition = "transform 1s";

	// Set map pixel ratio (fix mobile map not loading at some points)
	map.pixelRatio_ = 2;

	// hide station menu
	if (document.getElementById("stationMenu")) document.getElementById("stationMenu").remove();
	document.getElementById("zoomControls").classList.add("smooth-slide-down-zoom-controls"); // move zoom controls back down

	// reset travelled distance
	travelledDistance = 0;
}

function onBikeNavigation() {
	// Set navigation mode
	navigationMode = "bike";

	// Set rotation mode
	if (!rotationMode) rotationMode = "route";

	// Request fullscreen
	// https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen
	if (typeof document.body.requestFullscreen === "function") document.body.requestFullscreen();

	// Tell the user that there is navigation going, so he needs to rotate the screen to landscape
	if (window.matchMedia("(orientation: portrait)").matches) showRotationNotice();

	// Add the Navigation Information Panel
	let navInfoPanelElement = document.createElement("div");
	navInfoPanelElement.id = "navigationInfoPanel";
	navInfoPanelElement.innerHTML = `
	<div id="costAndTimeContainer">
		<div>
			<i class="bi bi-currency-euro"></i>
			<span id="tripCost">0.00€</span>
		</div>
		<div>
			<i class="bi bi-clock"></i>
			<span id="tripTime">00:00:00</span>
		</div>
	</div>
	<div id="speedContainer">
		<div id="speed">N/A</div>
		<div id="speedLabel">km/h</div>
	</div>
    `.trim();
	document.body.appendChild(navInfoPanelElement);

	// Append the end navigation button
	appendElementToBodyFromHTML(`
		<div id="changeRotationModeButton" onclick="changeRotationMode()"><i class="bi bi-sign-turn-right"></i></div>
		<div id="endNavigationButton" onclick="stopNavigation()"><i class="bi bi-sign-stop"></i></div>
	`);

	// Append the change rotation button
	if (!document.getElementById("changeRotationModeButton")) {
		appendElementToBodyFromHTML(`
			<div id="changeRotationModeButton" onclick="changeRotationMode()"><i class="bi bi-sign-turn-right"></i></div>
		`);
	}

	// Set map pixel ratio (fix mobile map not loading at some points)
	map.pixelRatio_ = 1.5;

	// Update the map style to hide the on foot UI
	const mapElement = document.getElementById("map");
	mapElement.style.zIndex = "15";
}

async function finalOnFootNavigation() {
	// Set navigation mode
	navigationMode = "foot";

	// Set rotation mode
	if (!rotationMode) rotationMode = "route";

	// Exit fullscreen
	try {
		await document.exitFullscreen();
	} catch (error) {
		console.log(error);
	}

	// Remove all the on bike navigation elements
	const navigationElements = Array.from(document.querySelectorAll("*")).filter(
		e => getComputedStyle(e).zIndex === "16"
	);
	for (element of navigationElements) {
		element.remove();
	}

	// Remove the on bike button
	if (document.getElementById("onBikeButton")) document.getElementById("onBikeButton").remove();

	// Update the map style to hide the standard UI
	const mapElement = document.getElementById("map");
	mapElement.style.zIndex = "10";

	// Tell the user that there is navigation going, so he needs to rotate the screen to portrait
	if (window.matchMedia("(orientation: landscape)").matches) showRotationNotice();

	// Set map pixel ratio (fix mobile map not loading at some points)
	map.pixelRatio_ = 2;
}

async function stopNavigation() {
	// Unset the navigation properties
	navigationActive = false;
	navigationMode = null;

	// Unset rotation mode
	rotationMode = null;

	// Don't force device to be awake anymore
	if (wakeLock) {
		wakeLock.release().then(() => (wakeLock = null));
	}

	// Exit fullscreen, if not on landscape
	try {
		if (!window.matchMedia("(orientation: landscape)").matches) await document.exitFullscreen();
	} catch (error) {
		console.log(error);
	}

	// Remove all the navigation elements
	const navigationElements = Array.from(document.querySelectorAll("*")).filter(
		e => getComputedStyle(e).zIndex === "11" || getComputedStyle(e).zIndex === "16"
	);
	for (element of navigationElements) {
		element.remove();
	}

	// Set map to default
	const mapElement = document.getElementById("map");
	mapElement.style.zIndex = "0";

	// Remove 3D effect
	mapElement.style.transform = "unset";
	mapElement.style.transition = "unset";

	// Align the map to north and pan to user location on the center
	const view = map.getView();
	const userPosition = ol.proj.fromLonLat(pos);
	view.setCenter(userPosition);
	view.setRotation(0); // 0 degrees is north
	view.padding = [0, 0, 0, 0]; // reset padding

	// Reset map pixel ratio to default
	map.pixelRatio_ = window.devicePixelRatio;

	// Show the stations back, if user was navigating to station
	if (userClickedNavigateToStation) {
		// Remove the results layer
		map
			.getLayers()
			.getArray()
			.filter(layer => ["placesLayer", "stationsLayer", "routeLayer"].includes(layer.get("name")))
			.forEach(layer => map.removeLayer(layer));

		// Add back the stations layer (only if user has clicked navigate to stations)
		getStations();
	}

	// Show cycleways layer
	map
		.getLayers()
		.getArray()
		.find(layer => layer.get("name") === "cyclewaysLayer")
		.setVisible(true);

	// If the screen is not portrait, tell the user to rotate it
	orientationChangeHandler(window.matchMedia("(orientation: portrait)"));
}

function changeRotationMode() {
	let endNavigationButton = document.getElementById("endNavigationButton");
	let endNavigationButtonPortrait = document.getElementById("endNavigationButtonPortrait");
	let changeRotationModeButton = document.getElementById("changeRotationModeButton");
	let changeRotationModeButtonPortrait = document.getElementById("changeRotationModeButtonPortrait");

	if (rotationMode === "route") {
		rotationMode = "compass";
		if (changeRotationModeButton) changeRotationModeButton.innerHTML = `<i class="bi bi-compass"></i>`;
		if (changeRotationModeButtonPortrait) changeRotationModeButtonPortrait.innerHTML = `<i class="bi bi-compass"></i>`;
	} else if (rotationMode === "compass") {
		if (!endNavigationButton && !endNavigationButtonPortrait) {
			rotationMode = "free";
			if (changeRotationModeButton) changeRotationModeButton.innerHTML = `<i class="bi bi-crosshair"></i>`;
			if (changeRotationModeButtonPortrait)
				changeRotationModeButtonPortrait.innerHTML = `<i class="bi bi-crosshair"></i>`;
			followLocation = true;
		} else {
			rotationMode = "route";
			if (changeRotationModeButton) changeRotationModeButton.innerHTML = `<i class="bi bi-sign-turn-right"></i>`;
			if (changeRotationModeButtonPortrait)
				changeRotationModeButtonPortrait.innerHTML = `<i class="bi bi-sign-turn-right"></i>`;
		}
	} else if (rotationMode === "free") {
		rotationMode = "compass";
		if (changeRotationModeButton) changeRotationModeButton.innerHTML = `<i class="bi bi-compass"></i>`;
		if (changeRotationModeButtonPortrait) changeRotationModeButtonPortrait.innerHTML = `<i class="bi bi-compass"></i>`;
		followLocation = true;
	}
}

function updateRotation() {
	// Keep current rotation by default
	let angleRad = map.getView().getRotation();
	const currentPosition = pos;

	// Get correct rotation
	if (rotationMode === "route" && currentPosition != lastUserPosition) {
		let closestDistance;
		let closestPointIndex;

		// Get the closest route point to current location
		for (const [i, routePoint] of currentRouteCoordinates.entries()) {
			const computedDistance = distance(currentPosition, routePoint);
			if (!closestDistance) {
				closestDistance = computedDistance;
				closestPointIndex = i;
			} else if (computedDistance < closestDistance) {
				closestDistance = computedDistance;
				closestPointIndex = i;
			}
		}

		// If the closest point is less than 1 meter away, update lastRoutePointIndex
		if (lastRoutePointIndex) {
			const distanceToClosestPoint = distance(currentPosition, currentRouteCoordinates[closestPointIndex]);
			const distanceToLastPoint = distance(currentPosition, currentRouteCoordinates[lastRoutePointIndex]);
			const distanceBetweenClosestAndLastPoint = distance(
				currentRouteCoordinates[closestPointIndex],
				currentRouteCoordinates[lastRoutePointIndex]
			);

			if (
				((distanceToClosestPoint < 1 && distanceToClosestPoint < distanceToLastPoint) ||
					distanceToLastPoint > distanceBetweenClosestAndLastPoint ||
					Math.abs(lastRoutePointIndex - closestPointIndex) > 1) && // If the difference is more than 1 point
				closestPointIndex != lastRoutePointIndex
			) {
				lastRoutePointIndex = closestPointIndex; // Move to next point
				travelledDistance += distanceBetweenClosestAndLastPoint;
			} else {
				closestPointIndex = lastRoutePointIndex;
			}
		} else {
			lastRoutePointIndex = closestPointIndex;
		}

		const closestRoutePoint = currentRouteCoordinates[closestPointIndex];
		const nextRoutePoint = currentRouteCoordinates[Math.min(closestPointIndex + 1, currentRouteCoordinates.length - 1)]; // make sure the point doesn't go out of bounds

		const routeDistance = map
			.getLayers()
			.getArray()
			.filter(layer => layer.get("name") === "routeLayer")[0]
			.getSource()
			.getFeatures()
			.reduce((sum, cur) => sum + cur.values_.summary.distance, 0);

		// calculate route progress
		const routeProgress = travelledDistance / routeDistance;
		const remainingDistance = routeDistance - travelledDistance;

		// check if the user is off-route
		// (user is out of the circle containing the closest and next route points + 10 meters of margin of error)
		if (distance(currentPosition, nextRoutePoint) - distance(closestRoutePoint, nextRoutePoint) > 30) {
			alert("You are off-route!");
			recalculateFullRoute(currentPosition, currentRouteCoordinates[currentRouteCoordinates.length - 1]);
		}

		// Get the differences between coordinates
		const diffLat = nextRoutePoint[1] - closestRoutePoint[1];
		const diffLon = nextRoutePoint[0] - closestRoutePoint[0];

		// Get the angle between the current route point and the next route point (corrected from clockwise east to clockwise north)
		angleRad = -90 * (Math.PI / 180) + Math.atan2(diffLat, diffLon);

		// Update last user position
		lastUserPosition = currentPosition;
	} else if (rotationMode === "compass") {
		angleRad = -compassHeading;
	}

	// Get values and view (pos object is global and is updated getLocation() in map.js)
	const view = map.getView();
	const mapSize = map.getSize();
	const userPosition = ol.proj.fromLonLat(pos);

	if (navigationActive) {
		// Follow user location
		followLocation = true;

		// Pan to location
		if (navigationMode === "bike") view.padding = [mapSize[1] * 0.8, 0, 20, 0];
		else view.padding = [mapSize[1] * 0.7, 0, 20, 0];
    
    /*
		// Update rotation
		view.animate({
			duration: 250,
			rotation: angleRad,
			center: userPosition,
		});
		*/
		view.setRotation(angleRad);
		if (navigationMode === "bike") view.centerOn(userPosition, mapSize, [mapSize[0] / 2, mapSize[1] * 0.9]);
		else view.centerOn(userPosition, mapSize, [mapSize[0] / 2, mapSize[1] * 0.85]);

		// Check if user is near to dropoff station, and prompt them if they reached the dropoff station
		let distanceToDropoffStation = distance(currentPosition, [dropoffStation.longitude, dropoffStation.latitude]);
		if (distanceToDropoffStation < 30 && !promptedDropoffStation) {
			createCustomYesNoPrompt(
				`Chegou à estação?`,
				() => {
					promptedDropoffStation = true;
					finalOnFootNavigation();
				},
				() => {
					// Do nothing
				}
			);
		} else if (distanceToDropoffStation >= 30) promptedDropoffStation = false;

		// Check if user is near to destination, and prompt them if they reached the destination
		let distanceToDestination = distance(currentPosition, finalDestination);
		if (distanceToDestination < 30 && !promptedDestination) {
			createCustomYesNoPrompt(
				`Chegou ao destino?`,
				() => {
					promptedDestination = true;
					stopNavigation();
				},
				() => {
					// Do nothing
				}
			);
		} else if (distanceToDestination >= 30) promptedDestination = false;
	} else if (window.matchMedia("(orientation: landscape)").matches && !tripEnded && rotationMode !== "free") {
		// Pan to location
		view.padding = [mapSize[1] * 0.7, 0, 20, 0];

    /*
		// Update rotation
		view.animate({
			duration: 250,
			rotation: angleRad,
			center: userPosition,
		});
		*/
		view.setRotation(angleRad);
		view.centerOn(userPosition, mapSize, [mapSize[0] / 2, mapSize[1] * 0.85]);
		
	}
}

async function orientationChangeHandler(event) {
	if (event.matches) {
		// Portrait

		if (navigationActive && navigationMode === "bike") {
		}

		if (document.querySelector("#rotateScreenNotice")) {
			// Hide the rotate screen notice
			document.getElementById("rotateScreenNotice").remove();

			// Update the inner height if the app started in portrait mode
			initialWindowHeight = window.innerHeight;
		}

		// Exit fullscreen
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
		} catch (error) {
			console.log(error);
		}

		// If in navigation UI, change to default UI
		exitLandscapeNavigationUI();
	} else {
		// Landscape

		if (document.querySelector("#rotateScreenNotice")) {
			// Hide the rotate screen notice
			document.querySelector("#rotateScreenNotice").remove();
		}

		// Wait for map to finish loading
		await new Promise(resolve => {
			(function isMapLoaded() {
				if (typeof map === "object") resolve(map);
				else setTimeout(isMapLoaded, 100);
			})();
		});

		// Set map pixel ratio (fix mobile map not loading at some points)
		map.pixelRatio_ = 1.5;

		// Recommend to user to switch to fullscreen when in landscape
		if (typeof document.body.requestFullscreen === "function" && !document.fullscreenElement) {
			createCustomYesNoPrompt(
				"Para usar a aplicação em modo landscape é recomendado estar em ecrã inteiro.",
				() => {
					// Request fullscreen
					document.body.requestFullscreen();
				},
				() => {},
				"Ok",
				"Ignorar"
			);
		}

		// If user switches to landscape while in trip, put into navigation UI
		if (!tripEnded) {
			goIntoLandscapeNavigationUI();
		}
	}
}

async function goIntoLandscapeNavigationUI() {
	// Make the device awake
	try {
		wakeLock = await navigator.wakeLock.request("screen");
	} catch (err) {
		// The Wake Lock request has failed - usually system related, such as battery.
		console.log(`${err.name}, ${err.message}`);
	}

	// Add the Navigation Information Panel
	let navInfoPanelElement = document.createElement("div");
	navInfoPanelElement.id = "navigationInfoPanel";
	navInfoPanelElement.innerHTML = `
	<div id="costAndTimeContainer">
		<div>
			<i class="bi bi-currency-euro"></i>
			<span id="tripCost">0.00€</span>
		</div>
		<div>
			<i class="bi bi-clock"></i>
			<span id="tripTime">00:00:00</span>
		</div>
	</div>
	<div id="speedContainer">
		<div id="speed">N/A</div>
		<div id="speedLabel">km/h</div>
	</div>
	`.trim();
	document.body.appendChild(navInfoPanelElement);

	// Set the default rotation mode
	rotationMode = "free";

	// Append the change rotation button
	appendElementToBodyFromHTML(`
		<div id="changeRotationModeButton" onclick="changeRotationMode()"><i class="bi bi-crosshair"></i></div>
	`);

	// Set map pixel ratio (fix mobile map not loading at some points)
	map.pixelRatio_ = 1.5;

	// Update the map style to hide the on foot UI
	const mapElement = document.getElementById("map");
	mapElement.style.zIndex = "15";

	// Change map dots to available docks
	loadStationMarkersFromArray(stationsArray, true);
}

function exitLandscapeNavigationUI() {
	// If in navigation UI, change to default UI
	if (document.querySelector("#navigationInfoPanel") && !navigationActive) {
		// Remove all the on bike navigation elements
		const navigationElements = Array.from(document.querySelectorAll("*")).filter(
			e => getComputedStyle(e).zIndex === "16"
		);
		for (element of navigationElements) {
			element.remove();
		}

		// Unset rotation mode
		rotationMode = null;

		// Align the map to north and pan to user location on the center
		const view = map.getView();
		const userPosition = ol.proj.fromLonLat(pos);
		view.setCenter(userPosition);
		view.setRotation(0); // 0 degrees is north
		view.padding = [0, 0, 0, 0]; // reset padding
		followLocation = true;

		// Remove the on bike button
		document.getElementById("onBikeButton")?.remove();

		// Update the map style to show the standard UI
		const mapElement = document.getElementById("map");
		mapElement.style.zIndex = "0";

		// Change map dots to available bikes
		loadStationMarkersFromArray(stationsArray, !tripEnded);
	}
}

function showRotationNotice() {
	appendElementToBodyFromHTML(`
		<div class="rotate-screen-notice" id="rotateScreenNotice">
			<div id="phone">
			</div>
			<div id="message">
				Rode o seu dispositivo
			</div>
		</div>
		`);
}

// Add an event listener for changes in orientation
const portrait = window.matchMedia("(orientation: portrait)");
portrait.addEventListener("change", orientationChangeHandler);

// Initial orientation check
window.addEventListener("load", () => orientationChangeHandler(window.matchMedia("(orientation: portrait)")));

let navigationActive = false;
let navigationMode = null;
let deviceOrientation = "portrait";
let wakeLock = null;
let lastRoutePointIndex = null;
let promptedDropoffStation;
let promptedDestination;
let rotationMode = "route";

async function startNavigation(walkingOnly = false) {
	navigationActive = true;

	// Make the device awake
	try {
		wakeLock = await navigator.wakeLock.request("screen");
	} catch (err) {
		// The Wake Lock request has failed - usually system related, such as battery.
		console.log(`${err.name}, ${err.message}`);
	}

	// Navigation on-foot from user location to nearest station
	navigationMode === "foot";

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

	// Pan to user location and set the correct rotation based on the route
	updatePositionAndRotationWhenNavigating();
	updatePositionAndRotationWhenNavigating(); // do twice because the first time the alignment is not right (no idea why)
}

function onBikeNavigation() {
	navigationMode = "bike";

	// Request fullscreen
	document.body.requestFullscreen();

	// Tell the user that there is navigation going, so he needs to rotate the screen
	appendElementToBodyFromHTML(`
    <div class="rotate-screen-notice" id="rotateScreenNotice">
        <div id="phone">
        </div>
        <div id="message">
            Rode o seu dispositivo
        </div>
    </div>
    `);

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
		<div id="speed">00</div>
		<div id="speedLabel">km/h</div>
	</div>
    `.trim();
	document.body.appendChild(navInfoPanelElement);

	// Append the end navigation button
	appendElementToBodyFromHTML(`
		<div id="changeRotationModeButton" onclick="changeRotationMode()"><i class="bi bi-sign-turn-right"></i></div>
		<div id="endNavigationButton" onclick="stopNavigation()"><i class="bi bi-sign-stop"></i></div>
	`);

	// Set map pixel ratio (fix mobile map not loading at some points)
	map.pixelRatio_ = 1.5;

	// Update the map style to hide the on foot UI
	const mapElement = document.getElementById("map");
	mapElement.style.zIndex = "15";
}

async function finalOnFootNavigation() {
	navigationMode = "foot";

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

	// Tell the user that there is navigation going, so he needs to rotate the screen
	appendElementToBodyFromHTML(`
    <div class="rotate-screen-notice" id="rotateScreenNotice">
        <div id="phone">
        </div>
        <div id="message">
            Rode o seu dispositivo
        </div>
    </div>
    `);

	// Set map pixel ratio (fix mobile map not loading at some points)
	map.pixelRatio_ = 2;
}

async function stopNavigation() {
	navigationActive = false;
	navigationMode = null;

	// Don't force device to be awake anymore
	if (wakeLock) {
		wakeLock.release().then(() => (wakeLock = null));
	}

	// Exit fullscreen
	try {
		await document.exitFullscreen();
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
		.find(layer => layer.get("name") === "cyclewaysLayer").setVisible(true);

	// If the screen is not portrait, tell the user to rotate it
	orientationChangeHandler(window.matchMedia("(orientation: portrait)"));
}

function changeRotationMode() {
	let changeRotationModeButton = document.getElementById("changeRotationModeButton");
	let changeRotationModeButtonPortrait = document.getElementById("changeRotationModeButtonPortrait");

	if (rotationMode === "route") {
		rotationMode = "compass";
		if (changeRotationModeButton) changeRotationModeButton.innerHTML = `<i class="bi bi-compass"></i>`;
		if (changeRotationModeButtonPortrait) changeRotationModeButtonPortrait.innerHTML = `<i class="bi bi-compass"></i>`;
	} else if (rotationMode === "compass") {
		rotationMode = "route";
		if (changeRotationModeButton) changeRotationModeButton.innerHTML = `<i class="bi bi-sign-turn-right"></i>`;
		if (changeRotationModeButtonPortrait)
			changeRotationModeButtonPortrait.innerHTML = `<i class="bi bi-sign-turn-right"></i>`;
	}
}

function updatePositionAndRotationWhenNavigating() {
	if (navigationActive) {
		let angleRad;

		if (rotationMode === "route") {
			let closestDistance;
			let closestPointIndex;

			// Get the closest route point to current location
			for (const [i, routePoint] of currentRouteCoordinates.entries()) {
				const computedDistance = distance(pos, routePoint);
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
				let distanceToClosestPoint = distance(pos, currentRouteCoordinates[closestPointIndex]);
				let distanceToLastPoint = distance(pos, currentRouteCoordinates[lastRoutePointIndex]);
				let distanceBetweenClosestAndLastPoint = distance(
					currentRouteCoordinates[closestPointIndex],
					currentRouteCoordinates[lastRoutePointIndex]
				);

				if (
					(distanceToClosestPoint < 1 && distanceToClosestPoint < distanceToLastPoint) ||
					distanceToLastPoint > distanceBetweenClosestAndLastPoint ||
					Math.abs(lastRoutePointIndex - closestPointIndex) > 1 // If the difference is more than 1 point
				) {
					lastRoutePointIndex = closestPointIndex;
				} else {
					closestPointIndex = lastRoutePointIndex;
				}
			} else {
				lastRoutePointIndex = closestPointIndex;
			}

			let closestRoutePoint = currentRouteCoordinates[closestPointIndex];
			let nextRoutePoint = currentRouteCoordinates[Math.min(closestPointIndex + 1, currentRouteCoordinates.length - 1)]; // make sure the point doesn't go out of bounds

			// Get the differences between coordinates
			let diffLat = nextRoutePoint[1] - closestRoutePoint[1];
			let diffLon = nextRoutePoint[0] - closestRoutePoint[0];

			// Get the angle between the current route point and the next route point (corrected from clockwise east to clockwise north)
			angleRad = -90 * (Math.PI / 180) + Math.atan2(diffLat, diffLon);
		} else if (rotationMode === "compass") {
			angleRad = -compassHeading;
		}

		// Pan to location and update rotation (pos object is global and is updated getLocation() in map.js)
		const view = map.getView();
		const mapSize = map.getSize();
		const userPosition = ol.proj.fromLonLat(pos);

		view.setRotation(angleRad);

		if (navigationMode === "bike") view.centerOn(userPosition, mapSize, [mapSize[0] / 2, mapSize[1] * 0.9]);
		else view.centerOn(userPosition, mapSize, [mapSize[0] / 2, mapSize[1] * 0.85]);

		// Check if user is near to dropoff station, and prompt them if they reached the dropoff station
		let distanceToDropoffStation = distance(pos, [dropoffStation.longitude, dropoffStation.latitude]);
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
		let distanceToDestination = distance(pos, finalDestination);
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

		requestAnimationFrame(updatePositionAndRotationWhenNavigating);
	}
}

function orientationChangeHandler(event) {
	if (event.matches) {
		// Portrait mode
		if (navigationActive && navigationMode === "bike") {
			// Tell the user that there is navigation going, so he needs to rotate the screen
			appendElementToBodyFromHTML(`
                <div class="rotate-screen-notice" id="rotateScreenNotice">
                    <div id="phone">
                    </div>
                    <div id="message">
                        Rode o seu dispositivo
                    </div>
                </div>
            `);
		} else {
			// Hide the rotate screen notice
			if (document.getElementById("rotateScreenNotice")) document.getElementById("rotateScreenNotice").remove();

			// Update the inner height if the app started in portrait mode
			initialWindowHeight = window.innerHeight;
		}
	} else {
		// Landscape
		if (navigationActive && navigationMode === "bike") {
			// Hide the rotate screen notice
			if (document.querySelector("#rotateScreenNotice")) document.querySelector("#rotateScreenNotice").remove();
		} else {
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
	}
}

let portrait = window.matchMedia("(orientation: portrait)");

portrait.addEventListener("change", orientationChangeHandler);

window.addEventListener("load", () => orientationChangeHandler(window.matchMedia("(orientation: portrait)"))); // Initial orientation check

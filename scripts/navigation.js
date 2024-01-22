let navigationActive = false;
let navigationMode = null;
let deviceOrientation = "portrait";
let wakeLock = null;
let lastRoutePointIndex = null;

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

	// Request fullscreen
	document.body.requestFullscreen();

	// Zoom in to an approppriate level
	map.getView().setZoom(17);

	// Add the Navigation Information Panel
	let navInfoPanelElement = document.createElement("div");
	navInfoPanelElement.id = "navigationInfoPanelPortrait";
	navInfoPanelElement.innerHTML = `
    <img src="assets/images/mGira_big_white.png" alt="big logo">
    <div id="endNavigationButton" onclick="stopNavigation()">Terminar viagem</div>
    `.trim();
	document.body.appendChild(navInfoPanelElement);

	// Append the buttons
	if (!walkingOnly)
		appendElementToBodyFromHTML(`<div id="onBikeButton" onclick="onBikeNavigation()">Estou na bicicleta</div>`);

	// Update the map style to hide the standard UI
	const mapElement = document.getElementById("map");
	mapElement.style.zIndex = "10";

	// Pan to user location and set the correct rotation based on the route
	updatePositionAndRotationWhenNavigating();
	updatePositionAndRotationWhenNavigating(); // do twice because the first time the alignment is not right (no idea why)
}

function onBikeNavigation() {
	navigationMode = "bike";

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
    <img src="assets/images/mGira_big_white.png" alt="big logo">
    <span id="tripCost">0.00€</span>
    <span id="tripTime">00:00:00</span>
    <div id="endNavigationButton" onclick="stopNavigation()">Terminar viagem</div>
    `.trim();
	document.body.appendChild(navInfoPanelElement);

	// Append the button
	appendElementToBodyFromHTML(
		`<div id="reachedFinalStation" onclick="finalOnFootNavigation()">Cheguei à estação!</div>`
	);

	// Update the map style to hide the on foot UI
	const mapElement = document.getElementById("map");
	mapElement.style.zIndex = "15";
}

function finalOnFootNavigation() {
	navigationMode = "foot";

	// Remove all the on bike navigation elements
	const navigationElements = Array.from(document.querySelectorAll("*")).filter(e => getComputedStyle(e).zIndex === "16");
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
}

async function stopNavigation() {
	navigationActive = false;
	navigationMode = null;

	// Exit fullscreen
	try {
		await document.exitFullscreen();
	} catch (error) {
		console.log(error);
	}

	// Don't force device to be awake anymore
	if (wakeLock) {
		wakeLock.release().then(() => (wakeLock = null));
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

	// Align the map to north and pan to user location on the center
	const view = map.getView();
	const userPosition = ol.proj.fromLonLat(pos);
	view.setCenter(userPosition);
	view.setRotation(0); // 0 degrees is north

	// If the screen is not portrait, tell the user to rotate it
	orientationChangeHandler(window.matchMedia("(orientation: portrait)"));
}

function updatePositionAndRotationWhenNavigating() {
	if (navigationActive) {
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

		console.log(closestPointIndex);
		console.log(lastRoutePointIndex);

		// If the closest point is less than 1 meter away, update lastRoutePointIndex
		if (lastRoutePointIndex) {
			let distanceToClosestPoint = distance(pos, currentRouteCoordinates[closestPointIndex]);
			let distanceToLastPoint = distance(pos, currentRouteCoordinates[lastRoutePointIndex]);
			let distanceBetweenClosestAndLastPoint = distance(currentRouteCoordinates[closestPointIndex], currentRouteCoordinates[lastRoutePointIndex]);

			console.log(distanceToClosestPoint);
			console.log(distanceToLastPoint);
			console.log(distanceBetweenClosestAndLastPoint);

			if(
				(distanceToClosestPoint < 1 && distanceToClosestPoint < distanceToLastPoint)
				||
				(distanceToLastPoint > distanceBetweenClosestAndLastPoint)
				||
				(Math.abs(lastRoutePointIndex - closestPointIndex) > 1) // If the difference is more than 1 point
			) {
				lastRoutePointIndex = closestPointIndex;
			}
			else {
				closestPointIndex = lastRoutePointIndex;
			}
		}
		else {
			lastRoutePointIndex = closestPointIndex;
		}

		console.log(closestPointIndex);
		console.log(lastRoutePointIndex);

		let closestRoutePoint = currentRouteCoordinates[closestPointIndex];
		let nextRoutePoint = currentRouteCoordinates[Math.min(closestPointIndex + 1, currentRouteCoordinates.length - 1)]; // make sure the point doesn't go out of bounds

		// Get the differences between coordinates
		let diffLat = nextRoutePoint[1] - closestRoutePoint[1];
		let diffLon = nextRoutePoint[0] - closestRoutePoint[0];

		// Get the angle between the current route point and the next route point (corrected from clockwise east to clockwise north)
		const angleRad = -90 * (Math.PI / 180) + Math.atan2(diffLat, diffLon);

		// Pan to location and update rotation (pos object is global and is updated getLocation() in map.js)
		const view = map.getView();
		const mapSize = map.getSize();
		const userPosition = ol.proj.fromLonLat(pos);

		view.centerOn(userPosition, mapSize, [mapSize[0] / 2, mapSize[1] * (3 / 4)]);
		view.setRotation(angleRad);
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

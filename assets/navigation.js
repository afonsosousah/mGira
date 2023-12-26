let navigationActive = false;
let navigationMode = null;
let deviceOrientation = "portrait";
let wakeLock = null;

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
	navigationMode == "foot";

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
	mapElement = document.getElementById("map");
	mapElement.style.zIndex = "10";

	// Pan to user location and set the correct rotation based on the route
	updatePositionAndRotationWhenNavigating();
	updatePositionAndRotationWhenNavigating(); // do twice because the first time the alignment is not right (no idea why)

	/*
    // Alert user to calibrate compass
    alert(`
        Se o compasso não estiver calibrado, por favor calibre para utilizar a navegação.
        <img src="assets/images/figure-8-compass-calibration.gif" alt="compass calibration">
    `);

    // Start the FULLTILT DeviceOrientation listeners and update true north
    // bearing indicator whenever a new deviceorientation event is fired.
    var promise = FULLTILT.getDeviceOrientation({'type': 'world'});
    promise.then(function(orientationControl) {

        orientationControl.listen(function() {

            // Get latest screen-adjusted deviceorientation data
            var screenAdjustedEvent = orientationControl.getScreenAdjustedEuler();

            // Calculate the current compass heading that the user is 'looking at'
            var compassHeading = 360 - screenAdjustedEvent.alpha;
            compassHeading = -(Math.PI / 180) * compassHeading; // convert back to radians for the map

            updateRotationWhenNavigating(compassHeading);

        });

    });*/
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
	mapElement = document.getElementById("map");
	mapElement.style.zIndex = "15";
}

function finalOnFootNavigation() {
	navigationMode = "foot";

	// Remove all the on bike navigation elements
	navigationElements = Array.from(document.querySelectorAll("*")).filter(e => getComputedStyle(e).zIndex == 16);
	for (element of navigationElements) {
		element.remove();
	}

	// Remove the on bike button
	if (document.getElementById("onBikeButton")) document.getElementById("onBikeButton").remove();

	// Update the map style to hide the standard UI
	mapElement = document.getElementById("map");
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

function stopNavigation() {
	navigationActive = false;
	navigationMode = null;

	// Exit fullscreen
	document.exitFullscreen();

	// Don't force device to be awake anymore
	if (wakeLock) {
		wakeLock.release().then(() => {
			wakeLock = null;
		});
	}

	// Remove all the navigation elements
	navigationElements = Array.from(document.querySelectorAll("*")).filter(
		e => getComputedStyle(e).zIndex == 11 || getComputedStyle(e).zIndex == 16
	);
	for (element of navigationElements) {
		element.remove();
	}

	// Set map to default
	mapElement = document.getElementById("map");
	mapElement.style.zIndex = "0";

	// Align the map to north and pan to user location on the center
	var view = map.getView();
	var userPosition = ol.proj.fromLonLat(pos);
	view.setCenter(userPosition);
	view.setRotation(0); // 0 degrees is north

	// If the screen is not portrait, tell the user to rotate it
	orientationChangeHandler(window.matchMedia("(orientation: portrait)"));
}

function updatePositionAndRotationWhenNavigating() {
	if (navigationActive) {
		var curLon = pos[0];
		var curLat = pos[1];

		let closestDistance;
		let closestPoint_index;

		// Get the closest route point to current location
		for (let i = 0; i < currentRouteCoordinates.length; i++) {
			let routePoint = currentRouteCoordinates[i];
			if (!closestDistance) {
				closestDistance = distance(curLat, curLon, routePoint[1], routePoint[0]);
				closestPoint_index = i;
			} else if (distance(curLat, curLon, routePoint[1], routePoint[0]) < closestDistance) {
				closestDistance = distance(curLat, curLon, routePoint[1], routePoint[0]);
				closestPoint_index = i;
			}
		}

		let closestRoutePoint = currentRouteCoordinates[closestPoint_index];
		let nextRoutePoint = currentRouteCoordinates[Math.min(closestPoint_index + 1, currentRouteCoordinates.length - 1)]; // make sure the point doesn't go out of bounds

		// Get the differences between coordinates
		let diffLat = nextRoutePoint[1] - closestRoutePoint[1];
		let diffLon = nextRoutePoint[0] - closestRoutePoint[0];

		// Get the angle between the current route point and the next route point (corrected from clockwise east to clockwise north)
		var angleRad = -90 * (Math.PI / 180) + Math.atan2(diffLat, diffLon);

		// Pan to location and update rotation (pos object is global and is updated getLocation() in map.js)
		var view = map.getView();
		var mapSize = map.getSize();
		var userPosition = ol.proj.fromLonLat(pos);

		view.centerOn(userPosition, mapSize, [mapSize[0] / 2, mapSize[1] * (3 / 4)]);
		view.setRotation(angleRad);
	}
}

function orientationChangeHandler(event) {
	if (event.matches) {
		// Portrait mode
		if (navigationActive && navigationMode == "bike") {
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
		if (navigationActive && navigationMode == "bike") {
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

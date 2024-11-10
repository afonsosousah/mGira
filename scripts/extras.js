const delay = ms => new Promise(res => setTimeout(res, ms));

function appendElementToBodyFromHTML(htmlString) {
	// Create a string representing the element
	const elementString = htmlString;

	// Create a new DOMParser
	const parser = new DOMParser();

	// Parse the element string
	const doc = parser.parseFromString(elementString, "text/html");

	// Access the parsed element
	const element = doc.body.firstChild;

	// Append the elements to the document
	for (const element of doc.body.childNodes) {
		document.body.appendChild(element);
	}
}

function appendElementToElementFromHTML(htmlString, parentElement) {
	// Create a string representing the element
	const elementString = htmlString;

	// Create a new DOMParser
	const parser = new DOMParser();

	// Parse the element string
	const doc = parser.parseFromString(elementString, "text/html");

	// Access the parsed element
	const element = doc.body.firstChild;

	// Now you can manipulate or append the element to the document
	parentElement.appendChild(element);
}

function createElementFromHTML(htmlString) {
	var div = document.createElement("div");
	div.innerHTML = htmlString.trim();

	// Change this to div.childNodes to support multiple top-level nodes.
	return div.firstChild;
}

function getCookie(cname) {
	let name = cname + "=";
	let decodedCookie = decodeURIComponent(document.cookie);
	let ca = decodedCookie.split(";");
	for (let i = 0; i < ca.length; i++) {
		let c = ca[i];
		while (c.charAt(0) == " ") {
			c = c.substring(1);
		}
		if (c.indexOf(name) == 0) {
			return c.substring(name.length, c.length);
		}
	}
	return "";
}

function parseMillisecondsIntoReadableTime(milliseconds) {
	// Get days from milliseconds
	let days = milliseconds / (24 * 1000 * 60 * 60);
	let absoluteDays = Math.floor(days);
	let d = absoluteDays;

	// Get remainder from days and convert to hours
	let hours = (days - absoluteDays) * 24;
	let absoluteHours = Math.floor(hours);
	let h = absoluteHours > 9 ? absoluteHours : "0" + absoluteHours;

	//Get remainder from hours and convert to minutes
	let minutes = (hours - absoluteHours) * 60;
	let absoluteMinutes = Math.floor(minutes);
	let m = absoluteMinutes > 9 ? absoluteMinutes : "0" + absoluteMinutes;

	// Return in 0d00h00m format
	if (d > 0) return d + "d" + h + "h" + m + "m";
	else if (h > 0) return h + "h" + m + "m";
	else return m + "m";
}

function parseMillisecondsIntoTripTime(milliseconds, showSeconds = true) {
	// Get hours from milliseconds
	let hours = milliseconds / (60 * 60 * 1000);
	let absoluteHours = Math.floor(hours);
	let h = absoluteHours > 9 ? absoluteHours : "0" + absoluteHours;

	// Get remainder from hours and convert to minutes
	let minutes = (hours - absoluteHours) * 60;
	let absoluteMinutes = Math.floor(minutes);
	let m = absoluteMinutes > 9 ? absoluteMinutes : "0" + absoluteMinutes;

	// Get remainder from minutes and convert to seconds
	let seconds = (minutes - absoluteMinutes) * 60;
	let absoluteSeconds = Math.floor(seconds);
	let s = absoluteSeconds > 9 ? absoluteSeconds : "0" + absoluteSeconds;

	// Return in 00h00m00s format
	return (absoluteHours > 0 ? h + "h" : "") + m + "m" + (showSeconds ? s + "s" : "");
}

function changeThemeColor(color) {
	metaThemeColor = document.querySelector("meta[name=theme-color]").setAttribute("content", color);
}

function downloadObjectAsJson(exportObj, exportName) {
	const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObj, null, "\t"));
	const downloadAnchorNode = document.createElement("a");
	downloadAnchorNode.setAttribute("href", dataStr);
	downloadAnchorNode.setAttribute("download", exportName + ".json");
	document.body.appendChild(downloadAnchorNode); // required for firefox
	downloadAnchorNode.click();
	downloadAnchorNode.remove();
}

function getTLD() {
	let hostname = window.location.hostname;

	// Check if it is an IP address (for development)
	const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
	const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
	if (ipv4Pattern.test(hostname) || ipv6Pattern.test(hostname)) {
		return hostname;
	}

	// Get TLD
	let hostnames = hostname.split(".");
	hostname =
		hostnames.length === 1 ? hostname : hostnames[hostnames.length - 2] + "." + hostnames[hostnames.length - 1];

	return hostname;
}

function createCookie(name, value, expiryDate) {
	document.cookie =
		name +
		"=" +
		value +
		"; expires=" +
		expiryDate.toGMTString() +
		"; SameSite=strict" +
		"; Domain=" +
		getTLD() +
		"; Path=/;";
}

function deleteCookie(name) {
	document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:01 GMT; Domain=" + getTLD() + "; Path=/; SameSite=strict";
}

function getStationsDiff(newStationsArray, oldStationsArray = null) {
	oldStationsArray ?? stationsArray;

	for (const newStation of newStationsArray) {
		// Get previous station state
		const oldStation = oldStationsArray.find(obj => obj.serialNumber === newStation.serialNumber);

		// Compare number of bikes
		if (newStation.bikes !== oldStation.bikes) {
			const difference = newStation.bikes - oldStation.bikes;
			console.log(
				`Station ${newStation.serialNumber} has ${difference > 0 ? "+" + difference : difference} available bikes`
			);
			//map.getView().setCenter(ol.proj.fromLonLat([newStation.longitude, newStation.latitude]));
		}

		// Compare number of docks
		if (newStation.docks !== oldStation.docks) {
			const difference = newStation.docks - oldStation.docks;
			console.log(
				`Station ${newStation.serialNumber} has ${difference > 0 ? "+" + difference : difference} free docks`
			);
		}

		// Compare status
		if (newStation.assetStatus !== oldStation.assetStatus) {
			console.log(
				`Station ${newStation.serialNumber} went from ${oldStation.assetStatus} status to ${newStation.assetStatus} status`
			);
		}
	}
}

function toPascalCase(str) {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

function htmlEncode(str) {
	return str
		.replaceAll("&", "&amp;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");
}

function convertBbox(bbox) {
	const minCoords = ol.proj.fromLonLat([bbox[0], bbox[1]]);
	const maxCoords = ol.proj.fromLonLat([bbox[2], bbox[3]]);

	return [minCoords[0], minCoords[1], maxCoords[0], maxCoords[1]];
}

function randomInteger(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDistance(meters) {
	if (meters > 999_000) return "+999km";
	if (meters > 100_000) return (meters / 1000).toFixed(0) + "km";
	if (meters > 10_000) return (meters / 1000).toFixed(1) + "km";
	if (meters > 1_000) return (meters / 1000).toFixed(2) + "km";
	return meters.toFixed(0) + "m";
}

const arrayStandardDeviation = (arr, usePopulation = false) => {
	// Calculate the mean of the array
	const mean = arr.reduce((acc, val) => acc + val, 0) / arr.length;

	// Calculate the sum of squared differences from the mean
	const sumOfSquaredDifferences = arr
		.reduce((acc, val) => acc.concat((val - mean) ** 2), [])
		.reduce((acc, val) => acc + val, 0);

	// Calculate the standard deviation
	return Math.sqrt(sumOfSquaredDifferences / (arr.length - (usePopulation ? 0 : 1)));
};

// Testing functions
let onFakeTrip = false;

function startFakeTrip() {
	// Generate random trip time (between 5 and 120 minutes)
	const tripMs = randomInteger(5, 120) * 60 * 1000;

	// Create fake start date
	const startDate = new Date(Date.now() - tripMs);

	// Create fake trip object
	activeTripObj = {
		code: "Q1BWYJLB1R",
		bike: "E0000",
		startDate: startDate.toISOString(),
		endDate: null,
		cost: null,
		finished: false,
		canPayWithMoney: null,
		canUsePoints: null,
		clientPoints: null,
		tripPoints: null,
		canceled: false,
		period: "other",
		periodTime: "312",
		error: 0,
	};

	// Append the trip overlay
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

	// Update the station markers
	loadStationMarkersFromArray(stationsArray, true);

	// Go into landscape UI if needed
	if (window.matchMedia("(orientation: landscape)").matches) {
		goIntoLandscapeNavigationUI();
	}

	// Set the trip ended flag and start timer
	onFakeTrip = true;
	tripEnded = false;
	tripTimer(Date.parse(activeTripObj.startDate));
}

function endFakeTrip() {
	onFakeTrip = false;
	tripEnded = true;

	// Update the station markers
	loadStationMarkersFromArray(stationsArray, false);

	// If in navigation UI, change to default UI
	exitLandscapeNavigationUI();
}

function startFakeRoute() {
	fetch("../assets/track_points.geojson").then(async response => {
		const watchInterval = 1000;
		const geoJSON = await response.json();
		const points = geoJSON.features.map(point => point.geometry.coordinates);
		const timestamps = geoJSON.features.map(
			(point, i, features) =>
				new Date(point.properties.time).getTime() - new Date(features[0].properties.time).getTime()
		);
		const headings = geoJSON.features.map((point, i, features) => {
			const currentPoint = points[i];
			const previousPoint = points[Math.max(0, i - 1)];
			const diffLat = currentPoint[1] - previousPoint[1];
			const diffLon = currentPoint[0] - previousPoint[0];
			let heading = -(Math.PI / 2) + Math.atan2(diffLat, diffLon); // (corrected from clockwise east to clockwise north)
			heading = (180 / Math.PI) * heading; // convert to deg
			return heading;
		});
		const speeds = geoJSON.features.map((point, i, features) => {
			const currentPoint = points[i];
			const previousPoint = points[Math.max(0, i - 1)];
			const speed = distance(currentPoint, previousPoint);
			return speed;
		});
		let fakeRouteIndex = 0;

		// Clear all previous geolocation watches
		for (const watchPositionID of watchPositionIDs) {
			navigator.geolocation.clearWatch(watchPositionID);
		}

		// Create the fake rotation event
		const event = new Event("deviceorientationabsolute");

		// Create the fake geolocation object
		navigator.geolocation = navigator.geolocation || {};
		navigator.geolocation.getCurrentPosition = function (succ, err) {
			setTimeout((a, b) => {
				if (fakeRouteIndex >= points.length) fakeRouteIndex = 0;

				const currentPoint = points[fakeRouteIndex];
				let gpsHeading = -headings[fakeRouteIndex];
				gpsHeading -= Math.floor(gpsHeading / 360) * 360; // Wrap into range [0,360].

				const position = {
					coords: {
						latitude: currentPoint[1],
						longitude: currentPoint[0],
						heading: gpsHeading,
						speed: speeds[fakeRouteIndex],
					},
				};

				// Fire fake rotation event
				event.alpha = headings[fakeRouteIndex];
				event.alpha += window.screen.orientation?.angle;
				event.beta = event.gamma = 0;
				window.dispatchEvent(event);

				fakeRouteIndex += 1;
				succ(position);
			}, 0);
		};
		navigator.geolocation.watchPosition = function (succ, err) {
			return setInterval(
				(succ, err) => {
					navigator.geolocation.getCurrentPosition(succ, err);
				},
				watchInterval,
				succ,
				err
			);
		};
		navigator.geolocation.clearWatch = function (id) {
			clearInterval(id);
		};

		getLocation();
		startFakeTrip();
	});
}

function openFakeRateTripMenu() {
	// Generate random trip time (between 5 and 120 minutes)
	const tripMs = randomInteger(5, 120) * 60 * 1000;

	// Create fake start date
	const startDate = new Date(Date.now() - tripMs);
	const endDate = new Date(Date.now());

	// Create fake trip object
	const tripObj = {
		code: "Q1BWYJLB1R",
		bike: "E0000",
		startDate: startDate.toISOString(),
		endDate: endDate.toISOString(),
		cost: 0,
		finished: true,
		canPayWithMoney: null,
		canUsePoints: null,
		clientPoints: null,
		tripPoints: null,
		canceled: false,
		period: "other",
		periodTime: "312",
		error: 0,
	};

	openRateTripMenu(tripObj);
}

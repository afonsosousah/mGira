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

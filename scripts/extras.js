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

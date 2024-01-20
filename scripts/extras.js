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

	// Now you can manipulate or append the element to the document
	document.body.appendChild(element);
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

function getCookie(name) {
	for (const cookie of decodeURIComponent(document.cookie).split(";")) {
		if (cookie.split("=", 1)[0] === name) return c.replace(`${name}=`, "");
	}
	return "";
}

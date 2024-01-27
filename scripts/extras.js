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

function getCookie(cname) {
    let name = cname + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');
    for(let i = 0; i <ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) == ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
      }
    }
    return "";
}


function parseMillisecondsIntoReadableTime(milliseconds){

	// Get days from milliseconds
	var days = milliseconds / (24*1000*60*60);
	var absoluteDays = Math.floor(days);
	var d = absoluteDays;

	// Get remainder from days and convert to hours 
	var hours = (days - absoluteDays) * 24;
	var absoluteHours = Math.floor(hours);
	var h = absoluteHours > 9 ? absoluteHours : '0' + absoluteHours;
  
	//Get remainder from hours and convert to minutes
	var minutes = (hours - absoluteHours) * 60;
	var absoluteMinutes = Math.floor(minutes);
	var m = absoluteMinutes > 9 ? absoluteMinutes : '0' +  absoluteMinutes;  
  
	// Return in 0d00h00m format
	if (d > 0)
		return d + 'd' + h + 'h' + m + 'm';
	else if (h > 0)
		return h + 'h' + m + 'm'
	else 
		return m + 'm'
  }
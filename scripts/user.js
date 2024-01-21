let tokenRefreshed = false;

// Define the global user, where the variables will be stored
let user = {};

// Login to the emel API and get the tokens
async function login(event) {
	event.preventDefault();
	const loginForm = document.getElementById("loginForm");

	// Do the login request
	const response = await makePostRequest(
		"https://api-auth.emel.pt/auth",
		JSON.stringify({
			Provider: "EmailPassword",
			CredentialsEmailPassword: {
				email: loginForm.email.value,
				password: loginForm.password.value,
			},
		})
	);

	if (response.data) {
		// Store the received tokens
		user.accessToken = response.data.accessToken;
		user.refreshToken = response.data.refreshToken;
		user.expiration = response.data.expiration;

		// Get all user details
		getUserInformation();

		// Set the cookie expiry to 1 month after today.
		const expiryDate = new Date();
		expiryDate.setMonth(expiryDate.getMonth() + 1);

		// Store refreshToken cookie (stay logged in)
		document.cookie = "refreshToken=" + user.refreshToken + "; expires=" + expiryDate.toGMTString();

		document.getElementById("loginMenu").remove();
		tokenRefreshed = true;
	} else {
		alert("Login failed!");
	}
}

// Gets all the user information
async function getUserInformation() {
	// get the general information (without using the proxy)
	let response = await makeGetRequest("https://api-auth.emel.pt/user", user.accessToken);
	if (typeof response !== "undefined") user = { ...user, ...response.data };

	// Update user image based on user details
	setUserImageInitials(user.name);

	// Make batch query for Gira client information, activeUserSubscriptions and tripHistory to speed up request
	response = await makePostRequest(
		"https://apigira.emel.pt/graphql",
		JSON.stringify({
			query: `query {
            client: client { code, type, balance, paypalReference, bonus, numberNavegante }
            activeUserSubscriptions: activeUserSubscriptions { code, cost, expirationDate, name, nameEnglish, subscriptionCost, subscriptionPeriod, subscriptionStatus, type, active }
            tripHistory: tripHistory(pageInput: { _pageNum: 1, _pageSize: 1000 }) { bikeName bikeType bonus code cost endDate endLocation rating startDate startLocation usedPoints }
        }`,
		}),
		user.accessToken
	);
	user = { ...user, ...response.data.client[0] };
	user.activeUserSubscriptions = response.data.activeUserSubscriptions;
	user.tripHistory = response.data.tripHistory;

	return user;
}

// Open the login menu element and populate it
function openLoginMenu() {

	document.cookie = "version=0.0.0"; // Force show update notes after logout
	document.cookie = 'refreshToken=None;path="/";expires=Thu, 01 Jan 1970 00:00:01 GMT'; // delete cookie

	let menu = document.createElement("div");
	menu.className = "login-menu";
	menu.id = "loginMenu";
	menu.innerHTML = `
        <div id="loginCard">
            <img id="logo" src="assets/images/mGira_big.png" alt="mGira logo">
            <form id="loginForm">
                <input type="email" name="email" id="email" placeholder="e-Mail">
                <input type="password" name="password" id="password" placeholder="Palavra-passe">
            </form>
            <div id="registerButton" onclick="openSetProxyPrompt()"">Proxy</div>
            <div id="loginButton" onclick="login(event)">Entrar</div>
            <img id="footer" src="assets/images/gira_footer.svg" alt="footer">
        </div>
    `.trim();

	// Hide any menu already open
	if (document.querySelector(".user-settings")) document.querySelector(".user-settings").remove();

	if (document.querySelector(".bike-reserve")) document.querySelector(".bike-reserve").remove();

	if (document.querySelector(".station-menu")) document.querySelector(".station-menu").remove();

	if (document.querySelector(".bike-list")) document.querySelector(".bike-list").remove();

	// Add to the document
	if (document.querySelectorAll(".login-menu").length === 0) document.body.appendChild(menu);
}

// Open user settings element and populate it
async function openUserSettings() {
	// show the container from the start so that the request delay is less noticeable
	let settingsElement = document.createElement("div");
	settingsElement.className = "user-settings";
	settingsElement.id = "userSettings";

	if (document.querySelectorAll(".user-settings").length === 0) document.body.appendChild(settingsElement);

	// show loading animation
	settingsElement.innerHTML = `
    <img src="assets/images/mGira_bike.png" id="spinner">
    <div id="backButton" onclick="hideUserSettings()"><i class="bi bi-arrow-90deg-left"></i></div>
    <div id="proxyNotWorking" onclick="openSetProxyPrompt()">Proxy não funciona?</div>
    `;

	// Get all the user information
	const userObj = await getUserInformation();

	// Get subscription expiration
	const subscriptionExpiration = new Date(userObj.activeUserSubscriptions[0].expirationDate);

	// Get user initials
	let allNames = userObj.name.split(" ");  // separate all names
	let initials = allNames[0][0] + allNames.at(-1)[0]; // first letter of first name + first letter of last name

	// Calculate the total time of the tripHistory
	let totalTime = 0;
	for (trip of userObj.tripHistory) {
		let elapsedTime = new Date(new Date(trip.endDate) - new Date(trip.startDate));
		totalTime += elapsedTime.getTime();
	}
	totalTime = new Date(totalTime);
	totalTime.setTime(totalTime.getTime() + totalTime.getTimezoneOffset() * 60 * 1000); // Correct because of Daylight Saving Time
	const days = Math.round(Math.abs(totalTime.getTime() / (24 * 60 * 60 * 1000)));
	const hours = totalTime.getHours();
	const minutes = totalTime.getMinutes();
	const formattedTotalTime = days + "d" + hours + "h" + minutes.toString().padStart(2, "0") + "m";

	// Calculate an estimate for total distance (assuming an avg speed of 15km/h)
	let hoursFloat = days * 60 + hours + minutes / 60;
	let totalDistance = Math.floor(hoursFloat * 15); // hours * km in 1 hour

	// Calculate the average time of a trip
	let avgTime = new Date(totalTime.getTime() / userObj.tripHistory.length);
	const formattedAvgTime = avgTime.getMinutes().toString().padStart(2, "0") + "m";

	// Calculate an estimate for C02 saved using total time (assuming an avg speed of 15km/h)
	let co2Saved = Math.floor(hoursFloat * 15 * 0.054); // hours * km in 1 hour * kg of co2 saved per km

	// Populate the element
	settingsElement.innerHTML = `
        <div id="topUserContainer">
            <div id="backButton" onclick="hideUserSettings()"><i class="bi bi-arrow-90deg-left"></i></div>
            <img id="footer" src="assets/images/gira_footer_white.svg" alt="backImage">
            <div id="userImage">
				<div id="userInitialsSettings">${initials}</div>
			</div>
        </div>
        <div id="userName">${userObj.name}</div>
        <div id="balanceAndBonusContainer">
            <div id="balanceContainer">
                <div id="balanceLabel">Saldo</div>
                <div id="balance">${parseFloat(userObj.balance).toFixed(2)}€</div>
            </div>
            <div id="bonusContainer">
                <div id="bonusLabel">Bónus</div>
                <div id="bonus">${userObj.bonus}</div>
            </div>
        </div>
        <div id="subscriptionContainer">
            <div>
                <i class="bi bi-credit-card" id="cardSVG"></i>
                <div id="subscriptionName">${userObj.activeUserSubscriptions[0].name}</div>
                <div id="subscriptionValidity">Válido até ${subscriptionExpiration.toLocaleDateString("pt")}</div>
            </div>
        </div>
        <div id="statsContainer">
            <div id="totalDistanceContainer">
                <div id="totalDistanceLabel">Distância (est.)</div>
                <div id="totalDistance">${totalDistance}km</div>
            </div>
            <div id="totalTimeContainer">
                <div id="totalTimeLabel">Tempo total</div>
                <div id="totalTime">${formattedTotalTime}</div>
            </div>
            <div id="co2SavedContainer">
                <div id="co2SavedLabel">CO2 poupado</div>
                <div id="co2Saved">${co2Saved}kg</div>
            </div>
            <div id="numberOfTripsContainer">
                <div id="numberOfTripsLabel">Nº de viagens</div>
                <div id="numberOfTrips">${userObj.tripHistory.length}</div>
            </div>
        </div>
        <div id="settingsContainer">
            <div id="proxy">
                <div>Proxy definido pelo utilizador</div>
                <input id="proxyUrlInput" value="${proxyURL}" placeholder="Insere aqui o URL para o proxy"/>
                <div id="resetProxyButton"><i class="bi bi-arrow-counterclockwise"></i></div>
                <div id="setProxyButton"><i class="bi bi-check-lg"></i></div>
            </div>
        </div>
        <div id="bottom">
            <div id="versionNumber">0.0.3</div>
            <div id="logoutButton" onclick="openLoginMenu()">Sair</div>
        </div>
    `.trim();

	document.getElementById("setProxyButton").addEventListener("click", () => {
		// Set the cookie expiry to 1 year after today.
		const expiryDate = new Date();
		expiryDate.setFullYear(expiryDate.getFullYear() + 1);

		// Store customProxy cookie
		proxyURL = document.getElementById("proxyUrlInput").value;
		document.cookie = "customProxy=" + encodeURI(proxyURL) + "; expires=" + expiryDate.toGMTString();

		alert("O proxy foi definido.");
	});

	document.getElementById("resetProxyButton").addEventListener("click", () => {
		// Delete customProxy cookie
		proxyURL = "proxy.php";
		document.cookie = 'customProxy=None;path="/";expires=Thu, 01 Jan 1970 00:00:01 GMT';
		// Update input
		document.getElementById("proxyUrlInput").value = proxyURL;

		alert("O proxy foi redefinido.");
	});
}

function hideUserSettings() {
	let userSettings = document.getElementById("userSettings");
	if (userSettings) {
		userSettings.classList.add("smooth-slide-to-bottom");
		setTimeout(() => userSettings.remove(), 1000); // remove element after animation end
	}
}

function openSetProxyPrompt() {
	createCustomTextPrompt(
		"Por favor defina um novo proxy.",
		() => {
			// Store customProxy cookie
			proxyURL = document.getElementById("customTextPromptInput").value;
			document.cookie = "customProxy=" + encodeURI(proxyURL);
		},
		() => {
			// Delete customProxy cookie
			proxyURL = "proxy.php";
			document.cookie = 'customProxy=None;path="/";expires=Thu, 01 Jan 1970 00:00:01 GMT';
			openLoginMenu();
		},
		"Definir",
		"Padrão"
	);
}



function setUserImageInitials(username) {

	// Set the initials of the user name to act like picture
	// (removes dependency on ui-avatars.com)

	// Get the initials
	let allNames = username.split(" ");  // separate all names
	let initials = allNames[0][0] + allNames.at(-1)[0]; // first letter of first name + first letter of last name

	// User picture (main screen)
	let userInitialsElement = document.getElementById("userInitials");
	userInitialsElement.innerHTML = initials;
}

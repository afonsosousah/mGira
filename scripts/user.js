const TRIP_HISTORY_PAGE_SIZE = 10;
let tokenRefreshed = false;
let minimumDistanceToStation = 50;
let devMode = false;
let tripHistory = null;

// Define the global user, where the variables will be stored
let user = {};

// Login to the emel API and get the tokens
async function login(event) {
	event.preventDefault();

	// Get values from form
	const loginForm = document.getElementById("loginForm");

	// Show loading animation
	const loginCard = document.getElementById("loginCard");
	loginCard.innerHTML = `<img src="assets/images/mGira_spinning.gif" id="spinner">`;

	// Do the login request
	const responseReq = await fetch(GIRA_AUTH_ENDPOINT, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			Provider: "EmailPassword",
			CredentialsEmailPassword: {
				email: loginForm.email.value,
				password: loginForm.password.value,
			},
		}),
	});

	const response = await responseReq.json();

	// Handle login errors
	if (responseReq.status === 400) {
		if (Object.hasOwn(response, "statusDescription")) {
			if (
				response.statusDescription.includes("The Email field is required.") ||
				response.statusDescription.includes("The Password field is required.")
			) {
				alert("Por favor preencha os campos de email e password!");
				document.getElementById("loginMenu")?.remove();
				openLoginMenu();
				return;
			}
		}
	}

	if (response.error) {
		if (response.error.message === "Invalid credentials.") {
			alert("Credenciais inválidas.");
			document.getElementById("loginMenu")?.remove();
			openLoginMenu();
			return;
		}
	}

	if (response.data) {
		// Store the received tokens
		user.accessToken = response.data.accessToken;
		user.refreshToken = response.data.refreshToken;
		user.expiration = response.data.expiration;
		await fetchFirebaseToken(user.accessToken);

		/* Run the startup functions */
		await runStartupFunctions();

		// Set the cookie expiry to 1 year after today.
		const refreshTokenExpiryDate = new Date();
		refreshTokenExpiryDate.setFullYear(refreshTokenExpiryDate.getFullYear() + 1);

		// Store refreshToken cookie (stay logged in)
		createCookie("refreshToken", user.refreshToken, refreshTokenExpiryDate);

		// Set the cookie expiry to 2 minutes after now.
		const accessTokenExpiryDate = new Date();
		accessTokenExpiryDate.setMinutes(accessTokenExpiryDate.getMinutes() + 2);

		// Store accessToken cookie (for quick refreshes)
		createCookie("accessToken", user.accessToken, accessTokenExpiryDate);

		document.getElementById("loginMenu")?.remove();
		tokenRefreshed = true;
	} else {
		alert("Login failed!");
	}
}

async function fetchFirebaseToken(accessToken) {
	const res = await makeProxyRequest(FIREBASE_TOKEN_URL, {
			headers: {
				"User-Agent": `mGira ${currentVersion}`,
				"X-Gira-Token": accessToken,
			},
			method: "POST",
		}),
		token = await res.text();
	if (!res.ok) {
		console.error("Error fetching encrypted token: ", token);
		alert("Erro ao obter o token de verificação do dispositivo. A app não vai funcionar corretamente.");
		return null;
	}
	const { exp } = getJWTPayload(token);
	createCookie("firebaseToken", token, new Date(exp * 1000)); // 30 days
	user.firebaseToken = token;
	return token;
}

function getJWTPayload(token) {
	// Decode the JWT token and get the payload
	const payload = token.split(".")[1];
	const decodedPayload = atob(payload);
	return JSON.parse(decodedPayload);
}

async function runStartupFunctions() {
	// Get all user details
	getUserInformation();

	// Check if update info should be shown
	showUpdateInfoIfNeeded();

	// Get the user location on app open
	getLocation();

	// Start rotation of location dot
	// startLocationDotRotation();

	// Start WebSocket connection. This also loads the stations once they're sent
	startWSConnection();

	// Show any messages from EMEL
	await validateLogin();
}

async function validateLogin() {
	const response = await makePostRequest(
		GIRA_GRAPHQL_ENDPOINT,
		JSON.stringify({
			query: `mutation { 
				validateLogin(in: { 
					language: "pt",
					userAgent: "Gira/3.4.3 (Android 34)",
					firebaseToken: "cwEUfibvTHCRZ6z3R1l3B8"
				}) { messages { code text } } 
			}`,
		}),
		user.accessToken
	);

	for (const message of response?.data?.validateLogin?.messages ?? []) {
		createCustomAlert(message.text, `<i class="bi bi-info-circle"></i>`);
	}
}

// Gets all the user information
async function getUserInformation() {
	// get the general information (without using the proxy)
	let response = await makeGetRequest(GIRA_USER_ENDPOINT, user.accessToken);
	if (typeof response !== "undefined") user = { ...user, ...response.data };

	// Update user image based on user details
	document.getElementById("userInitials").innerText = getUserInitials(user.name);

	// Make batch query for Gira client information, activeUserSubscriptions and tripHistory to speed up request
	response = await makePostRequest(
		GIRA_GRAPHQL_ENDPOINT,
		JSON.stringify({
			query: `query {
            client: client { code, type, balance, paypalReference, bonus, numberNavegante }
            activeUserSubscriptions: activeUserSubscriptions { code, cost, expirationDate, name, nameEnglish, subscriptionCost, subscriptionPeriod, subscriptionStatus, type, active }
        }`,
		}),
		user.accessToken
	);
	user = { ...user, ...response.data.client[0] };
	user.activeUserSubscriptions = response.data.activeUserSubscriptions;

	return user;
}

// get tripHistory
async function getTripHistory(pageNum = 1, pageSize = TRIP_HISTORY_PAGE_SIZE) {
	response = await makePostRequest(
		GIRA_GRAPHQL_ENDPOINT,
		JSON.stringify({
			operationName: "tripHistory",
			variables: { in: { _pageNum: pageNum, _pageSize: pageSize } },
			query:
				"query tripHistory($in: PageInput) { tripHistory(pageInput: $in) { bikeName bikeType bonus code cost endDate endLocation rating startDate startLocation usedPoints }}",
		}),
		user.accessToken
	);
	return response.data.tripHistory;
}

// Open the login menu element and populate it
function openLoginMenu() {
	console.log("login menu was opened");

	// delete cookies
	deleteCookie("refreshToken");
	deleteCookie("accessToken");

	// delete user object
	user = {};
	if (ws) ws.close();

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
    <img src="assets/images/mGira_spinning.gif" id="spinner">
    <div id="backButton" onclick="hideUserSettings()"><i class="bi bi-arrow-90deg-left"></i></div>
    <div id="proxyNotWorking" onclick="openSetProxyPrompt()">Proxy não funciona?</div>
    `;

	let userObj = user; // get from global variable

	// Get all the user information, if it isn't available yet
	if (!userObj.activeUserSubscriptions) userObj = await getUserInformation();

	// Get subscription expiration
	const subscriptionExpiration = new Date(userObj.activeUserSubscriptions[0].expirationDate);

	// Populate the element
	settingsElement.innerHTML = `
        <div id="topUserContainer">
            <div id="backButton" onclick="hideUserSettings()"><i class="bi bi-arrow-90deg-left"></i></div>
			<div id="refreshButton" onclick="refreshUserInformation()"><i class="bi bi-arrow-clockwise"></i></div>
            <img id="footer" src="assets/images/gira_footer_white.svg" alt="backImage">
			<div id="bottomCard"></div>
            <div id="userImage">
				<div id="userInitialsSettings">${getUserInitials(userObj.name)}</div>
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
                <div id="subscriptionName">Passe ${toPascalCase(userObj.activeUserSubscriptions[0].type)}</div>
                <div id="subscriptionValidity">Válido até ${subscriptionExpiration.toLocaleDateString("pt")}</div>
            </div>
        </div>
		<div id="statisticsMenuButtonContainer">
			<div id="statisticsMenuButton" onclick="openStatisticsMenu();">
				<i class="bi bi-bar-chart"></i>
				<span>Estatísticas de uso</span>
			</div>
		</div>
		<div id="tripHistoryButtonContainer">
			<div id="tripHistoryButton" onclick="openTripHistory();">
				<i class="bi bi-clock-history"></i>
				<span>Histórico de viagens</span>
			</div>
		</div>
        <div id="settingsContainer">
            <div id="proxy">
                <div>Proxy definido pelo utilizador</div>
                <input id="proxyUrlInput" value="${proxyURL ?? "Padrão"}" placeholder="Insere aqui o URL para o proxy"/>
                <div id="resetProxyButton"><i class="bi bi-arrow-counterclockwise"></i></div>
                <div id="setProxyButton"><i class="bi bi-check-lg"></i></div>
            </div>
			<div id="distanceToStation">
				<div>Distância mínima até estação</div>
				<select id="distanceToStationSelector">
					<option value="50" ${minimumDistanceToStation === 50 ? `selected="selected"` : ""}>50m</option>
					<option value="75" ${minimumDistanceToStation === 75 ? `selected="selected"` : ""}>75m</option>
					<option value="100" ${minimumDistanceToStation === 100 ? `selected="selected"` : ""}>100m</option>
				</select>
			</div>
			<div id="devMode">
				<div>Modo de programador</div>
				<input id="devModeCheckbox" type="checkbox" ${devMode ? `checked="checked"` : ""}"/>
			</div>
        </div>
		<div id="issueButtonContainer">
			<div id="issueButton" onclick="window.open('https://github.com/afonsosousah/mGira/issues')">
				<i class="bi bi-bug"></i>
				<span>Relatar problema</span>
			</div>
		</div>
        <div id="bottom">
            <div id="versionNumber">${currentVersion}</div>
            <div id="logoutButton" onclick="openLoginMenu()">Sair</div>
        </div>
    `.trim();

	document.getElementById("setProxyButton").addEventListener("click", () => {
		// Set the cookie expiry to 1 year after today.
		const expiryDate = new Date();
		expiryDate.setFullYear(expiryDate.getFullYear() + 1);

		// Store customProxy cookie
		proxyURL = document.getElementById("proxyUrlInput").value;
		createCookie("customProxy", encodeURI(proxyURL), expiryDate);

		alert("O proxy foi definido.", `<i class="bi bi-info-circle"></i>`);
	});

	document.getElementById("resetProxyButton").addEventListener("click", () => {
		// Delete customProxy cookie
		proxyURL = null;
		deleteCookie("customProxy");

		// Update input
		document.getElementById("proxyUrlInput").value = proxyURL;

		alert("O proxy foi redefinido.", `<i class="bi bi-info-circle"></i>`);
	});

	// Handle value change on distance to station selector
	const distanceToStationSelector = document.getElementById("distanceToStationSelector");
	distanceToStationSelector.addEventListener("change", () => {
		const newDistance = Number(distanceToStationSelector.value); // convert to int
		minimumDistanceToStation = newDistance; // Set the value

		customCreateCookie("minimumDistanceToStation", newDistance); // Store the value in a cookie

		console.log(`Minimum distance to station was set to ${minimumDistanceToStation}m`);
	});
	const devModeInput = document.getElementById("devModeCheckbox");
	let devModeCounter = 0;
	devModeInput.addEventListener("change", () => {
		devMode = devModeInput.checked;
		if (devMode) devModeCounter++;
		if (devModeCounter === 3) {
			minimumDistanceToStation = Infinity; // cookie is not updated intentionally
			console.log("Easter egg activated, disabled minimum distance requirement");
			alert("Se chegaste aqui, provavelmente sabes o que acabaste de fazer. Parabéns!");
		}
		customCreateCookie("devMode", devMode);

		console.log(`Dev mode was set to ${devMode}`);
	});

	// Set status bar color in PWA
	// Set notification bar color in Progressive Web App (installable website)
	changeThemeColor("#79c000");
}

function customCreateCookie(name, value) {
	// Set the cookie expiry to 1 year after today.
	const expiryDate = new Date();
	expiryDate.setFullYear(expiryDate.getFullYear() + 1);

	// Store cookie
	createCookie(name, value, expiryDate);
}

function hideUserSettings(animate = true) {
	let userSettings = document.getElementById("userSettings");
	if (userSettings && animate) {
		userSettings.classList.add("smooth-slide-to-bottom");
		setTimeout(() => userSettings.remove(), 300); // remove element after animation end
	} else if (userSettings) {
		userSettings.remove();
	}
	changeThemeColor("#ffffff"); // Set status bar color in PWA
}

function refreshUserInformation() {
	// Set this to null to force refresh on settings page open
	user.activeUserSubscriptions = null;

	// Close and reopen settings page
	hideUserSettings(false);
	openUserSettings();
}

function openSetProxyPrompt() {
	createCustomTextPrompt(
		"Por favor defina um novo proxy.",
		() => {
			// Set the cookie expiry to 1 year after today.
			const expiryDate = new Date();
			expiryDate.setFullYear(expiryDate.getFullYear() + 1);

			// Store customProxy cookie
			proxyURL = document.getElementById("proxyUrlInput").value;
			createCookie("customProxy", encodeURI(proxyURL), expiryDate);
		},
		() => {
			// Delete customProxy cookie
			proxyURL = null;
			deleteCookie("customProxy");
			openLoginMenu();
		},
		"Definir",
		"Padrão"
	);
}

function getUserInitials(username) {
	// Get the initials
	const allNames = username.trim().split(" "); // separate all names
	// first letter of first name + first letter of last name when present
	return allNames.length === 1 ? allNames[0][0] : allNames[0][0] + allNames.at(-1)[0];
}

async function openTripHistory() {
	let menu = document.createElement("div");
	menu.id = "tripHistory";

	if (document.querySelectorAll("#tripHistory").length === 0) document.body.appendChild(menu);

	// Hide user settings behind trip history (without animations)
	const userSettingsElem = document.getElementById("userSettings");
	if (userSettingsElem) {
		userSettingsElem.style.maxHeight = "100dvh";
		userSettingsElem.style.overflow = "hidden";
		document.body.scrollTop = document.documentElement.scrollTop = 0; // scroll to top of the page
	}

	// Set status bar color in PWA
	changeThemeColor("#ffffff");

	// show loading animation
	menu.innerHTML = `
		<img src="assets/images/mGira_spinning.gif" id="spinner">
		<div id="backButton" onclick="hideTripHistory();"><i class="bi bi-arrow-90deg-left"></i></div>
		`;

	// Get user's trip history
	const tripHistory = await getTripHistory();

	if (document.querySelectorAll("#tripHistory").length === 0) hideTripHistory();

	// Create element
	menu.innerHTML = `
        <div id="backButton" onclick="hideTripHistory();"><i class="bi bi-arrow-90deg-left"></i></div>
		<div id="title">Histórico de Viagens</div>
		<div id="listGradient"></div>
        <ul id="tripList">
            <!-- Populate with the list here -->
        </ul>
		<div id="downloadTripHistoryButton" onclick="downloadTripHistory();">
			<i class="bi bi-cloud-download"></i>
		</div>
    `.trim();

	// populate the trip list
	addTripsToDOM(tripHistory);

	const tripList = document.getElementById("tripList");
	tripList.addEventListener("scroll", async event => {
		if (isScrolledToBottom(tripList)) {
			const newPageNum = tripList.childElementCount / TRIP_HISTORY_PAGE_SIZE + 1;
			if (newPageNum % 1 === 0) {
				console.log("Loading trip history page " + newPageNum);
				const spinner = createElementFromHTML(`<img src="assets/images/mGira_spinning.gif" id="tripHistorySpinner">`);
				tripList.appendChild(spinner);
				tripList.scrollTo({ top: tripList.scrollHeight, behavior: "auto" });
				const newTripHistory = await getTripHistory(newPageNum);
				spinner.remove();
				addTripsToDOM(newTripHistory);
			}
			// If the new page number is decimal it means the last history request didn't return TRIP_HISTORY_PAGE_SIZE trips
			// Therefore there are no more trips to load
		}
	});

	// if there are no trips, put a message saying that
	if (tripList.childElementCount === 0) tripList.innerHTML = "Não realizou nenhuma viagem";
}

function downloadTripHistory() {
	createCustomYesNoPrompt(
		"Deseja descarregar o seu histórico de viagens completo?\n⚠️ Nota: isto pode demorar algum tempo.",
		async () => {
			document.getElementById("alertBox").innerHTML = `<img src="assets/images/mGira_spinning.gif" id="spinner">`; // Show spinner
			downloadObjectAsJson(await getTripHistory(1, 10_000), "tripHistory");
		},
		() => null
	);
}

function addTripsToDOM(tripHistory) {
	for (let trip of tripHistory) {
		// create the list element
		const tripListElement = document.createElement("li");
		tripListElement.className = "trip-list-element";

		// Get formatted date. Format: "1 de jan. de 2024"
		const tripDate = new Date(trip.startDate);
		const formattedDate = tripDate.toLocaleDateString("pt", { dateStyle: "medium" }).replaceAll(" de ", " ");

		// Get formatted start time
		const formattedStartTime = tripDate.toLocaleTimeString("pt");

		// Get formatted time
		let tripTime = new Date(Date.parse(trip.endDate) - Date.parse(trip.startDate));
		const formattedTime = tripTime.getHours() + "h" + tripTime.getMinutes().toString().padStart(2, "0") + "m";

		// Get formatted cost
		let formattedCost = parseFloat(trip.cost).toFixed(2);

		// add the content to the list element
		tripListElement.innerHTML = `
            <div id="tripInfo">
				<div id="bikeName">
					<img id="bikeIcon" src="assets/images/mGira_bike.png">
					${trip.bikeName}
				</div>
				<div id="date">
					<i class="bi bi-calendar"></i>
					${formattedDate}
				</div>
				<div id="time">
					<i class="bi bi-clock"></i>
					${formattedStartTime}
				</div>
				<div id="time">
					<i class="bi bi-hourglass"></i>
					${formattedTime}
				</div>
				<div id="cost">
					<i class="bi bi-currency-euro"></i>
					${formattedCost}€
				</div>
				<div id="points">
					<i class="bi bi-piggy-bank"></i>
					${trip.bonus - trip.usedPoints} pontos
				</div>
            </div>
			<div id="tripStations">
				<img src="assets/images/tripStations.png">
				<div id="startStation">${trip.startLocation}</div>
				<div id="endStation">${trip.endLocation ?? "Não foi possível obter a estação final"}</div>
			</div>
        `.trim();
		document.getElementById("tripList").appendChild(tripListElement);
	}
}

function hideTripHistory() {
	// Remove element from DOM
	document.getElementById("tripHistory").remove();

	// Show user settings again
	let userSettingsElem = document.getElementById("userSettings");
	userSettingsElem.style.maxHeight = "";
	userSettingsElem.style.overflow = "";

	// Set status bar color in PWA
	changeThemeColor("#79c000");
}

// Statistics Menu
async function openStatisticsMenu() {
	// Create element
	let menu = document.createElement("div");
	menu.id = "statisticsMenu";

	if (document.querySelectorAll("#statisticsMenu").length === 0) document.body.appendChild(menu);

	// Hide user settings behind statistics menu (without animations)
	const userSettingsElem = document.getElementById("userSettings");
	if (userSettingsElem) {
		userSettingsElem.style.maxHeight = "100dvh";
		userSettingsElem.style.overflow = "hidden";
		document.body.scrollTop = document.documentElement.scrollTop = 0; // scroll to top of the page
	}

	// set background to white
	menu.style.backgroundColor = "var(--white)";
	menu.style.height = "100dvh";
	menu.style.width = "100vw";

	// show loading animation
	menu.innerHTML = `
		<img src="assets/images/mGira_spinning.gif" id="spinner">
		<div id="backButton" onclick="hideStatisticsMenu();"><i class="bi bi-arrow-90deg-left"></i></div>
		`;

	// Get user's trip history
	tripHistory = await getTripHistory(1, 10_000);

	if (document.querySelectorAll("#statisticsMenu").length === 0) hideStatisticsMenu();

	// set background back to black
	menu.style.backgroundColor = "var(--black)";

	// Set status bar color in PWA
	changeThemeColor("#231f20");

	menu.innerHTML = `
        <div id="backButton" onclick="hideStatisticsMenu();"><i class="bi bi-arrow-90deg-left"></i></div>
		<div id="title">Estatísticas</div>
		<div id="usableArea">
			<div class="chart-container">
				<canvas id="statsChart"></canvas>
			</div>
			<div id="statsTotals">
				<div id="timeParent" class="stats-totals-element">
					<div id="time">0</div>
					<div id="timeLabel">Tempo</div>
				</div>
				<div id="distanceParent" class="stats-totals-element">
					<div id="distance">0</div>
					<div id="distanceLabel">Distância</div>
				</div>
				<div id="tripsParent" class="stats-totals-element">
					<div id="trips">0</div>
					<div id="tripsLabel">Viagens</div>
				</div>
			</div>
			<div id="statsControls">
				<div id="periodControlParent">
					<div id="periodControlLabel" class="stats-control-label">Período</div>
					<select id="periodControl" onchange="updateStatisticsChart();">
						<option value="last7days" selected="selected">Últimos 7 dias</option>
						<option value="last30days">Últimos 30 dias</option>
						<option value="lastYear">Último ano</option>
						<option value="total">Total</option>
					</select>
				</div>
				<div id="groupControlParent">
					<div id="groupControlLabel" class="stats-control-label">Agrupar por</div>
					<select id="groupControl" onchange="updateStatisticsChart();">
						<option value="days" selected="selected">Dias</option>
						<option value="weeks">Semanas</option>
						<option value="months">Meses</option>
					</select>
				</div>
				<div id="statisticControlParent" onchange="updateStatisticsChart();">
					<div id="statisticControlLabel" class="stats-control-label">Estatística</div>
					<select id="statisticControl">
						<option value="timeRidden" selected="selected">Tempo em viagem</option>
						<option value="distance">Distância</option>
					</select>
				</div>
			</div>
		</div>
    `.trim();
	document.body.appendChild(menu);

	// Populate chart
	updateStatisticsChart();
}

function hideStatisticsMenu() {
	// Remove element from DOM
	document.getElementById("statisticsMenu").remove();

	// Show user settings again
	let userSettingsElem = document.getElementById("userSettings");
	userSettingsElem.style.maxHeight = "";
	userSettingsElem.style.overflow = "";

	// Set status bar color in PWA
	changeThemeColor("#79c000");
}

function updateStatisticsChart() {
	// Get the selected options
	let period = document.getElementById("periodControl").value;
	let groupBy = document.getElementById("groupControl").value;
	let statistic = document.getElementById("statisticControl").value;

	let numberOfDays;

	if (period === "last7days") {
		numberOfDays = 7;
	} else if (period === "last30days") {
		numberOfDays = 30;
	} else if (period === "lastYear") numberOfDays = 365;
	else if (period === "total") {
		// Start from the day the user account was activated
		let timeFromActivated = Date.now() - Date.parse(user.dateActivate);

		// Convert the milliseconds to days
		const days = timeFromActivated / (24 * 1000 * 60 * 60);
		const absoluteDays = Math.floor(days);

		numberOfDays = absoluteDays;
	}

	let startDate = new Date(new Date().setDate(new Date().getDate() - (numberOfDays - 1)));

	let tripsInPeriod = {
		total: {
			number_of_trips: 0,
			time_ridden: 0,
			distance: 0,
		},
	};

	// Create object linking each group with the trips
	for (let days = 0; days < numberOfDays; days++) {
		const start = startDate;

		// Add days to start date
		const dayDate = new Date(start.getFullYear(), start.getMonth(), start.getDate() + days);

		// If seeing total period, include also the year (to not repeat objects...)
		const dayMonthString =
			period === "total"
				? `${dayDate.getDate()}/${dayDate.getMonth() + 1}/${dayDate.getFullYear().toString().substring(2)}` // only last 2 digits of year
				: `${dayDate.getDate()}/${dayDate.getMonth() + 1}`;

		// Get the trips of the day
		const dayTrips = tripHistory.filter(trip => {
			const startDate = new Date(trip.startDate);
			return (
				startDate.getDate() === dayDate.getDate() && // Same day
				startDate.getMonth() === dayDate.getMonth() && // Same month
				startDate.getFullYear() === dayDate.getFullYear() // Same year
			);
		});

		// Get the time (in ms) and distance (in km) ridden for each trip
		for (const trip of dayTrips) {
			let tripTime = Date.parse(trip.endDate) - Date.parse(trip.startDate);
			trip.riddenTime = tripTime;
			// Calculate an estimate for trip distance (assuming an avg speed of 15km/h)
			const speed = 15 / (3600 * 1000); // convert km/h to km/ms
			trip.distance = Math.round(tripTime * speed * 1000) / 1000; // milliseconds * km in 1 millisecond (and round to 3 decimal places)
		}

		// Create the new object
		tripsInPeriod[dayMonthString] = {
			number_of_trips: dayTrips.length,
			time_ridden: dayTrips.length === 0 ? 0 : dayTrips.reduce((total_time, trip) => total_time + trip.riddenTime, 0),
			distance:
				dayTrips.length === 0 ? 0 : dayTrips.reduce((total_distance, trip) => total_distance + trip.distance, 0),
		};

		// Add to the total object
		tripsInPeriod.total.number_of_trips += dayTrips.length;
		tripsInPeriod.total.time_ridden +=
			dayTrips.length === 0 ? 0 : dayTrips.reduce((total_time, trip) => total_time + trip.riddenTime, 0);
		tripsInPeriod.total.distance +=
			dayTrips.length === 0 ? 0 : dayTrips.reduce((total_distance, trip) => total_distance + trip.distance, 0);
	}

	let groupedTripsInPeriod = {
		total: {
			number_of_trips: tripsInPeriod.total.number_of_trips,
			time_ridden: tripsInPeriod.total.time_ridden,
			distance: tripsInPeriod.total.distance,
		},
	};

	// Group the trips by period
	if (groupBy === "days") {
		groupedTripsInPeriod = tripsInPeriod;
	} else if (groupBy === "weeks") {
		const daysInWeek = 7;

		const entries = Object.entries(tripsInPeriod);

		for (let index = 1; index < entries.length - 1; index += daysInWeek) {
			let slicedTripsInPeriod = entries.slice(index, index + daysInWeek);
			let keyName = `${slicedTripsInPeriod.at(0)[0]}-${slicedTripsInPeriod.at(-1)[0]}`;
			groupedTripsInPeriod[keyName] = {
				number_of_trips: 0,
				time_ridden: 0,
				distance: 0,
			};

			// group all the data
			for (const [day, dayData] of slicedTripsInPeriod) {
				groupedTripsInPeriod[keyName].number_of_trips += dayData.number_of_trips;
				groupedTripsInPeriod[keyName].time_ridden += dayData.time_ridden;
				groupedTripsInPeriod[keyName].distance += dayData.distance;
			}
		}
	} else if (groupBy === "months") {
		const daysInMonth = 30;
		const entries = Object.entries(tripsInPeriod);

		for (let index = 1; index < entries.length - 1; index += daysInMonth) {
			let slicedTripsInPeriod = entries.slice(index, index + daysInMonth);
			let keyName = `${slicedTripsInPeriod.at(0)[0]}-${slicedTripsInPeriod.at(-1)[0]}`;
			groupedTripsInPeriod[keyName] = {
				number_of_trips: 0,
				time_ridden: 0,
				distance: 0,
			};

			// group all the data
			for (const [day, dayData] of slicedTripsInPeriod) {
				groupedTripsInPeriod[keyName]["number_of_trips"] += dayData.number_of_trips;
				groupedTripsInPeriod[keyName]["time_ridden"] += dayData.time_ridden;
				groupedTripsInPeriod[keyName]["distance"] += dayData.distance;
			}
		}
	}

	// Get labels and data (use slice to ignore total)
	let labels = Object.keys(groupedTripsInPeriod).slice(1);
	let dataLabel;
	let data;
	let yAxisLabel;
	if (statistic === "timeRidden") {
		data = Object.values(groupedTripsInPeriod)
			.slice(1)
			.map(period => Math.floor(period.time_ridden / 60000)); // convert to minutes
		dataLabel = "Tempo em viagem (min)";
		yAxisLabel = "Minutos";
	} else if (statistic === "distance") {
		data = Object.values(groupedTripsInPeriod)
			.slice(1)
			.map(period => period.distance);
		dataLabel = "Distância (km)";
		yAxisLabel = "Quilómetros";
	}

	// Set totals in HTML
	document.querySelector("#statsTotals #time").innerHTML = parseMillisecondsIntoReadableTime(
		groupedTripsInPeriod.total.time_ridden
	);
	document.querySelector("#statsTotals #distance").innerHTML = Math.round(groupedTripsInPeriod.total.distance) + "km";
	document.querySelector("#statsTotals #trips").innerHTML = groupedTripsInPeriod.total.number_of_trips;

	// Change chart font color
	Chart.defaults.color = "#d9d9da";

	// Destroy previous chart if it exists
	let oldChart = Chart.getChart("statsChart");
	if (oldChart != undefined) {
		oldChart.destroy();
	}

	// Create new chart
	const chartElem = document.getElementById("statsChart");
	new Chart(chartElem, {
		type: "bar",
		data: {
			labels: labels,
			datasets: [
				{
					label: dataLabel,
					data: data,
					borderWidth: 1,
					borderRadius: 10,
					backgroundColor: "#79c00080",
					borderColor: "#79c000",
				},
			],
		},
		options: {
			scales: {
				x: {
					display: false,
				},
				y: {
					beginAtZero: true,
					title: {
						display: true,
						text: yAxisLabel,
					},
				},
			},
			layout: {
				padding: {
					left: 5,
					right: 20,
				},
			},
			plugins: {
				legend: {
					display: false,
				},
			},
			maintainAspectRatio: false,
		},
	});
}

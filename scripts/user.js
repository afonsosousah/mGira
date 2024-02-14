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

	let userObj = user; // get from global variable

	// Get all the user information, if it isn't available yet
	if (!userObj.activeUserSubscriptions) userObj = await getUserInformation();

	// Get subscription expiration
	const subscriptionExpiration = new Date(userObj.activeUserSubscriptions[0].expirationDate);

	// Get user initials
	let allNames = userObj.name.split(" "); // separate all names
	let initials = allNames[0][0] + allNames.at(-1)[0]; // first letter of first name + first letter of last name

	// Populate the element
	settingsElement.innerHTML = `
        <div id="topUserContainer">
            <div id="backButton" onclick="hideUserSettings()"><i class="bi bi-arrow-90deg-left"></i></div>
            <img id="footer" src="assets/images/gira_footer_white.svg" alt="backImage">
			<div id="bottomCard"></div>
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
                <input id="proxyUrlInput" value="${proxyURL}" placeholder="Insere aqui o URL para o proxy"/>
                <div id="resetProxyButton"><i class="bi bi-arrow-counterclockwise"></i></div>
                <div id="setProxyButton"><i class="bi bi-check-lg"></i></div>
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

	// Set status bar color in PWA
	// Set notification bar color in Progressive Web App (installable website)
	changeThemeColor("#79c000");
}

function hideUserSettings() {
	let userSettings = document.getElementById("userSettings");
	if (userSettings) {
		userSettings.classList.add("smooth-slide-to-bottom");
		setTimeout(() => userSettings.remove(), 300); // remove element after animation end
	}
	changeThemeColor("#ffffff"); // Set status bar color in PWA
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
	let allNames = username.split(" "); // separate all names
	let initials = allNames[0][0] + allNames.at(-1)[0]; // first letter of first name + first letter of last name

	// User picture (main screen)
	let userInitialsElement = document.getElementById("userInitials");
	userInitialsElement.innerHTML = initials;
}

function openTripHistory() {
	// Create element
	let menu = document.createElement("div");
	menu.id = "tripHistory";
	menu.innerHTML = `
        <img src="assets/images/gira_footer.svg" alt="footer" id="graphics">
        <div id="backButton" onclick="hideTripHistory();"><i class="bi bi-arrow-90deg-left"></i></div>
		<div id="title">Histórico de Viagens</div>
        <ul id="tripList">
            <!-- Populate with the list here -->
        </ul>
		<div id="downloadTripHistoryButton" onclick="downloadObjectAsJson(user.tripHistory, 'tripHistory');">
			<i class="bi bi-cloud-download"></i>
		</div>
    `.trim();
	document.body.appendChild(menu);

	// Hide user settings behind trip history (without animations)
	let userSettingsElem = document.getElementById("userSettings");
	userSettingsElem.style.maxHeight = "100dvh";

	// populate the trip list
	for (let trip of user.tripHistory) {
		// create the list element
		const tripListElement = document.createElement("li");
		tripListElement.className = "trip-list-element";

		// Get formatted date
		let tripDate = new Date(trip.startDate);
		let monthNumberToShortForm = [
			"jan.",
			"fev.",
			"mar.",
			"abr.",
			"mai.",
			"jun.",
			"jul.",
			"ago.",
			"set.",
			"out.",
			"nov.",
			"dez.",
		];
		const formattedDate = `${tripDate.getDay()} ${
			monthNumberToShortForm[tripDate.getMonth()]
		} ${tripDate.getFullYear()}`;

		// Get formatted time
		let tripTime = new Date(new Date(trip.endDate) - new Date(trip.startDate));
		tripTime.setTime(tripTime.getTime() + tripTime.getTimezoneOffset() * 60 * 1000); // Correct because of Daylight Saving Time
		const hours = tripTime.getHours();
		const minutes = tripTime.getMinutes();
		const formattedTime = hours + "h" + minutes.toString().padStart(2, "0") + "m";

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
					<i class="bi bi-clock-history"></i>
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
				<div id="endStation">${trip.endLocation}</div>
			</div>
        `.trim();
		document.getElementById("tripList").appendChild(tripListElement);
	}

	// if there are no trips, put a message saying that
	if (document.getElementById("tripList").childElementCount === 0)
		document.getElementById("tripList").innerHTML = "Não realizou nenhuma viagem";

	// Set status bar color in PWA
	changeThemeColor("#ffffff");
}

function hideTripHistory() {
	// Remove element from DOM
	document.getElementById("tripHistory").remove();

	// Show user settings again
	let userSettingsElem = document.getElementById("userSettings");
	userSettingsElem.style.maxHeight = "";

	// Set status bar color in PWA
	changeThemeColor("#79c000");
}

// Statistics Menu
function openStatisticsMenu() {
	// Create element
	let menu = document.createElement("div");
	menu.id = "statisticsMenu";
	menu.innerHTML = `
        <img src="assets/images/gira_footer_white.svg" alt="footer" id="graphics">
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
						<option value="last7days">Últimos 7 dias</option>
						<option value="last30days" selected="selected">Últimos 30 dias</option>
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

	// Hide user settings behind statistics menu (without animations)
	if (document.getElementById("userSettings")) {
		let userSettingsElem = document.getElementById("userSettings");
		userSettingsElem.style.maxHeight = "100dvh";
	}

	// Populate chart
	updateStatisticsChart();

	// Set status bar color in PWA
	changeThemeColor("#231f20");
}

function hideStatisticsMenu() {
	// Remove element from DOM
	document.getElementById("statisticsMenu").remove();

	// Show user settings again
	let userSettingsElem = document.getElementById("userSettings");
	userSettingsElem.style.maxHeight = "";

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
		let timeFromActivated = Date.now() - new Date(user.dateActivate).getTime();

		// Convert the milliseconds to days
		var days = timeFromActivated / (24 * 1000 * 60 * 60);
		var absoluteDays = Math.floor(days);

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
		const dayTrips = user.tripHistory.filter(
			trip =>
				new Date(trip.startDate).getDate() === dayDate.getDate() && // Same day
				new Date(trip.startDate).getMonth() === dayDate.getMonth() && // Same month
				new Date(trip.startDate).getFullYear() === dayDate.getFullYear() // Same year
		);

		// Get the time (in ms) and distance (in km) ridden for each trip
		for (trip of dayTrips) {
			let tripTime = new Date(new Date(trip.endDate) - new Date(trip.startDate));
			trip.riddenTime = tripTime.getTime();
			// Calculate an estimate for trip distance (assuming an avg speed of 15km/h)
			const speed = 15 / (3600 * 1000); // convert km/h to km/ms
			trip.distance = Math.round(tripTime.getTime() * speed * 1000) / 1000; // milliseconds * km in 1 millisecond (and round to 3 decimal places)
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

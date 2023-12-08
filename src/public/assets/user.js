let tokenRefreshed = false;

// Define the global user, where the variables will be stored
let user = {};

// Login to the emel API and get the tokens
async function login(event){
    event.preventDefault();
    const loginForm = document.getElementById("loginForm");
    
    // Do the login request
    response = await make_post_request("https://api-auth.emel.pt/auth", JSON.stringify({
        Provider: "EmailPassword",
        CredentialsEmailPassword: {
            email: loginForm.email.value,
            password: loginForm.password.value
        }
    }))

    if(response.data){
        // Store the received tokens
        user.accessToken = response.data.accessToken
        user.refreshToken = response.data.refreshToken
        user.expiration = response.data.expiration

        // Get all user details
        get_user_information();

        // Store refreshToken cookie (stay logged in)
        document.cookie = "refreshToken=" + user.refreshToken;
        document.getElementById('loginMenu').remove()
        tokenRefreshed = true;
    } else {
        alert("Login failed!");
    } 
}

// Gets all the user information
async function get_user_information(){
    // get the general information
    response = await make_get_request("https://api-auth.emel.pt/user", user.accessToken)
    user = {...user, ...response.data};

    // Update user image based on user details
    if(document.getElementById('userPicture'))
        document.getElementById('userPicture').innerHTML = `<img src="https://ui-avatars.com/api/?name=${encodeURI(user.name)}&size=${document.documentElement.clientHeight * 0.14}&background=ffffff&color=79C000&rounded=true">`;

    // Make batch query for Gira client information, activeUserSubscriptions and tripHistory to speed up request
    response = await make_post_request("https://apigira.emel.pt/graphql", JSON.stringify({
        "query": `query {
            client: client { code, type, balance, paypalReference, bonus, numberNavegante }
            activeUserSubscriptions: activeUserSubscriptions { code, cost, expirationDate, name, nameEnglish, subscriptionCost, subscriptionPeriod, subscriptionStatus, type, active }
            tripHistory: tripHistory(pageInput: { _pageNum: 1, _pageSize: 1000 }) { bikeName bikeType bonus code cost endDate endLocation rating startDate startLocation usedPoints }
        }`
    }), user.accessToken)
    user = {...user, ...response.data.client[0]};
    user.activeUserSubscriptions = response.data.activeUserSubscriptions;
    user.tripHistory = response.data.tripHistory;

    /*// get Gira client information
    response = await make_post_request("https://apigira.emel.pt/graphql", JSON.stringify({
        "operationName": "client",
        "variables": {},
        "query": "query client($code: String) {client(code: $code) {code, type, balance, paypalReference, bonus, numberNavegante}}"
    }), user.accessToken)
    user = {...user, ...response.data.client[0]};

    // get activeUserSubscriptions
    response = await make_post_request("https://apigira.emel.pt/graphql", JSON.stringify({
        "operationName": "activeUserSubscriptions",
        "variables": {},
        "query": "query activeUserSubscriptions {activeUserSubscriptions {code, cost, expirationDate, name, nameEnglish, subscriptionCost, subscriptionPeriod, subscriptionStatus, type, active}}"
    }), user.accessToken)
    user.activeUserSubscriptions = response.data.activeUserSubscriptions;

    // get tripHistory
    response = await make_post_request("https://apigira.emel.pt/graphql", JSON.stringify(    {
        "operationName": "tripHistory",
        "variables": {"in": {"_pageNum": 1, "_pageSize": 1000}},
        "query": "query tripHistory($in: PageInput) { tripHistory(pageInput: $in) { bikeName bikeType bonus code cost endDate endLocation rating startDate startLocation usedPoints }}"
    }), user.accessToken)
    user.tripHistory = response.data.tripHistory;*/

    return user;
}

// Refreshes current user accessToken, using refreshToken
async function token_refresh(){
    tokenRefreshed = false;
    console.log("Token has not been refreshed...");
    response = await fetch("https://api-auth.emel.pt/token/refresh", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "token": user.refreshToken
        })
    });
    if(response.status == 200) {
        responseObject = await response.json();
        if(Object.hasOwn(responseObject, 'data')) {
            // Store the received tokens
            user.accessToken = responseObject.data.accessToken
            user.refreshToken = responseObject.data.refreshToken
            user.expiration = responseObject.data.expiration

            // Store refreshToken cookie (stay logged in)
            document.cookie = "refreshToken=" + user.refreshToken;

            // Hide login menu if it is showing
            if (document.querySelector('.login-menu'))
                document.querySelector('.login-menu').remove();

            // Set that the token has been refreshed successfully
            tokenRefreshed = true;
        }
    } else if (response.status == 400) {
        // unset the refreshToken cookie
        //document.cookie = "refreshToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
        // prompt for new login
        openLoginMenu();
    } else {
        alert("Token refresh failed!");
    }
}

// Open the login menu element and populate it
function openLoginMenu() {
    let menu = document.createElement("div");
    menu.className = "login-menu";
    menu.id = "loginMenu";
    menu.innerHTML = 
    `
        <img src="assets/images/mGira_big.png" alt="mGira logo" width="50%">
        <div id="loginCard">
            <form id="loginForm">
                <input type="email" name="email" id="email" placeholder="e-Mail">
                <input type="password" name="password" id="password" placeholder="Palavra-passe">
            </form>
            <div id="registerButton" onclick="alert('Registe-se na aplicação original da Gira para utilizar a mGira.')">Registar</div>
            <div id="loginButton" onclick="login(event)">Entrar</div>
            <img src="assets/images/gira_footer.svg" id="footer" alt="footer" width="100%">
        </div>
    `.trim();


    // Hide any menu already open
    if(document.querySelector('.user-settings'))
        document.querySelector('.user-settings').remove();

    if(document.querySelector('.bike-reserve'))
        document.querySelector('.bike-reserve').remove();

    if(document.querySelector('.station-menu'))
        document.querySelector('.station-menu').remove();

    if(document.querySelector('.bike-list'))
        document.querySelector('.bike-list').remove();
    
    
    // Add to the document
    if(document.querySelectorAll('.login-menu').length == 0)
        document.body.appendChild(menu);
}


// Open user settings element and populate it
async function openUserSettings() {

    // show the container from the start so that the request delay is less noticeable
    let settingsElement = document.createElement("div");
    settingsElement.className = "user-settings";
    settingsElement.id = "userSettings";
    if(document.querySelectorAll('.user-settings').length == 0)
        document.body.appendChild(settingsElement);

    // show loading animation
    settingsElement.innerHTML = `
    <div class="lds-ring"><div></div><div></div><div></div><div></div></div>
    <div id="backButton" onclick="document.getElementById('userSettings').remove()"><i class="bi bi-arrow-90deg-left"></i></div>
    `;
    
    // Get all the user information
    userObj = await get_user_information();

    // Format the subscription expiration date
    subscriptionExpiration = new Date(userObj.activeUserSubscriptions[0].expirationDate);
    expirationDateFormatted = subscriptionExpiration.getDate() +'/' + (subscriptionExpiration.getMonth()+1) +'/'+ subscriptionExpiration.getFullYear();

    // Calculate the total time of the tripHistory
    let totalTime = 0;
    for (trip of userObj.tripHistory) {
        let elapsedTime = new Date(new Date(trip.endDate) - new Date(trip.startDate));
        totalTime += elapsedTime.getTime();
    }
    totalTime = new Date(totalTime);
    totalTime.setTime(totalTime.getTime() + totalTime.getTimezoneOffset()*60*1000);  // Correct because of Daylight Saving Time
    var days = Math.round(Math.abs(totalTime.getTime() / (24 * 60 * 60 * 1000)));
    var hours = totalTime.getHours();
    var minutes = totalTime.getMinutes();
    var formattedTotalTime = days + 'd' + hours + 'h' + correctMinutesSeconds(minutes) + 'm';

    // Calculate an estimate for total distance (assuming an avg speed of 15km/h)
    let hoursFloat = days*60 + hours + minutes/60;
    let totalDistance = Math.floor(hoursFloat * 15) // hours * km in 1 hour

    // Calculate the average time of a trip
    let avgTime = new Date(totalTime.getTime() / userObj.tripHistory.length);
    var formattedAvgTime = correctMinutesSeconds(avgTime.getMinutes()) + 'm';

    // Calculate an estimate for C02 saved using total time (assuming an avg speed of 15km/h)
    let co2Saved = Math.floor(hoursFloat * 15 * 0.250) // hours * km in 1 hour * kg of co2 saved per km

    // Populate the element
    settingsElement.innerHTML = 
    `
        <div id="topUserContainer">
            <div id="backButton" onclick="document.getElementById('userSettings').remove()"><i class="bi bi-arrow-90deg-left"></i></div>
            <img src="assets/images/gira_footer.svg" alt="backImage">
        </div>
        <img id="userImage" src="https://ui-avatars.com/api/?name=${encodeURI(userObj.name)}&size=175&background=231F20&color=fff&rounded=true">
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
                <div id="subscriptionValidity">Válido até ${expirationDateFormatted}</div>
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
        <div id="versionNumber">v0.0.1</div>
        <div id="logoutButton" onclick="openLoginMenu()">Sair</div>
        <div id="bottomSpacing"></div>
    `.trim();
}
let stationsArray;
let lastStationObj;

// returns an array with all the bikes in a station
async function get_bikes(stationID){
    response = await make_post_request("https://apigira.emel.pt/graphql", JSON.stringify({
        "operationName": "getBikes",
        "variables": {"input": stationID},
        "query": "query getBikes($input: String) {getBikes(input: $input) { battery, code, name, kms, serialNumber, type, parent }}"
    }), user.accessToken)
    if(typeof response != "undefined")
        return response.data.getBikes
}

// returns an array with all the docks in a station
async function get_docks(stationID){
    response = await make_post_request("https://apigira.emel.pt/graphql", JSON.stringify({
        "operationName": "getDocks",
        "variables": {"input": stationID},
        "query": "query getDocks($input: String) {getDocks(input: $input) { ledStatus, lockStatus, serialNumber, code, name }}"
    }), user.accessToken)
    if(typeof response != "undefined")
        return response.data.getDocks
}

// using batch querying to get bikes and docks faster
// returns an object with both getBikes and getDocks properties
async function get_bikes_and_docks(stationID){
    response = await make_post_request("https://apigira.emel.pt/graphql", JSON.stringify({
        "query": `query { 
            getBikes(input: "${stationID}") { battery, code, name, kms, serialNumber, type, parent }
            getDocks(input: "${stationID}") { ledStatus, lockStatus, serialNumber, code, name }
        }`
    }), user.accessToken);
    if(typeof response != "undefined")
        return response.data;
}

// sets the global array stationArray
async function get_stations() {
    response = await make_post_request("https://apigira.emel.pt/graphql", JSON.stringify({
        "operationName": "getStations",
        "variables": {},
        "query": "query getStations {getStations { code, description, latitude, longitude, name, bikes, docks, serialNumber }}"
    }), user.accessToken);

    if(typeof response != "undefined") {

        // Load the stations to the map
        stationsArray = response.data.getStations;
        loadStationMarkersFromArray(stationsArray);

        // Hide login menu if it is showing
        if (document.querySelector('.login-menu'))
            document.querySelector('.login-menu').remove();

        // Start WebSocket connection
        startWSConnection();

        // Get all user details
        get_user_information();

        return response.data.getStations;
    }
    else {
        // Wait for token refresh
        checkToken(get_stations);
    }
}

// Open the station menu element and populate it
async function openStationMenu(stationSerialNumber) {

    if(stationSerialNumber == null){
        alert("A estação não está ativa!");
        return;
    }

    // get station object
    stationObj = stationsArray.filter(obj => {
        return obj.serialNumber === stationSerialNumber;
    })[0];
    lastStationObj = stationObj;

    // show the bottom panel from the start so that the request delay is less noticeable
    let menu = document.createElement("div");
    menu.className = "station-menu";
    menu.id = "stationMenu";
    document.body.appendChild(menu);

    // If there is navigation going, make the menu still appear
    if (navigationActive)
        menu.style.zIndex = 99;

    // show loading animation
    menu.innerHTML = `<div class="lds-ring"><div></div><div></div><div></div><div></div></div>`;

    // get list of available bikes and docks
    bikeAndDocks = await get_bikes_and_docks(stationSerialNumber);
    let bikeList = bikeAndDocks.getBikes;
    let dockList = bikeAndDocks.getDocks;
    stationObj.bikeList = bikeList;
    numBikes = stationObj.bikeList.length;
    stationObj.dockList = dockList;

    // set the inner HTML after the animation has started
    if(typeof bikeList != "undefined" && typeof dockList != "undefined") {
        menu.innerHTML = 
        `
            <div id="stationName">${stationObj.name}</div>
            <img id="stationImage" src="assets/images/mGira_station.png" alt="Gira station" width="25%">
            <div id="availableBikesNumber">${(numBikes === 1) ? '1 bicicleta disponível' : `${numBikes} bicicletas disponíveis` }</div>
            <div id="cancelButton" onclick="document.getElementById('stationMenu').remove()">Cancelar</div>
            <div id="seeBikesButton" onclick="openBikeList('${stationSerialNumber}')">Ver bicicletas</div>
        `.trim();
    } else {
        menu.innerHTML = 
        `
            <div id="availableBikesNumber">Ocorreu um erro.</div>
            <div id="cancelButton" onclick="document.getElementById('stationMenu').remove()">Voltar</div>
        `.trim();
    }
}

// Open the bike list element and populate it
async function openBikeList(stationSerialNumber) {
    // get station object
    stationObj = stationsArray.filter(obj => {
        return obj.serialNumber === stationSerialNumber;
    })[0];

    let menu = document.createElement("div");
    menu.className = "bike-list";
    menu.id = "bikeMenu";
    menu.innerHTML = 
    `
        <div id="backButton" onclick="document.getElementById('bikeMenu').remove()"><i class="bi bi-arrow-90deg-left"></i></div>
        <div id="stationName">${stationObj.name}</div>
        <img id="stationImage" src="assets/images/mGira_station.png" alt="Gira station" width="25%">
        <ul id="bikeList">
            <!-- Populate with the list here -->
        </ul>
    `.trim();
    document.body.appendChild(menu);

    // If there is navigation going, make the menu still appear
    if (navigationActive)
        menu.style.zIndex = 99;

    // get the bikes in the station
    for(let bike of stationObj.bikeList) {
        bikeListElement = document.createElement("li");
        bikeListElement.className = "bike-list-element";

        // get the name of the dock in which the bike is
        dockObj = stationObj.dockList.filter(obj => {
            return obj.code === bike.parent;
        })[0];

        bikeListElement.innerHTML = 
        `
            ${(bike.name[0] == "E") ? `${bike.name} - ${bike.battery}% - Doca ${dockObj.name}` : `${bike.name} - Doca ${dockObj.name}` }
            <div id="reserveBikeButton" onclick="openUnlockBikeCard('${stationSerialNumber}','${bike.serialNumber}')">Retirar</div>
        `.trim();
        document.getElementById("bikeList").appendChild(bikeListElement);
    }
    
    // if there are no bikes, put a message saying that
    if(document.getElementById("bikeList").childElementCount == 0)
        document.getElementById("bikeList").innerHTML = "Não há bicicletas na estação.";


    // allow user to try to take bike not appearing in app
    appendElementToElementFromHTML(
    `
        <div id="openTakeUnregisteredBikeButton" onclick="openTakeUnregisteredBikeMenu('${stationSerialNumber}')">Tentar retirar bicicleta que não aparece no sistema</div>
    `,
    document.getElementById("bikeList"));
}

async function getMissingBikesList() {

    // Make a batch query to speed up the request
    let queryString = "query {";
    let i = 0;

    for (station of stationsArray) {
        queryString += ` station_${i}: getBikes(input: "${station.serialNumber}") { battery, code, name, kms, serialNumber, type, parent } `;
        i += 1;
    }

    queryString += "}";

    //console.log(queryString);

    response = await make_post_request("https://apigira.emel.pt/graphql", JSON.stringify({
        "query": queryString
    }), user.accessToken)

    if(typeof response != "undefined"){
        // Flatten the resulting array
        allBikesList = Object.values(response.data).flat(Infinity);

        // get the bikes not in the bikeSerialNumberMapping
        missingBikes = allBikesList.filter(({ name: name1 }) => !bikeSerialNumberMapping.some(({ name: name2 }) => name2 === name1));

        // compact the missing bikes list
        missingBikes = missingBikes.map((bike) => { return {name: bike.name, serialNumber: bike.serialNumber} });

        console.log(missingBikes);
    } else {
        console.log("The request failed.");
    }
}
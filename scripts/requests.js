let proxyURL = null;

const DEFAULT_PROXY = "https://corsproxy.afonsosousah.workers.dev/";

// The VAIMOO API doesn't allow cross-origin requests, so they go through a proxy
async function makeProxyRequest(url, init) {
	return fetch(proxyURL ?? DEFAULT_PROXY, {
		...init,
		headers: {
			...init.headers,
			"X-Proxy-URL": url,
		},
	});
}

// TODO: these keys come from the legacy GIRA GraphQL API; VAIMOO's responseStatus.errorCode values
// still need to be mapped (gira-mais has the same TODO). Unknown errors show VAIMOO's own message.
const errorTranslations = {
	trip_interval_limit: "Tem de esperar 5 minutos entre viagens.",
	already_active_trip: "Já tem uma viagem a decorrer!",
	unable_to_start_trip: "Não foi possível iniciar a viagem.",
	trip_not_found: "Viagem não encontrada.",
	invalid_arguments: "Argumentos inválidos.",
	bike_already_in_trip: "Bicicleta já em viagem.",
	bike_already_reserved: "Bicicleta já reservada.",
	already_has_active_trip: "Já tem uma viagem a decorrer.",
	no_bike_found: "Bicicleta não encontrada.",
	bike_on_repair: "Bicicleta a ser reparada.",
	bike_in_repair: "Bicicleta a ser reparada.",
	not_enough_balance:
		'Saldo negativo. Se isto se deve a uma viagem mal terminada, por favor contacte <a href="mailto:gira@emel.pt">gira@emel.pt</a>',
	has_no_active_subscriptions: "Não tem um passe ativo.",
};

// Shows an API error to the user, translated when it is a known one
function showApiError(error, fallbackMessage = "Ocorreu um erro.") {
	if (error instanceof VaimooNetworkError) {
		alert("Não foi possível comunicar com a EMEL. Verifique a sua ligação ou o proxy.");
		return;
	}

	const messages = error instanceof VaimooApiError ? error.messages : [];
	if (error instanceof VaimooApiError) console.error("VAIMOO error", error.status, error.code, error.body);

	// Try to display the countdown if not set already
	if (messages.includes("trip_interval_limit")) countdownFromLatestTrip();

	const translated = messages.map(message => errorTranslations[message]).find(Boolean);
	if (translated) alert(translated);
	else if (messages.length && messages[0] !== error.message) alert(htmlEncode(messages.join("\n")));
	else alert(fallbackMessage);
}

function returnToDefaultState() {
	// Return to app starting state
	hideUserSettings();
	hidePlaceSearchMenu();
	let bikeListMenu = document.getElementById("bikeMenu");
	if (bikeListMenu) {
		hideBikeList();
		return; // prevent station card from being hidden if there was a bike list menu
	}
	let menu = document.getElementById("stationMenu");
	if (menu) {
		menu.classList.add("smooth-slide-to-left");
		setTimeout(() => menu.remove(), 500); // remove element after animation
		document.getElementById("zoomControls").classList.add("smooth-slide-down-zoom-controls"); // move zoom controls back down
	}
}

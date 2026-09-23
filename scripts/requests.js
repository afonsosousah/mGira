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

// Portuguese messages for the known API errors
const errorTranslations = {
	trip_interval_limit: "Tem de esperar 5 minutos entre viagens.",
	already_active_trip: "Já tem uma viagem a decorrer!",
	unable_to_start_trip: "Não foi possível iniciar a viagem.",
	trip_not_found: "Viagem não encontrada.",
	invalid_arguments: "Argumentos inválidos.",
	bike_already_in_trip: "Bicicleta já em viagem.",
	bike_already_reserved: "Bicicleta já reservada.",
	no_bike_found: "Bicicleta não encontrada.",
	bike_in_repair: "Bicicleta a ser reparada.",
	not_enough_balance:
		'Saldo negativo. Se isto se deve a uma viagem mal terminada, por favor contacte <a href="mailto:gira@emel.pt">gira@emel.pt</a>',
	has_no_active_subscriptions: "Não tem um passe ativo.",
	login_code_expired: "O início de sessão expirou. Por favor tente novamente.",
	session_expired: "A sessão expirou. Por favor inicie sessão novamente.",
};

// VAIMOO's numeric responseStatus.errorCode → key in errorTranslations.
// VAIMOO doesn't publish these, so they are added as they are observed (unmapped codes are logged, see showApiError).
const vaimooErrorCodes = {
	823: "login_code_expired", // "Code not found, already used, or expired." (OAuth code exchange)
	1100: "no_bike_found", // Vaimoo.Application.Exceptions.Bike.BikeNotFoundException (quick-start)
	1602: "trip_not_found", // Vaimoo.Application.Exceptions.Trip.TripNotFoundException (trip details)
};

// VAIMOO's error messages are in English, mostly .NET exception names turned into words by
// humanizeVaimooErrorMessage ("Bike Not Found"). For codes not mapped above, match that text.
// Order matters: the bike-specific patterns come before the user-specific ones.
const vaimooErrorPatterns = [
	[/(vehicle|bike|bicycle).{0,40}(already|currently).{0,20}(in|on) (a )?(trip|use|ride)/i, "bike_already_in_trip"],
	[/(vehicle|bike|bicycle).{0,40}(reserved|booked)|(reserved|booked).{0,40}(vehicle|bike|bicycle)/i, "bike_already_reserved"],
	[/repair|maintenance|out of service|damaged|broken/i, "bike_in_repair"],
	[/(vehicle|bike|bicycle|device).{0,40}(not found|unavailable|not available|does not exist)|(no|unknown) (vehicle|bike|bicycle)/i, "no_bike_found"],
	[/(already|currently).{0,40}(active|ongoing|running|in progress)?.{0,20}(trip|ride|rental)|(active|ongoing) (trip|ride|rental)/i, "already_active_trip"],
	[/subscription|membership|no (active )?(pass|plan)|pass (is )?(expired|inactive)/i, "has_no_active_subscriptions"],
	[/balance|credit|insufficient|funds|debt|wallet/i, "not_enough_balance"],
	[/wait|too soon|interval|cool ?down|between (trips|rides)/i, "trip_interval_limit"],
	[/trip.{0,20}not found/i, "trip_not_found"],
];

// Finds the errorTranslations key for an API error, or null if it is not a known one
function knownErrorKey(error) {
	if (!(error instanceof VaimooApiError)) return null;

	for (const code of error.codes) {
		if (vaimooErrorCodes[code]) return vaimooErrorCodes[code];
	}

	for (const message of error.messages) {
		// Legacy GraphQL error names, in case VAIMOO uses the same ones
		if (errorTranslations[message]) return message;
		const readable = humanizeVaimooErrorMessage(message);
		const match = vaimooErrorPatterns.find(([pattern]) => pattern.test(readable));
		if (match) return match[1];
	}

	if (error.status === 401) return "session_expired";
	return null;
}

// Shows an API error to the user, translated when it is a known one
function showApiError(error, fallbackMessage = "Ocorreu um erro.") {
	if (error instanceof VaimooNetworkError) {
		alert("Não foi possível comunicar com a EMEL. Verifique a sua ligação ou o proxy.");
		return;
	}

	const key = knownErrorKey(error);
	if (error instanceof VaimooApiError) {
		// Log the full response, so unmapped codes can be added to vaimooErrorCodes
		const log = key ? console.info : console.warn;
		log(`VAIMOO error (${key ?? "unmapped"})`, error.status, error.codes, error.messages, error.body);
	} else {
		console.error(error);
	}

	// Try to display the countdown if not set already
	if (key === "trip_interval_limit") countdownFromLatestTrip();

	if (key) {
		alert(errorTranslations[key]);
		return;
	}

	// Unknown error: show the Portuguese message, with VAIMOO's own message for context
	const details =
		error instanceof VaimooApiError
			? error.messages.filter(message => message !== error.message).map(humanizeVaimooErrorMessage)
			: [];
	alert(details.length ? `${fallbackMessage}<br><br><small>${htmlEncode(details.join("\n"))}</small>` : fallbackMessage);
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

// Keeps the stations and the active trip in sync with VAIMOO.
// Replaces the old GraphQL websocket subscriptions. Ported from gira-mais (src/lib/gira-api/backend-sync.ts and src/lib/trip.ts).
//
// - Stations come from a live Firestore listener.
// - The active trip is polled from VAIMOO's /user/trip endpoint, and the bike's Firestore document is
//   followed during a trip to notice sooner when it has been docked or when the unlock failed.

const PENDING_TRIP_INTERVAL_MS = 3_000;
const ACTIVE_TRIP_INTERVAL_MS = 15_000;
const START_CONFIRM_TIMEOUT_MS = 30_000;
const FIRESTORE_START_TRIP_TIMEOUT = 100;
const RECENT_RATING_WINDOW_MS = 60 * 60 * 1000;

// Trip known locally: { code, bikeName, startDate (ms), confirmed, startedLocallyAt (ms) }
let localTrip = null;
let backendSyncStarted = false;
let stopStationListener = null;
let stopBikeListener = null;
let watchedBikeName = null;
let tripPollTimer = null;
let tripStatusRequest = null;
// Set when the bike document says the trip is over; keeps polling fast until /user/trip agrees
let tripEndSignalled = false;

async function startBackendSync() {
	if (!stopStationListener) {
		const firestore = await waitForFirestore();
		if (!stopStationListener) {
			stopStationListener = firestore.subscribeStations(onStationsUpdate, error =>
				console.error("Station listener failed", error)
			);
		}
	}

	// Only on the first start: this also runs on every token refresh
	if (!backendSyncStarted && user.accessToken) {
		backendSyncStarted = true;
		const activeTrip = await refreshTripStatus("sync-start");
		if (!activeTrip) recoverRecentTripRating().catch(error => console.error("Could not recover the trip rating", error));
	}
}

function stopBackendSync() {
	stopStationListener?.();
	stopStationListener = null;
	followActiveBike(null);
	clearTripPollTimer();
	localTrip = null;
	tripEndSignalled = false;
	backendSyncStarted = false;
}

function onStationsUpdate(vaimooStations) {
	stationsArray = mapStations(vaimooStations);

	// Don't replace the markers while the user is searching for a place
	if (!document.getElementById("placeSearchMenu")) loadStationMarkersFromArray(stationsArray, !tripEnded);
}

/* Trip polling */

function clearTripPollTimer() {
	if (tripPollTimer) clearTimeout(tripPollTimer);
	tripPollTimer = null;
}

function scheduleTripCheck() {
	clearTripPollTimer();
	if (!localTrip) return;
	const delayMs = localTrip.confirmed && !tripEndSignalled ? ACTIVE_TRIP_INTERVAL_MS : PENDING_TRIP_INTERVAL_MS;
	tripPollTimer = setTimeout(() => refreshTripStatus("scheduled-poll"), delayMs);
}

/**
 * Reconcile the local state with VAIMOO's active trip endpoint.
 * Failures are logged and resolve to null: the next poll retries anyway.
 */
function refreshTripStatus(source = "unspecified") {
	if (!user.accessToken || onFakeTrip) return Promise.resolve(null);
	if (tripStatusRequest) return tripStatusRequest;

	tripStatusRequest = (async () => {
		try {
			const serverTrip = await getCurrentTrip();
			const active = serverTrip?.activeTripId != null && serverTrip.activeTripId > 0;

			if (active) {
				onServerTripActive(serverTrip);
				return serverTrip;
			}

			if (localTrip?.confirmed) {
				onTripFinished(localTrip);
			} else if (localTrip && Date.now() - localTrip.startedLocallyAt >= START_CONFIRM_TIMEOUT_MS) {
				// VAIMOO never confirmed the trip started
				abortPendingTrip();
				alert("Não foi possível iniciar a viagem.");
			}
			return null;
		} catch (error) {
			console.error(`Trip status refresh failed (${source})`, error);
			return null;
		} finally {
			tripStatusRequest = null;
			scheduleTripCheck();
		}
	})();

	return tripStatusRequest;
}

function onServerTripActive(serverTrip) {
	const code = String(serverTrip.activeTripId);
	const bikeName = serverTrip.visualId ?? localTrip?.bikeName ?? "?";
	const startDate = parseVaimooDate(serverTrip.tripStartDate)?.getTime() ?? localTrip?.startDate ?? Date.now();
	const timerNeedsRestart = !localTrip || !localTrip.confirmed || localTrip.code !== code;

	// The bike document said the trip was over but VAIMOO disagrees; go back to the relaxed cadence
	tripEndSignalled = false;

	localTrip = {
		code,
		bikeName,
		startDate,
		confirmed: true,
		startedLocallyAt: localTrip?.startedLocallyAt ?? Date.now(),
	};
	tripEnded = false;
	followActiveBike(bikeName);

	// Show the trip overlay if it is not shown already and the user is not on navigation
	if (!document.getElementById("tripOverlay") && !navigationActive) {
		showTripOverlay(bikeName);

		// Change map dots to available docks
		loadStationMarkersFromArray(stationsArray, true);

		// If user is in landscape when the trip starts, put into navigation UI
		if (window.matchMedia("(orientation: landscape)").matches) goIntoLandscapeNavigationUI();
	}

	// Use the server's start date for the timer
	if (timerNeedsRestart) tripTimer(startDate, true);
}

/** Called after the unlock request succeeded, until VAIMOO confirms the trip */
function startLocalTrip(bikeName, unlockTime) {
	localTrip = { code: null, bikeName, startDate: unlockTime, confirmed: false, startedLocallyAt: unlockTime };
	tripEnded = false;
	followActiveBike(bikeName);

	showTripOverlay(bikeName);
	loadStationMarkersFromArray(stationsArray, true);
	tripTimer(unlockTime, true);

	refreshTripStatus("quick-start");
}

/** Drop a trip that VAIMOO never confirmed, e.g. after the bike reported a start timeout */
function abortPendingTrip() {
	if (!localTrip || localTrip.confirmed) return false;
	localTrip = null;
	endTripUI();
	return true;
}

function endTripUI() {
	tripEnded = true;
	followActiveBike(null);
	clearTripPollTimer();
	document.getElementById("tripOverlay")?.remove();
	exitLandscapeNavigationUI();
	loadStationMarkersFromArray(stationsArray, false);
}

async function onTripFinished(trip) {
	localTrip = null;
	tripEndSignalled = false;
	endTripUI();

	if (!trip.code || finishedTripsList.includes(trip.code)) return;
	finishedTripsList.push(trip.code);

	// The trip history may take a moment to include the trip that just ended
	for (let attempt = 0; attempt < 3; attempt++) {
		const [latest] = (await getTripHistory(1, 1).catch(() => [])) ?? [];
		if (latest?.code === trip.code) {
			promptTripRating(latest);
			return;
		}
		await delay(3000);
	}
	console.warn(`Trip ${trip.code} was not found in the trip history`);
}

function promptTripRating(trip) {
	if (ratedTripsList.includes(trip.code) || tripBeingRated) return;
	openRateTripMenu(trip);
}

/** Show the rating prompt if the app was closed while the last trip ended */
async function recoverRecentTripRating() {
	if (localTrip || document.getElementById("rateTripMenu")) return;
	const [latest] = (await getTripHistory(1, 1)) ?? [];
	if (!latest?.code || !latest.endDate) return;
	const ageMs = Date.now() - Date.parse(latest.endDate);
	if (ageMs < 0 || ageMs > RECENT_RATING_WINDOW_MS) return;
	if (getCookie("lastRatedTrip") === latest.code) return;
	promptTripRating(latest);
}

/* Firestore bike listener */

function followActiveBike(bikeName) {
	if (watchedBikeName === bikeName) return;
	stopBikeListener?.();
	stopBikeListener = null;
	watchedBikeName = bikeName;
	if (!bikeName) return;

	let previousState;
	let previousErrorCode;

	waitForFirestore().then(firestore => {
		// The trip may have changed while waiting
		if (watchedBikeName !== bikeName || stopBikeListener) return;

		stopBikeListener = firestore.subscribeBike(
			bikeName,
			bike => {
				const nextState = bike?.TripVehicleState ?? null;
				const nextErrorCode = bike?.TripErrorCode ?? null;
				// Same rule as the official app: LOCKED with no trip id means the trip is over
				const tripOver = bike != null && nextState === "LOCKED" && bike.TripId == null;

				if (tripOver && localTrip?.confirmed && !tripEndSignalled) {
					console.debug("Firestore reports the bike locked with no trip, confirming with VAIMOO");
					tripEndSignalled = true;
					refreshTripStatus("firestore-locked-no-trip");
				} else if (previousState !== undefined && previousState !== nextState) {
					refreshTripStatus(`firestore-state:${previousState}->${nextState}`);
				}

				// The official app surfaces these codes straight from the bike document (100 = start timeout, 2xx/4xx = end failures)
				if (previousErrorCode !== undefined && previousErrorCode !== nextErrorCode && nextErrorCode) {
					console.warn("VAIMOO bike reported trip error code", nextErrorCode);
					if (nextErrorCode === FIRESTORE_START_TRIP_TIMEOUT) {
						if (abortPendingTrip()) alert("Não foi possível iniciar a viagem.");
					} else if (localTrip?.confirmed) {
						alert("Ocorreu um erro ao terminar a viagem. Verifique se a bicicleta ficou bem presa na doca.");
					}
					refreshTripStatus(`firestore-error:${nextErrorCode}`);
				}

				previousState = nextState;
				previousErrorCode = nextErrorCode;
			},
			error => console.error("Active bike listener failed", error)
		);
	});
}

// Check the trip when coming back to the app (a trip may have started or ended in the meantime)
document.addEventListener("visibilitychange", () => {
	if (document.visibilityState === "visible" && backendSyncStarted) refreshTripStatus("app-resume");
});

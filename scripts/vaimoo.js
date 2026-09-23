// Client for the VAIMOO backend that EMEL moved GIRA to.
// Ported from gira-mais (src/lib/vaimoo-api/client.ts and src/lib/gira-api/api.ts).

const VAIMOO_BASE_URL = "https://emel-consumerapp.vaimoo.com/";
const VAIMOO_APP_ID = "8d75593b-83a1-4cce-862f-1671b59c5b0f";
const VAIMOO_APP_VERSION = "A1.0.0";
const EMEL_LOGIN_URL = "https://login.emel.pt/";
const EMEL_REDIRECT_URI = "vaimoo://auth/callback";
// VAIMOO tenant that scopes GIRA data in the shared Firestore project and API
const GIRA_TENANT = "P1/EML/EML/";

const VAIMOO_MAX_ATTEMPTS = 3;
const VAIMOO_RETRY_DELAY_MS = 1000;

class VaimooApiError extends Error {
	constructor(message, status, body) {
		super(message);
		this.name = "VaimooApiError";
		this.status = status;
		this.body = body;
		// VAIMOO's numeric responseStatus.errorCode, which is what the official app switches on
		this.code = typeof body?.responseStatus?.errorCode === "number" ? body.responseStatus.errorCode : null;
		this.messages = vaimooErrorMessages(body, message);
	}
}

// The EMEL account rejected the email/password
class InvalidCredentialsError extends VaimooApiError {
	constructor(message, body) {
		super(message, 401, body);
		this.name = "InvalidCredentialsError";
	}
}

// The request never got an HTTP response (offline, DNS, timeout); the server may or may not have processed it
class VaimooNetworkError extends Error {
	constructor(message, cause) {
		super(message);
		this.name = "VaimooNetworkError";
		this.cause = cause;
	}
}

function messagesFromErrorList(errors) {
	if (!Array.isArray(errors)) return [];
	return errors.flatMap(error => {
		if (typeof error === "string") return [error];
		if (typeof error?.message === "string") return [error.message];
		return [];
	});
}

// VAIMOO wraps failures as { responseStatus: { errorCode, message, errors: [{ errorCode, message }] } }
function vaimooErrorMessages(body, fallback) {
	if (typeof body === "string" && body) return [body];
	if (!body || typeof body !== "object") return [fallback];
	const nested = messagesFromErrorList(body.responseStatus?.errors);
	if (nested.length) return nested;
	if (typeof body.responseStatus?.message === "string" && body.responseStatus.message) return [body.responseStatus.message];
	const flat = messagesFromErrorList(body.errors);
	if (flat.length) return flat;
	if (typeof body.message === "string") return [body.message];
	if (typeof body.error === "string") return [body.error];
	return [fallback];
}

/**
 * Perform a request, retrying network-level failures with linear backoff.
 * HTTP error responses are never retried: the server has answered.
 * `retry: false` is for non-idempotent calls (the unlock), where a timed-out request may already have taken effect.
 */
async function vaimooHttp(url, init, { retry = true, proxied = true } = {}) {
	const maxAttempts = retry ? VAIMOO_MAX_ATTEMPTS : 1;
	for (let attempt = 1; ; attempt++) {
		let response;
		try {
			response = proxied ? await makeProxyRequest(url, init) : await fetch(url, init);
		} catch (error) {
			console.error(`Request to ${new URL(url).pathname} failed (attempt ${attempt}/${maxAttempts})`, error);
			if (attempt < maxAttempts) {
				await delay(VAIMOO_RETRY_DELAY_MS * attempt);
				continue;
			}
			throw new VaimooNetworkError(`Request failed: ${error?.message ?? error}`, error);
		}

		const text = await response.text();
		let body = text;
		try {
			body = text ? JSON.parse(text) : null;
		} catch {
			// not JSON, keep the text
		}

		if (!response.ok) throw new VaimooApiError(`Request failed with HTTP ${response.status}`, response.status, body);
		return body;
	}
}

/**
 * Make a request to the VAIMOO API with the current session.
 * If the access token is rejected, the token is refreshed and the request retried once.
 */
async function vaimooRequest(path, options = {}, isRetry = false) {
	const url = new URL(path.replace(/^\/+/, ""), VAIMOO_BASE_URL);
	url.searchParams.set("userId", String(user.userId ?? null));
	url.searchParams.set("mainAppVersion", VAIMOO_APP_VERSION);
	url.searchParams.set("t", String(Date.now()));
	for (const [key, value] of Object.entries(options.params ?? {})) url.searchParams.set(key, String(value));

	const hasBody = options.data !== undefined;
	const headers = {
		Accept: "application/json",
		"Accept-Language": "pt",
		AppId: VAIMOO_APP_ID,
		// VAIMOO expects the raw token, without "Bearer". The proxy moves this to the Authorization header.
		"X-Authorization": options.token ?? user.accessToken ?? "",
		...(hasBody ? { "Content-Type": "application/json" } : {}),
		...options.headers,
	};

	try {
		return await vaimooHttp(
			url.toString(),
			{
				method: options.method ?? (hasBody ? "POST" : "GET"),
				headers,
				...(hasBody ? { body: JSON.stringify(options.data) } : {}),
			},
			{ retry: options.retry }
		);
	} catch (error) {
		// Access token rejected, refresh it and retry once
		if (!isRetry && !options.noRefresh && error instanceof VaimooApiError && error.status === 401) {
			console.debug("VAIMOO rejected the access token, refreshing and retrying");
			const newToken = await tokenRefresh().catch(() => undefined);
			if (newToken) return vaimooRequest(path, { ...options, token: undefined }, true);
		}
		throw error;
	}
}

/* Authentication */

function jwtExpiration(token) {
	try {
		const { exp } = getJWTPayload(token);
		return typeof exp === "number" ? exp * 1000 : null;
	} catch {
		return null;
	}
}

// VAIMOO access tokens are short-lived (5 minutes at the time of writing) and the login
// response does not include expireSeconds, so read the expiry from the JWT itself.
function toVaimooSession(response) {
	// The login response uses `userId`, the refresh-token response uses `id`
	const userId = response.user?.userId ?? response.user?.id;
	if (userId == null) throw new VaimooApiError("VAIMOO session has no user id", 500, null);

	const seconds = Number(response.accessToken.expireSeconds);
	const expiration =
		jwtExpiration(response.accessToken.token) ??
		Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 5 * 60 * 1000);

	return {
		accessToken: response.accessToken.token,
		refreshToken: response.accessToken.refreshToken,
		userId,
		expiration,
		user: response.user,
	};
}

async function loginWithEmel(email, password) {
	// 1. Authenticate with the EMEL account (this endpoint allows CORS, no proxy needed)
	let auth;
	try {
		auth = await vaimooHttp(
			new URL("emel-api/auth", EMEL_LOGIN_URL).toString(),
			{
				method: "POST",
				headers: { Accept: "application/json", "Content-Type": "application/json" },
				body: JSON.stringify({ provider: "EmailPassword", credentialsEmailPassword: { email, password } }),
			},
			{ proxied: false }
		);
	} catch (error) {
		if (error instanceof VaimooApiError && error.status === 401) throw new InvalidCredentialsError(error.message, error.body);
		throw error;
	}
	if (auth?.error?.code !== 0) throw new InvalidCredentialsError(auth?.error?.message ?? "EMEL login failed", auth?.error);

	// 2. Get the EMEL user id (also allows CORS)
	const emelUser = await vaimooHttp(
		new URL("emel-api/user", EMEL_LOGIN_URL).toString(),
		{
			method: "GET",
			headers: { Accept: "application/json", Authorization: `Bearer ${auth.data.accessToken}` },
		},
		{ proxied: false }
	);
	if (emelUser?.error?.code !== 0) {
		throw new VaimooApiError(emelUser?.error?.message ?? "EMEL user lookup failed", 502, emelUser?.error);
	}

	// 3. Exchange the EMEL tokens for a one-time code (no CORS, goes through the proxy)
	const secureCode = await vaimooHttp(new URL("api/auth/code", EMEL_LOGIN_URL).toString(), {
		method: "POST",
		// Empty X-Authorization: older proxies send "Authorization: null" when it's missing
		headers: { Accept: "application/json", "Content-Type": "application/json", "X-Authorization": "" },
		body: JSON.stringify({
			payload: { ...auth.data, userId: emelUser.data.id },
			redirectUri: EMEL_REDIRECT_URI,
		}),
	});

	// 4. Exchange the code for a VAIMOO session
	const response = await vaimooRequest("auth/v2/oauth/", {
		method: "POST",
		data: { code: secureCode.code },
		token: "",
		noRefresh: true,
	});
	return toVaimooSession(response);
}

async function refreshVaimooSession(refreshToken) {
	const response = await vaimooRequest("auth/refresh-token", {
		method: "POST",
		token: "",
		headers: { RefreshToken: refreshToken, "no-refresh": "true" },
		noRefresh: true,
	});
	return toVaimooSession(response);
}

/* Endpoints */

// Newest first, like the official app; without an explicit sort the server order is undefined
const vaimooTripsQuery = (pageIndex = 1, pageSize = 20) =>
	JSON.stringify({ pageIndex, pageSize, sort: [{ field: "startDate", dir: "desc" }], filter: { filters: [] } });

const getVaimooUser = () => vaimooRequest("user", { params: { IncludeUserAppSettings: true } });

const getCurrentTrip = () => vaimooRequest("user/trip");

const getTrips = (pageIndex, pageSize) => vaimooRequest("trip/trips", { params: { query: vaimooTripsQuery(pageIndex, pageSize) } });

const getTripDetails = tripId => vaimooRequest(`trip/trip-details/${tripId}`);

const submitTripFeedback = feedback => vaimooRequest("user-feedback", { method: "POST", data: feedback });

const getRemainingCredit = () => vaimooRequest("wallet/remaining-credit");

const getSubscriptionUsage = () => vaimooRequest("subscription/v2/usage");

// Not retried: if the request times out after the server unlocked the bike, a repeat would be rejected
// as "already in a trip"; startBikeTrip checks the active trip instead.
const quickStartTrip = communicationId =>
	vaimooRequest(`trip/v2/quick-start/${encodeURIComponent(communicationId)}`, { method: "POST", retry: false });

/* Dates */

/**
 * VAIMOO trip timestamps are UTC but carry no zone designator ("2026-09-15T21:20:22.308").
 * `new Date` would read them as local time, an hour off in Lisbon summer time, so append the designator when missing.
 */
function parseVaimooDate(value) {
	if (!value) return null;
	const hasOffset = /(Z|[+-]\d{2}:?\d{2})$/i.test(value);
	return new Date(hasOffset ? value : value + "Z");
}

// Local time without a zone designator, as sent by the official app in the feedback payload
function vaimooLocalTimestamp(date) {
	const pad = (value, length = 2) => String(value).padStart(length, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
		date.getMinutes()
	)}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
}

/* Mappers from VAIMOO data to the shapes used around the app */

// The station feed's AvailableBikes counter includes bikes flagged as out of service, so it can exceed the
// number of bikes a user can actually unlock. Once a station's bikes have been loaded, prefer the observed
// count for as long as the server counter stays at the value it had when we observed it.
const observedBikeCounts = new Map();
let lastVaimooStations = [];

function serverBikeCount(station) {
	return Math.max(0, Math.trunc(station.AvailableBikes ?? 0));
}

function stationBikeCount(station) {
	const serverBikes = serverBikeCount(station);
	const observed = observedBikeCounts.get(String(station.DockingStationId));
	return observed && observed.serverBikes === serverBikes ? observed.bikes : serverBikes;
}

// Returns true if the displayed bike count of the station changed
function recordObservedBikeCount(stationId, bikes) {
	const station = lastVaimooStations.find(candidate => String(candidate.DockingStationId) === stationId);
	if (!station) return false;
	const shownBefore = stationBikeCount(station);
	observedBikeCounts.set(stationId, { serverBikes: serverBikeCount(station), bikes });
	const shownNow = stationBikeCount(station);

	// Keep the stations array in sync
	const stationObj = stationsArray?.find(s => s.serialNumber === stationId);
	if (stationObj) stationObj.bikes = shownNow;

	return shownNow !== shownBefore;
}

function mapStations(vaimooStations) {
	lastVaimooStations = vaimooStations;
	return vaimooStations.map(station => ({
		serialNumber: String(station.DockingStationId),
		code: String(station.DockingStationId),
		name: station.Name ?? "",
		description: [station.StreetBuildingIdentifier, station.Street, station.City].filter(Boolean).join(" "),
		latitude: station.Location.latitude,
		longitude: station.Location.longitude,
		bikes: stationBikeCount(station),
		docks: Math.max(0, Math.trunc(station.DockLimit ?? 0)),
		freeDocks: Math.max(0, Math.trunc(station.FreeDocks ?? 0)),
		assetStatus: station.IsActive && station.ServiceStatus === "AVAILABLE" ? "active" : "repair",
	}));
}

function mapBike(bike) {
	return {
		name: bike.VisualId,
		serialNumber: bike.CommunicationId,
		battery: bike.BatteryPercentage,
		type: bike.Category === "E-Bike" ? "electric" : "classic",
		dockName: bike.DockingPointVisualId ?? "?",
		kms: bike.RemainingDistance,
		stationId: String(bike.DockingStationId),
	};
}

function dockOrder(dock) {
	const number = parseInt(dock, 10);
	return Number.isNaN(number) ? Number.POSITIVE_INFINITY : number;
}

// Firestore returns bikes in arbitrary order; list only the unlockable ones, by dock number like the station does
function mapAvailableBikes(bikes) {
	return bikes
		.filter(bike => bike.IsAvaliable && !bike.IsBooked && Boolean(bike.CommunicationId))
		.map(mapBike)
		.sort((a, b) => dockOrder(a.dockName) - dockOrder(b.dockName) || a.name.localeCompare(b.name));
}

function mapTrip(trip) {
	return {
		code: String(trip.tripId ?? ""),
		bikeName: trip.vehicle?.visualId ?? "?",
		bikeType: trip.vehicle?.vehicleCategoryCode ?? null,
		startDate: parseVaimooDate(trip.startDate)?.toISOString() ?? null,
		endDate: parseVaimooDate(trip.endDate)?.toISOString() ?? null,
		cost: trip.tripCost ?? 0,
		startLocation: trip.startStation?.name ?? null,
		endLocation: trip.endStation?.name ?? null,
		distanceMeters: trip.coveredDistanceInMeters ?? 0,
	};
}

/* Firestore access (the module in firestore.js registers window.vaimooFirestore) */

async function waitForFirestore() {
	while (!window.vaimooFirestore) {
		await delay(50);
	}
	return window.vaimooFirestore;
}

async function getStationBikes(stationSerialNumber) {
	const firestore = await waitForFirestore();
	return mapAvailableBikes(await firestore.getStationBikes(Number(stationSerialNumber)));
}

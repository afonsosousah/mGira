// to give back to the calls that were made when another one was already being processed
// (promise caching)
let tokenPromise = null;
let tokenRefreshTimeout = null;

// Stores the tokens of a VAIMOO session in the user object and in cookies
function storeSession(session) {
	user.accessToken = session.accessToken;
	user.refreshToken = session.refreshToken;
	user.userId = session.userId;
	user.expiration = session.expiration;

	// Set the cookie expiry to 1 year after today.
	const oneYearFromNow = new Date();
	oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

	// Store refreshToken and userId cookies (stay logged in)
	createCookie("refreshToken", user.refreshToken, oneYearFromNow);
	createCookie("userId", user.userId, oneYearFromNow);

	// Store accessToken cookie until it expires (for quick refreshes)
	createCookie("accessToken", user.accessToken, new Date(user.expiration));

	scheduleTokenRefresh();
}

// VAIMOO access tokens only last a few minutes, refresh them before they expire
function scheduleTokenRefresh() {
	if (tokenRefreshTimeout) clearTimeout(tokenRefreshTimeout);
	tokenRefreshTimeout = null;
	if (!user.expiration) return;
	const delayMs = Math.max(1000, user.expiration - Date.now() - 30_000);
	tokenRefreshTimeout = setTimeout(() => tokenRefresh().catch(() => null), delayMs);
}

function cancelTokenRefresh() {
	if (tokenRefreshTimeout) clearTimeout(tokenRefreshTimeout);
	tokenRefreshTimeout = null;
}

// Refreshes current user accessToken, using refreshToken
async function tokenRefresh() {
	tokenRefreshed = false;

	if (!user.refreshToken || user.userId == null) {
		openLoginMenu();
		return;
	}

	// Make sure to only refresh the token one at a time.
	// The refresh token changes on every use, so a second parallel refresh would fail.
	if (tokenPromise) return tokenPromise;

	// If there are no other calls being processed, create a new promise
	tokenPromise = new Promise(async (resolve, reject) => {
		// Try to refresh token with retries...
		const numberOfTries = 3;

		for (let currentTry = 0; currentTry < numberOfTries; currentTry++) {
			try {
				const session = await refreshVaimooSession(user.refreshToken);
				storeSession(session);

				// Hide login menu if it is showing
				if (document.querySelector(".login-menu")) document.querySelector(".login-menu").remove();

				// Make sure the stations and trip are being synced
				startBackendSync();

				// Set that the token has been refreshed successfully
				tokenRefreshed = true;

				resolve(user.accessToken); // return the promised result
				return;
			} catch (error) {
				console.error("Token refresh failed", error);
				// A rejected refresh token will not become valid by retrying
				if (error instanceof VaimooApiError && (error.status === 400 || error.status === 401)) break;
				await delay(2000);
			}
		}

		// Could not refresh the token, prompt for new login
		openLoginMenu();
		reject();
	}).finally(() => {
		tokenPromise = null;
	});

	return tokenPromise;
}

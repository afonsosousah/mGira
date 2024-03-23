// to give back to the calls that were made when another one was already being processed
// (promise caching)
let tokenPromise = null;

// Refreshes current user accessToken, using refreshToken
async function tokenRefresh() {
	tokenRefreshed = false;

	if (!user.refreshToken) {
		openLoginMenu();
		return;
	}

	// Make sure to only refresh the token one at a time
	if (tokenPromise) return tokenPromise;

	// If there are no other calls being processed, create a new promise
	tokenPromise = new Promise(async (resolve, reject) => {
		// Try to refresh token with retries...
		const numberOfTries = 3;
		let currentTry = 0;

		while (currentTry < numberOfTries) {
			const response = await fetch("https://api-auth.emel.pt/token/refresh", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					token: user.refreshToken,
				}),
			});

			if (response.status === 200) {
				const responseObject = await response.json();

				if (Object.hasOwn(responseObject, "data")) {
					// Store the received tokens
					user.accessToken = responseObject.data.accessToken;
					user.refreshToken = responseObject.data.refreshToken;
					user.expiration = responseObject.data.expiration;

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

					// Hide login menu if it is showing
					if (document.querySelector(".login-menu")) document.querySelector(".login-menu").remove();

					// Make sure the ws connection is open
					startWSConnection();

					// Set that the token has been refreshed successfully
					tokenRefreshed = true;

					resolve(user.accessToken); // return the promised result
					return;
				}
			} else {
				currentTry += 1;
			}
		}

		// Retried for x times to refresh the token, prompt for new login
		openLoginMenu();
		reject();
		return;
	}).finally(() => {
		tokenPromise = null;
	});

	return tokenPromise;
}

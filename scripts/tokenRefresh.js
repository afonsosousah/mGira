let numberOfTokenRefreshTries = 5;
let currentTry = 0;

// Refreshes current user accessToken, using refreshToken
async function tokenRefresh() {
	tokenRefreshed = false;
	currentTry += 1;
	console.log("Token has not been refreshed...");
	const response = await fetch(proxyURL, {
		method: "POST",
		headers: {
			"X-Proxy-URL": "https://api-auth.emel.pt/token/refresh",
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

			// Set the cookie expiry to 1 month after today.
			const expiryDate = new Date();
			expiryDate.setMonth(expiryDate.getMonth() + 1);

			// Store refreshToken cookie (stay logged in)
			document.cookie = "refreshToken=" + user.refreshToken + "; expires=" + expiryDate.toGMTString();

			// Hide login menu if it is showing
			if (document.querySelector(".login-menu")) document.querySelector(".login-menu").remove();

			// Set that the token has been refreshed successfully
			tokenRefreshed = true;
			currentTry = 0; // reset the number of tries

			return user.accessToken;
		}
	} else if (response.status === 400) {
		// try for x times to refresh the token, otherwise prompt for new login
		if (currentTry < numberOfTokenRefreshTries) {
			// Wait before making next request (reduce error rate)
			await delay(200);
			return tokenRefresh();
		} else openLoginMenu();
	} else {
		alert("Token refresh failed!");
	}
}

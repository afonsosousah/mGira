/**
 * Cloudflare worker that proxies mGira's requests to the EMEL/VAIMOO APIs, which don't allow cross-origin requests.
 *
 * - The target URL is passed in the X-Proxy-URL header (full URL, including the query string).
 * - The access token is passed in the X-Authorization header and sent on as Authorization, unchanged
 *   (VAIMOO expects the raw token, without "Bearer").
 * - Every other header (e.g. VAIMOO's AppId, RefreshToken, no-refresh and Accept-Language) is forwarded as is.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// Only these hosts can be reached through the proxy, so it can't be used as an open proxy
const ALLOWED_HOSTS = ["emel-consumerapp.vaimoo.com", "login.emel.pt"];

const ALLOWED_METHODS = "GET,HEAD,POST,OPTIONS";

const DEMO_PAGE = `
	<!DOCTYPE html>
	<html>
	<body>
		<h1>CORS Proxy for mGira</h1>
	</body>
	</html>
`;

function rawHtmlResponse(html) {
	return new Response(html, {
		headers: {
			"content-type": "text/html;charset=UTF-8",
		},
	});
}

function errorResponse(status, statusText, origin) {
	return new Response(statusText, {
		status,
		statusText,
		headers: {
			// Let the browser read the error instead of reporting a CORS failure
			"Access-Control-Allow-Origin": origin ?? "*",
			Vary: "Origin",
		},
	});
}

async function handleRequest(request) {
	const origin = request.headers.get("Origin");
	const apiUrl = request.headers.get("X-Proxy-URL");
	if (origin === null || apiUrl === null) return errorResponse(400, "Bad Request, Missing Headers", origin);

	let target;
	try {
		target = new URL(apiUrl);
	} catch {
		return errorResponse(400, "Bad Request, Invalid X-Proxy-URL", origin);
	}
	if (target.protocol !== "https:" || !ALLOWED_HOSTS.includes(target.hostname)) {
		return errorResponse(403, "Forbidden, Host Not Allowed", origin);
	}

	const authorization = request.headers.get("X-Authorization");

	// Rewrite the request to point to the API URL. This also makes the request mutable.
	request = new Request(target.toString(), request);
	request.headers.delete("X-Proxy-URL");
	request.headers.delete("X-Authorization");
	request.headers.delete("Cookie");
	// Make the API server think that this request is not cross-site
	request.headers.set("Origin", target.origin);
	if (authorization && authorization !== "null" && authorization !== "Bearer null") {
		request.headers.set("Authorization", authorization);
	}

	let response;
	try {
		response = await fetch(request);
	} catch (error) {
		console.error("Upstream request failed", error);
		return errorResponse(502, "Bad Gateway", origin);
	}

	// Recreate the response so the headers can be modified
	response = new Response(response.body, response);
	response.headers.set("Access-Control-Allow-Origin", origin);
	response.headers.append("Vary", "Origin");

	return response;
}

function handleOptions(request) {
	if (
		request.headers.get("Origin") !== null &&
		request.headers.get("Access-Control-Request-Method") !== null &&
		request.headers.get("Access-Control-Request-Headers") !== null
	) {
		// Handle CORS preflight requests
		return new Response(null, {
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": ALLOWED_METHODS,
				"Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers"),
				"Access-Control-Max-Age": "86400",
			},
		});
	}

	// Handle standard OPTIONS request
	return new Response(null, {
		headers: {
			Allow: ALLOWED_METHODS.replaceAll(",", ", "),
		},
	});
}

export default {
	async fetch(request) {
		if (request.method === "OPTIONS") return handleOptions(request);

		if (["GET", "HEAD", "POST"].includes(request.method)) {
			// Opening the worker URL in a browser shows the demo page
			if (request.method === "GET" && request.headers.get("X-Proxy-URL") === null) return rawHtmlResponse(DEMO_PAGE);
			return handleRequest(request);
		}

		return new Response(null, {
			status: 405,
			statusText: "Method Not Allowed",
		});
	},
};

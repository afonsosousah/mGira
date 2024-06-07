/**
 Cloudflare worker to proxy requests to an API server.
 the proxy URL is passed in the x-proxy-url header.
 the authorization token is passed in the x-authorization header.

 * Learn more at https://developers.cloudflare.com/workers/
 */

export default {
	async fetch(request) {
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
			"Access-Control-Max-Age": "86400",
		};
		async function handleRequest(request) {
			const url = new URL(request.url);
			let apiUrl = request.headers.get("x-proxy-url");
			let auth = request.headers.get("x-authorization");
			const origin = new URL(apiUrl).origin;

			// Rewrite request to point to API URL. This also makes the request mutable
			// so you can add the correct Origin header to make the API server think
			// that this request is not cross-site.
			request = new Request(apiUrl, request);
			request.headers.set("Authorization", auth);
			request.headers.set("Origin", origin);
			let response = await fetch(request);

			// Recreate the response so you can modify the headers
			response = new Response(response.body, response);

			// Set CORS headers
			response.headers.set("Access-Control-Allow-Origin", "*");

			// Append to/Add Vary header so browser will cache response correctly
			response.headers.append("Vary", "Origin");

			return response;
		}

		async function handleOptions(request) {
			if (
				request.headers.get("Origin") !== null &&
				request.headers.get("Access-Control-Request-Method") !== null &&
				request.headers.get("Access-Control-Request-Headers") !== null
			) {
				// Handle CORS preflight requests.
				return new Response(null, {
					headers: {
						...corsHeaders,
						"Access-Control-Allow-Headers": request.headers.get("Access-Control-Request-Headers"),
					},
				});
			} else {
				// Handle standard OPTIONS request.
				return new Response(null, {
					headers: {
						Allow: "GET, HEAD, POST, OPTIONS",
					},
				});
			}
		}

		const url = new URL(request.url);

		if (request.method === "OPTIONS") {
			// Handle CORS preflight requests
			return handleOptions(request);
		} else if (request.method === "GET" || request.method === "HEAD" || request.method === "POST") {
			// Handle requests to the API server
			return handleRequest(request);
		} else {
			return new Response(null, {
				status: 405,
				statusText: "Method Not Allowed",
			});
		}
	},
};

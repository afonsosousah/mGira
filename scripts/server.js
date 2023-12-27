// returns Date and Time in ISO 8601(?) format
async function get_server_time() {
	const response = await makePostRequest(
		"http://apigira.emel.pt/graphql",
		JSON.stringify({
			operationName: "getServerTime",
			variables: {},
			query: "query getServerTime {\n  getServerTime\n}",
		}),
		accessToken
	);
	return response.data.getServerTime;
}

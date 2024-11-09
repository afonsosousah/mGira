// returns Date and Time in ISO 8601(?) format
async function getServerTime() {
	const response = await makePostRequest(
		"GIRA_GRAPHQL_ENDPOINT",
		JSON.stringify({
			operationName: "getServerTime",
			variables: {},
			query: "query getServerTime {\n  getServerTime\n}",
		}),
		accessToken
	);
	return response.data.getServerTime;
}

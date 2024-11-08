// returns Date and Time in ISO 8601(?) format
async function getServerTime() {
	const response = await makePostRequest(
		"https://egira-proxy-arqetk5clq-ew.a.run.app/api/graphql",
		JSON.stringify({
			operationName: "getServerTime",
			variables: {},
			query: "query getServerTime {\n  getServerTime\n}",
		}),
		accessToken
	);
	return response.data.getServerTime;
}

// returns Date and Time in ISO 8601(?) format
async function get_server_time() {
	response = await make_post_request(
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

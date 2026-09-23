// Live station and bike data from the Firestore database of VAIMOO's official app.
// Ported from gira-mais (src/lib/vaimoo-api/firestore.ts).
// Loaded as a module; exposes its functions on window.vaimooFirestore for the classic scripts.
import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
	collection,
	getDocs,
	getFirestore,
	onSnapshot,
	query,
	where,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// Public client credentials of the official VAIMOO app; GIRA shares this project with other VAIMOO tenants
const FIRESTORE_PROJECT = "vaimoorotterdam";
const FIRESTORE_API_KEY = "AIzaSyAmKfHdjYUhzYmg7qSZtRwwYE92HQQlmJ4";
const FIREBASE_APP_NAME = "vaimoo-firestore";
const TENANT = "P1/EML/EML/";

const RESUBSCRIBE_BASE_DELAY_MS = 5_000;
const RESUBSCRIBE_MAX_DELAY_MS = 60_000;

function firestoreDatabase() {
	const app = getApps().some(candidate => candidate.name === FIREBASE_APP_NAME)
		? getApp(FIREBASE_APP_NAME)
		: initializeApp({ apiKey: FIRESTORE_API_KEY, projectId: FIRESTORE_PROJECT }, FIREBASE_APP_NAME);
	return getFirestore(app);
}

function tenantQuery(collectionId, ...constraints) {
	return query(collection(firestoreDatabase(), collectionId), where("Tenant", "==", TENANT), ...constraints);
}

async function queryOnce(collectionId, ...constraints) {
	const snapshot = await getDocs(tenantQuery(collectionId, ...constraints));
	return snapshot.docs.map(document => document.data());
}

// Firestore stops delivering snapshots after the error callback fires, so a single failure would
// otherwise freeze the station map for the rest of the session. Resubscribe with backoff.
function subscribeToQuery(collectionId, constraints, onData, onError) {
	let stopped = false;
	let failures = 0;
	let unsubscribe = () => {};
	let retry = null;

	const subscribe = () => {
		unsubscribe = onSnapshot(
			tenantQuery(collectionId, ...constraints),
			snapshot => {
				failures = 0;
				onData(snapshot.docs.map(document => document.data()));
			},
			error => {
				onError?.(error);
				if (stopped) return;
				const delay = Math.min(RESUBSCRIBE_MAX_DELAY_MS, RESUBSCRIBE_BASE_DELAY_MS * 2 ** failures++);
				console.warn(`Firestore listener on ${collectionId} failed, resubscribing in ${delay}ms`, error);
				retry = setTimeout(subscribe, delay);
			}
		);
	};
	subscribe();

	return () => {
		stopped = true;
		if (retry) clearTimeout(retry);
		unsubscribe();
	};
}

window.vaimooFirestore = {
	getStations: () => queryOnce("docking-stations"),

	getStationBikes: stationId => queryOnce("bikes", where("DockingStationId", "==", stationId)),

	findBike: visualId => queryOnce("bikes", where("VisualId", "==", visualId)),

	/** Subscribe to the tenant-scoped station feed used by the official app */
	subscribeStations: (onData, onError) => subscribeToQuery("docking-stations", [], onData, onError),

	/** Keep bike details live only for the station currently being viewed */
	subscribeStationBikes: (stationId, onData, onError) =>
		subscribeToQuery("bikes", [where("DockingStationId", "==", stationId)], onData, onError),

	/** Follow the physical bike during a trip, regardless of station assignment */
	subscribeBike: (visualId, onData, onError) =>
		subscribeToQuery("bikes", [where("VisualId", "==", visualId)], bikes => onData(bikes[0] ?? null), onError),
};

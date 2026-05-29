import { getMongo } from "$lib/server/mongo";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
	const mongo = await getMongo();
	const client = mongo.getClient(params.server);
	const db = client.db(params.database);
	const collections = (await db.listCollections().toArray()).sort((a, b) => a.name.localeCompare(b.name));

	const collectionsWithDetails = await Promise.all(
		collections.map(async (c) => {
			if (c.type === "view") {
				return { name: c.name, type: c.type, count: 0, size: 0 };
			}
			const coll = db.collection(c.name);
			try {
				const stats = (await coll
					.aggregate([{ $collStats: { storageStats: {}, count: {} } }])
					.next()) as { storageStats: { size: number; count: number; storageSize: number; totalIndexSize: number } } | null;
				if (stats) {
					return {
						name: c.name,
						type: c.type,
						count: stats.storageStats.count,
						size: stats.storageStats.size + (stats.storageStats.totalIndexSize ?? 0),
					};
				}
			} catch {}
			const count = await coll.estimatedDocumentCount().catch(() => 0);
			return { name: c.name, type: c.type, count, size: 0 };
		}),
	);

	return {
		collections: collectionsWithDetails,
	};
};

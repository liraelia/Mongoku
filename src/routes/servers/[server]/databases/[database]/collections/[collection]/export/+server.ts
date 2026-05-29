import { getMongo } from "$lib/server/mongo";
import JsonEncoder from "$lib/server/JsonEncoder";
import { logger } from "$lib/server/logger";
import type { RequestHandler } from "./$types";
import { createGzip } from "zlib";
import { Readable, pipeline } from "stream";

const CHUNK_BYTES = 256 * 1024;

export const GET: RequestHandler = async ({ params }) => {
	const mongo = await getMongo();
	const client = mongo.getClient(params.server);
	const db = client.db(params.database);
	const collection = db.collection(params.collection);

	const filename = `${params.database}.${params.collection}.jsonl.gz`;
	const cursor = collection.find({}, { batchSize: 1000 });

	async function* lines() {
		let buffer = "";
		try {
			for await (const doc of cursor) {
				buffer += JSON.stringify(JsonEncoder.encode(doc)) + "\n";
				if (buffer.length >= CHUNK_BYTES) {
					yield buffer;
					buffer = "";
				}
			}
			if (buffer) {
				yield buffer;
			}
		} finally {
			await cursor.close().catch(() => {});
		}
	}

	const gzip = createGzip();

	pipeline(Readable.from(lines()), gzip, (err) => {
		if (err) {
			logger.error(`Export failed for ${params.database}.${params.collection}:`, err);
		}
	});

	return new Response(Readable.toWeb(gzip) as ReadableStream, {
		headers: {
			"Content-Type": "application/gzip",
			"Content-Disposition": `attachment; filename="${filename}"`,
		},
	});
};

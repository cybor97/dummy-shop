import { Collection, Document } from "mongodb";
import { hashString } from "./utils/fnv1a-hash";
import { cleanup, registerShutdown } from "./utils/lifecycle";
import { log } from "./utils/log";
import { getDbUrl } from "./utils/env";
import { connectToMongoDBOrExit } from "./utils/db";

const MAX_CHUNK_SIZE = 1000;
const INTERVAL = 1000;
const FULL_REINDEX_FLAG = "--full-reindex";

const buffer = new Map<string, Document>();
async function flushBuffer(targetCollection: Collection) {
  if (buffer.size === 0) {
    return;
  }

  const chunk = Array.from(buffer.values());
  buffer.clear();

  const result = await targetCollection.bulkWrite(
    chunk.map((item) => {
      const [account, domain] = item.email.split("@");
      const anonymisedItem = {
        ...item,
        firstName: hashString(item.firstName),
        lastName: hashString(item.lastName),
        email: `${hashString(account)}@${domain}`,
        address: {
          ...item.address,
          line1: hashString(item.address.line1),
          line2: hashString(item.address.line2),
          postcode: hashString(item.address.postcode),
        },
      };
      // Using upsert to safely deal with race conditions on multi-process level
      return {
        updateOne: {
          filter: { _id: item._id },
          update: { $set: anonymisedItem },
          upsert: true,
        },
      };
    }),
  );
  log(`Upserted ${result.upsertedCount} documents`);
}

async function fullReindex(
  sourceCollection: Collection,
  targetCollection: Collection,
) {
  const cursor = sourceCollection.find().batchSize(1000);

  while (await cursor.hasNext()) {
    for (let i = 0; i < MAX_CHUNK_SIZE; i++) {
      const doc = await cursor.next();
      if (doc === null) {
        break;
      }
      buffer.set(doc._id.toString(), doc);
    }
    const dates = [...buffer.values()].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    log(
      `Flushing buffer of ${buffer.size} documents (earliest: ${dates[0]?.createdAt.toISOString()}, latest: ${dates[dates.length - 1]?.createdAt.toISOString()})`,
    );
    await flushBuffer(targetCollection);
  }
}

export function listenForChanges(
  sourceCollection: Collection,
  targetCollection: Collection,
) {
  sourceCollection.watch().on("change", (e) => {
    if (e.operationType === "insert") {
      buffer.set(e.documentKey._id.toString(), e.fullDocument);
      if (buffer.size > MAX_CHUNK_SIZE) {
        log(`Buffer size is ${buffer.size}, flushing`);
        flushBuffer(targetCollection);
      }
    }
  });

  const interval = setInterval(async () => {
    flushBuffer(targetCollection);
  }, INTERVAL);

  return interval;
}

async function main() {
  const dbUri = getDbUrl();
  const client = await connectToMongoDBOrExit(dbUri);

  const db = client.db();
  const sourceCollection = db.collection("customers");
  const targetCollection = db.collection("customers_anonymised");

  if (process.argv.includes(FULL_REINDEX_FLAG)) {
    await fullReindex(sourceCollection, targetCollection);
    await cleanup(client);
    process.exit(0);
  } else {
    const interval = listenForChanges(sourceCollection, targetCollection);
    registerShutdown(client, interval);
  }
}

main();

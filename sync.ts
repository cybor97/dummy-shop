import { Collection, Document } from "mongodb";
import { hashString } from "./utils/fnv1a-hash";
import { cleanup, registerShutdown } from "./utils/lifecycle";
import { error, log, warn } from "./utils/log";
import { getDbUrl } from "./utils/env";
import { connectToMongoDBOrExit } from "./utils/db";
import { setupChangeStream, ChangeStreamHandler } from "./utils/change-stream";

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

export async function listenForChanges(
  sourceCollection: Collection,
  targetCollection: Collection,
): Promise<{ stop: () => void }> {
  let flushInterval: NodeJS.Timeout | null = null;
  let changeStreamHandler: ChangeStreamHandler | null = null;

  const processChange = (change: any) => {
    // according to the specification, delete operations are not supported
    if (["insert", "update", "replace"].includes(change.operationType)) {
      let id: string | null = null;
      let delta: Document | null = null;
      switch (change.operationType) {
        case "insert":
          id = change.documentKey._id.toString();
          delta = change.fullDocument;
          break;
        case "update":
          id = change.documentKey._id.toString();
          delta = change.updateDescription.updatedFields;
          break;
        case "replace":
          id = change.documentKey._id.toString();
          delta = change.fullDocument;
          break;
      }
      if (!id) {
        error(`Unsupported event for operation type: ${change.operationType}`);
        return;
      }

      buffer.set(id, delta);
      if (buffer.size > MAX_CHUNK_SIZE) {
        log(`Buffer size is ${buffer.size}, flushing`);
        void flushBuffer(targetCollection);
      }
    }
  };

  // Set up the change stream using the utility
  changeStreamHandler = await setupChangeStream(
    sourceCollection,
    processChange,
    { fullDocument: "updateLookup" },
  );

  // Set up periodic buffer flush
  let busy = false;
  flushInterval = setInterval(async () => {
    if (busy) {
      warn(`Previous operation is still running, skipping`);
      return;
    }
    busy = true;
    try {
      await flushBuffer(targetCollection);
    } catch (err) {
      error(
        `Failed to flush buffer: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    busy = false;
  }, INTERVAL);

  // Return a cleanup function
  return {
    stop: () => {
      if (changeStreamHandler) {
        changeStreamHandler.stop();
      }
      if (flushInterval) {
        clearInterval(flushInterval);
        flushInterval = null;
      }
    },
  };
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
    const changeStreamHandler = await listenForChanges(
      sourceCollection,
      targetCollection,
    );
    registerShutdown(client, changeStreamHandler.stop);
    // dry run
    await fullReindex(sourceCollection, targetCollection);
  }
}

main();

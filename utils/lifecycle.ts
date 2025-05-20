import { MongoClient } from "mongodb";
import { error } from "./log";

type CleanupResource = NodeJS.Timeout | (() => void);

/**
 * Closes the MongoDB connection and exits the process
 * @param client MongoDB client
 * @param resource Optional resource to clean up (interval to clear or function to call)
 */
export async function cleanup(
  client: MongoClient,
  resource: CleanupResource | null = null,
) {
  if (resource !== null) {
    if (typeof resource === "function") {
      resource();
    } else {
      clearInterval(resource);
    }
  }
  try {
    console.log("Closing MongoDB connection");
    await client.close();
  } catch (err) {
    error(
      `Failed to close MongoDB connection: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  process.exit(0);
}

export function registerShutdown(
  client: MongoClient,
  resource: CleanupResource | null = null,
) {
  process.on("SIGINT", async () => {
    await cleanup(client, resource);
  });
  process.on("SIGTERM", async () => {
    await cleanup(client, resource);
  });
}

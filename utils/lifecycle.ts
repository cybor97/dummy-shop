import { MongoClient } from "mongodb";
import { error } from "./log";

/**
 * Closes the MongoDB connection and exits the process
 * @param client MongoDB client
 * @param interval Optional interval to clear. Dummy, in case of more complex scheduling mechanism - cancel scheduled tasks
 */
export async function cleanup(
  client: MongoClient,
  interval: NodeJS.Timeout | null = null,
) {
  if (interval !== null) {
    clearInterval(interval);
  }
  try {
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
  interval: NodeJS.Timeout | null = null,
) {
  process.on("SIGINT", async () => {
    console.log("Closing MongoDB connection");
    await cleanup(client, interval);
  });
  process.on("SIGTERM", async () => {
    console.log("Closing MongoDB connection");
    await cleanup(client, interval);
  });
}

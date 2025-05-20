import { MongoClient } from "mongodb";

export async function cleanup(
  client: MongoClient,
  interval: NodeJS.Timeout | null = null,
) {
  if (interval !== null) {
    clearInterval(interval);
  }
  await client.close();
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

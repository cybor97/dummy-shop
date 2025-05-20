import { MongoClient } from "mongodb";
import { error, log } from "./log";

/**
 * Connects to MongoDB and handles connection errors
 * @param dbUri MongoDB connection URI
 * @returns Connected MongoDB client
 */
export async function connectToMongoDBOrExit(dbUri: string): Promise<MongoClient> {
  try {
    const client = await MongoClient.connect(dbUri);
    log(`Connected to MongoDB`);
    return client;
  } catch (err) {
    // By the nature of the app, we can't continue if we can't connect to MongoDB
    error(
      `Failed to connect to MongoDB: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }
}

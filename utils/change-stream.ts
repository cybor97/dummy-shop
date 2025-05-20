import { ChangeStream, Collection, Document } from "mongodb";
import { error, log, warn } from "./log";

export type ChangeProcessor = (change: any) => void;

export type ChangeStreamHandler = {
  stop: () => void;
};

/**
 * Sets up a MongoDB change stream with error handling and automatic reconnection
 * 
 * @param collection The MongoDB collection to watch
 * @param processChange Function to process each change event
 * @param options Additional options for the change stream
 * @returns A handler with methods to control the change stream
 */
export async function setupChangeStream(
  collection: Collection,
  processChange: ChangeProcessor,
  options: {
    fullDocument?: "default" | "updateLookup";
  } = {}
): Promise<ChangeStreamHandler> {
  let changeStream: ChangeStream | null = null;
  let isRunning = true;

  // Set up the change stream with resume capability
  const initializeChangeStream = async () => {
    try {
      // Create the change stream with provided options
      changeStream = collection.watch([], { 
        fullDocument: options.fullDocument || "default" 
      });
      
      // Process changes in a loop with error handling
      while (isRunning) {
        try {
          if (!changeStream) break;
          
          // Wait for the next change
          const change = await changeStream.next();
          if (change) {
            processChange(change);
          }
        } catch (err) {
          // If this is a resumable error, the next iteration will reconnect
          // If not, we break the loop and the outer catch will handle it
          if (changeStream?.closed) {
            error(`Change stream closed: ${err instanceof Error ? err.message : String(err)}`);
            break;
          } else {
            warn(`Error processing change: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      }
    } catch (err) {
      error(`Failed to set up change stream: ${err instanceof Error ? err.message : String(err)}`);
      // Attempt to reconnect after a delay
      setTimeout(() => {
        if (isRunning) {
          log('Attempting to reconnect change stream...');
          void initializeChangeStream();
        }
      }, 5000);
    }
  };

  // Start processing the change stream
  await initializeChangeStream();

  // Return a cleanup function
  return {
    stop: () => {
      isRunning = false;
      if (changeStream) {
        changeStream.close().catch(err => {
          error(`Error closing change stream: ${err instanceof Error ? err.message : String(err)}`);
        });
        changeStream = null;
      }
    }
  };
} 
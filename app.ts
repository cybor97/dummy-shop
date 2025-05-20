import { ObjectId } from "mongodb";
import { faker } from "@faker-js/faker";

import { registerShutdown } from "./utils/lifecycle";
import { log, warn } from "./utils/log";
import { getDbUrl } from "./utils/env";
import { connectToMongoDBOrExit } from "./utils/db";

const INTERVAL = 200;

async function main() {
  const dbUri = getDbUrl();
  const client = await connectToMongoDBOrExit(dbUri);

  const db = client.db();
  const collection = db.collection("customers");

  let busy = false;
  const interval = setInterval(async () => {
    if (busy) {
      warn(`Previous operation is still running, skipping`);
      return;
    }
    busy = true;

    const chunk = new Array(Math.floor(Math.random() * 10 + 1))
      .fill(null)
      .map(() => ({
        _id: new ObjectId(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email({ provider: "hotmail.com" }),
        address: {
          line1: faker.location.streetAddress(),
          line2: faker.location.secondaryAddress(),
          postcode: faker.location.zipCode(),
          city: faker.location.city(),
          state: faker.location.state({ abbreviated: true }),
          country: faker.location.countryCode(),
        },
        createdAt: new Date(),
      }));

    await collection.insertMany(chunk);
    log(`Inserted ${chunk.length} documents`);

    busy = false;
  }, INTERVAL);

  registerShutdown(client, interval);
}

main();

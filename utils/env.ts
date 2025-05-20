import * as dotenv from "dotenv";
dotenv.config();

export const getDbUrl = () => {
  const dbUrl = process.env.DB_URI;
  if (!dbUrl) {
    throw new Error("DB_URI is not set");
  }
  return dbUrl;
};

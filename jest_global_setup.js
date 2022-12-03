import dotenv from "dotenv";
dotenv.config({ path: ".env-test" });
import { MongoClient } from "mongodb";
import mongoServer from "./mongodb_memory_server.js";

export default async function(globalConfig, projectConfig){
    console.log();
    globalThis.__MONGOSERVER__ = mongoServer;
    console.log("Mongo Server created successfully.");

    process.env.MONGO_DB_URL = globalThis.__MONGOSERVER__.getUri();
    console.log("MONGO_DB_URL env variable set to server uri.");

    globalThis.__MONGOCONNECT__ = await MongoClient.connect(process.env.MONGO_DB_URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    console.log("Connection to mongo server established.");

    globalThis.__MONGODB__ = await globalThis.__MONGOCONNECT__.db(process.env.MONGO_DB_NAME);
    await globalThis.__MONGODB__.command({ ping: 1 }); // forces wait until db is accessible
    console.log("Connection to DB "+process.env.MONGO_DB_NAME+" successful.");
    
    return true;
}
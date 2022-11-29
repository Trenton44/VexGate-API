const buildServer = () => {
    let app = require("fastify")();
    app.register(require("./bungie-api/fastify_plugin.js"));
    return app;
};
beforeAll(async () => {
    console.log("Creating MongoDB Collection.");
    global.MongoCollection = await globalThis.__MONGODB__.collection(process.env.MONGO_DB_COLLECTION); // Promise to collection, for easy access in test suites
    console.log("Initializing application server.");
    global.App = buildServer();
});

afterAll(() => {
    console.log("Closing application server.");
    global.App.close();
})
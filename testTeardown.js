module.exports = async function(globalConfig, projectConfig){
    await globalThis.__MONGOCONNECT__.close();
    console.log("Successfully closed connection to test server.");
    globalThis.__MONGOSERVER__.stop();
    console.log("Successfully closed mongo server.");
    return true;
}
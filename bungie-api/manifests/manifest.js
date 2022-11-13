const fs = require("fs");
const { execSync } = require("child_process");
const https = require("https");

const manifest = require("./manifest.json");

const filepath = __dirname+"/manifest";
const bungiepath = "https://www.bungie.net";

execSync("mkdir -p "+filepath);

function asyncDownloadManifest(url, language){
    console.log("Downloading Manifest "+language);
    let fileloc = filepath+"/"+language+".json";
    https.get(url, (response) => {
        let file = fs.createWriteStream(fileloc);
        response.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log("Successfully Downloaded "+language+": "+fileloc);
        });
    });
}

for (i in manifest.Response.jsonWorldContentPaths){
    let urlpath = bungiepath + manifest.Response.jsonWorldContentPaths[i];
    asyncDownloadManifest(urlpath, i);
}
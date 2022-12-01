const axios = require("axios");
const BungieResponse = require("./api_response.js");

// change to search for parameter string in uri
// if found, THEN replace string and delete parameter
// leave non-uri parameters untouched.
function InjectURIParameters(uri, parameters){
    for(let parameter in parameters){
        const searchString = "{"+parameter+"}";
        if(uri.search(searchString) == -1)
            continue;
        uri = uri.replace(searchString, parameters[parameter])
        delete parameters[parameter];
    }
    return uri;
}

const HTMLInterceptor = (response) => {
    return response.headers["content-type"] !== "application/json" ? Promise.reject("Bungie Service is currently unavailable") 
        : response.data.ErrorCode != 1 ? Promise.reject(response.data.ErrorStatus)
        : response;
};

const SetupRequest = (request) => {
    request.url = InjectURIParameters(request.url, request.params);
    console.log(request);
    Promise.reject("No.");
}

const axiosBase = {
    baseURL: "https://www.bungie.net/Platform",
    headers: {
        "X-API-Key": process.env.BUNGIE_API_KEY,
        "User-Agent": "VexGate API/"+process.env.VERSION+" AppId/"+process.env.BUNGIE_CLIENT_ID
    }
};




module.exports = async (schemauri, parameters, language, token=null, config=null) => {
    let options = !token ? {} : { headers:{ "Authorization": "Bearer "+ token } };
    let data = await axiosBungie.get(uri, options).catch((error) => Promise.reject(error));
    return !config ? data : BungieResponse(data, schemauri, config, language);
};

module.exports = () => {
    let axiosBungie = axios.create(axiosBase);
    axiosBungie.interceptors.request.use(SetupRequest);
    axiosBungie.interceptors.response.use(HTMLInterceptor);
    return axiosBungie;
}
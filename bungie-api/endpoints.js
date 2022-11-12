const { validateSession, BungieLogin, BungieLoginResponse, sessionStatus } = require("./session");
const { InjectURIParameters, ProcessResponse } = require("./api.js");

let general = (fastify, options, next) => {
    fastify.get("/", sessionStatus);
    fastify.get("/*", async (request, reply) => reply.code(404).send({ error: "Endpoint not found." }));
    fastify.get("/login", BungieLogin);
    fastify.get("/bnetResponse", BungieLoginResponse);
    next();
};


let user = (fastify, options, next) => {
    fastify.addHook('preHandler', async (request, reply) => {
        await validateSession(request.session).catch( (error) => reply.code(400).send({ error: "User has not authorized this app." }));
        request.BClient.headers.Authorization = "Bearer "+request.session.accessToken;
        return true;
    });
    fastify.get("/GetProfile", { schema: {} }, async (request, reply) => {
        const openapiuri = "/Destiny2/{membershipType}/Profile/{destinyMembershipId}/";
        let profile = request.session.activeProfile;
        let uri = InjectURLParameters(openapiuri, {
            membershipType: profile.membershipType,
            destinyMembershipId: profile.destinyMembershipId,
        });
        return request.BClient(uri, {
            params: { components: request.query.components }
        })
        .then( (response) => ProcessResponse(response, openapiuri))
        .catch( (error) => reply.code(400).send({ error: "error" }));
    });
    next();
};



module.exports = (fastify, options, next) => {
    fastify.register(general);
    fastify.register(user);
    next();
};
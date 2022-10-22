const api_doc = require("./openapi.json");
const apidoc_xtypeheaders = ["x-mapped-definition", "x-mobile-manifest-name", "x-enum-values", "x-destiny-component-type-dependency", "x-dictionary-key", "x-preview", "x-enum-reference"];
const Definitions = require("./manifest/en/world_content.json"); 
//  Traverses through a given object, one key at a time (using an array of keys), to find a key-value. 
//      If the key-value doesn't exist, return false
//      If the key-value is undefined, return false
function traverseObject(keylist, searchObj){
    try{ keylist.forEach( (key) => {  searchObj = searchObj[key]; });  }
    catch { return false; }
    if(!searchObj) { return false; } // if the object is found, but is undefined, also return false.
    return searchObj;
}

//parses the $ref link into an array of keys that can be used to get to the actual schema inside the api doc object.
//Note: currently all $refs in the api doc obj are local, and have a leading #. if this changes, will need to add logic to accomodate
function parseSchemaRef(ref_link, delimiter){
    if(!delimiter) { delimiter = "/"; }  //local schema ref's use /, so defaulting to it.
    let link_array = ref_link.split(delimiter);
    if(link_array[0] === "#") { return link_array.slice(1); } //return without leading # if it exists
    return link_array;
}

//the "schema" passed is usually just the global api_doc, but there are a few cases where i use an internal schema here.
function findSchema(key_array, schema){
    if(!schema)
        schema = api_doc;
    let path = traverseObject(key_array, schema);
    if(!path)
        throw Error("This API path is invalid or contains invalid keys.");
    let path_key_array = parseSchemaRef(path);
    return [path_key_array, traverseObject(path_key_array, api_doc)]; 
}

//  Takes a config object, and iterates through it using the list of obj keys that our data is stored at.
//  In this config object, a function for transforming the data should be stored in the same location as our data, using the keyword "transform"
//  Ex: if our data is stored at components.schemas.DestinyItemComponent
//  then in the config object, we would have components.schemas.DestinyItemComponent.transform = function(data) { "code to transform the data" }
//  
function transformFromConfig(key_array, data, config){
    key_array = key_array.slice(0); //to make sure it doesn't affected the original keylist. I don't think it will, but can never be sure.
    key_array.push("transform"); //The keyword the function is stored in. Note: This will be a problem if the data has a proprty "transform" already.
    let reference = traverseObject(key_array, config);
    if(!reference) //if no configuration function exists, there's no transformation to be done. return data as-is
        return data;
    return reference(data); //call the transform function, return transformed data.
}

function customTransformations(key_array, data, xtypeheaders, config){
    if(xtypeheaders["x-destiny-component-type-dependency"]){
        // This data is based off a component-type dependency relevant to the API response. 
        // So, we're going to search the config object for a transform function for this specific component-type-dependency

        //to make sure it doesn't affected the original keylist. I don't think it will, but can never be sure.

        //We want the key found in the x-type-header, 
        //so we replace the current keys pointing to the schema and replace them with keys pointing to the component-type-dependency schema.
        // in the api, component-type-dependency schemas are on the same json-object level as everything else.
        //Ex of this in action:
        //[components, schemas, Destiny.Responses.DestinyProfileResponse, profileInventory] is a destiny-component-type-dependency
        // So, we will replace the key_array to look for [components, schemas, ProfileInventories], where the dependency schema is located
        let temp = key_array.slice(0, key_array.length-2); 
        temp.push(xtypeheaders["x-destiny-component-type-dependency"]); //the component-type key.

        //there may be a scenario where you don't want to use ProfileInventories, but do want to use [components, schemas, Destiny.Responses.DestinyProfileResponse, profileInventory]
        //if that's so, simply include a [Destiny.Responses.DestinyProfileResponse, profileInventory] transformation instead
        //traverseObject will check for a ProfileInventories schema, return false because you didn't add one
        // and then continue on through this function, and apply the transformation using the normal key_array (Destiny.Responses.DestinyProfileResponse, profileInventory)
        if(traverseObject(temp, config))
            return transformFromConfig(temp, data, config);
        
    }
    /*if(xtypeheaders["x-mapped-definition"]){
        //this data is a hash identifier(s) that maps to a destiny definition
        //So here, we're gonna find that definition, and return the dataset (if you've got it setup to do that in the config obj)
        
        let temp_key_array = parseSchemaRef(xtypeheaders["x-mapped-definition"]["$ref"]);
        let xmappedschema = traverseObject(temp_key_array, api_doc);
        if(xmappedschema){
            //console.log("We've successfully found the schema definition");
            // at this point, the temp_key_array should look something like this: ['components', 'schemas', 'Destiny.Definitions.DestinyInventoryItemDefinition']
            // that last piece contains the location of the definition this value maps to in the manifest files
            // So, we're going to parse that piece into a key array, and use it to retrieve the value from the manifest.
            // then we will replace this hash identifier with that processed data.
            let def_key_array = parseSchemaRef(temp_key_array[temp_key_array.length -1], ".");
            def_key_array = def_key_array.slice(def_key_array.length - 1);
            def_key_array.push(data);
            let manifest_data = traverseObject(def_key_array, Definitions);
            //if for some reason it can't find it in the manifest database, just proceed with the data as normal.
            if(manifest_data)
                return propertyProcessController(temp_key_array, xmappedschema, manifest_data, config, true, false);
        }
    }*/
    if(xtypeheaders["x-enum-reference"]){
        //enum reference means it's got a integer representing some other value.
        //that value is found in the schema under an x-enum-value array of objects
        //So we go to that schema, find the object with this numericValue, and return it's corresponding identifier
        //console.log("Found an enum reference.");
        let temp_key_array = parseSchemaRef(xtypeheaders["x-enum-reference"]["$ref"]);
        let xmappedschema = traverseObject(temp_key_array, api_doc);
        if(xmappedschema){
            for(i in xmappedschema["x-enum-values"]){
                if(xmappedschema["x-enum-values"][i].numericValue == data){
                    //console.log(xmappedschema["x-enum-values"][i].identifier);
                    return xmappedschema["x-enum-values"][i].identifier;
                }
                    
            }
        }

    }
    return transformFromConfig(key_array, data, config);
}

function getXTypeHeaders(schema){
    let schema_keys = Object.keys(schema);
    let results = {};
    for(i in apidoc_xtypeheaders){
        results[apidoc_xtypeheaders[i]] = false;
        for(j in schema_keys){
            if(apidoc_xtypeheaders[i] == schema_keys[j])
                results[apidoc_xtypeheaders[i]] = schema[schema_keys[j]];
        }
    }
    return results;
}

function Entrypoint(path, request_type, status_code, data, config){
    let key_array = ["paths", path, request_type, "responses", status_code, "$ref"];
    let [ref_array, schema] = findSchema(key_array); //return the schema for the response
    key_array = ["content", "application/json", "schema","properties", "Response", "$ref"];
    [ref_array, schema] = findSchema(key_array, schema); //return the schema for the response's data.
    return propertyProcessController(ref_array, schema, data, config, true); //Data mapping starts here.
}

function propertyProcessController(key_array, schema, data, config, isNewSchema, indexed){
    //Bungie uses various custom "x-type" headers. They're useful for parsing/transforming data, so we're going to get a headcount for the schema in question here.
    let xtypeheaders = getXTypeHeaders(schema);
    if(isNewSchema)
        indexed = xtypeheaders["x-dictionary-key"];
    switch(schema.type){
        case "object":
            data = processObjectSchema(key_array, schema, data, indexed, config);
            return customTransformations(key_array, data, xtypeheaders, config);
        case "array":
            data = processArraySchema(key_array, schema, data, indexed, config);
            return customTransformations(key_array, data, xtypeheaders, config);
        default:
            data = processBasicSchema(key_array, schema, data, indexed, config);
            return customTransformations(key_array, data, xtypeheaders, config);
    }
    
}

//Not much to do with basic types other than return, but i made it a function in case I ever need to add logic to basic types.
function processBasicSchema(key_array, schema, data, indexed){ 
    return data; 
}

function processArraySchema(key_array, schema, data, indexed, config){
    try{
        [key_array, schema] = findSchema(["items", "$ref"], schema);
        isNewSchema = true;
    }
    catch {
        schema = schema.items;
        isNewSchema = false;
    }
    let new_data = data.map( (current, index) => { return propertyProcessController(key_array.slice(0), schema, current, config, isNewSchema, indexed); });
    return new_data;
}

//  Object-type schemas have 3 different possibilites, which necessitates a object-specific controller function
//  - they can have a key "properties", which means a list of keys, each with it's own corresponding schema 
//  - they can have a key "additionalProperties", which has an $ref. This means that all the data here actually corresponds with the $ref schema, and so we should pass any current info (Read: indexed keys or naw), to the next schema
//  - they can have a key "allOf" which has a $ref. This also means that all data here corresponds with the $ref schema, and so we should pass any current info (Read: indexed keys or naw), to the next schema
function processObjectSchema(key_array, schema, data, indexed, config){
    if(schema.properties)
        return processKeywordProperties(key_array, schema, data, indexed, config);
    else if(schema.additionalProperties)
        return processKeywordAdditionalProperties(key_array, schema, data, indexed, config);
    else if(schema.allOf)
        return processKeywordAllOf(key_array, schema, data, indexed, config);
    else
        throw Error("This object has no properties, God help us all.")
}

function processKeywordProperties(key_array, schema, data, indexed, config){
    let parsed_properties = {};
    for(property in data){
        let passKeys = key_array.slice(0);
        let passSchema = schema.properties;
        let isNewSchema = true;
        try {
            //object property has a $ref, set that as the schema and go
            [passKeys, passSchema] = findSchema([property, "$ref"], passSchema);

        }
        catch {
            //  If we get here, this particular property is either:
            //  1: One holding it's own schema info instead of a $ref to another
            //  2: An indexed property, so the key won't match up to it's corresponding schema key
            //  3: A property that isn't documented by the api docs (unfortunately, it happens)
            if(traverseObject([property], passSchema)){
                // Possibiliy 1, we can pass the data/schema and move on.
                passKeys.push(property);
                passSchema = passSchema[property];
            }
            else{
                
                // If here, it's either possibility 2 or 3.
                if(indexed){
                    // If my code is right up to this point, we should have an indication of if the keys are indexed.
                    //  if they are, We are going to assume that this is the ONLY schema property, as I can't imagine having multiple schemas on indexed data.
                    //  In which case, pass the SCHEMA property in place of the data property, and move on.
                    //  Note: If there ever is a condition where we have multiple indexed schema properties, we're just screwed.
                    passKeys.push(Object.keys(passSchema)[0]);
                    passSchema = schema;
                    isNewSchema = false;

                }
                else {
                    //At this point, it's either indexed, and the api doesn't indicate it, or it's an undocumented property of the data.
                    //  Regardless, there's nothing we can do, so just return the data as-is.
                    //console.log("Can't tell if "+property+" is undocumented or indexed.");
                    parsed_properties[property] = data[property];
                    continue;
                }
            }
        }
        parsed_properties[property] = propertyProcessController(passKeys, passSchema, data[property], config, isNewSchema, indexed);
    }
    return parsed_properties;
}

function processKeywordAdditionalProperties(key_array, schema, data, indexed, config){
    try { [key_array, schema] = findSchema(["additionalProperties", "$ref"], schema); }
    catch {
        // In the case where there isn't a schema ref, we want to pass along the knowledge of if this data is indexed.
        schema = schema.additionalProperties;
    }
    let parsed_properties = {};
    for(property in data){
        // iterate through the list. we don't have to care about the keys being indexed or not
        // because additionalProperties should only ever hold one schema.
        parsed_properties[property] = propertyProcessController(key_array.slice(0), schema, data[property], config, false, indexed);
        // NOTE: isNewSchema false by default, if indexed is true it means all keys in the data being used by the next schema are indexed
    }
    return parsed_properties;
}

function processKeywordAllOf(key_array, schema, data, indexed, config){
    try { [key_array, schema] = findSchema(["allOf", 0, "$ref"], schema); }
    catch { throw Error("First instance of allOf without a $ref, don't currently support this."); }
    return propertyProcessController(key_array.slice(0), schema, data, config, false, indexed); //we pass false to isNewSchema by default, as allOf should only ever reference another schema.
}


let api_doc_link = "/Destiny2/{membershipType}/Profile/{destinyMembershipId}/";
let request_type = "get";
let code = "200";
const test_data = require("./profileData.json");
const config_objects = require('./backendTransformations.js');
blah = Entrypoint(api_doc_link, request_type, code, test_data, config_objects);
const fs = require('fs');
fs.writeFile("new_parsedProfileData.json", JSON.stringify(blah), (result) => console.log("success"));

module.exports = Entrypoint;
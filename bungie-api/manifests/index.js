/* this will need to look into 
/manifest and check each folder.
add the folder as the key, and the json file inside as the data
then export that object, so program can read all manfiests
*/

const manifests = "getall manifests into object.";

module.exports = function(language){
    return manifests[language] ? manifests[language] : manifests["en"];
}

"use strict";

//
// includes
//
var fs = require("fs");

require("reso-api-server");

(function () {
  var aConfigFile = "./service.conf";
console.log("");
  fs.exists(aConfigFile, function(exists) {
    if (!exists) {
console.log("Configuration file " + aConfigFile + " missing");
console.log("");
      process.exit(0);
    } else {
//
// read configuration file
//
console.log("Using configuration file " + aConfigFile);
      var contents = fs.readFileSync(aConfigFile).toString().split("\n");
      var i;
      var userConfig = {};
      for(i in contents) {
        var line = contents[i];
        var data = line.split(":");
        if (data.length != 1) {
          if (line.substring(0,1) != "#") {
            var aValue = data[1].trim().toUpperCase();
            switch (aValue) {
              case "false":
                aValue = false;
                break;
              case "FALSE":
                aValue = false;
                break;
              case "true":
                aValue = true;
                break;
              case "TRUE":
                aValue = true;
                break;
              default:
                aValue = data[1]
                for( var j = 2; j < data.length; j++){
                  aValue += ":" + data[j]
                }
                aValue = aValue.trim();
            }
            userConfig[data[0]] = aValue;
          }
        }
      }
      startServer(userConfig);
    }
  });
})();

function startServer(userConfig) {
 
//
// pre-process with configuration information
//
  var systemMetadata;
  if (!userConfig.METADATA_DEFINITION) {
    require("reso-data-dictionary"); 
  } else {
    require(userConfig["METADATA_DEFINITION"]);
    systemMetadata = userConfig["METADATA_DEFINITION"];
  }
  var certificates = {};
  if (userConfig["SERVER_PROTOCOL"] == 'https') {
    certificates = {
      key:    fs.readFileSync(userConfig["SERVER_KEY"]),
      cert:   fs.readFileSync(userConfig["SERVER_CERTIFICATE"]),
      ca:     fs.readFileSync(userConfig["CA_CERTIFICATE"])
    };
  }

//
// create server 
//

  $data.createODataServer(
    {
      authType: userConfig["AUTH_TYPE"],
      authRealm: userConfig["AUTH_REALM"],
      basicAuth: function(username, password){
        if (!password) {
          return false;
        }
        if (password == lookupUserPassword(username)) {
          return true;
        }
        return false;
      },
      certificates: certificates, 
//      CORS: true,
      checkPermission: function(access, user, entitySets, callback){
/*
console.dir(entitySets[0].name);
*/
        if (access & $data.Access.Read){
            callback.success();
        } else if (user == 'admin') callback.success();
        else callback.error('auth fail');
      }, 
      compression: userConfig["COMPRESSION"],
      digestAuth: lookupUserPassword,
      externalIndex: userConfig["EXTERNAL_INDEX"], 
      host: userConfig["SERVER_DOMAIN"], 
      indexLocation: userConfig["INDEX_LOCATION"], 
      logEntry: userConfig["LOG_ENTRY"],
      metadata: systemMetadata, 
      path: "/"+userConfig["SERVER_PATH"], 
      authServerUrl: userConfig["AUTH_SERVER_URL"], 
      oauth2ServerUrl: userConfig["OAUTH2_SERVER_URL"], 
      port: userConfig["SERVER_PORT"],
      postProcess: function(method, reso){
        switch (method) {
          case "DELETE":
console.log ("Delete " + reso.resultSize + " object from " + reso.memberName + " (" + reso.keyValue + ") by " + reso.userName + " sent through " + reso.requestor + " consuming " + (reso.endTime - reso.startTime) + " ms");
            break;
          case "GET":
            var returnText = "objects";
            if (reso.resultSize == 1) {
              returnText = "object";
            }
console.log ("Query " + reso.resultSize + " " + returnText + " from " + reso.memberName + " by " + reso.userName + " sent through " + reso.requestor + " consuming " + (reso.endTime - reso.startTime) + " ms");
            break;
          case "PATCH":
console.log ("Update " + reso.resultSize + " object to " + reso.memberName + " (" + reso.keyValue + ") by " + reso.userName + " sent through " + reso.requestor + " consuming " + (reso.endTime - reso.startTime) + " ms");
            break;
          case "POST":
console.log ("Add " + reso.resultSize + " object to " + reso.memberName + " (" + reso.keyValue + ") by " + reso.userName + " sent through " + reso.requestor + " consuming " + (reso.endTime - reso.startTime) + " ms");
            break;
        }
      },
      processWait: userConfig["PROCESS_WAIT"],
      protocol: userConfig["SERVER_PROTOCOL"], 
      responseLimit: userConfig["RESPONSE_LIMIT"], 
      serverName: userConfig["SERVER_NAME"], 
      type: reso 
    }
  );

}

var lookupUserPassword = function(username) {
  if (username == "admin"){
    return "admin";
  }
  return false;
}


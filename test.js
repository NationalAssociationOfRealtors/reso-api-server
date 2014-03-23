
"use strict";

//
// includes
//
var fs = require("fs")
  , INDEX;

//require("odata-server");
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
              case "FALSE":
                aValue = false;
                break;
              case "TRUE":
                aValue = true;
                break;
              default:
                aValue = data[1].trim();
            }
            userConfig[data[0]] = aValue;
//            userConfig[data[0]] = data[1].trim();
          }
        }
      }
      startServer(userConfig);
    }
  });
}());

function startServer(userConfig) {
 
//
// pre-process with configuration information
//
  if (!userConfig.METADATA_DEFINITION) {
    require("reso-data-dictionary"); 
  } else {
    require(userConfig["METADATA_DEFINITION"]);
  }
  var certificates = {
    key:    fs.readFileSync(userConfig["SERVER_KEY"]),
    cert:   fs.readFileSync(userConfig["SERVER_CERTIFICATE"]),
    ca:     fs.readFileSync(userConfig["CA_CERTIFICATE"])
  };

//reso.Property.ensureIndex( { "ListingId" : 1 }, { unique : true });

//
// create server 
//
/*
$data.createODataServer(
  reso, 
  userConfig["SERVER_PATH"], 
  userConfig["SERVER_PORT"], 
  userConfig["SERVER_DOMAIN"], 
  userConfig["SERVER_PROTOCOL"], 
  userConfig["INDEX_LOCATION"], 
  certificates
);
*/

/*
$data.createODataServer(
  {
    authType: userConfig["AUTH_TYPE"],
    authRealm: userConfig["AUTH_REALM"],
    basicAuth: {username: "admin", password: "admin"},
    certificates: certificates, 
    indexLocation: userConfig["INDEX_LOCATION"], 
    host: userConfig["SERVER_DOMAIN"], 
    path: "/"+userConfig["SERVER_PATH"] 
    port: userConfig["SERVER_PORT"], 
    protocol: userConfig["SERVER_PROTOCOL"], 
    type: reso, 
  }
);
*/

  $data.createODataServer(
    {
      authType: userConfig["AUTH_TYPE"],
      authRealm: userConfig["AUTH_REALM"],
      basicAuth: function(username, password){
        if (username == "admin"){
          return password == "admin";
        } else return true;
      },
      certificates: certificates, 
      compression: userConfig["COMPRESSION"],
      digestAuth: function(username){
        if (username == "admin"){
          return "admin";
        }
        return false;
      },
      externalIndex: userConfig["EXTERNAL_INDEX"], 
      host: userConfig["SERVER_DOMAIN"], 
      indexLocation: userConfig["INDEX_LOCATION"], 
      logEntry: userConfig["LOG_ENTRY"], 
      path: "/"+userConfig["SERVER_PATH"], 
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
            break;
          case "POST":
console.log ("Add " + reso.resultSize + " object to " + reso.memberName + " (" + reso.keyValue + ") by " + reso.userName + " sent through " + reso.requestor + " consuming " + (reso.endTime - reso.startTime) + " ms");
            break;
        }
      },
      processWait: userConfig["PROCESS_WAIT"],
      protocol: userConfig["SERVER_PROTOCOL"], 
      type: reso 
    }
  );

/*
$data.createODataServer(
  {
    authType: userConfig["AUTH_TYPE"],
    authRealm: userConfig["AUTH_REALM"],
    CORS: true, 
    basicAuth: function(username, password){
      if (username == "admin"){
        return password == "admin";
      } else return true;
    },
    certificates: certificates, 
    checkPermission: function(access, user, entitySets, callback){
      if (access & $data.Access.Read){
        callback.success();
      }else if (user == "admin") callback.success();
      else callback.error("auth fail");
    },
    indexLocation: userConfig["INDEX_LOCATION"], 
    path: "/"+userConfig["SERVER_PATH"], 
    port: userConfig["SERVER_PORT"], 
    protocol: userConfig["SERVER_PROTOCOL"], 
    type: reso 
  }
);
*/

}


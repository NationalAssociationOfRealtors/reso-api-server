require('jaydata-reso');

var fs = require('fs')
  , crypto = require("crypto")
  , randomstring = require("just.randomstring")
  , nonce = randomstring(16)
  , transportVersion = "0.9";

window.DOMParser = require('xmldom').DOMParser;

//
// functions shared between endpoints
//
function basicAuthFn(config, connect, req, res, next){
  if (!config.basicAuth) {
    return next();
  }
  if (typeof config.basicAuth == 'function'){
    connect.basicAuth(config.basicAuth)(req, res, next);
  } else {
    next();
  }
};
    
function digestAuthFn(config, req, res, next){
  if (!config.digestAuth) {
    return next();
  }
  if (typeof config.digestAuth == 'function'){
    digestAuth(config.digestAuth, req, res, config.authRealm, next);
  } else {
    next();
  }
};

function queryFn(connect, req, res, next){
  if (!req.query) {
    connect.query()(req, res, next);
  } else next();
};

function errorFn(req, res, next, callback) {
  var domain = require("domain");
  var reqd = domain.create();
  reqd.add(req);
  reqd.add(res);
  reqd.add(next);
  reqd.on('error', function(err) {
    try {
      console.error(err);
       next(err);
    } catch (derr){
      console.error("Error sending 500", derr, req.url);
      reqd.dispose();
    }
  });
  reqd.run(function(){
    callback();
  });
};
    
function errorHandlerFn(config, connect, err, req, res, next) {
  if (config.errorHandler) {
    connect.errorHandler.title = typeof config.errorHandler == "string" ?  config.errorHandler : config.provider.databaseName;
    connect.errorHandler()(err, req, res, next);
  } else {
    next(err);
  }
};

//
// resource endpoint
//    
$data.ODataServer = function(type, db){

    var connect = require("connect");
   
    var config = typeof type === "object" ? type : {};
    var type = config.type || type;
    config.database = config.database || db || type.name;
    if (!config.provider) config.provider = {};
    config.provider.name = config.provider.name || "mongoDB";
    config.provider.databaseName = config.provider.databaseName || config.database || db || type.name;
    config.provider.responseLimit = config.provider.responseLimit || config.responseLimit || 100;
    config.provider.user = config.provider.user || config.user;
    config.provider.checkPermission = config.provider.checkPermission || config.checkPermission;
    config.provider.externalIndex = config.externalIndex;
  
    var serviceType = $data.Class.defineEx(type.fullName + ".Service", [type, $data.ServiceBase]);
    serviceType.annotateFromVSDoc();

    function postProcessFn(req, res){
      if (config.postProcess) {
        if (typeof config.postProcess == 'function'){
          function clearForProcessing(req) {
            if (!req.reso.memberName) {
              req.reso.memberName = "System";
            }
            req.reso.requestor = req.connection.remoteAddress;
            if (req.reso.memberName == "$metadata") {
              req.reso.memberName = "Metadata";
            }
            req.reso.endTime = new Date().getTime();
            config.postProcess(req.method, req.reso);
          }
//
// server needs to complete its processing so results are delayed by 10 ms to allow thread to complete
//
          var waits = 0;
          var waitTime = config.processWait;
          function timeout_wrapper(req) {
            return function() {
              ++waits;
//console.log("Wait " + waits + " times for " + req.reso.startTime);
              if (req.reso.resultSize) {
                clearForProcessing(req);
              } else {
                if (waits > 2) {
console.log("Shutdown Wait for " + req.reso.startTime);
console.log("Consider increasing PROCESS_WAIT configuration value");
                  req.reso.resultSize = 1;
                  req.reso.keyValue = "unknown";
                  clearForProcessing(req);
                } else {
                  timeout = setTimeout(fn, waitTime);
                }
              }
            };
          };
          var fn = timeout_wrapper(req);
          var timeout = setTimeout(fn, waitTime);
          if (req.reso.resultSize) {
            clearTimeout(timeout);
            clearForProcessing(req);
          }

        }
      }
    };

/*
    var corsFn = function(req, res, next){
        if (config.CORS !== false){
            res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
            res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,X-HTTP-Method-Override,X-PINGOTHER,Content-Type,MaxDataServiceVersion,DataServiceVersion,Authorization,Accept");
            res.setHeader("Access-Control-Allow-Methods", "POST,GET,OPTIONS,PUT,MERGE,PATCH,DELETE");
            if (req.method === "OPTIONS"){
                res.setHeader("Access-Control-Allow-Credentials", "false");
                res.setHeader("Access-Control-Max-Age", "31536000");
                res.setHeader("Cache-Control", "max-age=31536000");
                res.end();
            }else{
                next();
            }
        }else next();
    };
*/
    
    function bodyFn(req, res, next){
      if (!req.body){
        connect.json()(req, res, function(err){
          if (err) return next(err);
          connect.urlencoded()(req, res, next);
        });
      } else next();
    };
    
    function simpleBodyFn(req, res, next) {
      $data.JayService.OData.Utils.simpleBodyReader()(req, res, next);
    };

    return function(req, res, next){
      var self = this;

//
// hide recursive calls that are denoted with an endpoint  "/$batch"
//
      var startStamp = new Date();
      var endPointURL = unescape(req.url);
      if (endPointURL != "/$batch") {
        if (config.logEntry) {
console.log(startStamp + " " + "Request " + req.method + " " + endPointURL + " received from " + req.connection.remoteAddress); 
        }     
      }
      if (config.provider.checkPermission){
        Object.defineProperty(req, 'checkPermission', {
          value: config.provider.checkPermission.bind(req),
          enumerable: true
        });
        config.provider.checkPermission = req.checkPermission;
      }

/*
        if (req.method === 'OPTIONS') {
console.log('!OPTIONS');
          var headers = {};
// IE8 does not allow domains to be specified, just the *
          headers["Access-Control-Allow-Origin"] = req.headers.origin;
          headers["Access-Control-Allow-Methods"] = "HEAD,POST,GET,OPTIONS,PUT,MERGE,DELETE";
          headers["Access-Control-Allow-Headers"] = "Host,Accept-Language,Accept-Encoding,Connection,User-Agent,Origin,Cache-Control,Pragma,X-Requested-With,X-HTTP-Method-Override,X-PINGOTHER,Content-Type,MaxDataServiceVersion,DataServiceVersion,Authorization,Accept";
          headers["Access-Control-Allow-Credentials"] = "false";
//          headers["Access-Control-Max-Age"] = '86400'; // 24 hours
//          headers["Access-Control-Max-Age"] = "31536000";
//          headers["Cache-Control"] = "max-age=31536000";
          headers["Access-Control-Max-Age"] = "1";
          headers["Cache-Control"] = "max-age=1";
          res.writeHead(200, headers);
          res.end();
        } else {
        res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
        res.setHeader("Access-Control-Allow-Headers", "Host,Accept-Language,Accept-Encoding,Referer,Connection,User-Agent,Origin,Cache-Control,Pragma,x-requested-with,X-HTTP-Method-Override,X-PINGOTHER,Content-Type,MaxDataServiceVersion,DataServiceVersion,Authorization,Accept");
        res.setHeader("Access-Control-Allow-Methods", "HEAD,POST,GET,OPTIONS,PUT,MERGE,DELETE");
        res.setHeader('Access-Control-Allow-Credentials', "false");
//        res.setHeader("Access-Control-Max-Age", "31536000");
//        res.setHeader("Cache-Control", "max-age=31536000");
        res.setHeader("Access-Control-Max-Age", "1");
        res.setHeader("Cache-Control", "max-age=1");
*/

      switch(config.authType) {
        case "Basic":
          basicAuthFn(config, connect, req, res, function(){
            config.provider.user = config.user = req.user || req.remoteUser || config.user || config.provider.user || "anonymous";
            queryFn(connect, req, res, function(){
              bodyFn(req, res, function(){
                simpleBodyFn(req, res, function(){
                  errorFn(req, res, next, function(){

                    req.reso = {
                      "externalIndex" : config.externalIndex,
                      "startTime": startStamp.getTime(),
                        "userName" : config.provider.user 
                    }
                    $data.JayService.createAdapter(
                      serviceType, 
                      function() {
                        return new serviceType(config.provider);
                      }
                    ).call(
                        self, 
                        req, 
                        res, 
                        function(err) {
                          if (typeof err === "string") err = new Error(err);
                          errorHandlerFn(err, req, res, next);
                        }
                    );
                    postProcessFn(req, res);

                  }); // errorFn
                }); // simpeBodyFn
              }); // bodyFn
            }); // queryFn
          }); // basicAuthFn
          break
        case "Digest":
          digestAuthFn(config, req, res, function(){
            config.provider.user = config.user = req.user || req.remoteUser || config.user || config.provider.user || "anonymous";
            queryFn(connect, req, res, function(){
              bodyFn(req, res, function(){
                simpleBodyFn(req, res, function(){
                  errorFn(req, res, next, function(){

                    req.reso = {
                      "externalIndex" : config.externalIndex, 
                      "startTime": startStamp.getTime(),
                      "userName" : config.provider.user 
                    }
                    $data.JayService.createAdapter(
                      serviceType, 
                      function() {
                        return new serviceType(config.provider);
                      }
                    ).call(
                        self, 
                        req, 
                        res, 
                        function(err) {
                          if (typeof err === "string") err = new Error(err);
                          errorHandlerFn(err, req, res, next);
                        }
                    );
                    postProcessFn(req, res);

                  }); // errorFn
                }); // simpleBodyFn
              }); // bodyFn
            }); // queryFn
          }); // digestAuthFn
          break
        default:
          config.provider.user = config.user = req.user || req.remoteUser || config.user || config.provider.user || "anonymous";
          queryFn(connect, req, res, function(){
            bodyFn(req, res, function(){
              simpleBodyFn(req, res, function(){
                errorFn(req, res, next, function(){

                    req.reso = {
                      "externalIndex" : config.externalIndex, 
                      "startTime": startStamp.getTime(),
                      "userName" : config.provider.user 
                    }
                    $data.JayService.createAdapter(
                      serviceType, 
                      function() {
                        return new serviceType(config.provider);
                      }
                    ).call(
                        self, 
                        req, 
                        res, 
                        function(err) {
                          if (typeof err === "string") err = new Error(err);
                          errorHandlerFn(err, req, res, next);
                        }
                          
                    );
                    postProcessFn(req, res);

                }); // errorFn
              }); // simpleBodyFn
            }); // bodyFn
          }); // queryFn
      } // switch authType
    }; // return
};

//
// DataService (discovery) endpoint
//    
$data.DataServiceServer = function(type, dataServiceEndpoint, resourceEndpoint, resourceList, metadata){

  var connect = require("connect");
   
  var config = typeof type === "object" ? type : {};
  var type = config.type || type;

  function dataServiceMetadata(req, res, next) {

    function generateResourceHeader() { 
      return "<?xml version=\"1.0\" encoding=\"utf-8\"?>\r\n" +
             "<feed xml:base=\"" + dataServiceEndpoint + "/\" " +
             "xmlns=\"http://www.w3.org/2005/Atom\" " +
             "xmlns:d=\"http://schemas.microsoft.com/ado/2007/08/dataservices\" " +
             "xmlns:m=\"http://schemas.microsoft.com/ado/2007/08/dataservices/metadata\" " +
             "xmlns:georss=\"http://www.georss.org/georss\" " +
             "xmlns:gml=\"http://www.opengis.net/gml\">\r\n" +
             " <id>" + dataServiceEndpoint + "</id>\r\n" +
             " <title type=\"text\">DataSystem</title>\r\n" +
             " <updated>" + metadata.lastUpdate.toISOString() + "</updated>\r\n" +
             " <link rel=\"self\" title=\"DataSystem\" href=\"DataSystem\" />\r\n" +
             " <entry>\r\n" +
             "  <id>" + dataServiceEndpoint + "/DataSystem('" + config.serverName + "')</id>\r\n" +
             "  <category term=\"RESO.OData.Transport.DataSystem\" scheme=\"http://schemas.microsoft.com/ado/2007/08/dataservices/scheme\" />\r\n" +
             "  <link rel=\"edit\" title=\"DataSystem\" href=\"DataSystem('" + config.serverName + "')\" />\r\n" +
             "  <title>Data Services for " + config.serverName + "</title>\r\n" +
             "  <updated>" + metadata.lastUpdate.toISOString() + "</updated>\r\n" +
             "  <author>\r\n" +
             "   <name>" + metadata.author + "</name>\r\n" +
             "  </author>\r\n" +
             "  <content type=\"application/xml\">\r\n" +
             "   <m:properties>\r\n" +
             "    <d:Name>" + config.serverName + "</d:Name>\r\n" +
             "    <d:ServiceURI>" + dataServiceEndpoint + "</d:ServiceURI>\r\n" +
             "    <d:DateTimeStamp m:type=\"Edm.DateTime\">" + (new Date()).toISOString() + "</d:DateTimeStamp>\r\n" +
             "    <d:TransportVersion>" + transportVersion + "</d:TransportVersion>\r\n" +
             "    <d:Resources m:type=\"Collection(RESO.OData.Transport.Resource)\">\r\n";
    };

    function generateResourceElement(aName, aDate) { 
      return "    <d:element>\r\n" +
             "     <d:Name>" + aName + "</d:Name>\r\n" +
             "     <d:ServiceURI>" + resourceEndpoint + "</d:ServiceURI>\r\n" +
             "     <d:Description>RESO Standard " + aName + " Resource</d:Description>\r\n" +
             "     <d:DateTimeStamp m:type=\"Edm.DateTime\">" + aDate.toISOString() + "</d:DateTimeStamp>\r\n" +
             "     <d:TimeZoneOffset m:type=\"Edm.Int32\">" + (0 - (aDate.getTimezoneOffset()/60))  + "</d:TimeZoneOffset>\r\n" +
             "     <d:Localizations m:type=\"Collection(RESO.OData.Transport.Localization)\" />\r\n" +
             "    </d:element>\r\n";
    }

    function generateResourceFooter() { 
      return "    </d:Resources>\r\n" +
             "    <d:ID>" + config.serverName + "</d:ID>\r\n" +
             "   </m:properties>\r\n" +
             "  </content>\r\n" +
             " </entry>\r\n" +
             "</feed>";
    };

    var aDoc = generateResourceHeader();
    for (eName in resourceList) {
      aDoc += generateResourceElement(eName, resourceList[eName]);
    }
    aDoc += generateResourceFooter();

    res.statusCode = 200;
    res.setHeader("content-type", "application/xml;charset=UTF-8");
    res.setHeader("content-length", aDoc.length);
    res.end(aDoc);
  };

  return function(req, res, next){
    var self = this;
    switch(config.authType) {
      case "Basic":
        basicAuthFn(config, connect, req, res, function(){
          config.provider.user = config.user = req.user || req.remoteUser || config.user || config.provider.user || "anonymous";
          queryFn(connect, req, res, function(){
            errorFn(req, res, next, function(){
              var aQuery = decodeURIComponent(req._parsedUrl.query);
              switch (aQuery) {
                case "DataSystem":
                  dataServiceMetadata(req, res, next);
                  break;
                case "DataSystem('" + config.serverName + "')":
                  dataServiceMetadata(req, res, next);
                  break;
                default:
                  res.statusCode = 500;
                  errorHandlerFn(config, connect, "Unknown DataService Query " + aQuery, req, res, next);
              }
            }); // errorFn
          }); // queryFn
        });
        break
      case "Digest":
        digestAuthFn(config,req, res, function(){
          config.provider.user = config.user = req.user || req.remoteUser || config.user || config.provider.user || "anonymous";
          queryFn(connect, req, res, function(){
            errorFn(req, res, next, function(){
              var aQuery = decodeURIComponent(req._parsedUrl.query);
              switch (aQuery) {
                case "DataSystem":
                  dataServiceMetadata(req, res, next);
                  break;
                case "DataSystem('" + config.serverName + "')":
                  dataServiceMetadata(req, res, next);
                  break;
                default:
                  res.statusCode = 500;
                  errorHandlerFn(config, connect, "Unknown DataService Query " + aQuery, req, res, next);
              }
            }); // errorFn
          }); // queryFn
        });
        break
      default:
        config.provider.user = config.user = req.user || req.remoteUser || config.user || config.provider.user || "anonymous";
        queryFn(connect, req, res, function(){
          errorFn(req, res, next, function(){
            var aQuery = decodeURIComponent(req._parsedUrl.query);
            switch (aQuery) {
              case "DataSystem":
                dataServiceMetadata(req, res, next);
                break;
              case "DataSystem('" + config.serverName + "')":
                dataServiceMetadata(req, res, next);
                  break;
              default:
                res.statusCode = 500;
                errorHandlerFn(config, connect, "Unknown DataService Query " + aQuery, req, res, next);
            }
          }); // errorFn
        }); // queryFn
    } // switch authType

  }; // return
};

//
// http service
//
$data.createODataServer = function(type, path, port, host, protocol, certificates) {

  var bannerWidth = 78;
  function bannerTop() {
    var bannerText = ".";
    for (var i = bannerWidth; i--;) {
      bannerText += "-";
    }
    bannerText += ".";
console.log(bannerText);
  }
  function bannerSpacer() {
    var bannerText = "|";
    for (var i = bannerWidth; i--;) {
      bannerText += "-";
    }
    bannerText += "|";
console.log(bannerText);
  }
  function bannerLine(text) {
    if (!text) {
      text = "";
    }
    var bannerText = "| " + text;
    for (var i = (bannerWidth-text.length-1); i--;) {
      bannerText += " ";
    }
    bannerText += "|";
console.log(bannerText);
  }
  function bannerBottom() {
    var bannerText = "'";
    for (var i = bannerWidth; i--;) {
      bannerText += "-";
    }
    bannerText += "'";
console.log(bannerText);
  }
 
//
// general configuration items
// 
  var config = typeof type === 'object' ? type : {};

  var projectName = "RESO API Server";
  config.serverName = config.serverName || projectName;

  bannerTop();
  var packageName = projectName + " Version " + require('./package').version;
  if (config.serverName == projectName ) {
    bannerLine(packageName);
  } else {
    bannerLine(config.serverName);
    bannerLine("(" + packageName + ")");
  } 
  bannerSpacer();

  switch(config.authType) {
    case "Basic":
      bannerLine("- Supports " + config.authType + " Authentication");
      break;
    case "Digest":
      config.authRealm = config.authRealm || config.serverName;
      bannerLine("- Supports " + config.authType + " Authentication");
      bannerLine("  > Digest realm: " + config.authRealm);
      bannerLine("  > Digest nonce: " + nonce);
      break;
    default:
      bannerLine("- No Authentication is being used");
  }

  if (config.compression) {
    bannerLine("- Output will ALWAYS be compressed if the requestor can handle compression");
  } else {
    bannerLine("- Output will NEVER be compressed");
  }
  bannerBottom();

//
// indexing 
//
  var Db = require('mongodb').Db , Server = require('mongodb').Server;
  var db = new Db("reso", new Server("127.0.0.1", 27017), { safe : false } );
  db.open(function(err, db) {
    if (err) throw err;

//
// construct an arrays  of collection information:
// - collections not using guid as a key
// - creationDate by collection
//
    var definitions = type.type.memberDefinitions;
    var indexList = {};
    var resourceList = {};
    var resourceDate = new Date();
    for (dName in definitions) {
      var pos = dName.indexOf("$");
      if (pos === 0) {
        if (definitions[dName].kind == "property") {
          if (definitions[dName].type.fullName == "$data.EntitySet") {
            resourceList[dName.substring(1)] = resourceDate;
            var entitySet = definitions[dName];
            var keyProperties = entitySet.elementType.memberDefinitions.getKeyProperties();
            if (keyProperties.length > 0) {
              if (keyProperties[0].originalType != "id") {
                indexList[dName.substring(1)] = keyProperties[0].name;
              }
            }
          }
        }
      }
    }

    function startup() {
      db.close();
      var connect = require('connect');
      var app;
      if (protocol == "http" ) {
        app = connect();
      } else {
        var serverCertificates = config.certificates || certificates;
        app = connect(serverCertificates);
      }
      var serverPath = config.path || path || "/";

      if (config.compression) {
        app.use(connect.compress());
      }

//
// handlers
//
      var serverHost = config.host || host;
      var serverPort = config.port || port || 80;
      var serverProtocol = config.protocol || protocol || "http";

      app.use(serverPath, $data.ODataServer(type));

      var dataSystemPath = "/DataSystem.svc";    
      var resourceEndpoint = serverProtocol + "://" + serverHost + ":" + serverPort + serverPath;
      var dataServiceEndpoint = serverProtocol + "://" + serverHost + ":" + serverPort + dataSystemPath;
      var metadata = {
        author: config.serverName || "unknown",
        version: "unknown"
      };
      if (!config.metadata) {
        var pjson = JSON.parse(fs.readFileSync("./node_modules/reso-data-dictionary/package.json", "utf8"));
        metadata.author = pjson.author.name;
        metadata.version = pjson.version;
        metadata.lastUpdate= fs.statSync("./node_modules/reso-data-dictionary/index.js").mtime;
      } else {
        metadata.lastUpdate = fs.statSync(config.metadata).mtime;
      }
      app.use(dataSystemPath, $data.DataServiceServer(type, dataServiceEndpoint, resourceEndpoint, resourceList, metadata));

      app.listen(serverPort, serverHost);

//
// console notification
//
      bannerLine();
      bannerLine("Listening on " + serverProtocol + "://" + serverHost + ":" + serverPort + serverPath);
      bannerBottom();

      bannerTop();
      bannerLine("DataService Endpoint");
      bannerSpacer();
      bannerLine("Listening on " + serverProtocol + "://" + serverHost + ":" + serverPort + dataSystemPath);
      bannerBottom();
    }

    bannerTop();
    bannerLine("Resource Endpoint");
    bannerSpacer();
//
// no need to apply special indexing if all collections use guid 
//
    function isEmptyObject(obj) {
      for(var prop in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, prop)) {
          return false;
        }
      }
      return true;
    }
    if (isEmptyObject(indexList)) {
      bannerLine("- No special indexing is required");
      startup();
    }

//
// process collections that don't use default guid as key
//
    for (cName in indexList) {
      var cObject = {};
      var cKey = indexList[cName];
      cObject[cKey] = 1;
      bannerLine("- Indexing " + cName);
      var collection = db.collection(cName);

//
// external index feature needs conflicting index removed and a scan of keys
//
      if (config.externalIndex) {
        collection.indexInformation({full:true}, function(err, indexInformation) {
          var dropList = [];
          for (var i = indexInformation.length; i--;) {
            var anIndex = indexInformation[i];
            if (anIndex.unique) {
//console.dir(anIndex);
              var found = false;
              for (cIndexKey in anIndex.key) {
                if (cIndexKey == cKey) {
                  found = true;
                }
              }
              if (found) {
                dropList[dropList.length] = anIndex.key;
              }
            }
          }
          function scanAndCreate(aDefinition) {
            collection.find({},aDefinition).toArray(function(err, docs) {
//console.dir(docs);
              if (err) throw err;
              INDEX = [];
              for (var j = docs.length; j--;) {
                INDEX[j] = docs[j].ListingId;
              }
              bannerLine("  > An in-memory index for " + cName + " has been created with " + docs.length + " items");
              if (i < 0) {
                startup();
              }
            });
          };
          if (dropList.length == 0) {
            scanAndCreate(cObject);
          } else {
            for (var i = dropList.length; i--;) {
              db.dropIndex(cName, dropList[i], function(err, result) {
                if (!err) {
                  bannerLine("  > Conflicting built-in index was dropped");
                }
              });
              scanAndCreate(dropList[i]);
            } // dropList loop
          } // dropList.length == 0
        }); // collection.indexInformation
      } else {
//
// builtin-in index must be present
//
        bannerLine("  > Uniqueness enforced with built-in index");
        collection.ensureIndex(cObject, {unique:true, background:true, dropDups:true, w:0}, function(err, indexName) {
          if (err) throw err;
          if (!indexName) {
            bannerLine("  > Built-in index for " + cName + " was not found and was automatically created");
          }
// Fetch full index information
          collection.indexInformation({full:true}, function(err, indexInformation) {
//          db.indexInformation(cName, {full:true}, function(err, indexInformation) {
            for (var i = indexInformation.length; i--;) {
              if (indexInformation[i].name != "_id_") {
                bannerLine("  > Built-in index name for " + cName + " is " + indexInformation[i].name);
              }
            }
            startup();
          });
        }); // collection.ensureIndex
      } // if config.externalIndex
    } // indexDriver
  }); // db.open

};

module.exports = exports = $data.ODataServer;

function digestAuth(callback, req, res, realm, next) {
  var authorization = req.headers.authorization;

  if (req.user) return next();
  if (!authorization) return unauthorizedDigest(res, realm);

//
// Determine if Digest authorization header is sent
//
//console.log(authorization);
  var parts = authorization.split(" ");
  if (parts[0] !== "Digest") {
    return unauthorizedDigest(res, realm);
  }

//
// determine if the correct number of arguments is in the Digest header
//
  var pos = authorization.indexOf(" ");
  authorization = authorization.substring(pos);
  var parts = authorization.split(",");
  if (parts.length !== 8) {
    return unauthorizedDigest(res, realm);
  }

//
// breakdown the header
//
  var username;
  var realm;
  var nonce;
  var uri;
  var response;
  var qop;
  var nc;
  var cnonce; 
  for (var i = parts.length; i--;) {
    var pieces = parts[i].split("=");
    switch(pieces[0].trim()) {
      case "username":
        username = pieces[1].replace(/["']/g, "");
        break;
      case "realm":
        realm = pieces[1].replace(/["']/g, "");
        break;
      case "nonce":
        nonce = pieces[1].replace(/["']/g, "");
        break;
      case "uri":
        uri = pieces[1].replace(/["']/g, "");
        break;
      case "response":
        response = pieces[1].replace(/["']/g, "");
        break;
      case "qop":
        qop = pieces[1].replace(/["']/g, "");
        break;
      case "nc":
        nc = pieces[1].replace(/["']/g, "");
        break;
      case "cnonce":
        cnonce = pieces[1].replace(/["']/g, "");
        break;
    }
  }

//
// use the callback to determine the password to use
//
  var password = callback(username);
//console.log("PASSWORD: " + password);

//
// construct a response
//
//  var A1 = username + ":" + realm + ":" + password;
//console.log(A1);
//  var HA1 = md5(A1);
//  var A2 = req.method + ":" + uri;
//console.log(A2);
//  var HA2 = md5(A2);
//  var check_response = HA1 + ":" + nonce + ":" + nc + ":" + cnonce + ":" + qop + ":" + HA2;
//console.log(check_response);
//  check_response = md5(check_response);

  var HA1 = crypto.createHash("md5").update(username + ":" + realm + ":" + password, "utf8").digest("hex");
  var HA2 = crypto.createHash("md5").update(req.method + ":" + uri, "utf8").digest("hex");
  var check_response = crypto.createHash("md5").update(HA1 + ":" + nonce + ":" + nc + ":" + cnonce + ":" + qop + ":" + HA2, "utf8").digest("hex");
//  var HA1 = md5(username + ":" + realm + ":" + password);
//  var HA2 = md5(req.method + ":" + uri);
//  var check_response = md5(HA1 + ":" + nonce + ":" + nc + ":" + cnonce + ":" + qop + ":" + HA2);

//
// check constructed response against the passed response
//
//console.log(check_response);
//console.log(response);
  if (check_response != response) {
console.log("FAILED");
    unauthorizedDigest(res, realm);
  }

//
// set the user in the request
// 
  req.user = req.remoteUser = username;

//
// move on
//
  next();
};

function unauthorizedDigest(res, realm) {
  res.statusCode = 401;
  res.setHeader("WWW-Authenticate", 'Digest realm="' + realm + '", nonce="' + nonce + '", qop=auth');
  res.end("Unauthorized");
};

//function md5(str, encoding){
//  return crypto
//    .createHash('md5')
//    .update(str, 'utf8')
//    .digest(encoding || 'hex');
//};

function readIndexFile(fileName) {
  if (fs.existsSync(fileName)) {
    var contents = fs.readFileSync(fileName).toString();
    return contents.split(",");
  }
  return new Array();
}

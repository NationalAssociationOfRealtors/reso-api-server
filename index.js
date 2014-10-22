require('jaydata-reso');

var fs = require('fs')
  , randomstring = require("just.randomstring")
  , nonce = randomstring(16)
  , transportVersion = "0.9"
  , compression = require('compression')
  , connect = require('connect')
  , parse = require('url').parse
  , qs = require('qs')
  , http = require('http')
  , https = require('https')
  , auth = require('basic-auth')
  , url = require("url");

window.DOMParser = require('xmldom').DOMParser;

//
// functions shared between endpoints
//
function preProcessFn(req, res, next){
  if (!req.query) {
    req.query = ~req.url.indexOf('?')
      ? qs.parse(parse(req.url).query)
      : {};
  }
  next();
};

function bearerFn(config, parts, req, res, next){
  var parsedURI = url.parse(config.oauth2ServerUrl);
  var post_options = {
    host: parsedURI.hostname,
    port: parsedURI.port,
    path: parsedURI.path,
    method: "GET", 
    rejectUnauthorized: false,
    headers: {
      "Authorization": parts[0] + " " + parts[1],
    }
  };
  var https_auth = require("https");
  var post_req = https_auth.request(post_options, function(post_res) {
    post_res.setEncoding('utf8');
    var msg = "";
    post_res.on('data', function (chunk) {
      msg += chunk;
    });
    post_res.on("end", function () {
//
// set the user in the request
//
      msg = JSON.parse(msg);
      req.user = req.remoteUser = msg.name;
//
// move on
//
      next();
    });
  });

  post_req.end();

  post_req.on('error', function(e) { 
console.trace(e);
  });
};
    
function basicAuthFn(config, req, res, next){
  if (!config.basicAuth && !config.authServerUrl) {
    return next();
  }

  var authorization = req.headers.authorization;
  if (!authorization) return unauthorizedBasic(res);

//
// Determine if Bearer authorization header is sent
//
  var parts = authorization.split(" ");
  if (parts[0] == "Bearer") {
    return bearerFn(config, parts, req, res, next);
  }

  function unauthorizedBasic(res){
    res.statusCode = 401;
    res.setHeader("WWW-Authenticate", 'Basic realm="' + config.authRealm + '"');
    res.end("Unauthorized");
  }

  var user = auth(req);
  if (user == null) {
    unauthorizedBasic(res);
  } else {
    if (typeof config.basicAuth == 'function'){
      if (config.basicAuth(user.name, user.pass)) {
        req.user = req.remoteUser = user.name;
        next();
      } else {
        unauthorizedBasic(res);
      }
    } else {
      var querystring = require("querystring");
      var post_data = querystring.stringify({
        "user_name" : user.name 
      });
      var parsedURI = url.parse(config.authServerUrl);
      var post_options = {
        host: parsedURI.hostname,
        port: parsedURI.port,
        path: parsedURI.path,
        method: "POST", 
        rejectUnauthorized: false,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": post_data.length
        }
      };
      var https_auth = require("https");
      var post_req = https_auth.request(post_options, function(post_res) {
        post_res.setEncoding('utf8');
        var msg = "";
        post_res.on('data', function (chunk) {
          msg += chunk;
        });
        post_res.on("end", function () {
          msg = JSON.parse(msg);
          if (!msg) {
            unauthorizedBasic(res);
          }
          if (user.pass == msg.user_pass) {
//
// set the user in the request
//
            req.user = req.remoteUser = user.name;
            next();
          } else {
            unauthorizedBasic(res);
          }
        });
      });

      post_req.write(post_data);

      post_req.end();

      post_req.on('error', function(e) { 
console.trace(e);
      });
    }
  }
};
    
function digestAuthFn(config, req, res, next){
  if (!config.digestAuth && !config.authServerUrl) {
    return next();
  }

  if (req.user) return next();

  function unauthorizedDigest(res, realm) {
    res.statusCode = 401;
    res.setHeader("WWW-Authenticate", 'Digest realm="' + realm + '", nonce="' + nonce + '", qop=auth');
    res.end("Unauthorized");
  };

  var authorization = req.headers.authorization;
  if (!authorization) return unauthorizedDigest(res, config.authRealm);

//
// Determine if Bearer authorization header is sent
//
  var authparts = authorization.split(" ");
  if (authparts[0] !== "Digest") {
    if (authparts[0] == "Bearer") {
      return bearerFn(config, authparts, req, res, next);
    } else {
      return unauthorizedDigest(res, config.authRealm);
    }
  }

//
// determine if the correct number of arguments is in the Digest header
//
//  var pos = authorization.indexOf(" ");
//  authorization = authorization.substring(pos);
//  var parts = authorization.split(",");
  var authorizationTokens = authorization.substring(authorization.indexOf(" "));
//  var pos = authorization.indexOf(" ");
//  var authorizationTokens = authorization.substring(pos);
  var parts = authorizationTokens.split(",");
  if (parts.length !== 8) {
    return unauthorizedDigest(res, config.authRealm);
  }

//
// breakdown the header
//
  var breakdown = new Array();
  for (var i = parts.length; i--;) {
//    var pieces = parts[i].split("=");
//console.dir(parts[i]);
   // breakdown[pieces[0].trim()] = pieces[1].replace(/["']/g, "");
    var piece = parts[i].match(/^\s*?(\w+)="?([^"]*)"?\s*?$/);
    if (piece.length > 2) {
      breakdown[piece[1]] = piece[2];
    }
  }

  function digestAuthResponse(breakdown, password, req, res, next) {
//
// construct a response
//
    var crypto = require("crypto");
    var HA1 = crypto.createHash("md5").update(breakdown.username + ":" + breakdown.realm + ":" + password, "utf8").digest("hex");
    var HA2 = crypto.createHash("md5").update(req.method + ":" + breakdown.uri, "utf8").digest("hex");
    var check_response = crypto.createHash("md5").update(HA1 + ":" + breakdown.nonce + ":" + breakdown.nc + ":" + breakdown.cnonce + ":" + breakdown.qop + ":" + HA2, "utf8").digest("hex");

//
// check constructed response against the passed response
//
    if (check_response != breakdown.response) {
console.log("FAILED");
      unauthorizedDigest(res, breakdown.realm);
    }

//
// set the user in the request
// 
    req.user = req.remoteUser = breakdown.username;
    next();
  };

//
// use the callback to determine the password to use
//
  if (typeof config.digestAuth == 'function'){
    var callback = config.digestAuth;
    digestAuthResponse(breakdown, callback(breakdown.username), req, res, next);
  } else {
    var querystring = require("querystring");
    var post_data = querystring.stringify({
      "user_name" : breakdown.username 
    });
    var parsedURI = url.parse(config.authServerUrl);
    var post_options = {
      host: parsedURI.hostname,
      port: parsedURI.port,
      path: parsedURI.path,
      method: "POST", 
      rejectUnauthorized: false,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": post_data.length
      }
    };
    var https_auth = require("https");
    var post_req = https_auth.request(post_options, function(post_res) {
      post_res.setEncoding('utf8');
      var msg = "";
      post_res.on('data', function (chunk) {
        msg += chunk;
      });
      post_res.on("end", function () {
        msg = JSON.parse(msg);
        if (!msg) {
          unauthorizedDigest(res, breakdown.realm);
        }
        digestAuthResponse(breakdown, msg.user_pass, req, res, next);
      });
    });

    post_req.write(post_data);

    post_req.end();

    post_req.on('error', function(e) { 
console.trace(e);
    });
  }

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
    
function errorHandlerFn(config, err, req, res, next) {
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
$data.ODataServer = function(config){

    config.database = config.type.name;
    config.provider = {
      name: "mongoDB",
      databaseName: config.type.name,
      address: config.databaseAddress,
      port: config.databasePort,
      responseLimit: config.responseLimit || 100,
      user: config.user,
      checkPermission: config.checkPermission,
      externalIndex: config.externalIndex
    };
    var serviceType = $data.Class.defineEx(config.type.fullName + ".Service", [config.type, $data.ServiceBase]);
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
    
    function simpleBodyFn(req, res, next) {
      $data.JayService.OData.Utils.simpleBodyReader()(req, res, next);
    };
*/

    return function(req, res, next){
      var self = this;

//
// hide recursive calls that are denoted with an endpoint  "/$batch"
//
      var startStamp = new Date();
      var endPointURL = unescape(req.url);
      if (config.provider.checkPermission){
        Object.defineProperty(req, 'checkPermission', {
          value: config.provider.checkPermission.bind(req),
          enumerable: true
        });
        config.provider.checkPermission = req.checkPermission;
      }

      if (req.method === 'OPTIONS') {
console.log('!OPTIONS');
        var headers = {};
// IE8 does not allow domains to be specified, just the *
        headers["Access-Control-Allow-Origin"] = req.headers.origin;
        headers["Access-Control-Allow-Methods"] = "HEAD,POST,GET,OPTIONS,PUT,MERGE,DELETE";
        headers["Access-Control-Allow-Headers"] = "Host,Accept-Language,Accept-Encoding,Connection,User-Agent,Origin,Cache-Control,Pragma,X-Requested-With,X-HTTP-Method-Override,X-PINGOTHER,Content-Type,MaxDataServiceVersion,DataServiceVersion,Authorization,Accept";
        headers["Access-Control-Allow-Credentials"] = "false";
//        headers["Access-Control-Max-Age"] = '86400'; // 24 hours
//        headers["Access-Control-Max-Age"] = "31536000";
//        headers["Cache-Control"] = "max-age=31536000";
        headers["Access-Control-Max-Age"] = "1";
        headers["Cache-Control"] = "max-age=1";
        res.writeHead(200, headers);
        res.end();
      } else {
        res.setHeader("Access-Control-Allow-Origin", req.headers.origin);
        res.setHeader("Access-Control-Allow-Headers", "Host,Accept-Language,Accept-Encoding,Referer,Connection,User-Agent,Origin,Cache-Control,Pragma,x-requested-with,X-HTTP-Method-Override,X-PINGOTHER,Content-Type,MaxDataServiceVersion,DataServiceVersion,Authorization,Accept");
        res.setHeader("Access-Control-Allow-Methods", "HEAD,POST,GET,OPTIONS,PUT,MERGE,DELETE");
        res.setHeader('Access-Control-Allow-Credentials', "false");
//      res.setHeader("Access-Control-Max-Age", "31536000");
//      res.setHeader("Cache-Control", "max-age=31536000");
        res.setHeader("Access-Control-Max-Age", "1");
        res.setHeader("Cache-Control", "max-age=1");

        function processFn(req, res, next) {
          config.provider.user = config.user = req.user || req.remoteUser || config.user || config.provider.user || "anonymous";
          if (endPointURL != "/$batch") {
            if (config.logEntry) {
console.log(startStamp + " " + "Request " + req.method + " " + endPointURL + " by " + config.provider.user + " received from " + req.connection.remoteAddress); 
            }     
          }

          preProcessFn(req, res, function(){
//            simpleBodyFn(req, res, function(){
            $data.JayService.OData.Utils.simpleBodyReader()(req, res, function() { 
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
                      if (typeof err === "string") {
                        err = new Error(err);
                      }
                      errorHandlerFn(err, req, res, next);
                    }
                          
                );
                postProcessFn(req, res);
              }); // errorFn
            }); // simpleBodyFn
          }); // preProcessFn
        }

        switch(config.authType) {
          case "Basic":
            basicAuthFn(config, req, res, function(){
              processFn(req, res, next);
            }); // basicAuthFn
            break
          case "Digest":
            digestAuthFn(config, req, res, function(){
              processFn(req, res, next);
            }); // digestAuthFn
            break
          default:
            processFn(req, res, next);
        } // switch authType
      } // return
    } // not method OPTIONS
};

//
// DataService (discovery) endpoint
//    
$data.DataServiceServer = function(config, dataServiceEndpoint, resourceEndpoint, resourceList, metadata){

  return function(req, res, next){
    var self = this;

    var startStamp = new Date();
     
    function processFn(req, res, next) {
      config.provider.user = config.user = req.user || req.remoteUser || config.user || config.provider.user || "anonymous";
      if (config.logEntry) {
console.log(startStamp + " " + "Discovery Request by " + config.provider.user + " received from " + req.connection.remoteAddress); 
      }

      preProcessFn(req, res, function(){

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
          res.setHeader("content-length", Buffer.byteLength(aDoc));
          res.end(aDoc);
        };

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
              errorHandlerFn(config, "Unknown DataService Query " + aQuery, req, res, next);
          }
        }); // errorFn
      }); // preProcessFn
    }

    switch(config.authType) {
      case "Basic":
        basicAuthFn(config, req, res, function(){
          processFn(req, res, next);
        });
        break
      case "Digest":
        digestAuthFn(config,req, res, function(){
          processFn(req, res, next);
        });
        break
      default:
        config.provider.user = config.user = req.user || req.remoteUser || config.user || config.provider.user || "anonymous";
        processFnx(req, res, next);
    } // switch authType

  }; // return
};

//
// http service
//
$data.createODataServer = function(config) {

  var bannerWidth = 78;
  var bannerText;
  function bannerTop() {
    bannerText = ".";
    for (var i = bannerWidth; i--;) {
      bannerText += "-";
    }
    bannerText += ".";
console.log(bannerText);
  }
  function bannerSpacer() {
    bannerText = "|";
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
    bannerText = "| " + text;
    for (var i = (bannerWidth-text.length-1); i--;) {
      bannerText += " ";
    }
    bannerText += "|";
console.log(bannerText);
  }
  function bannerBottom() {
    bannerText = "'";
    for (var i = bannerWidth; i--;) {
      bannerText += "-";
    }
    bannerText += "'";
console.log(bannerText);
  }
 
//
// general configuration items
// 
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
      config.authRealm = config.authRealm || config.serverName;
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
  };

  if (config.authServerUrl) {
    config.basicAuth = null;
    config.digestAuth = null;
    bannerLine("- Accounts are maintained externally and accessed using:");
    bannerLine("  > " + config.authServerUrl);
  } else {
    bannerLine("- Account information is maintained within the server");
  };
  if (config.oauth2ServerUrl) {
    bannerLine("- Requests validated with OAuth2 Server using:");
    bannerLine("  > " + config.oauth2ServerUrl);
  }
  if (config.compression) {
    bannerLine("- Output will ALWAYS be compressed if the requestor supports compression");
  } else {
    bannerLine("- Output will NEVER be compressed");
  };
  bannerBottom();

//
// indexing 
//
  config.databaseAddress = "127.0.0.1";
  config.databasePort = 27017;
  var Db = require("mongodb").Db , Server = require("mongodb").Server;
  var db = new Db(config.type.name, new Server(config.databaseAddress, config.databasePort), { safe : false } );
  db.open(function(err, db) {
    if (err) throw err;

//
// construct an arrays  of collection information:
// - collections not using guid as a key
// - creationDate by collection
//
    var definitions = config.type.memberDefinitions;
    var resourceDate = new Date();
    var indexList = {};
    var resourceList = {};
    for (dName in definitions) {
      if (definitions[dName] !== undefined) {
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

//
// transport
//
      var getIPAddress = function() {
        var interfaces = require('os').networkInterfaces();
        for (var devName in interfaces) {
          var iface = interfaces[devName];
          for (var i = iface.length; i--;) {
            var alias = iface[i];
            if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
                return alias.address;
            }
          }
        }

        return '0.0.0.0';
      }

      var serverHost = config.host || getIPAddress() || "localhost";
      var serverPort = config.port || 80;
      var serverProtocol = config.protocol || "http";

      var app;
      app = connect();

      var serverPath = config.path || "/";

      if (config.compression) {
        app.use(compression());
      }

//
// Resource Endpoint handler
//
      app.use(serverPath, $data.ODataServer(config));

//
// DataSystem Endpoint handler
//
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
      app.use(dataSystemPath, $data.DataServiceServer(config, dataServiceEndpoint, resourceEndpoint, resourceList, metadata));

      if (serverProtocol == "http" ) {
        http.createServer(app).listen(serverPort, serverHost);
      } else {
        https.createServer(config.certificates, app).listen(serverPort, serverHost);
      }

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

function readIndexFile(fileName) {
  if (fs.existsSync(fileName)) {
    var contents = fs.readFileSync(fileName).toString();
    return contents.split(",");
  }
  return new Array();
}
    

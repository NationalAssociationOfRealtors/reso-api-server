
reso-api-server
=======

The RESO API Server provides a basic server that supports the OData protocol as specified by the RESO standards group.

### Operation

The RESO API Server can be run from the command line using a file created to customize operation.  The server supports both a DataService endpoint (used for discovery) as well as a Resource endpoint.  Information is stored in a local repository by default.  The server can be alternatively by configured to use a RESO Certified RETS 1.X server as a repository.  

The **Setup** section provides a step-by-step guide getting the server installed.  Please use information outlined in the **Configuration** section to create the configuration file.

### Setup

The following procedure should be followed to setup the server:

+ Install server using NPM:

 ```shell
  npm install reso-api-server
 ```
 
+ Create a metadata directory and create metadata if you do not want to you the package approach.  You can use the sample file provided in the distribution::

 ```shell
  mkdir metadata
  cd metadata
  cp ../node_modules/reso-api-server/samples/reso_1_2.js .
 ```

  Alternatively, you can use the packaged approach:

 ```shell
  npm install reso-data-dictionary
 ```

+ Create a configuration file or use the sample file supplied by the distribution:

 ```shell
  cp ../node_modules/reso-api-server/samples/service.conf . 
 ```

+ Configure the server using the guide below in the **Configuration** section.

+ Create an execution javascript file for node.js or use the test file supplied by the distribution:

 ```shell
  cp ./node_modules/reso-api-server/test.js .
 ```

+ Run the server:

 ```shell
  node test.js
 ```

### Configuration

A text configuration file should be located in the root directory of your project.  The default name of the file is "service.conf", but this name can be overriden when calling the resoServer() method.  A sample of the configuration file called "service.conf" can be found in the samples directory of this distribution.

RESO updates the RESO Data Dictionary periodically. A copy of the latest known RESO Data Dictionary is included in the samples directory, but you should check with the stnandards group for the latest copy.  

+ API Service (data supplier parameters)

 COMPRESSION: A boolean value that controls whether requested information is compressed.  Compressed is much smaller than normal data but requires more server resources to generate.  If the parameter is set to "true", them data will be compressed if requested.

 SERVER\_DOMAIN: The dns name of the computer that will be running the RESO API Server.  If not supplied, the IP Address of the computer will be used.  

 SERVER\_NAME: The name to display in the console at startup.  Useful for private labelling.

 SERVER\_PATH: The path of the RESO API service.

 SERVER\_PORT: The port that the RESO API Server will be listening on.

 SERVER\_PROTOCOL: The protocol that the RESO API Server is using.  Valid values are "http" or "https".

+ Data Processing 

 EXTERNAL\_INDEX: A boolean value that indicates whether an external index (recommended) is being used to enfoce uniqueness or the underlying MongoDB database indexing will be used.  Only MongoDB collections that do not use GUID as a key are affected.  This setting is only valid for local data repositories.  If the server is configured to use a RETS server as its repository (by configuring a LEGACY\_SOURCE\_URL), this setting is ignored.

 LEGACY\_SOURCE\_URL: A string that represents the URL of a RESO Certified RETS 1.X server.  The URL should start with the protocol and include the port number because the server will not assume the default port of 6103.  An example of an expected URL would be "http://some.mls.service.com:6103".  If LEGACY\_SOURCE\_URL is set, the setting for EXTERNAL\_INDEX is ignored.

 LOG\_ENTRY: A boolean value that indicates whether a console log message is generated each time a request is processed.  This produces more output at the console, but alerts you when there is activity. Defaults ot "false".

 METADATA\_DEFINITION: The path to the file for the JSON formatted OData definition file that contains RESO Data Dictionary definitions.  If this parameter is not included, the server will try to look for the package "reso-data-dictionary" which should be included from your root project directory.

 PROCESS\_WAIT: The number of milliseconds to wait for processing to complete for complex queries.  A goog value to start with is 20, but this parameter defaults to 0.

 RESPONSE\_LIMIT: The maximum number of objects that can be retrieved at one time.  Defaults to 100.

+ HTTPS Certificates 

 CA\_CERTIFICATE: The path to the file that contains a Certificate Authority (CA) certficate.  This value is only required if the SERVER\_PROTOCOL is "https".

 SERVER\_CERTIFICATE: The path to the file that contains the server's certficate.  This value is only required if the SERVER\_PROTOCOL is "https".

 SERVER\_KEY: The path to the file that contains the server's secret key.  This value is only required if the SERVER\_PROTOCOL is "https".

+ Authentication 

 AUTH\_REALM: The text to use for realm if using Digest Authentication. If this parameter is not included, the realm will default to the string in the SERVER\_NAME parameter. This value is only required if the AUTH\_TYPE is "Digest". 
  
 AUTH\_TYPE: The type of authentication supported by the RESO API Server.  Valid values are "Basic" and "Digest".

 AUTH\_SERVER\_URL: The url of the authentication server that will be used to pass a user name and return a password.

+ OAuth2 Service

 OAUTH2\_SERVER\_URL: The url of the OAuth2 server that can satify a userInfo request.
  
### Avoiding Duplicate Records 

The underlying MongoDB database does a good job of avoiding duplicates if you are depending on the GUID attached to reach record.  Real Estate listings are coded, but not with a GUID approach.  A listing database relies on a different "key".  In the case of this server, listing records have a key of "ListingId".  Since the key being used is not GUID, there are special mechanisms used to control duplicates.

The first approach to avoid duplicates is to create an index that enforces uniqueness.  In order to use this approach, set the configuration EXTERNAL\_INDEX to "false".  This approach takes advantage of the built-in capabilites of MongoDB.

An alternative to preventing duplicates with a MongoDB index is to create an index in-memory.  Upon startup, the database is scaned an an in-memory index is created.   In order to use this approach, set the configuration EXTERNAL\_INDEX to "true". Although this approach performes better than the MongoDB index approach, manipulation of the database (from the command line for instance) will corrupt the in-memory index.


### License

>The MIT License (MIT)
>
>Copyright (c) 2014 National Association of REALTORS
>
>Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
>The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
:
>THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


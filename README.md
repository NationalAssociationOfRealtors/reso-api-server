
reso-api-server
=======

The RESO API Server provides a basic server.

### Operation

The RESO API Server can be run from the command line using a file created to customize operation.  Please follow the procedure outlined in the **Configuration** section to create the configuration file.

### Setup

The following procedure should be followed to setup the server:

+ Install server using NPM:

```
npm install reso-api-server
```

+ Create metadata directory (optional):

```
mkdir metadata
cd metadata
cp ../node_modules/reso-api-server/samples/reso_1_2.js .
```

+ Create a configuration file or use the sample file supplied by the distribution:

```
cd ..
cp ./node_modules/reso-api-server/samples/server.conf .
```

+ Configure the server using the guide below in the **Configuration** section.

+ Create an execution javascript file for node.js or use the test file supplied by the distribution:

```
cp ./node_modules/reso-api-server/test.js .
```

+ Run the server:

```
node test.js
```

### Configuration

A text configuration file should be located in the root directory of your project.  The default name of the file is "service.conf", but this name can be overriden when calling the resoServer() method.  A sample of the configuration file called "service.conf" can be found in the samples directory of this distribution.

RESO updates the RESO Data Dictionary periodically. A copy of the latest known RESO Data Dictionary is included in the samples directory, but you should check with the stnandards group for the latest copy.  

+ API Service (data supplier parameters)

 COMPRESSION: A boolean value that controls whether requested information is compressed.  Compressed is much smaller than normal data but requires more server resources to generate.  If the parameter is set to "true", them data will be compressed if requested.

 SERVER_DOMAIN: The dns name of the computer that will be running the RESO API Server.

 SERVER_NAME: The name to display in the console at startup.  Useful for private labelling.

 SERVER_PATH: The path of the RESO API service.

 SERVER_PORT: The port that the RESO API Server will be listening on.

 SERVER_PROTOCOL: The protocol that the RESO API Server is using.  Valid values are "http" or "https".

+ Data Processing 

 EXTERNAL_INDEX: A boolean value that indicates whether an external index (recommended) is being used to enfoce uniqueness or the underlying MongoDB database indexing will be used.

 LOG_ENTRY: A boolean value that indicates whether a console log message is generated each time a request is processed.

 METADATA_DEFINITION: The path to the file for the JSON formatted OData definition file that contains RESO Data Dictionary definitions.  If this parameter is not included, the server will try to look for the package "reso-data-dictionary" which should be included from your root project directory.

 RESPONSE_LIMIT: The maximum number of objects that can be retrieved at one time.  Defaults to 100.

+ HTTPS Certificates 

 CA_CERTIFICATE: The path to the file that contains a Certificate Authority (CA) certficate.  This value is only required if the SERVER_PROTOCOL is "https".

 SERVER_CERTIFICATE: The path to the file that contains the server's certficate.  This value is only required if the SERVER_PROTOCOL is "https".

 SERVER_KEY: The path to the file that contains the server's secret key.  This value is only required if the SERVER_PROTOCOL is "https".

+ Authentication 

 AUTH_REALM: The text to use for realm if using Digest Authentication. If this parameter is not included, the realm will default to the string in the SERVER_NAME parameter. This value is only required if the AUTH_TYPE is "Digest". 
  
 AUTH_TYPE: The type of authentication supported by the RESO API Server.  Valid values are "Basic" and "Digest".

  
### Avoiding Duplicate Records 

The underlying MongoDB database does a good job of avoiding duplicates if you are depending on the GUID attached to reach record.  Real Estate listings are coded, but not with a GUID approach.  A listing database relies on a different "key".  In the case of this server, listing records have a key of "ListingId".  Since the key being used is not GUID, there  re special mechanisms used to control duplicates.

The first approach to avoid duplicates is to create an index that enforces uniquenes.  In order to use this approach, set the configuration EXTERNAL_INDEX to "false".  This approach takes advantage of the built-in capabilites of MongoDB.

An alternative to preventing duplicates with a MongoDB index is to create an index in-memory.  Upon startup, the database is scaned an an in-memory index is created.   In order to use this approach, set the configuration EXTERNAL_INDEX to "true". Although this approach performes better than the MongoDB index approach, manipulation of the database (from the command line for instance) will corrupt the in-memory index.


### License

>The MIT License (MIT)
>
>Copyright (c) 2014 National Association of REALTORS
>
>Permission is hereby granted, free of charge, to any person obtaining a copy
>of this software and associated documentation files (the "Software"), to deal
>in the Software without restriction, including without limitation the rights
>to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
>copies of the Software, and to permit persons to whom the Software is
>furnished to do so, subject to the following conditions:
>
>The above copyright notice and this permission notice shall be included in
>all copies or substantial portions of the Software.
>
>THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
>IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
>FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
>AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
>LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
>OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
>THE SOFTWARE.



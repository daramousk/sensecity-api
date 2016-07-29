#! /bin/sh
cd /opt/sensecity-api-develop/;node /opt/sensecity-api-develop/server.js >> /var/log/sensecityapi.log 2>&1 &
cd /opt/bugzillaAPI_develop/;node /opt/bugzillaAPI_develop/server.js >> /var/log/sensecity_bugzillaAPI.log 2>&1
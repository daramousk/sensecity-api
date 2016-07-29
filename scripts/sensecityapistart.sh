#! /bin/sh
cd /opt/sensecity-api/;node /opt/sensecity-api/server.js >> /var/log/sensecityapi.log 2>&1 &
cd /opt/bugzillaAPI/;node server.js >> /var/log/sensecity_bugzillaAPI.log 2>&1cd ../

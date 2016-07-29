#! /bin/sh
cd /opt/sensecity-api/;node /opt/sensecity-api/server.js >> /var/log/sensecityapi.log 2>&1 &
cd /opt/bugzillaAPI/;node /opt/bugzillaAPI/server.js >> /var/log/sensecity_bugzillaAPI.log 2>&1
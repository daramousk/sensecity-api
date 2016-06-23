#! /bin/sh
nodemon /opt/sensecity-api/server.js >> /var/log/sensecityapi.log 2>&1 &
nodemon /opt/bugzillaAPI/server.js >> /var/log/sensecity_bugzillaAPI.log 2>&1

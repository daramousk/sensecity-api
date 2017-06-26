// Dependencies
var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var fs = require('fs');
var request = require('request');
var nodemailer = require('nodemailer');
var querystring = require('querystring');
var crypto = require('crypto-js');
//var xml = require('xml');

var base64 = require('base-64');

var config = require('app-config');

var morgan = require('morgan');
var app = express();

var resizeCrop = require('resize-crop');
var file_exitst = require('exists-file');

app.use(morgan('combined'));

mongoose.connect('mongodb://' + config.config.my_hostname + '/' + config.config.database);

// Models
var Issue = require('../models/issue');
var act_User = require('../models/active_user');
var act_email = require('../models/activate_email');
var act_mobile = require('../models/activate_mobile');
var Role = require('../models/roles.js');
var Municipality = require('../models/municipality');
var cityPolicy = require('../models/citypolicy');


// Routes
//Issue.methods(['get', 'put', 'post', 'delete']);
//Issue.register(router, '/issues');

var bugUrlRest=config.config.bugUrlRest;

//Authorization middleware
function authorization(req, res, next) {

	
    Role.find({uuid: req.get('x-uuid')}, function (err, response) {
        if (response.length > 0 && response[0]["timestamp"] >= Date.now()) {
            var mypath = req.path;
            
            if (mypath.indexOf("admin") != -1){ //req.path === '/admin/bugs/search' || req.path === '/admin/bugs/update' || req.path === '/admin/bugs/comment' || req.path === '/admin/bugs/comment/tags' || req.path === '/admin/bugs/comment/add') {
                if (req.get('x-role') === 'departmentAdmin' || req.get('x-role') === 'sensecityAdmin' || req.get('x-role') === 'departmentUser' || req.get('x-role') === 'cityAdmin') {
                    next();
                } else {
                    res.send("failure");
                }
            } else {
                res.send("failure");
            }
        } else {
            res.send("failure");
        }
    });
}

function authentication(req, res, next) {

    if (req.get('x-uuid') != undefined) {
        Role.find({ uuid: req.get('x-uuid') }, function (err, response) {
            //response[0]["mongo"]

            if (response.length > 0 && response[0]["timestamp"] >= Date.now()) {
                next();
            } else {
                res.send("failure");
            }
        });
    } else {
        res.send("failure1");
    }
}

//Bugzilla login
var bugUrl = config.config.bugUrl;

var loginData1 = "?login=" + config.config.login + "&password=" + config.config.pwd;

var bugToken = "";
request({
    url: bugUrlRest + "/rest/login" + loginData1,
    method: "GET"
}, function (error, response, body) {

   
    var body_variable = JSON.parse(body);

    if (!error && response.statusCode === 200) {
        bugToken = body_variable.token;

        console.log("Login in bugzilla as: " + config.config.login);
        console.log("And assigned token: " + body_variable.token);
    } else {
        console.log("error: " + error);
        console.log("response.statusCode: " + response.statusCode);
        console.log("response.statusText: " + response.statusText);
    }
});

router.get('/image_issue', function (req, res) {

    var bugParams1 = "?bug_id=" + req.query.bug_id + "&include_fields=id,alias";    
    request({
        url: bugUrlRest + "/rest/bug" + bugParams1,
        method: "GET"
    }, function (error, response, body) {
        if (JSON.parse(response.body).bugs != undefined) {
            var img_alias = JSON.parse(response.body).bugs[0].alias[0];
            file_exitst(config.config.img_path + "original/" + img_alias + "_0.png", function (err, resp) {
                if (resp) {
                    if (req.query.resolution == "full") {
                        res.type('png').sendFile(config.config.img_path + "original/" + img_alias + "_0.png");
                    } else if (req.query.resolution == "medium") {
                        res.type('png').sendFile(config.config.img_path + "medium/" + img_alias + "_0_450x450.png");
                    } else if (req.query.resolution == "small") {
                        res.type('png').sendFile(config.config.img_path + "small/" + img_alias + "_0_144x144.png");
                    } else {
                        res.status(404).send('Not found');
                    }
                }
                else {
                    res.status(404).send('Not found');
                }
            });                  
        }
        else {
            res.status(404).send('Not found');
        }
    });
    
});

router.post('/image_issue', function (req, res) {

    if (req.body.mobile_num != undefined) {
        var _mobile_num = '';
        var _email_user = '';

        if (req.body.mobile_num != undefined) {
            _mobile_num = req.body.mobile_num;
        }

        if (req.body.email_user != undefined) {
            _email_user = req.body.email_user;
        }

        // Start Check The logic send email - sms mandatory

        Municipality.find({ boundaries: { $geoIntersects: { $geometry: { "type": "Point", "coordinates": [req.body.loc.coordinates[0], req.body.loc.coordinates[1]] } } } }, { "municipality": 1, "sms_key_fibair": 1, "mandatory_sms": 1, "mandatory_email": 1 }, function (req1, res1) {
            var _res1 = JSON.stringify(res1);

            if (JSON.parse(_res1)[0].mandatory_email == true && _email_user == '') {
                //Forbidden
                res.status(403).send([{ "error_msg": "Required_email" }]);
            }

            if (JSON.parse(_res1)[0].mandatory_sms == true && _mobile_num == '') {
                res.status(403).send([{ "error_msg": "Required_sms" }]);
            }
        });

        // end Check The logic send email - sms mandatory
    }

    var anonymous_status = "true";

    var return_var;
    var city_name = '';
    var city_address = '';

    if (req.body.hasOwnProperty('city_address')) {
        city_address = req.body.city_address;
    }

    if (city_address == '') {
        //console.log("https://maps.googleapis.com/maps/api/geocode/json?latlng=" + req.body.loc.coordinates[1] + "," + req.body.loc.coordinates[0] + "&language=el&key=" + config.config.key_geocoding);
        request({
            url: "https://maps.googleapis.com/maps/api/geocode/json?latlng=" + req.body.loc.coordinates[1] + "," + req.body.loc.coordinates[0] + "&language=el&key=" + config.config.key_geocoding,
            method: "GET"
        }, function (error, response) {

            if (JSON.parse(response.body).status == "OK") {
                city_address = JSON.parse(response.body).results[0].formatted_address;
            } else {
                city_address = "N/A";
            }

            if (!req.body.hasOwnProperty('issue') ||
                !req.body.hasOwnProperty('loc') ||
                !req.body.hasOwnProperty('value_desc') ||
                !req.body.hasOwnProperty('device_id')) {
                res.statusCode = 403;
                return res.send({ "message": "Forbidden" });
            } else {

                Municipality.find({
                    boundaries:
                    {
                        $geoIntersects:
                        {
                            $geometry: {
                                "type": "Point",
                                "coordinates": req.body.loc.coordinates
                            }
                        }
                    }
                }, function (err, response) {

                    var entry = new Issue({
                        loc: { type: 'Point', coordinates: req.body.loc.coordinates },
                        issue: req.body.issue,
                        device_id: req.body.device_id,
                        value_desc: req.body.value_desc,
                        comments: req.body.comments,
                        city_address: city_address
                    });


                   // entry.image_name = '';

                    var has_img = 0;
                    if (req.body.image_name.indexOf("base64") !== -1) {
                        has_img = 1;
                    }
                    if (response.length > 0) {

                        entry.municipality = response[0]["municipality"];

                        city_name = response[0].municipality_desc;
                    } else {
                        entry.municipality = '';
                        city_name = '';
                    }
                    entry.save(function (err1, resp) {
                        if (err1) {
                            console.log(err1);
                        } else {

                            if (has_img == 1) {
                                var base64img = req.body.image_name;
                                var base64Data = base64img.split(",");


                                var default_img_id = 0;
                                var source_img_file = config.config.img_path;

                                require("fs").writeFile(source_img_file + "original/" + resp._id + "_" + default_img_id + ".png", base64Data[1], 'base64', function (err) {
                                    console.log(err);

                                    resizeCrop({
                                        src: source_img_file + "original/" + resp._id + "_" + default_img_id + ".png",
                                        dest: source_img_file + "small/" + resp._id + "_" + default_img_id + "_144x144.png",
                                        height: 144,
                                        width: 144,
                                        gravity: "center"
                                    }, function (err, filePath) {
                                        // do something 
                                        console.log(err);
                                    });


                                    resizeCrop({
                                        src: source_img_file + "original/" + resp._id + "_" + default_img_id + ".png",
                                        dest: source_img_file + "medium/" + resp._id + "_" + default_img_id + "_450x450.png",
                                        height: 450,
                                        width: 450,
                                        gravity: "center"
                                    }, function (err, filePath) {
                                        // do something 
                                        console.log(err);
                                    });

                                });

                                if (resp.issue == "garbage" || resp.issue == "road-constructor" || resp.issue == "lighting" || resp.issue == "plumbing" || resp.issue == "protection-policy" || resp.issue == "green" || resp.issue == "environment") {
                                    if (response.length > 0) {

                                        var bugData1 = { "token": bugToken, "summary": resp.issue, "priority": "normal", "bug_severity": "normal", "cf_city_name": city_name, "alias": [resp._id.toString()], "url": resp.value_desc, "product": response[0]["municipality"], "component": config.config.bug_component, "version": "unspecified", "cf_city_address": city_address };

                                        request({
                                            url: bugUrlRest + "/rest/bug",
                                            method: "POST",
                                            json: bugData1
                                        }, function (error, bugResponse, body) {
                                            console.log("1");
                                            console.log(JSON.stringify(bugResponse));
                                            if (error != null) { console.log(error) };

                                            if (!error && bugResponse.statusCode === 200) {
                                                // console.log(body);
                                            } else {
                                                console.log("error: " + error);
                                                console.log("bugResponse.statusCode: " + bugResponse.statusCode);
                                                console.log("bugResponse.statusText: " + bugResponse.statusText);
                                            }
                                        });
                                    }
                                }

                            }
                        }
                        return_var = { "_id": resp._id };

                        if (resp.issue == "garbage" || resp.issue == "road-constructor" || resp.issue == "lighting" || resp.issue == "plumbing" || resp.issue == "protection-policy" || resp.issue == "green" || resp.issue == "environment") {
                            if (response.length > 0) {

                                var bugData1 = { "token": bugToken, "summary": resp.issue, "priority": "normal", "bug_severity": "normal", "cf_city_name": city_name, "alias": [resp._id.toString()], "url": resp.value_desc, "product": response[0]["municipality"], "component": config.config.bug_component, "version": "unspecified", "cf_city_address": city_address };


                                //console.log(bugData1);

                                request({
                                    url: bugUrlRest + "/rest/bug",
                                    method: "POST",
                                    json: bugData1
                                }, function (error, bugResponse, body) {
                                    console.log("2");
                                    console.log(JSON.stringify(bugResponse));
                                    if (error != null) { console.log(error) };

                                    if (!error && bugResponse.statusCode === 200) {
                                        // console.log(body);
                                    } else {
                                        console.log("error: " + error);
                                        console.log("bugResponse.statusCode: " + bugResponse.statusCode);
                                        console.log("bugResponse.statusText: " + bugResponse.statusText);
                                    }
                                });
                            }
                        }


                        //console.log(resp._id);




                        res.send(return_var);
                    });
                });
            }








        });
    }


    

});



//POST router
router.post('/issue', function (req, res) {    
/**/
    console.log('Ini');

    if (req.body.mobile_num != undefined) {
        var _mobile_num = '';
        var _email_user = '';

        if (req.body.mobile_num != undefined) {
            _mobile_num = req.body.mobile_num;
        }

        if (req.body.email_user != undefined) {
            _email_user = req.body.email_user;
        }

        // Start Check The logic send email - sms mandatory

        Municipality.find({ boundaries: { $geoIntersects: { $geometry: { "type": "Point", "coordinates": [req.body.loc.coordinates[0], req.body.loc.coordinates[1]] } } } }, { "municipality": 1, "sms_key_fibair": 1, "mandatory_sms": 1, "mandatory_email": 1 }, function (req1, res1) {
            var _res1 = JSON.stringify(res1);

            if (JSON.parse(_res1)[0].mandatory_email == true && _email_user == '') {
                //Forbidden
                res.status(403).send([{ "error_msg": "Required_email" }]);
            }

            if (JSON.parse(_res1)[0].mandatory_sms == true && _mobile_num == '') {
                res.status(403).send([{ "error_msg": "Required_sms" }]);
            }
        });

        // end Check The logic send email - sms mandatory
    }

    var anonymous_status = "true";

    var return_var;
    var city_name = '';
    var city_address = '';

    console.log(req);

    if (req.body.hasOwnProperty('city_address')) {
        city_address = req.body.city_address;
    }


    console.log("city_address" + city_address);

   // if (city_address == '') {
        //console.log("https://maps.googleapis.com/maps/api/geocode/json?latlng=" + req.body.loc.coordinates[1] + "," + req.body.loc.coordinates[0] + "&language=el&key=" + config.config.key_geocoding);
        /*request({
            url: "https://maps.googleapis.com/maps/api/geocode/json?latlng=" + req.body.loc.coordinates[1] + "," + req.body.loc.coordinates[0] + "&language=el&key=" + config.config.key_geocoding,
            method: "GET"
        }, function (error, response) {*/
            //console.log(JSON.stringify(response));
            /*if (JSON.parse(response.body).status == "OK") {
                city_address = JSON.parse(response.body).results[0].formatted_address;
            } else {
                city_address = "N/A";
            }*/

            if (!req.body.hasOwnProperty('issue') ||
                !req.body.hasOwnProperty('loc') ||
                !req.body.hasOwnProperty('value_desc') ||
                !req.body.hasOwnProperty('device_id')) {
                res.statusCode = 403;
                return res.send({ "message": "Forbidden" });
            } else {

                Municipality.find({
                    boundaries:
                    {
                        $geoIntersects:
                        {
                            $geometry: {
                                "type": "Point",
                                "coordinates": req.body.loc.coordinates
                            }
                        }
                    }
                }, function (err, response) {

                    var entry = new Issue({
                        loc: { type: 'Point', coordinates: req.body.loc.coordinates },
                        issue: req.body.issue,
                        device_id: req.body.device_id,
                        value_desc: req.body.value_desc,
                        comments: req.body.comments,
                        city_address: city_address
                    });


                    entry.image_name = '';

                    var has_img = 0;
                    if (req.body.image_name.indexOf("base64") !== -1) {
                        has_img = 1;
                    }
                    if (response.length > 0) {

                        entry.municipality = response[0]["municipality"];

                        city_name = response[0].municipality_desc;
                    } else {
                        entry.municipality = '';
                        city_name = '';
                    }
                    entry.save(function (err1, resp) {
                        if (err1) {
                            console.log(err1);
                        } else {

                            if (has_img == 1) {
                                var base64img = req.body.image_name;
                                var base64Data = base64img.split(",");

                                var default_img_id = 0;
                                var source_img_file = config.config.img_path;

                                require("fs").writeFile(source_img_file + "original/" + resp._id + "_" + default_img_id + ".png", base64Data[1], 'base64', function (err) {
                                    console.log(err);

                                    resizeCrop({
                                        src: source_img_file + "original/" + resp._id + "_" + default_img_id + ".png",
                                        dest: source_img_file + "small/" + resp._id + "_" + default_img_id + "_144x144.png",
                                        height: 144,
                                        width: 144,
                                        gravity: "center"
                                    }, function (err, filePath) {
                                        // do something 
                                        console.log(err);
                                    });


                                    resizeCrop({
                                        src: source_img_file + "original/" + resp._id + "_" + default_img_id + ".png",
                                        dest: source_img_file + "medium/" + resp._id + "_" + default_img_id + "_450x450.png",
                                        height: 450,
                                        width: 450,
                                        gravity: "center"
                                    }, function (err, filePath) {
                                        // do something 
                                        console.log(err);
                                    });

                                });

                                if (resp.issue == "garbage" || resp.issue == "road-constructor" || resp.issue == "lighting" || resp.issue == "plumbing" || resp.issue == "protection-policy" || resp.issue == "green" || resp.issue == "environment") {
                                    if (response.length > 0) {
                                        console.log("- - - - - - - - - - - - - - - - - - - - - - - - -");
                                        console.log("- - - - - - - - - - - - - - - - - - - - - - - - -");

                                        console.log(resp._id);

                                        console.log("- - - - - - - - - - - - - - - - - - - - - - - - -");
                                        console.log("- - - - - - - - - - - - - - - - - - - - - - - - -");

                                        var bugData1 = { "token": bugToken, "summary": resp.issue, "priority": "normal", "bug_severity": "normal", "cf_city_name": city_name, "alias": [resp._id.toString()], "url": resp.value_desc, "product": response[0]["municipality"], "component": config.config.bug_component, "version": "unspecified", "cf_city_address": city_address };

                                        console.log('"token":' + bugToken + ', "summary": ' + resp.issue + ', "priority": "normal", "bug_severity": "normal", "cf_city_name":' + city_name + ', "alias":' + [resp._id.toString()] + ', "url":' + resp.value_desc + ', "product":' + response[0]["municipality"] + ', "component":' + config.config.bug_component + ', "version": "unspecified", "cf_city_address":' + city_address);

                                        request({
                                            url: bugUrlRest + "/rest/bug",
                                            method: "POST",
                                            json: bugData1
                                        }, function (error, bugResponse, body) {
                                            console.log("3--");
                                            console.log(JSON.stringify(bugResponse));
                                            if (error != null) { console.log(error) };

                                            if (!error && bugResponse.statusCode === 200) {
                                                // console.log(body);
                                                //return_var = { "_id": resp._id };
                                                res.send({ "_id": resp._id });
                                            } else {
                                                console.log("error: " + error);
                                                console.log("bugResponse.statusCode: " + bugResponse.statusCode);
                                                console.log("bugResponse.statusText: " + bugResponse.statusText);
                                            }
                                        });
                                    }
                                }


                                
                            } else {

                                if (resp.issue == "garbage" || resp.issue == "road-constructor" || resp.issue == "lighting" || resp.issue == "plumbing" || resp.issue == "protection-policy" || resp.issue == "green" || resp.issue == "environment") {
                                    if (response.length > 0) {

                                        var bugData1 = { "token": bugToken, "summary": resp.issue, "priority": "normal", "bug_severity": "normal", "cf_city_name": city_name, "alias": [resp._id.toString()], "url": resp.value_desc, "product": response[0]["municipality"], "component": config.config.bug_component, "version": "unspecified", "cf_city_address": city_address };


                                        //console.log(bugData1);

                                        request({
                                            url: bugUrlRest + "/rest/bug",
                                            method: "POST",
                                            json: bugData1
                                        }, function (error, bugResponse, body) {
                                            console.log("4");
                                            console.log(JSON.stringify(bugResponse));
                                            if (error != null) { console.log(error) };

                                            if (!error && bugResponse.statusCode === 200) {
                                                // console.log(body);
                                                res.send({ "_id": resp._id });
                                            } else {
                                                console.log("error: " + error);
                                                console.log("bugResponse.statusCode: " + bugResponse.statusCode);
                                                console.log("bugResponse.statusText: " + bugResponse.statusText);
                                            }
                                        });
                                    }
                                }

                            }
                        }

                        //console.log(resp._id);




                        
                    });
                });
            }            
       // });
  //  }

    /**/

    /*


    if (req.body.mobile_num != undefined) {
        var _mobile_num = '';
        var _email_user = '';

        if (req.body.mobile_num != undefined) {
            _mobile_num = req.body.mobile_num;
        }

        if (req.body.email_user != undefined) {
            _email_user = req.body.email_user;
        }

        // Start Check The logic send email - sms mandatory
    
    Municipality.find({ boundaries: { $geoIntersects: { $geometry: { "type": "Point", "coordinates": [req.body.loc.coordinates[0], req.body.loc.coordinates[1]] } } } }, { "municipality": 1, "sms_key_fibair": 1, "mandatory_sms": 1, "mandatory_email": 1 }, function (req1, res1) {
        var _res1 = JSON.stringify(res1);
        
        if (JSON.parse(_res1)[0].mandatory_email == true && _email_user == '') {
            //Forbidden
            res.status(403).send([{"error_msg":"Required_email"}]);
        } 

        if (JSON.parse(_res1)[0].mandatory_sms == true && _mobile_num == '') {
            res.status(403).send([{ "error_msg": "Required_sms"}]);
        }        
    });

    // end Check The logic send email - sms mandatory
    }

    var anonymous_status = "true";

    var return_var;
	var city_name='';
    var city_address = '';

    if (req.body.hasOwnProperty('city_address')) {
        city_address = req.body.city_address;
    }

    if (city_address == '') {
       // https://maps.googleapis.com/maps/api/geocode/json?latlng=38.289835547083946,21.773357391357422&language=el&key=AIzaSyCHBdH6Zw1z3H6NOmAaTIG2TwIPTXUhnvM 
        console.log("https://maps.googleapis.com/maps/api/geocode/json?latlng=" + req.body.loc.coordinates[1] + "," + req.body.loc.coordinates[0] + "&language=el&key=" + config.config.key_geocoding);
        request({
            url: "https://maps.googleapis.com/maps/api/geocode/json?latlng=" + req.body.loc.coordinates[1] + "," + req.body.loc.coordinates[0]+"&language=el&key=" + config.config.key_geocoding,
            method: "GET"
        }, function (error, response) {
            console.log(JSON.stringify(response));
           // console.log("===================>"+JSON.parse(response.body).status);

            if (JSON.parse(response.body).status == "OK") {
                //console.log("============sdsad");
                city_address = JSON.parse(response.body).results[0].formatted_address;
            } else {
                city_address = "N/A";
            }
            
            if (!req.body.hasOwnProperty('issue') ||
                !req.body.hasOwnProperty('loc') ||
                !req.body.hasOwnProperty('value_desc') ||
                !req.body.hasOwnProperty('device_id')) {
                res.statusCode = 403;
                return res.send({ "message": "Forbidden" });
            } else {

                Municipality.find({
                    boundaries:
                    {
                        $geoIntersects:
                        {
                            $geometry: {
                                "type": "Point",
                                "coordinates": req.body.loc.coordinates
                            }
                        }
                    }
                }, function (err, response) {

                    var entry = new Issue({
                        loc: { type: 'Point', coordinates: req.body.loc.coordinates },
                        issue: req.body.issue,
                        device_id: req.body.device_id,
                        value_desc: req.body.value_desc,
                        comments: req.body.comments,
                        city_address: city_address
                    });


                    entry.image_name = req.body.image_name;

                    if (response.length > 0) {
                        entry.municipality = response[0]["municipality"];

                        city_name = response[0].municipality_desc;
                    } else {
                        entry.municipality = '';
                        city_name = '';
                    }
                    entry.save(function (err1, resp) {
                        if (err1) {
                            console.log(err1);
                        } else {
                            if (resp.issue == "garbage" || resp.issue == "road-constructor" || resp.issue == "lighting" || resp.issue == "plumbing" || resp.issue == "protection-policy" || resp.issue == "green" || resp.issue == "environment") {
                                if (response.length > 0) {

                                    var bugData1 = { "token": bugToken, "summary": resp.issue, "priority": "normal", "bug_severity": "normal", "cf_city_name": city_name, "alias": [resp._id.toString()], "url": resp.value_desc, "product": response[0]["municipality"], "component": config.config.bug_component, "version": "unspecified", "cf_city_address": city_address };
                            

                                    //console.log(bugData1);

                                    request({
                                        url: bugUrlRest + "/rest/bug",
                                        method: "POST",
                                        json: bugData1
                                    }, function (error, bugResponse, body) {
                                        //console.log(JSON.stringify(bugResponse));
                                        if (error != null) { console.log(error) };

                                        if (!error && bugResponse.statusCode === 200) {
                                            // console.log(body);
                                        } else {
                                            console.log("error: " + error);
                                            console.log("bugResponse.statusCode: " + bugResponse.statusCode);
                                            console.log("bugResponse.statusText: " + bugResponse.statusText);
                                        }
                                    });
                                }
                            }

                        }
                        return_var = { "_id": resp._id };
                        res.send(return_var);
                    });
                });
            }
            

        });
    }
    */
   
});

router.post('/issue/:id', function (req, res) {
    var bodyParams;
    console.log("- - - -  - - -  - - - - -  - - - - - -  - - - -  - - - -  - - - - -  -");
    console.log("is=====>" + req);
    console.log("- - - -  - - -  - - - - -  - - - - - -  - - - -  - - - -  - - - - -  -");
    Issue.find({ "_id": req.params.id }, { "municipality": 1, "issue": 1 }, function (req1, res1) {
        if (res1 != undefined) {
            //console.log("res1=====>" + res1);
            cityPolicy.find({
                "city": res1[0].municipality,
                "category": res1[0].issue
            }, { "anonymous": 1 }, function (req2, res2) {
                if (res2[0].anonymous == "true") {
                    ///* Update the issue with a specific id 
                    ///* Add cc list and move from default component to "ΤΜΗΜΑ ΕΠΙΛΥΣΗΣ ΠΡΟΒΛΗΜΑΤΩΝ" and Custom field values

                    bodyParams = { "token": bugToken, "ids": [body_parse.bugs[0].id], "component": "Τμήμα επίλυσης προβλημάτων", "reset_assigned_to": true, "cf_issues": resp.issue };

                    request({
                        url: bugUrlRest + "/rest/bug/" + req.params.id,
                        method: "PUT",
                        json: bodyParams
                    }, function (error1, response1, body1) {
                        //console.log(error1);
                        if (resp.comments === null || resp.comments === "") {
                            resp.comments = "undefined";
                        }

                        var bugComment1 = { "token": bugToken, "id": body_parse.bugs[0].id, "comment": resp.comments };


                        request({
                            url: bugUrlRest + "/rest/bug/" + body_parse.bugs[0].id + "/comment",
                            method: "POST",
                            json: bugComment1
                        }, function (error2, bugResponse2, body2) {
                            //console.log("Insert comments to bugzilla");

                            if (body2.id != null) {
                                request({
                                    url: bugUrlRest + "/rest/bug/comment/" + body2.id + "/tags",
                                    method: "PUT",
                                    json: { "add": ["DEPARTMENT:all", "STATUS:CONFIRMED"], "id": body2.id, "token": bugToken }
                                }, function (error4, response4, body4) {
                                    //console.log("Insert Tags to comment");
                                });
                            }
                        });

                        request({
                            url: "/rest/bug/" + body_parse.bugs[0].id + "/comment",
                            method: "GET"
                        }, function (error3, bugResponse3, body3) {

                        });

                    });


                } else {
                    Municipality.find({ "municipality": res1[0].municipality }, { "mandatory_sms": 1, "mandatory_email": 1 }, function (req4, res4) {

                        var result_ = JSON.stringify(res4);

                        if (JSON.parse(result_)[0].mandatory_sms == true) {
                            console.log('sms');
                        }
                        if (JSON.parse(result_)[0].mandatory_email == true) {
                            console.log('email');
                        }

                       // console.log("email ==================>>>>>>>>>>>>>>>>" + req.body.email);

                        if (req.body.uuid != '' && req.body.name != '') {
                            Issue.findOneAndUpdate({ "_id": req.params.id }, {
                                user: { uuid: req.body.uuid, name: req.body.name, email: req.body.email, phone: req.body.mobile_num }
                            }, function (err, resp) {
                                console.log("Update Issue with name,email & mobile num!");
                                var _resp = JSON.stringify(resp);

                                if (err)
                                    throw err;

                                ///* Create user acount to bugzilla			
                                var bugCreateuser1 = { "token": bugToken, "email": req.body.email.toString() };

                                request({
                                    url: bugUrlRest + "/rest/user",
                                    method: "POST",
                                    json: bugCreateuser1
                                }, function (error, response, body) {
                                    if (error) {
                                        console.log("User doesnot created! Error : " + error);
                                        return false;
                                    }
                                    console.log("User Created/already exist at bugzilla");

                                    ///* Find to bugzilla the issue and return the id
                                    var bugParams1 = "?alias=" + req.params.id + "&include_fields=id,alias";

                                    request({
                                        url: bugUrlRest + "/rest/bug" + bugParams1,
                                        method: "GET"
                                    }, function (error, response, body) {
                                        var body_parse = JSON.parse(body);

                                        // console.log("body" + body_parse.bugs[0].id);

                                        if (body_parse.bugs[0] != undefined) {

                                            ///* Update the issue with a specific id 
                                            ///* Add cc list and move from default component to "ΤΜΗΜΑ ΕΠΙΛΥΣΗΣ ΠΡΟΒΛΗΜΑΤΩΝ" and Custom field values
                                            bodyParams = { "token": bugToken, "ids": [body_parse.bugs[0].id], "component": "Τμήμα επίλυσης προβλημάτων", "cc": { "add": [req.body.email] }, "cf_creator": req.body.name, "cf_email": req.body.email, "cf_mobile": req.body.mobile_num, "reset_assigned_to": true, "cf_authedicated": 1, "cf_issues": resp.issue };

                                            request({
                                                url: bugUrlRest + "/rest/bug/" + req.params.id,
                                                method: "PUT",
                                                json: bodyParams
                                            }, function (error1, response1, body1) {

                                                console.log(error1);

                                                if (resp.comments === null || resp.comments === "") {

                                                    resp.comments = "undefined";
                                                }
                                                var bugComment1 = { "token": bugToken, "id": body_parse.bugs[0].id, "comment": resp.comments };

                                                request({
                                                    url: bugUrlRest + "/rest/bug/" + body_parse.bugs[0].id + "/comment",
                                                    method: "POST",
                                                    json: bugComment1
                                                }, function (error2, bugResponse2, body2) {

                                                    console.log("Insert comments to bugzilla");


                                                    if (body2.id != null) {
                                                        Municipality.find({ "municipality": JSON.parse(_resp).municipality }, { "sms_key_fibair": 1 }, function (req11, res11) {
                                                            //console.log(res11[0].sms_key_fibair);
                                                            var mob_sms_key_fibair_base64 = new Buffer(res11[0].sms_key_fibair + ":").toString("base64");

                                                            if (mob_sms_key_fibair_base64 != undefined) {

                                                                if (mob_sms_key_fibair_base64 != '') {

                                                                    if (req.body.mobile_num != '') {
                                                                        console.log("- - - - - - - - - - - - - - - - - - - - - - - - - - - - " );
                                                                        console.log("send sms");
                                                                        console.log("- - - - - - - - - - - - - - - - - - - - - - - - - - - - ");
                                                                        console.log("----------------------------");
                                                                        console.log("'sender':" + JSON.parse(_resp).municipality + ", 'recipients': '30'" + req.body.mobile_num + ", 'body':" + JSON.parse(_resp).municipality + "'.sense.city! ΤΟ ΑΙΤΗΜΑ ΣΑΣ ΚΑΤΑΧΩΡΗΘΗΚΕ ΣΤΟ ΔΗΜΟ ΜΕ ΚΩΔΙΚΟ '" + body_parse.bugs[0].id + "'. ΛΕΠΤΟΜΕΡΕΙΕΣ: http://'" + JSON.parse(_resp).municipality + "'.sense.city/bugid.html?issue='" + body_parse.bugs[0].id);
                                                                        console.log("- - - - - - - - - - - - - - - - - - - - - - - - - - - - ");
                                                                        console.log("- - - - - - - - - - - - - - - - - - - - - - - - - - - - ");
                                                                        request({
                                                                            url: "https://api.theansr.com/v1/sms",
                                                                            method: "POST",
                                                                            form: { 'sender': JSON.parse(_resp).municipality, 'recipients': '30' + req.body.mobile_num, 'body': JSON.parse(_resp).municipality + '.sense.city! ΤΟ ΑΙΤΗΜΑ ΣΑΣ ΚΑΤΑΧΩΡΗΘΗΚΕ ΣΤΟ ΔΗΜΟ ΜΕ ΚΩΔΙΚΟ ' + body_parse.bugs[0].id + '. ΛΕΠΤΟΜΕΡΕΙΕΣ: http://' + JSON.parse(_resp).municipality + '.sense.city/bugid.html?issue=' + body_parse.bugs[0].id },
                                                                            headers: { "Authorization": 'Basic ' + mob_sms_key_fibair_base64, 'content-type': 'application/form-data' }
                                                                        }, function (err, response) {
                                                                            //console.log(response);
                                                                            //if call_id
                                                                        });

                                                                    }
                                                                }
                                                            }
                                                        });

                                                        request({
                                                            url: bugUrlRest + "/rest/bug/comment/" + body2.id + "/tags",
                                                            method: "PUT",
                                                            json: { "add": ["DEPARTMENT:all", "STATUS:CONFIRMED"], "id": body2.id, "token": bugToken }
                                                        }, function (error4, response4, body4) {

                                                            console.log("Insert Tags to comment");

                                                        });
                                                    }
                                                });

                                                request({
                                                    url: "/rest/bug/" + body_parse.bugs[0].id + "/comment",
                                                    method: "GET"
                                                }, function (error3, bugResponse3, body3) {

                                                });
                                            });


                                        }

                                    });

                                });


                                res.send({ "description": "ok" });

                            });
                        } else {
                            res.send({ "description": "no-update" });
                        }
                    });
                }
            });
        } else {

            res.send({ "description": "no-update" });
        }
    });

    

});

/* ** Test ** */

router.get('/issue', function (req, res) {

    req.send_user = 0;
    req.send_component = 1;
    req.send_severity = 0;
    req.send_priority = 0;
    

    get_issues(req, function (result) {
        //console.log(result);
        res.send(result);
    });

});

router.get('/admin/issue', authentication, function (req, res) {

    req.send_user = 1;
    req.send_component = 1;
    req.send_severity = 1;
    req.send_priority = 1;


    console.log(req);


    var _city_department = '';
    var _city_department_count = '';
    Role.find({ "uuid": req.headers['x-uuid'], "role": req.headers['x-role'] }, { "city": 1, "departments": 1 }, function (error, resp) {
    var bugParams = '';
    var depart_ini = '';
    console.log(resp);

    if (resp != undefined) {
        if (resp[0].departments.length > 1) {
            for (var i = 0; i < resp[0].departments.length; i++) {
                if (i > 0) {
                    _city_department += "&";
                }

                _city_department_count = resp[0].departments[i].department;
                _city_department += "f" + (4 + i) + "=component&o" + (4 + i) + "=equals&v" + (4 + i) + "=" + encodeURIComponent(_city_department_count);
            }
            _city_department += "&j3=OR&f3=OP&f" + (i + 4) + "=CP";
        } else if (resp[0].departments.length == 1 && resp[0].departments[0].department == undefined) {
            _city_department = "f4=component&o4=equals&v4=" + encodeURIComponent("Τμήμα επίλυσης προβλημάτων");
            depart_ini = 'Τμήμα επίλυσης προβλημάτων';
        } else {
            _city_department_count = resp[0].departments[0].department;
            _city_department = "f4=component&o4=equals&v4=" + encodeURIComponent(_city_department_count);
        }
    }
        
        if (req.query.bug_id != undefined) {
            if (depart_ini == 'Τμήμα επίλυσης προβλημάτων') {
                 bugParams = "?f2=bug_id&o2=equals&v2=" + req.query.bug_id + "&f3=product&o3=equals&v3=" + resp[0].city + "&include_fields=id,alias,status,component";
            } else {
                 bugParams = "?" + _city_department + "&f1=bug_id&o1=equals&v1=" + req.query.bug_id + "&f2=product&o2=equals&v2=" + resp[0].city + "&include_fields=id,alias,status,component";
            }
            //var bugParams = "?f2=bug_id&o2=equals&v2=" + req.query.bug_id + "&f3=product&o3=equals&v3=" + resp[0].city + "&include_fields=id,alias,status,component";
        } else {
            if (depart_ini == 'Τμήμα επίλυσης προβλημάτων') {
                 bugParams = "?f3=product&o3=equals&v3=" + resp[0].city + "&include_fields=id,alias,status,component";
            } else {
                 bugParams = "?" + _city_department + "&f1=product&o1=equals&v1=" + resp[0].city + "&include_fields=id,alias,status,component";
            }
            
        }
     
        request({
            url: bugUrlRest + "/rest/bug" + bugParams,//bugParams,
            method: "GET"
        }, function (error1, response, body) {     
            console.log("- - - -  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -");
            console.log(JSON.stringify(response));
            console.log("- - - -  - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -");
            if (JSON.parse(body).bugs != undefined) {
                if (JSON.parse(body).bugs.length > 0) {
                    var _component_dep = JSON.parse(body).bugs[0].component

                    _component_dep = encodeURIComponent(_component_dep);
                    if (_city_department.indexOf(_component_dep) > -1 || depart_ini == 'Τμήμα επίλυσης προβλημάτων') {
                        get_issues(req, function (result) {
                            res.send(result);
                        });
                    }
                    else {
                        res.status(403).send('Forbidden');
                    }
                } else {
                    res.send([]);
                }
            } else {
                res.status(403).send('Forbidden');
            } 
        });
    });
});

var get_issues = function (req, callback) {

    var _bug_extra="";
    var _user_extra = 0;

    if (req.send_user == 1) {
        _user_extra = 1;
    } else {
        _user_extra = 0;
    }
    
    if (req.send_component == 1) {
        _bug_extra += ",component";
    } else {
        _bug_extra += "";
    }

    if (req.send_severity == 1) {
        _bug_extra += ",priority";
    } else {
        _bug_extra += "";
    }

    if (req.send_priority == 1) {
        _bug_extra += ",severity";
    } else {
        _bug_extra += "";
    }

    var x_uuid = req.get('x-uuid');
    if ((req.query.hasOwnProperty("bug_id") || req.query.hasOwnProperty("mobile") || req.query.hasOwnProperty("email"))) {        
        if (req.query.bug_id == "" && req.query.mobile == "" && req.query.email == "") {
            callback([]);
        } else {
            var _bug_id;
            var _mobile;
            var _email;
            var _limit;
            var _sort;
            var _offset;
            var _image;



            if (req.query.hasOwnProperty("bug_id")) {
                _bug_id = req.query.bug_id;
            }


            if (req.query.hasOwnProperty("mobile")) {
                _mobile = req.query.mobile;
            }

            if (req.query.hasOwnProperty("email")) {
                _email = req.query.email;
            }

            if (!req.query.hasOwnProperty('limit')) {
                _limit = 1000;
            } else {
                _limit = req.query.limit;
            }

            if (!req.query.hasOwnProperty('sort')) {
                _sort = "&order=bug_id%20DESC";
                _sort_mongo = -1;
            } else {
                if (req.query.sort == 1) {
                    _sort = "&order=bug_id%20ASC";
                    _sort_mongo = 1;
                } else if (req.query.sort == -1) {
                    _sort = "&order=bug_id%20DESC";
                    _sort_mongo = -1;
                }

            }

            if (!req.query.hasOwnProperty('offset')) {
                _offset = "";
            } else {
                _offset = "&offset=" + req.query.offset;
            }

            var bugParams1 = "?f1=bug_id&o1=equals&f2=cf_mobile&o2=equals&f3=cf_email&o3=equals&limit=" + _limit + _sort + _offset;

            if (_bug_id != undefined) {
                bugParams1 += "&v1=" + _bug_id;
            }
            if (_mobile != undefined) {
                bugParams1 += "&v2=" + _mobile;
            }
            if (_email != undefined) {
                bugParams1 += "&v3=" + _email;
            }

            bugParams1 += "&include_fields=id,alias,status,cf_authedicated,resolution,cf_city_address" + _bug_extra;
            if (!req.query.hasOwnProperty('image_field')) {
                _image = 0;
            } else {
                if (req.query.image_field == 0) {
                    _image = 0;
                } else {
                    _image = 1;
                }
            }
            
            var ids = [];
            var bugzilla_results = [];
            var issue_return = [];

            request({
                url: bugUrlRest + "/rest/bug" + bugParams1,
                method: "GET"
            }, function (error, response, body) {
                var i_count = 0;
                var bugs_length = 0;

                
                if (JSON.parse(body).bugs != undefined) {
                    bugs_length = JSON.parse(body).bugs.length;
                }                
                for (i_count = 0; i_count < bugs_length; i_count++) {                    
                    ids.push(JSON.parse(body).bugs[i_count].alias[0]);
                    bugzilla_results = JSON.parse(body).bugs;
                }

                if (_image == 0) {
                    if (_user_extra == 0) {
                        Issue.find({ "_id": { $in: ids } }, { "user": 0, "image_name": _image }, function (err, issue) {
                           
                            //new start
                            if (err != null) { console.log("err   =   " + err); }
                            issue_return += '[';
                            
                            for (var i = 0; i < issue.length; i++) {

                                var bug_id = 0;
                                var bug_status = "";
                                var bug_authenticate = "0";

                                var bug_component;
                                var bug_priority;
                                var bug_severity;
                                var bug_resolution;
                                var bug_address;

                                for (var j = 0; j < bugzilla_results.length; j++) {

                                    if (bugzilla_results[j].alias[0] == issue[i]._id) {
                                        bug_id = bugzilla_results[j].id;
                                        bug_status = bugzilla_results[j].status;
                                        bug_authenticate = bugzilla_results[j].cf_authedicated;

                                        if (bugzilla_results[j].component != undefined) {
                                            bug_component = bugzilla_results[j].component;
                                        }
                                        if (bugzilla_results[j].priority != undefined) {
                                            bug_priority = bugzilla_results[j].priority;
                                        }
                                        if (bugzilla_results[j].severity != undefined) {
                                            bug_severity = bugzilla_results[j].severity;
                                        }

                                        if (bugzilla_results[j].resolution != undefined) {
                                            bug_resolution = bugzilla_results[j].resolution;
                                        }

                                        if (bugzilla_results[j].cf_city_address != undefined) {
                                            bug_address = bugzilla_results[j].cf_city_address;
                                        }

                                    }
                                }

                                issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '","cf_authenticate":"' + bug_authenticate + '", "bug_component":"' + bug_component + '", "bug_priority":"' + bug_priority + '", "bug_severity":"' + bug_severity + '","resolution":"' + bug_resolution + '","bug_address":"' + bug_address + '"}'; 
                                if (i < issue.length - 1) {
                                    issue_return += ',';
                                }
                            }

                            issue_return += ']';

                            callback(issue_return);


                        }).sort({ "create_at": _sort_mongo });
                    } else {
                        Issue.find({ "_id": { $in: ids } }, { "image_name": _image }, function (err, issue) {
                           
                            //new start
                            if (err != null) { console.log("err   =   " + err); }
                            issue_return += '[';

                            for (var i = 0; i < issue.length; i++) {

                                var bug_id = 0;
                                var bug_status = "";
                                var bug_authenticate = "0";

                                var bug_component;
                                var bug_priority;
                                var bug_severity;
                                var bug_resolution;
                                var bug_address;

                                for (var j = 0; j < bugzilla_results.length; j++) {
                                    if (bugzilla_results[j].alias[0] == issue[i]._id) {
                                        bug_id = bugzilla_results[j].id;
                                        bug_status = bugzilla_results[j].status;
                                        bug_authenticate = bugzilla_results[j].cf_authedicated;

                                        if (bugzilla_results[j].component != undefined) {
                                            bug_component = bugzilla_results[j].component;
                                           // console.log("bug_component ====>" + bug_component);
                                        }
                                        if (bugzilla_results[j].priority != undefined) {
                                            bug_priority = bugzilla_results[j].priority;
                                        }
                                        if (bugzilla_results[j].severity != undefined) {
                                            bug_severity = bugzilla_results[j].severity;
                                        }

                                        if (bugzilla_results[j].resolution != undefined) {
                                            bug_resolution = bugzilla_results[j].resolution;
                                        }
                                        if (bugzilla_results[j].cf_city_address != undefined) {
                                            bug_address = bugzilla_results[j].cf_city_address;
                                        }

                                    }
                                }

                                issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '","cf_authenticate":"' + bug_authenticate + '", "bug_component":"' + bug_component + '", "bug_priority":"' + bug_priority + '", "bug_severity":"' + bug_severity + '","name":"' + issue[i].user.name + '","phone":"' + issue[i].user.phone + '","email":"' + issue[i].user.email + '","resolution":"' + bug_resolution + '","bug_address":"' + bug_address + '"}';
                                if (i < issue.length - 1) {
                                    issue_return += ',';
                                }
                            }

                            issue_return += ']';

                            callback(issue_return);


                        }).sort({ "create_at": _sort_mongo });
                    }
                }
                else {
                    if (_user_extra == 0) {
                        Issue.find({ "_id": { $in: ids } }, { "user": 0 }, function (err, issue) {                            
                            //new start
                            if (err != null) { console.log("err   =   " + err); }
                            
                            issue_return += '[';

                            for (var i = 0; i < issue.length; i++) {

                                var bug_id = 0;
                                var bug_status = "";
                                var bug_authenticate = "0";

                                var bug_component;
                                var bug_priority;
                                var bug_severity;
                                var bug_resolution;
                                var bug_address;

                                for (var j = 0; j < bugzilla_results.length; j++) {
                                    if (bugzilla_results[j].alias[0] == issue[i]._id) {
                                        bug_id = bugzilla_results[j].id;
                                        bug_status = bugzilla_results[j].status;
                                        bug_authenticate = bugzilla_results[j].cf_authedicated;

                                        if (bugzilla_results[j].component != undefined) {
                                            bug_component = bugzilla_results[j].component;
                                        }
                                        if (bugzilla_results[j].priority != undefined) {
                                            bug_priority = bugzilla_results[j].priority;
                                        }
                                        if (bugzilla_results[j].severity != undefined) {
                                            bug_severity = bugzilla_results[j].severity;
                                        }

                                        if (bugzilla_results[j].resolution != undefined) {
                                            bug_resolution = bugzilla_results[j].resolution;
                                        }
                                        if (bugzilla_results[j].cf_city_address != undefined) {
                                            bug_address = bugzilla_results[j].cf_city_address;
                                        }

                                    }
                                }

                                issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '","cf_authenticate":"' + bug_authenticate + '", "bug_component":"' + bug_component + '", "bug_priority":"' + bug_priority + '", "bug_severity":"' + bug_severity + '","bug_address":"' + bug_address + '"}';
                                if (i < issue.length - 1) {
                                    issue_return += ',';
                                }
                            }
                            issue_return += ']';
                            callback(issue_return);
                        }).sort({ "create_at": _sort_mongo });
                    }
                    else {
                        Issue.find({ "_id": { $in: ids } }, function (err, issue) {
                            //new start
                            if (err != null) { console.log("err   =   " + err); }
                            
                            issue_return += '[';
                            
                            for (var i = 0; i < issue.length; i++) {

                                var bug_id = 0;
                                var bug_status = "";
                                var bug_authenticate = "0";

                                var bug_component;
                                var bug_priority;
                                var bug_severity;
                                var bug_resolution;
                                var bug_address;

                                for (var j = 0; j < bugzilla_results.length; j++) {
                                    if (bugzilla_results[j].alias[0] == issue[i]._id) {
                                        bug_id = bugzilla_results[j].id;
                                        bug_status = bugzilla_results[j].status;
                                        bug_authenticate = bugzilla_results[j].cf_authedicated;

                                        if (bugzilla_results[j].component != undefined) {
                                            bug_component = bugzilla_results[j].component;
                                            //console.log("bug_component 2====>" + bug_component);
                                        }
                                        if (bugzilla_results[j].priority != undefined) {
                                            bug_priority = bugzilla_results[j].priority;
                                        }
                                        if (bugzilla_results[j].severity != undefined) {
                                            bug_severity = bugzilla_results[j].severity;
                                        }

                                        if (bugzilla_results[j].resolution != undefined) {
                                            bug_resolution = bugzilla_results[j].resolution;
                                        }

                                        if (bugzilla_results[j].cf_city_address != undefined) {
                                            bug_address = bugzilla_results[j].cf_city_address;
                                        }
                                    }
                                }
                                issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '","cf_authenticate":"' + bug_authenticate + '", "bug_component":"' + bug_component + '", "bug_priority":"' + bug_priority + '", "bug_severity":"' + bug_severity + '","name":"' + issue[i].user.name + '","phone":"' + issue[i].user.phone + '","email":"' + issue[i].user.email + '","resolution":"' + bug_resolution + '","bug_address":"' + bug_address + '"}';
                                if (i < issue.length - 1) {
                                    issue_return += ',';
                                }
                            }
                            issue_return += ']';
                            callback(issue_return);
                        }).sort({ "create_at": _sort_mongo });
                    }
                }
            });
        }
    }
    else if (!req.query.hasOwnProperty("bug_id") && !req.query.hasOwnProperty("mobile") && !req.query.hasOwnProperty("email") && req.query.hasOwnProperty("city")) {
    
        var _startdate = new Date();
        var _enddate = new Date();
        var _coordinates;
        var _distance;
        var _issue;
        var _limit;
        var _sort;
        var _loc_var;
        var newdate = new Date();
        var _image;
        var _list_issue;
        var _product;
        var _status = [];
        var _cf_authedicated = 1;
        var _cf_authedicated_contition = "equals";
        var _kml;
        var _offset;
        var _user = false;
        var _default_issue = "";
        var _departments;
        var _summary;
        var yyyy1;
        var yyyy2;
        var mm1;
        var mm2;
        var dd1;
        var dd2;
        var _resolution;

        if (!req.query.hasOwnProperty("city") && !req.query.hasOwnProperty("coordinates")) {
            res.send([{ "response": "no-data", "message": "You don't send city - coordinates values!" }]);
        }
        else {


            if (!req.query.hasOwnProperty('startdate')) {
                _startdate = new Date(_startdate) - 1000 * 60 * 60 * 24 * 3;

                _startdate = new Date(_startdate);

                yyyy1 = _startdate.getFullYear();
                if (_startdate.getMonth() < 9) {
                    mm1 = "0" + (_startdate.getMonth() + 1);
                } else {
                    mm1 = _startdate.getMonth() + 1;
                }
                if (_startdate.getDate() <= 9) {
                    dd1 = "0" + _startdate.getDate();
                } else {
                    dd1 = _startdate.getDate();
                }

                _startdate = yyyy1 + "-" + mm1 + "-" + dd1 + "T00:00:00.000";

            } else {
                var partsOfStr = req.query.startdate.split('-');
                _startdate = partsOfStr[0] + "-" + partsOfStr[1] + "-" + partsOfStr[2] + "T00:00:00.000";
            }

            if (req.query.hasOwnProperty('enddate')) {
                var partsOfStr = req.query.enddate.split('-');
                _enddate = partsOfStr[0] + "-" + partsOfStr[1] + "-" + partsOfStr[2] + "T23:59:59.999";
            } else {
                yyyy2 = _enddate.getFullYear();
                if (_enddate.getMonth() < 9) {
                    mm2 = "0" + (_enddate.getMonth() + 1);
                } else {
                    mm2 = _enddate.getMonth() + 1;
                }
                if (_enddate.getDate() <= 9) {
                    dd2 = "0" + _enddate.getDate();
                } else {
                    dd2 = _enddate.getDate();
                }

                _enddate = yyyy2 + "-" + mm2 + "-" + dd2 + "T23:59:59.999";

            }

            if (!req.query.hasOwnProperty('coordinates')) {
                _coordinates = '';
            } else {
                _coordinates = req.query.coordinates;
            }

            if (!req.query.hasOwnProperty('distance')) {
                _distance = '10000';
            } else {
                _distance = req.query.distance;
            }

            if (!req.query.hasOwnProperty('includeAnonymous')) {
                _cf_authedicated = 1;
                _cf_authedicated_contition = "equals";
            }
            else {
                if (req.query.includeAnonymous == 1) {
                    _cf_authedicated = 2;
                    _cf_authedicated_contition = "lessthan";
                    _default_issue = "---";
                } else {
                    _cf_authedicated = 1;
                    _cf_authedicated_contition = "equals";
                }

            }

            if (!req.query.hasOwnProperty('issue') || req.query.issue === 'all') {
                if (_default_issue == "---") {
                    _issue = "---,garbage,plumbing,lighting,road-constructor,green,protection-policy,environment";
                    _summary = "&f6=short_desc&o6=anywordssubstr&v6=garbage, plumbing, lighting, road-constructor, green, protection-policy, environment";
                } else {
                    _issue = "garbage,plumbing,lighting,road-constructor,green,protection-policy,environment";
                    _summary = "&f6=short_desc&o6=anywordssubstr&v6=garbage, plumbing, lighting, road-constructor, green, protection-policy, environment";
                }
            } else {

                var issue_split = req.query.issue.split("|");

                switch (issue_split.length) {
                    case 1:
                        if (_default_issue == "---") {
                            _issue = "---," + issue_split[0].toString();
                            _summary = "&f6=short_desc&o6=anywordssubstr&v6=" + issue_split[0].toString();
                        } else {
                            _issue = issue_split[0].toString();
                            _summary = "&f6=short_desc&o6=anywordssubstr&v6=" + issue_split[0].toString();
                        }
                        break;
                    case 2:
                        if (_default_issue == "---") {
                            _issue = "---," + issue_split[0].toString() + "," + issue_split[1].toString();
                            _summary = "&f6=short_desc&o6=anywordssubstr&v6=" + issue_split[0].toString() + ", " + issue_split[1].toString();
                        } else {
                            _issue = issue_split[0].toString() + "," + issue_split[1].toString();
                            _summary = "&f6=short_desc&o6=anywordssubstr&v6=" + issue_split[0].toString() + ", " + issue_split[1].toString();
                        }
                        break;
                    case 3:
                        if (_default_issue == "---") {
                            _issue = "---," + issue_split[0].toString() + "," + issue_split[1].toString() + "," + issue_split[2].toString();
                            _summary = "&f6=short_desc&o6=anywordssubstr&v6=" + issue_split[0].toString() + ", " + issue_split[1].toString() + ", " + issue_split[2].toString();
                        } else {
                            _issue = issue_split[0].toString() + "," + issue_split[1].toString() + "," + issue_split[2].toString();
                            _summary = "&f6=short_desc&o6=anywordssubstr&v6=" + issue_split[0].toString() + ", " + issue_split[1].toString() + ", " + issue_split[2].toString();

                        }
                        break;
                    case 4:
                        if (_default_issue == "---") {
                            _issue = "---," + issue_split[0].toString() + "," + issue_split[1].toString() + "," + issue_split[2].toString() + "," + issue_split[3].toString();
                            _summary = "&f6=short_desc&o6=anywordssubstr&v6=" + issue_split[0].toString() + ", " + issue_split[1].toString() + ", " + issue_split[2].toString() + ", " + issue_split[3].toString();
                        } else {
                            _issue = issue_split[0].toString() + "," + issue_split[1].toString() + "," + issue_split[2].toString() + "," + issue_split[3].toString();
                            _summary = "&f6=short_desc&o6=anywordssubstr&v6=" + issue_split[0].toString() + ", " + issue_split[1].toString() + ", " + issue_split[2].toString() + ", " + issue_split[3].toString();
                        }
                        break;
                    case 5:
                        if (_default_issue == "---") {
                            _issue = "---," + issue_split[0].toString() + "," + issue_split[1].toString() + "," + issue_split[2].toString() + "," + issue_split[3].toString() + "," + issue_split[4].toString();
                            _summary = "&f6=short_desc&o6=anywordssubstr&v6=" + issue_split[0].toString() + ", " + issue_split[1].toString() + ", " + issue_split[2].toString() + ", " + issue_split[3].toString() + ", " + issue_split[4].toString();
                        } else {
                            _issue = issue_split[0].toString() + "," + issue_split[1].toString() + "," + issue_split[2].toString() + "," + issue_split[3].toString() + "," + issue_split[4].toString();
                            _summary = "&f6=short_desc&o6=anywordssubstr&v6=" + issue_split[0].toString() + ", " + issue_split[1].toString() + ", " + issue_split[2].toString() + ", " + issue_split[3].toString() + ", " + issue_split[4].toString();
                        }
                        break;
                    case 6:
                        if (_default_issue == "---") {
                            _issue = "---," + issue_split[0].toString() + "," + issue_split[1].toString() + "," + issue_split[2].toString() + "," + issue_split[3].toString() + "," + issue_split[4].toString() + "," + issue_split[5].toString();
                            _summary = "&f6=short_desc&o6=anywordssubstr&v6=" + issue_split[0].toString() + ", " + issue_split[1].toString() + ", " + issue_split[2].toString() + ", " + issue_split[3].toString() + ", " + issue_split[4].toString() + ", " + issue_split[5].toString();
                        } else {
                            _issue = issue_split[0].toString() + "," + issue_split[1].toString() + "," + issue_split[2].toString() + "," + issue_split[3].toString() + "," + issue_split[4].toString() + "," + issue_split[5].toString();
                            _summary = "&f6=short_desc&o6=anywordssubstr&v6=" + issue_split[0].toString() + ", " + issue_split[1].toString() + ", " + issue_split[2].toString() + ", " + issue_split[3].toString() + ", " + issue_split[4].toString() + ", " + issue_split[5].toString();
                        }
                        break;
                    case 7:
                        if (_default_issue == "---") {
                            _issue = "---," + issue_split[0].toString() + "," + issue_split[1].toString() + "," + issue_split[2].toString() + "," + issue_split[3].toString() + "," + issue_split[4].toString() + "," + issue_split[5].toString() + "," + issue_split[6].toString();
                            _summary = "&f6=short_desc&o6=anywordssubstr&v6=" + issue_split[0].toString() + ", " + issue_split[1].toString() + ", " + issue_split[2].toString() + ", " + issue_split[3].toString() + ", " + issue_split[4].toString() + ", " + issue_split[5].toString() + ", " + issue_split[6].toString();
                        } else {
                            _issue = issue_split[0].toString() + "," + issue_split[1].toString() + "," + issue_split[2].toString() + "," + issue_split[3].toString() + "," + issue_split[4].toString() + "," + issue_split[5].toString() + "," + issue_split[6].toString();
                            _summary = "&f6=short_desc&o6=anywordssubstr&v6=" + issue_split[0].toString() + ", " + issue_split[1].toString() + ", " + issue_split[2].toString() + ", " + issue_split[3].toString() + ", " + issue_split[4].toString() + ", " + issue_split[5].toString() + ", " + issue_split[6].toString();
                        }
                        break;
                    default:
                        if (_default_issue == "---") {
                            _issue = "---,garbage,plumbing,lighting,road-constructor,green,protection-policy,environment";
                            _summary = "&f6=short_desc&o6=anywordssubstr&v6=garbage, plumbing, lighting, road-constructor, green, protection-policy, environment";
                        } else {
                            _issue = "garbage,plumbing,lighting,road-constructor,green,protection-policy,environment";
                            _summary = "&f6=short_desc&o6=anywordssubstr&v6=garbage, plumbing, lighting, road-constructor, green, protection-policy, environment";
                        }
                        break;
                }
            }

            if (!req.query.hasOwnProperty('departments')) {
                _departments = "";
            } else {
                var department_split = req.query.departments.split("|");

                var i_dep = 0;

                _departments = "";
                for (i_dep = 0; i_dep < department_split.length; i_dep++) {
                    _departments += "&component=" + encodeURIComponent(department_split[i_dep]);
                }

            }

            if (!req.query.hasOwnProperty('limit')) {
                _limit = 1000;
            } else {
                _limit = req.query.limit;
            }

            if (!req.query.hasOwnProperty('sort')) {
                _sort = "&order=bug_id%20DESC";
                _sort_mongo = -1;
            } else {
                if (req.query.sort == 1) {
                    _sort = "&order=bug_id%20ASC";
                    _sort_mongo = 1;
                } else if (req.query.sort == -1) {
                    _sort = "&order=bug_id%20DESC";
                    _sort_mongo = -1;
                }

            }

            if (!req.query.hasOwnProperty('image_field')) {
                _image = 0;
            } else {
                if (req.query.image_field == 0) {
                    _image = 0;
                } else {
                    _image = 1;
                }
            }

            if (!req.query.hasOwnProperty('list_issue')) {
                _list_issue = false;
            } else {
                if (req.query.image_field == 0) {
                    _list_issue = false;
                } else {
                    _list_issue = true;
                }
            }



            if (!req.query.hasOwnProperty('status')) {

                _status = "&f7=bug_status&o7=anywordssubstr&v7=CONFIRMED, IN_PROGRESS";
            } else {
                var status_split = req.query.status.split("|");

                switch (status_split.length) {
                    case 1:
                        _status = "&f7=bug_status&o7=anywordssubstr&v7=" + status_split[0];
                        break;
                    case 2:
                        _status = "&f7=bug_status&o7=anywordssubstr&v7=" + status_split[0] + ", " + status_split[1];
                        break;
                    case 3:
                        _status = "&f7=bug_status&o7=anywordssubstr&v7=" + status_split[0] + ", " + status_split[1] + ", " + status_split[2];
                        break;
                    default:
                        _status = "&f7=bug_status&o7=anywordssubstr&v7=CONFIRMED, IN_PROGRESS";
                        break;
                }
            }
            
                    var null_resolution = '';
                    //if (req.query.hasOwnProperty('resolution')) {                    
                        if (_status.indexOf("IN_PROGRESS") > -1 || _status.indexOf("CONFIRMED") > -1) {
                            null_resolution = ",---";
                        }
                   // }
                    

                    if (!req.query.hasOwnProperty('resolution')) {
                        _resolution = "&f8=resolution&o8=anyexact&v8=FIXED,INVALID,WONTFIX,DUPLICATE" + null_resolution;
                    } else {
                        var resolution_split = req.query.resolution.split("|");

                        switch (resolution_split.length) {
                            case 1:
                                _resolution = "&f8=resolution&o8=anyexact&v8=" + resolution_split[0] + null_resolution;
                                break;
                            case 2:
                                _resolution = "&f8=resolution&o8=anyexact&v8=" + resolution_split[0] + ", " + resolution_split[1] + null_resolution;
                                break;
                            case 3:
                                _resolution = "&f8=resolution&o8=anyexact&v8=" + resolution_split[0] + ", " + resolution_split[1] + ", " + resolution_split[2] + null_resolution;
                                break;
                            default:
                                _resolution = "&f8=resolution&o8=anyexact&v8=FIXED,INVALID,WONTFIX,DUPLICATE" + null_resolution;
                                break;
                        }


                    }
               
            

            if (!req.query.hasOwnProperty('kml')) {
                _kml = 0;
            } else {
                _kml = req.query.kml;
            }

            if (!req.query.hasOwnProperty('offset')) {
                _offset = "";
            } else {
                _offset = "&offset=" + req.query.offset;
            }

            _user = false;
            
            if (!req.query.hasOwnProperty('city') && _coordinates != '') {

                var _cordinates_ar = JSON.parse(req.query.coordinates);

                Municipality.find({ boundaries: { $geoIntersects: { $geometry: { "type": "Point", "coordinates": [_cordinates_ar[0], _cordinates_ar[1]] } } } }, { "municipality": 1, "municipality_desc": 1 }, function (err, response) {
                    if (response.length > 0) {

                        _product = response[0]["municipality"];

                        var bugParams1 = "?product=" + _product + "&query_format=advanced&limit=" + _limit + _status + "&v2=" + _enddate + "&f2=creation_ts&o2=lessthaneq&v3=" + _startdate + "&f3=creation_ts&o3=greaterthaneq&v5=" + _cf_authedicated + _offset + "&f5=cf_authedicated&o5=" + _cf_authedicated_contition + _departments + _sort + _summary + _resolution + "&include_fields=id,alias,status,cf_authedicated,resolution,cf_city_address" + _bug_extra;
                        
                        var ids = [];
                        var bugzilla_results = [];
                        var issue_return = [];

                        request({
                            url: bugUrlRest + "/rest/bug" + bugParams1,
                            method: "GET"
                        }, function (error, response, body) {

                            if (error != undefined) { console.log(JSON.stringify(error)); }

                            var i_count = 0;
                            var bugs_length = 0;

                            if (JSON.parse(body).bugs != undefined) {
                                bugs_length = JSON.parse(body).bugs.length;
                            }
                            for (i_count = 0; i_count < bugs_length; i_count++) {
                                ids.push(JSON.parse(body).bugs[i_count].alias[0]);
                                bugzilla_results = JSON.parse(body).bugs;
                            }
                            if (_image == 0) {
                                if (_user_extra == 0) {
                                    Issue.find({ "_id": { $in: ids } }, { "user":0, "image_name": _image }, function (err, issue) {
                                    
                                        //new start
                                        if (err != null) { console.log("err   =   " + err); }
                                        if (_kml == 0) {
                                            issue_return += '[';
                                        } else if (_kml == 1) {
                                            issue_return += '<?xml version="1.0" encoding="UTF-8"?> <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom"> <Document>' +
                                                '<name>sensecity.kml</name>' +
                                                '<Style id="s_ylw-pushpin_hl">' +
                                                '<IconStyle>' +
                                                '<color>ff7fffff</color>' +
                                                '<scale>1.3</scale>' +
                                                '<Icon>' +
                                                '<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>' +
                                                '</Icon>' +
                                                '<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>' +
                                                '</IconStyle>' +
                                                '</Style>' +
                                                '<StyleMap id="m_ylw-pushpin">' +
                                                '<Pair>' +
                                                '<key>normal</key>' +
                                                '<styleUrl>#s_ylw-pushpin</styleUrl>' +
                                                '</Pair>' +
                                                '<Pair>' +
                                                '<key>highlight</key>' +
                                                '<styleUrl>#s_ylw-pushpin_hl</styleUrl>' +
                                                '</Pair>' +
                                                '</StyleMap>' +
                                                '<Style id="s_ylw-pushpin">' +
                                                '<IconStyle>' +
                                                '<color>ff7fffff</color>' +
                                                '<scale>1.1</scale>' +
                                                '<Icon>' +
                                                '<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>' +
                                                '</Icon>' +
                                                '<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>' +
                                                '</IconStyle>' +
                                                '</Style>' +
                                                '<Folder>' +
                                                '<name>sensecity</name>' +
                                                '<open>1</open>';
                                        }
                                        
                                        for (var i = 0; i < issue.length; i++) {

                                            var bug_id = 0;
                                            var bug_status = "";
                                            var bug_authenticate = "0";
                                            var bug_component;
                                            var bug_priority;
                                            var bug_severity;
                                            var bug_resolution;
                                            var bug_address;

                                            for (var j = 0; j < bugzilla_results.length; j++) {
                                                if (bugzilla_results[j].alias[0] == issue[i]._id) {
                                                    bug_id = bugzilla_results[j].id;
                                                    bug_status = bugzilla_results[j].status;
                                                    bug_authenticate = bugzilla_results[j].cf_authedicated;

                                                    if (bugzilla_results[j].component != undefined) {
                                                        bug_component = bugzilla_results[j].component;
                                                    }
                                                    if (bugzilla_results[j].priority != undefined) {
                                                        bug_priority = bugzilla_results[j].priority;
                                                    }
                                                    if (bugzilla_results[j].severity != undefined) {
                                                        bug_severity = bugzilla_results[j].severity;
                                                    }

                                                    if (bugzilla_results[j].resolution != undefined) {
                                                        bug_resolution = bugzilla_results[j].resolution;
                                                    }

                                                    if (bugzilla_results[j].cf_city_address != undefined) {
                                                        bug_address = bugzilla_results[j].cf_city_address;
                                                    }
                                                }
                                            }

                                            if (_kml == 0) {
                                                issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '","cf_authenticate":"' + bug_authenticate + '", "bug_component":"' + bug_component + '", "bug_priority":"' + bug_priority + '", "bug_severity":"' + bug_severity + '","resolution":"' + bug_resolution + '","bug_address":"' + bug_address + '"}';
                                                if (i < issue.length - 1) {
                                                    issue_return += ',';
                                                }
                                            } else if (_kml == 1) {
                                                issue_return += '<Placemark>' +
                                                    '<name>' + issue[i].issue + ' - ' + issue[i].value_desc + '</name>' +
                                                    '<description><![CDATA[<img src="' + issue[i].image_name + '"/><a href="http://' + issue[i].municipality + '.sense.city/scissuemap.html#?issue_id=' + issue[i]._id + '">http://' + issue[i].municipality + '.sense.city/scissuemap.html#?issue_id=' + issue[i]._id + '</a>]]></description>' +
                                                    '<LookAt>' +
                                                    '<longitude>' + issue[i].loc.coordinates[0] + '</longitude>' +
                                                    '<latitude>' + issue[i].loc.coordinates[1] + '</latitude>' +
                                                    '<altitude>0</altitude>' +
                                                    '<heading>-176.4101948194351</heading>' +
                                                    '<tilt>70.72955317497231</tilt>' +
                                                    '<range>1952.786634342951</range>' +
                                                    '<gx:altitudeMode>relativeToSeaFloor</gx:altitudeMode>' +
                                                    '</LookAt>' +
                                                    '<styleUrl>#m_ylw-pushpin</styleUrl>' +
                                                    '<Point>' +
                                                    '<gx:drawOrder>1</gx:drawOrder>' +
                                                    '<coordinates>' + issue[i].loc.coordinates[0] + ',' + issue[i].loc.coordinates[1] + ',0</coordinates>' +
                                                    '</Point>' +
                                                    '</Placemark>';
                                            }
                                        }

                                        if (_kml == 0) {
                                            issue_return += ']';

                                            callback(issue_return);

                                        } else if (_kml == 1) {
                                            issue_return += '</Folder> </Document> </kml>';

                                            callback(issue_return);

                                        }

                                        //new end


                                        //res.send(issue);
                                    }).sort({ "create_at": _sort_mongo });//.limit(_limit);

                                } else {
                                    Issue.find({ "_id": { $in: ids } }, { "image_name": _image }, function (err, issue) {

                                        //new start
                                        if (err != null) { console.log("err   =   " + err); }
                                        if (_kml == 0) {
                                            issue_return += '[';
                                        } else if (_kml == 1) {
                                            issue_return += '<?xml version="1.0" encoding="UTF-8"?> <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom"> <Document>' +
                                                '<name>sensecity.kml</name>' +
                                                '<Style id="s_ylw-pushpin_hl">' +
                                                '<IconStyle>' +
                                                '<color>ff7fffff</color>' +
                                                '<scale>1.3</scale>' +
                                                '<Icon>' +
                                                '<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>' +
                                                '</Icon>' +
                                                '<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>' +
                                                '</IconStyle>' +
                                                '</Style>' +
                                                '<StyleMap id="m_ylw-pushpin">' +
                                                '<Pair>' +
                                                '<key>normal</key>' +
                                                '<styleUrl>#s_ylw-pushpin</styleUrl>' +
                                                '</Pair>' +
                                                '<Pair>' +
                                                '<key>highlight</key>' +
                                                '<styleUrl>#s_ylw-pushpin_hl</styleUrl>' +
                                                '</Pair>' +
                                                '</StyleMap>' +
                                                '<Style id="s_ylw-pushpin">' +
                                                '<IconStyle>' +
                                                '<color>ff7fffff</color>' +
                                                '<scale>1.1</scale>' +
                                                '<Icon>' +
                                                '<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>' +
                                                '</Icon>' +
                                                '<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>' +
                                                '</IconStyle>' +
                                                '</Style>' +
                                                '<Folder>' +
                                                '<name>sensecity</name>' +
                                                '<open>1</open>';
                                        }
                                        
                                        for (var i = 0; i < issue.length; i++) {

                                            var bug_id = 0;
                                            var bug_status = "";
                                            var bug_authenticate = "0";
                                            var bug_component;
                                            var bug_priority;
                                            var bug_severity;
                                            var bug_resolution;
                                            var bug_address;

                                            for (var j = 0; j < bugzilla_results.length; j++) {
                                                if (bugzilla_results[j].alias[0] == issue[i]._id) {
                                                    bug_id = bugzilla_results[j].id;
                                                    bug_status = bugzilla_results[j].status;
                                                    bug_authenticate = bugzilla_results[j].cf_authedicated;

                                                    if (bugzilla_results[j].component != undefined) {
                                                        bug_component = bugzilla_results[j].component;
                                                    }
                                                    if (bugzilla_results[j].priority != undefined) {
                                                        bug_priority = bugzilla_results[j].priority;
                                                    }
                                                    if (bugzilla_results[j].severity != undefined) {
                                                        bug_severity = bugzilla_results[j].severity;
                                                    }

                                                    if (bugzilla_results[j].resolution != undefined) {
                                                        bug_resolution = bugzilla_results[j].resolution;
                                                    }

                                                    if (bugzilla_results[j].cf_city_address != undefined) {
                                                        bug_address = bugzilla_results[j].cf_city_address;
                                                    }

                                                }
                                            }

                                            if (_kml == 0) {
                                                issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '","cf_authenticate":"' + bug_authenticate + '", "bug_component":"' + bug_component + '", "bug_priority":"' + bug_priority + '", "bug_severity":"' + bug_severity + '","name":"' + issue[i].user.name + '","phone":"' + issue[i].user.phone + '","email":"' + issue[i].user.email + '","resolution":"' + bug_resolution + '","bug_address":"' + bug_address + '"}';
                                                if (i < issue.length - 1) {
                                                    issue_return += ',';
                                                }
                                            } else if (_kml == 1) {
                                                issue_return += '<Placemark>' +
                                                    '<name>' + issue[i].issue + ' - ' + issue[i].value_desc + '</name>' +
                                                    '<description><![CDATA[<img src="' + issue[i].image_name + '"/><a href="http://' + issue[i].municipality + '.sense.city/scissuemap.html#?issue_id=' + issue[i]._id + '">http://' + issue[i].municipality + '.sense.city/scissuemap.html#?issue_id=' + issue[i]._id + '</a>]]></description>' +
                                                    '<LookAt>' +
                                                    '<longitude>' + issue[i].loc.coordinates[0] + '</longitude>' +
                                                    '<latitude>' + issue[i].loc.coordinates[1] + '</latitude>' +
                                                    '<altitude>0</altitude>' +
                                                    '<heading>-176.4101948194351</heading>' +
                                                    '<tilt>70.72955317497231</tilt>' +
                                                    '<range>1952.786634342951</range>' +
                                                    '<gx:altitudeMode>relativeToSeaFloor</gx:altitudeMode>' +
                                                    '</LookAt>' +
                                                    '<styleUrl>#m_ylw-pushpin</styleUrl>' +
                                                    '<Point>' +
                                                    '<gx:drawOrder>1</gx:drawOrder>' +
                                                    '<coordinates>' + issue[i].loc.coordinates[0] + ',' + issue[i].loc.coordinates[1] + ',0</coordinates>' +
                                                    '</Point>' +
                                                    '</Placemark>';
                                            }
                                        }

                                        if (_kml == 0) {
                                            issue_return += ']';

                                            callback(issue_return);

                                        } else if (_kml == 1) {
                                            issue_return += '</Folder> </Document> </kml>';

                                            callback(issue_return);

                                        }

                                        //new end


                                        //res.send(issue);
                                    }).sort({ "create_at": _sort_mongo });//.limit(_limit);
                                }

                            } else {
                                if (_user_extra == 0) {
                                    Issue.find({ "_id": { $in: ids } }, { "user": 0 }, function (err, issue) {
                                    
                                        //new start
                                        if (err != null) { console.log("err1   =   " + err); }
                                        if (_kml == 0) {
                                            issue_return += '[';
                                        } else if (_kml == 1) {
                                            issue_return += '<?xml version="1.0" encoding="UTF-8"?> <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom"> <Document>' +
                                                '<name>sensecity.kml</name>' +
                                                '<Style id="s_ylw-pushpin_hl">' +
                                                '<IconStyle>' +
                                                '<color>ff7fffff</color>' +
                                                '<scale>1.3</scale>' +
                                                '<Icon>' +
                                                '<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>' +
                                                '</Icon>' +
                                                '<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>' +
                                                '</IconStyle>' +
                                                '</Style>' +
                                                '<StyleMap id="m_ylw-pushpin">' +
                                                '<Pair>' +
                                                '<key>normal</key>' +
                                                '<styleUrl>#s_ylw-pushpin</styleUrl>' +
                                                '</Pair>' +
                                                '<Pair>' +
                                                '<key>highlight</key>' +
                                                '<styleUrl>#s_ylw-pushpin_hl</styleUrl>' +
                                                '</Pair>' +
                                                '</StyleMap>' +
                                                '<Style id="s_ylw-pushpin">' +
                                                '<IconStyle>' +
                                                '<color>ff7fffff</color>' +
                                                '<scale>1.1</scale>' +
                                                '<Icon>' +
                                                '<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>' +
                                                '</Icon>' +
                                                '<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>' +
                                                '</IconStyle>' +
                                                '</Style>' +
                                                '<Folder>' +
                                                '<name>sensecity</name>' +
                                                '<open>1</open>';
                                        }

                                        for (var i = 0; i < issue.length; i++) {

                                            var bug_id = 0;
                                            var bug_status = "";
                                            var bug_authenticate = "0";
                                            var bug_component;
                                            var bug_priority;
                                            var bug_severity;
                                            var bug_resolution;
                                            var bug_address;

                                            for (var j = 0; j < bugzilla_results.length; j++) {
                                                if (bugzilla_results[j].alias[0] == issue[i]._id) {
                                                    bug_id = bugzilla_results[j].id;
                                                    bug_status = bugzilla_results[j].status;
                                                    bug_authenticate = bugzilla_results[j].cf_authedicated;

                                                    if (bugzilla_results[j].component != undefined) {
                                                        bug_component = bugzilla_results[j].component;
                                                    }
                                                    if (bugzilla_results[j].priority != undefined) {
                                                        bug_priority = bugzilla_results[j].priority;
                                                    }
                                                    if (bugzilla_results[j].severity != undefined) {
                                                        bug_severity = bugzilla_results[j].severity;
                                                    }

                                                    if (bugzilla_results[j].resolution != undefined) {
                                                        bug_resolution = bugzilla_results[j].resolution;
                                                    }

                                                    if (bugzilla_results[j].cf_city_address != undefined) {
                                                        bug_address = bugzilla_results[j].cf_city_address;
                                                    }
                                                }
                                            }

                                            if (_kml == 0) {
                                                issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '","cf_authenticate":"' + bug_authenticate + '", "bug_component":"' + bug_component + '", "bug_priority":"' + bug_priority + '", "bug_severity":"' + bug_severity + '","resolution":"' + bug_resolution + '","bug_address":"' + bug_address + '"}';
                                                if (i < issue.length - 1) {
                                                    issue_return += ',';
                                                }
                                            } else if (_kml == 1) {
                                                issue_return += '<Placemark>' +
                                                    '<name>' + issue[i].issue + ' - ' + issue[i].value_desc + '</name>' +
                                                    '<description><![CDATA[<img src="' + issue[i].image_name + '"/><a href="http://' + issue[i].municipality + '.sense.city/scissuemap.html#?issue_id=' + issue[i]._id + '">http://' + issue[i].municipality + '.sense.city/scissuemap.html#?issue_id=' + issue[i]._id + '</a>]]></description>' +
                                                    '<LookAt>' +
                                                    '<longitude>' + issue[i].loc.coordinates[0] + '</longitude>' +
                                                    '<latitude>' + issue[i].loc.coordinates[1] + '</latitude>' +
                                                    '<altitude>0</altitude>' +
                                                    '<heading>-176.4101948194351</heading>' +
                                                    '<tilt>70.72955317497231</tilt>' +
                                                    '<range>1952.786634342951</range>' +
                                                    '<gx:altitudeMode>relativeToSeaFloor</gx:altitudeMode>' +
                                                    '</LookAt>' +
                                                    '<styleUrl>#m_ylw-pushpin</styleUrl>' +
                                                    '<Point>' +
                                                    '<gx:drawOrder>1</gx:drawOrder>' +
                                                    '<coordinates>' + issue[i].loc.coordinates[0] + ',' + issue[i].loc.coordinates[1] + ',0</coordinates>' +
                                                    '</Point>' +
                                                    '</Placemark>';
                                            }
                                        }

                                        if (_kml == 0) {
                                            issue_return += ']';

                                            callback(issue_return);
                                        } else if (_kml == 1) {
                                            issue_return += '</Folder> </Document> </kml>';

                                            callback(issue_return);
                                        }
                                    }).sort({ "create_at": _sort_mongo });//.limit(_limit);
                                } else {
                                    Issue.find({ "_id": { $in: ids } }, function (err, issue) {
                                    
                                        //new start
                                        if (err != null) { console.log("err1   =   " + err); }
                                        if (_kml == 0) {
                                            issue_return += '[';
                                        } else if (_kml == 1) {
                                            issue_return += '<?xml version="1.0" encoding="UTF-8"?> <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom"> <Document>' +
                                                '<name>sensecity.kml</name>' +
                                                '<Style id="s_ylw-pushpin_hl">' +
                                                '<IconStyle>' +
                                                '<color>ff7fffff</color>' +
                                                '<scale>1.3</scale>' +
                                                '<Icon>' +
                                                '<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>' +
                                                '</Icon>' +
                                                '<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>' +
                                                '</IconStyle>' +
                                                '</Style>' +
                                                '<StyleMap id="m_ylw-pushpin">' +
                                                '<Pair>' +
                                                '<key>normal</key>' +
                                                '<styleUrl>#s_ylw-pushpin</styleUrl>' +
                                                '</Pair>' +
                                                '<Pair>' +
                                                '<key>highlight</key>' +
                                                '<styleUrl>#s_ylw-pushpin_hl</styleUrl>' +
                                                '</Pair>' +
                                                '</StyleMap>' +
                                                '<Style id="s_ylw-pushpin">' +
                                                '<IconStyle>' +
                                                '<color>ff7fffff</color>' +
                                                '<scale>1.1</scale>' +
                                                '<Icon>' +
                                                '<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>' +
                                                '</Icon>' +
                                                '<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>' +
                                                '</IconStyle>' +
                                                '</Style>' +
                                                '<Folder>' +
                                                '<name>sensecity</name>' +
                                                '<open>1</open>';
                                        }

                                        for (var i = 0; i < issue.length; i++) {

                                            var bug_id = 0;
                                            var bug_status = "";
                                            var bug_authenticate = "0";
                                            var bug_component;
                                            var bug_priority;
                                            var bug_severity;
                                            var bug_resolution;
                                            var bug_address;

                                            for (var j = 0; j < bugzilla_results.length; j++) {
                                                if (bugzilla_results[j].alias[0] == issue[i]._id) {
                                                    bug_id = bugzilla_results[j].id;
                                                    bug_status = bugzilla_results[j].status;
                                                    bug_authenticate = bugzilla_results[j].cf_authedicated;

                                                    if (bugzilla_results[j].component != undefined) {
                                                        bug_component = bugzilla_results[j].component;
                                                    }
                                                    if (bugzilla_results[j].priority != undefined) {
                                                        bug_priority = bugzilla_results[j].priority;
                                                    }
                                                    if (bugzilla_results[j].severity != undefined) {
                                                        bug_severity = bugzilla_results[j].severity;
                                                    }

                                                    if (bugzilla_results[j].resolution != undefined) {
                                                        bug_resolution = bugzilla_results[j].resolution;
                                                    }

                                                    if (bugzilla_results[j].cf_city_address != undefined) {
                                                        bug_address = bugzilla_results[j].cf_city_address;
                                                    }

                                                }
                                            }

                                            if (_kml == 0) {
                                                issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '","cf_authenticate":"' + bug_authenticate + '", "bug_component":"' + bug_component + '", "bug_priority":"' + bug_priority + '", "bug_severity":"' + bug_severity + '","name":"' + issue[i].user.name + '","phone":"' + issue[i].user.phone + '","email":"' + issue[i].user.email + '","resolution":"' + bug_resolution + '","bug_address":"' + bug_address + '"}';
                                                if (i < issue.length - 1) {
                                                    issue_return += ',';
                                                }
                                            } else if (_kml == 1) {
                                                issue_return += '<Placemark>' +
                                                    '<name>' + issue[i].issue + ' - ' + issue[i].value_desc + '</name>' +
                                                    '<description><![CDATA[<img src="' + issue[i].image_name + '"/><a href="http://' + issue[i].municipality + '.sense.city/scissuemap.html#?issue_id=' + issue[i]._id + '">http://' + issue[i].municipality + '.sense.city/scissuemap.html#?issue_id=' + issue[i]._id + '</a>]]></description>' +
                                                    '<LookAt>' +
                                                    '<longitude>' + issue[i].loc.coordinates[0] + '</longitude>' +
                                                    '<latitude>' + issue[i].loc.coordinates[1] + '</latitude>' +
                                                    '<altitude>0</altitude>' +
                                                    '<heading>-176.4101948194351</heading>' +
                                                    '<tilt>70.72955317497231</tilt>' +
                                                    '<range>1952.786634342951</range>' +
                                                    '<gx:altitudeMode>relativeToSeaFloor</gx:altitudeMode>' +
                                                    '</LookAt>' +
                                                    '<styleUrl>#m_ylw-pushpin</styleUrl>' +
                                                    '<Point>' +
                                                    '<gx:drawOrder>1</gx:drawOrder>' +
                                                    '<coordinates>' + issue[i].loc.coordinates[0] + ',' + issue[i].loc.coordinates[1] + ',0</coordinates>' +
                                                    '</Point>' +
                                                    '</Placemark>';
                                            }
                                        }

                                        if (_kml == 0) {
                                            issue_return += ']';

                                            callback(issue_return);
                                        } else if (_kml == 1) {
                                            issue_return += '</Folder> </Document> </kml>';

                                            callback(issue_return);
                                        }
                                    }).sort({ "create_at": _sort_mongo });//.limit(_limit);
                                }
                            }

                        });
                    } else {
                        _product = '';
                        callback([]);
                    }
                });
                //end else if there is coordinates
            } else {
            
                _product = req.query.city;

                //var bugParams1 = "?product=" + _product + "&j_top=OR&query_format=advanced&limit=" + _limit + _status + "&v2=" + _enddate + "&f2=creation_ts&o2=lessthan&v3=" + _startdate + "&f3=creation_ts&o3=greaterthan&v4=" + _issue + "&f4=cf_issues&o4=anywordssubstr&v5=" + _cf_authedicated + _offset + "&f5=cf_authedicated&o5=" + _cf_authedicated_contition + _departments + _sort + _summary + "&include_fields=id,alias,status,cf_authedicated";
                var bugParams1 = "?product=" + _product + "&query_format=advanced&limit=" + _limit + _status + "&v2=" + _enddate + "&f2=creation_ts&o2=lessthaneq&v3=" + _startdate + "&f3=creation_ts&o3=greaterthaneq&v5=" + _cf_authedicated + _offset + "&f5=cf_authedicated&o5=" + _cf_authedicated_contition + _departments + _sort + _summary + _resolution + "&include_fields=id,alias,status,cf_authedicated,resolution,cf_city_address" + _bug_extra;
                
                var ids = [];
                var bugzilla_results = [];
                var issue_return = [];
                request({
                    url: bugUrlRest + "/rest/bug" + bugParams1,
                    method: "GET"
                }, function (error, response, body) {
                
                    var i_count = 0;
                    var bugs_length = 0;
                    
                    if (JSON.parse(body).bugs != undefined) {
                        bugs_length = JSON.parse(body).bugs.length;
                    }
                    for (i_count = 0; i_count < bugs_length; i_count++) {
                        ids.push(JSON.parse(body).bugs[i_count].alias[0]);
                        bugzilla_results = JSON.parse(body).bugs;
                    }


                    if (_image == 0) {
                        // This query works only if is valid object ids
                        // if not we have error like {CastError: Cast to ObjectId failed for value "12345g43" at path "_id"}.
                        if (_user_extra == 0) {
                            Issue.find({ "_id": { $in: ids } }, { "user": 0, "image_name": _image }, function (err, issue) {
                            
                                //new start
                                if (err != null) { console.log("err2   =   " + err); }
                                if (_kml == 0) {
                                    issue_return += '[';
                                } else if (_kml == 1) {
                                    issue_return += '<?xml version="1.0" encoding="UTF-8"?> <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom"> <Document>' +
                                        '<name>sensecity.kml</name>' +
                                        '<Style id="s_ylw-pushpin_hl">' +
                                        '<IconStyle>' +
                                        '<color>ff7fffff</color>' +
                                        '<scale>1.3</scale>' +
                                        '<Icon>' +
                                        '<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>' +
                                        '</Icon>' +
                                        '<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>' +
                                        '</IconStyle>' +
                                        '</Style>' +
                                        '<StyleMap id="m_ylw-pushpin">' +
                                        '<Pair>' +
                                        '<key>normal</key>' +
                                        '<styleUrl>#s_ylw-pushpin</styleUrl>' +
                                        '</Pair>' +
                                        '<Pair>' +
                                        '<key>highlight</key>' +
                                        '<styleUrl>#s_ylw-pushpin_hl</styleUrl>' +
                                        '</Pair>' +
                                        '</StyleMap>' +
                                        '<Style id="s_ylw-pushpin">' +
                                        '<IconStyle>' +
                                        '<color>ff7fffff</color>' +
                                        '<scale>1.1</scale>' +
                                        '<Icon>' +
                                        '<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>' +
                                        '</Icon>' +
                                        '<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>' +
                                        '</IconStyle>' +
                                        '</Style>' +
                                        '<Folder>' +
                                        '<name>sensecity</name>' +
                                        '<open>1</open>';
                                }


                                if (issue != undefined) {
                                    for (var i = 0; i < issue.length; i++) {

                                        var bug_id = 0;
                                        var bug_status = "";
                                        var bug_authenticate = "0";
                                        var bug_component;
                                        var bug_priority;
                                        var bug_severity;
                                        var bug_resolution;
                                        var bug_address;

                                        for (var j = 0; j < bugzilla_results.length; j++) {
                                            if (bugzilla_results[j].alias[0] == issue[i]._id) {
                                                bug_id = bugzilla_results[j].id;
                                                bug_status = bugzilla_results[j].status;
                                                bug_authenticate = bugzilla_results[j].cf_authedicated;

                                                if (bugzilla_results[j].component != undefined) {
                                                    bug_component = bugzilla_results[j].component;
                                                }
                                                if (bugzilla_results[j].priority != undefined) {
                                                    bug_priority = bugzilla_results[j].priority;
                                                }
                                                if (bugzilla_results[j].severity != undefined) {
                                                    bug_severity = bugzilla_results[j].severity;
                                                }

                                                if (bugzilla_results[j].resolution != undefined) {
                                                    bug_resolution = bugzilla_results[j].resolution;
                                                }

                                                if (bugzilla_results[j].cf_city_address != undefined) {
                                                    bug_address = bugzilla_results[j].cf_city_address;
                                                }
                                            }
                                        }

                                        if (_kml == 0) {
                                            issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '","cf_authenticate":"' + bug_authenticate + '", "bug_component":"' + bug_component + '", "bug_priority":"' + bug_priority + '", "bug_severity":"' + bug_severity + '","resolution":"' + bug_resolution + '","bug_address":"' + bug_address + '"}';
                                            if (i < issue.length - 1) {
                                                issue_return += ',';
                                            }
                                        } else if (_kml == 1) {
                                            issue_return += '<Placemark>' +
                                                '<name>' + issue[i].issue + ' - ' + issue[i].value_desc + '</name>' +
                                                '<description><![CDATA[<img src="' + issue[i].image_name + '"/><a href="http://' + issue[i].municipality + '.sense.city/scissuemap.html#?issue_id=' + issue[i]._id + '">http://' + issue[i].municipality + '.sense.city/scissuemap.html#?issue_id=' + issue[i]._id + '</a>]]></description>' +
                                                '<LookAt>' +
                                                '<longitude>' + issue[i].loc.coordinates[0] + '</longitude>' +
                                                '<latitude>' + issue[i].loc.coordinates[1] + '</latitude>' +
                                                '<altitude>0</altitude>' +
                                                '<heading>-176.4101948194351</heading>' +
                                                '<tilt>70.72955317497231</tilt>' +
                                                '<range>1952.786634342951</range>' +
                                                '<gx:altitudeMode>relativeToSeaFloor</gx:altitudeMode>' +
                                                '</LookAt>' +
                                                '<styleUrl>#m_ylw-pushpin</styleUrl>' +
                                                '<Point>' +
                                                '<gx:drawOrder>1</gx:drawOrder>' +
                                                '<coordinates>' + issue[i].loc.coordinates[0] + ',' + issue[i].loc.coordinates[1] + ',0</coordinates>' +
                                                '</Point>' +
                                                '</Placemark>';
                                        }
                                    }
                                }
                                else {
                                    issue_return = "{}";
                                }

                                if (_kml == 0) {
                                    issue_return += ']';

                                    callback(issue_return);
                                } else if (_kml == 1) {
                                    issue_return += '</Folder> </Document> </kml>';

                                    callback(issue_return);
                                }
                                
                            }).sort({ "create_at": _sort_mongo });//.limit(_limit);
                        } else {
                            Issue.find({ "_id": { $in: ids } }, { "image_name": _image }, function (err, issue) {
                            
                                //new start
                                if (err != null) { console.log("err2   =   " + err); }
                                if (_kml == 0) {
                                    issue_return += '[';
                                } else if (_kml == 1) {
                                    issue_return += '<?xml version="1.0" encoding="UTF-8"?> <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom"> <Document>' +
                                        '<name>sensecity.kml</name>' +
                                        '<Style id="s_ylw-pushpin_hl">' +
                                        '<IconStyle>' +
                                        '<color>ff7fffff</color>' +
                                        '<scale>1.3</scale>' +
                                        '<Icon>' +
                                        '<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>' +
                                        '</Icon>' +
                                        '<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>' +
                                        '</IconStyle>' +
                                        '</Style>' +
                                        '<StyleMap id="m_ylw-pushpin">' +
                                        '<Pair>' +
                                        '<key>normal</key>' +
                                        '<styleUrl>#s_ylw-pushpin</styleUrl>' +
                                        '</Pair>' +
                                        '<Pair>' +
                                        '<key>highlight</key>' +
                                        '<styleUrl>#s_ylw-pushpin_hl</styleUrl>' +
                                        '</Pair>' +
                                        '</StyleMap>' +
                                        '<Style id="s_ylw-pushpin">' +
                                        '<IconStyle>' +
                                        '<color>ff7fffff</color>' +
                                        '<scale>1.1</scale>' +
                                        '<Icon>' +
                                        '<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>' +
                                        '</Icon>' +
                                        '<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>' +
                                        '</IconStyle>' +
                                        '</Style>' +
                                        '<Folder>' +
                                        '<name>sensecity</name>' +
                                        '<open>1</open>';
                                }


                                if (issue != undefined) {
                                    for (var i = 0; i < issue.length; i++) {

                                        var bug_id = 0;
                                        var bug_status = "";
                                        var bug_authenticate = "0";
                                        var bug_component;
                                        var bug_priority;
                                        var bug_severity;
                                        var bug_resolution;
                                        var bug_address;

                                        for (var j = 0; j < bugzilla_results.length; j++) {
                                            if (bugzilla_results[j].alias[0] == issue[i]._id) {
                                                bug_id = bugzilla_results[j].id;
                                                bug_status = bugzilla_results[j].status;
                                                bug_authenticate = bugzilla_results[j].cf_authedicated;

                                                if (bugzilla_results[j].component != undefined) {
                                                    bug_component = bugzilla_results[j].component;
                                                }
                                                if (bugzilla_results[j].priority != undefined) {
                                                    bug_priority = bugzilla_results[j].priority;
                                                }
                                                if (bugzilla_results[j].severity != undefined) {
                                                    bug_severity = bugzilla_results[j].severity;
                                                }

                                                if (bugzilla_results[j].resolution != undefined) {
                                                    bug_resolution = bugzilla_results[j].resolution;
                                                }

                                                if (bugzilla_results[j].cf_city_address != undefined) {
                                                    bug_address = bugzilla_results[j].cf_city_address;
                                                }

                                            }
                                        }

                                        if (_kml == 0) {
                                            issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '","cf_authenticate":"' + bug_authenticate + '", "bug_component":"' + bug_component + '", "bug_priority":"' + bug_priority + '", "bug_severity":"' + bug_severity + '","resolution":"' + bug_resolution + '","bug_address":"' + bug_address + '"}';
                                            if (i < issue.length - 1) {
                                                issue_return += ',';
                                            }
                                        } else if (_kml == 1) {
                                            issue_return += '<Placemark>' +
                                                '<name>' + issue[i].issue + ' - ' + issue[i].value_desc + '</name>' +
                                                '<description><![CDATA[<img src="' + issue[i].image_name + '"/><a href="http://' + issue[i].municipality + '.sense.city/scissuemap.html#?issue_id=' + issue[i]._id + '">http://' + issue[i].municipality + '.sense.city/scissuemap.html#?issue_id=' + issue[i]._id + '</a>]]></description>' +
                                                '<LookAt>' +
                                                '<longitude>' + issue[i].loc.coordinates[0] + '</longitude>' +
                                                '<latitude>' + issue[i].loc.coordinates[1] + '</latitude>' +
                                                '<altitude>0</altitude>' +
                                                '<heading>-176.4101948194351</heading>' +
                                                '<tilt>70.72955317497231</tilt>' +
                                                '<range>1952.786634342951</range>' +
                                                '<gx:altitudeMode>relativeToSeaFloor</gx:altitudeMode>' +
                                                '</LookAt>' +
                                                '<styleUrl>#m_ylw-pushpin</styleUrl>' +
                                                '<Point>' +
                                                '<gx:drawOrder>1</gx:drawOrder>' +
                                                '<coordinates>' + issue[i].loc.coordinates[0] + ',' + issue[i].loc.coordinates[1] + ',0</coordinates>' +
                                                '</Point>' +
                                                '</Placemark>';
                                        }
                                    }
                                }
                                else {
                                    issue_return = ""; //issue_return = "{}";
                                }

                                if (_kml == 0) {
                                    issue_return += ']';

                                    callback(issue_return);
                                } else if (_kml == 1) {
                                    issue_return += '</Folder> </Document> </kml>';

                                    callback(issue_return);
                                }

                                //new end
                                //res.send(issue);
                            }).sort({ "create_at": _sort_mongo });//.limit(_limit);
                        }

                    } else {
                        if (_user_extra == 0) {
                            Issue.find({ "_id": { $in: ids } }, { "user": 0 }, function (err, issue) {
                            
                                //new start
                                if (err != null) { console.log("err3   =   " + err); }
                                if (_kml == 0) {
                                    issue_return += '[';
                                } else if (_kml == 1) {
                                    issue_return += '<?xml version="1.0" encoding="UTF-8"?> <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom"> <Document>' +
                                        '<name>sensecity.kml</name>' +
                                        '<Style id="s_ylw-pushpin_hl">' +
                                        '<IconStyle>' +
                                        '<color>ff7fffff</color>' +
                                        '<scale>1.3</scale>' +
                                        '<Icon>' +
                                        '<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>' +
                                        '</Icon>' +
                                        '<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>' +
                                        '</IconStyle>' +
                                        '</Style>' +
                                        '<StyleMap id="m_ylw-pushpin">' +
                                        '<Pair>' +
                                        '<key>normal</key>' +
                                        '<styleUrl>#s_ylw-pushpin</styleUrl>' +
                                        '</Pair>' +
                                        '<Pair>' +
                                        '<key>highlight</key>' +
                                        '<styleUrl>#s_ylw-pushpin_hl</styleUrl>' +
                                        '</Pair>' +
                                        '</StyleMap>' +
                                        '<Style id="s_ylw-pushpin">' +
                                        '<IconStyle>' +
                                        '<color>ff7fffff</color>' +
                                        '<scale>1.1</scale>' +
                                        '<Icon>' +
                                        '<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>' +
                                        '</Icon>' +
                                        '<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>' +
                                        '</IconStyle>' +
                                        '</Style>' +
                                        '<Folder>' +
                                        '<name>sensecity</name>' +
                                        '<open>1</open>';
                                }

                                for (var i = 0; i < issue.length; i++) {

                                    var bug_id = 0;
                                    var bug_status = "";
                                    var bug_authenticate = "0";
                                    var bug_component;
                                    var bug_priority;
                                    var bug_severity;
                                    var bug_resolution;
                                    var bug_address;

                                    for (var j = 0; j < bugzilla_results.length; j++) {
                                        if (bugzilla_results[j].alias[0] == issue[i]._id) {
                                            bug_id = bugzilla_results[j].id;
                                            bug_status = bugzilla_results[j].status;
                                            bug_authenticate = bugzilla_results[j].cf_authedicated;

                                            if (bugzilla_results[j].component != undefined) {
                                                bug_component = bugzilla_results[j].component;
                                            }
                                            if (bugzilla_results[j].priority != undefined) {
                                                bug_priority = bugzilla_results[j].priority;
                                            }
                                            if (bugzilla_results[j].severity != undefined) {
                                                bug_severity = bugzilla_results[j].severity;
                                            }

                                            if (bugzilla_results[j].resolution != undefined) {
                                                bug_resolution = bugzilla_results[j].resolution;
                                            }

                                            if (bugzilla_results[j].cf_city_address != undefined) {
                                                bug_address = bugzilla_results[j].cf_city_address;
                                            }
                                        }
                                    }

                                    if (_kml == 0) {
                                        issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '","cf_authenticate":"' + bug_authenticate + '", "bug_component":"' + bug_component + '", "bug_priority":"' + bug_priority + '", "bug_severity":"' + bug_severity + '","resolution":"' + bug_resolution + '","bug_address":"' + bug_address + '"} ';

                                        if (i < issue.length - 1) {
                                            issue_return += ',';
                                        }
                                    } else if (_kml == 1) {
                                        issue_return += '<Placemark>' +
                                            '<name>' + issue[i].issue + ' - ' + issue[i].value_desc + '</name>' +
                                            '<description><![CDATA[<img src="' + issue[i].image_name + '"/><a href="http://' + issue[i].municipality + '.sense.city/scissuemap.html#?issue_id=' + issue[i]._id + '">http://' + issue[i].municipality + '.sense.city/scissuemap.html#?issue_id=' + issue[i]._id + '</a>]]></description>' +
                                            '<LookAt>' +
                                            '<longitude>' + issue[i].loc.coordinates[0] + '</longitude>' +
                                            '<latitude>' + issue[i].loc.coordinates[1] + '</latitude>' +
                                            '<altitude>0</altitude>' +
                                            '<heading>-176.4101948194351</heading>' +
                                            '<tilt>70.72955317497231</tilt>' +
                                            '<range>1952.786634342951</range>' +
                                            '<gx:altitudeMode>relativeToSeaFloor</gx:altitudeMode>' +
                                            '</LookAt>' +
                                            '<styleUrl>#m_ylw-pushpin</styleUrl>' +
                                            '<Point>' +
                                            '<gx:drawOrder>1</gx:drawOrder>' +
                                            '<coordinates>' + issue[i].loc.coordinates[0] + ',' + issue[i].loc.coordinates[1] + ',0</coordinates>' +
                                            '</Point>' +
                                            '</Placemark>';
                                    }
                                }

                                if (_kml == 0) {
                                    issue_return += ']';

                                    callback(issue_return);
                                } else if (_kml == 1) {
                                    issue_return += '</Folder> </Document> </kml>';

                                    callback(issue_return);
                                }

                                //new end

                                //res.send(issue);
                            }).sort({ "create_at": _sort_mongo });//.limit(_limit);
                        } else {
                            Issue.find({ "_id": { $in: ids } }, { /*"user": 0*/ }, function (err, issue) {
                            
                            //new start
                            if (err != null) { console.log("err3   =   " + err); }
                            if (_kml == 0) {
                                issue_return += '[';
                            } else if (_kml == 1) {
                                issue_return += '<?xml version="1.0" encoding="UTF-8"?> <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom"> <Document>' +
                                    '<name>sensecity.kml</name>' +
                                    '<Style id="s_ylw-pushpin_hl">' +
                                    '<IconStyle>' +
                                    '<color>ff7fffff</color>' +
                                    '<scale>1.3</scale>' +
                                    '<Icon>' +
                                    '<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>' +
                                    '</Icon>' +
                                    '<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>' +
                                    '</IconStyle>' +
                                    '</Style>' +
                                    '<StyleMap id="m_ylw-pushpin">' +
                                    '<Pair>' +
                                    '<key>normal</key>' +
                                    '<styleUrl>#s_ylw-pushpin</styleUrl>' +
                                    '</Pair>' +
                                    '<Pair>' +
                                    '<key>highlight</key>' +
                                    '<styleUrl>#s_ylw-pushpin_hl</styleUrl>' +
                                    '</Pair>' +
                                    '</StyleMap>' +
                                    '<Style id="s_ylw-pushpin">' +
                                    '<IconStyle>' +
                                    '<color>ff7fffff</color>' +
                                    '<scale>1.1</scale>' +
                                    '<Icon>' +
                                    '<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>' +
                                    '</Icon>' +
                                    '<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>' +
                                    '</IconStyle>' +
                                    '</Style>' +
                                    '<Folder>' +
                                    '<name>sensecity</name>' +
                                    '<open>1</open>';
                            }

                            for (var i = 0; i < issue.length; i++) {

                                var bug_id = 0;
                                var bug_status = "";
                                var bug_authenticate = "0";
                                var bug_component;
                                var bug_priority;
                                var bug_severity;
                                var bug_resolution;
                                var bug_address;

                                for (var j = 0; j < bugzilla_results.length; j++) {
                                    if (bugzilla_results[j].alias[0] == issue[i]._id) {
                                        bug_id = bugzilla_results[j].id;
                                        bug_status = bugzilla_results[j].status;
                                        bug_authenticate = bugzilla_results[j].cf_authedicated;

                                        if (bugzilla_results[j].component != undefined) {
                                            bug_component = bugzilla_results[j].component;
                                        }
                                        if (bugzilla_results[j].priority != undefined) {
                                            bug_priority = bugzilla_results[j].priority;
                                        }
                                        if (bugzilla_results[j].severity != undefined) {
                                            bug_severity = bugzilla_results[j].severity;
                                        }

                                        if (bugzilla_results[j].resolution != undefined) {
                                            bug_resolution = bugzilla_results[j].resolution;
                                        }

                                        if (bugzilla_results[j].cf_city_address != undefined) {
                                            bug_address = bugzilla_results[j].cf_city_address;
                                        }
                                    }
                                }

                                if (_kml == 0) {
                                    issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '","cf_authenticate":"' + bug_authenticate + '", "bug_component":"' + bug_component + '", "bug_priority":"' + bug_priority + '", "bug_severity":"' + bug_severity + '","name":"' + issue[i].user.name + '","phone":"' + issue[i].user.phone + '","email":"' + issue[i].user.email + '","resolution":"' + bug_resolution + '","bug_address":"' + bug_address + '"} ';

                                    if (i < issue.length - 1) {
                                        issue_return += ',';
                                    }
                                } else if (_kml == 1) {
                                    issue_return += '<Placemark>' +
                                        '<name>' + issue[i].issue + ' - ' + issue[i].value_desc + '</name>' +
                                        '<description><![CDATA[<img src="' + issue[i].image_name + '"/><a href="http://' + issue[i].municipality + '.sense.city/scissuemap.html#?issue_id=' + issue[i]._id + '">http://' + issue[i].municipality + '.sense.city/scissuemap.html#?issue_id=' + issue[i]._id + '</a>]]></description>' +
                                        '<LookAt>' +
                                        '<longitude>' + issue[i].loc.coordinates[0] + '</longitude>' +
                                        '<latitude>' + issue[i].loc.coordinates[1] + '</latitude>' +
                                        '<altitude>0</altitude>' +
                                        '<heading>-176.4101948194351</heading>' +
                                        '<tilt>70.72955317497231</tilt>' +
                                        '<range>1952.786634342951</range>' +
                                        '<gx:altitudeMode>relativeToSeaFloor</gx:altitudeMode>' +
                                        '</LookAt>' +
                                        '<styleUrl>#m_ylw-pushpin</styleUrl>' +
                                        '<Point>' +
                                        '<gx:drawOrder>1</gx:drawOrder>' +
                                        '<coordinates>' + issue[i].loc.coordinates[0] + ',' + issue[i].loc.coordinates[1] + ',0</coordinates>' +
                                        '</Point>' +
                                        '</Placemark>';
                                }
                            }

                            if (_kml == 0) {
                                issue_return += ']';

                                callback(issue_return);
                            } else if (_kml == 1) {
                                issue_return += '</Folder> </Document> </kml>';

                                callback(issue_return);
                            }

                            //new end

                            //res.send(issue);
                        }).sort({ "create_at": _sort_mongo });//.limit(_limit);
                        }
                    }

                });
            } //

        } //end else if no city AND coordinates
    }
    else {
        callback([]);
    }
}

/* ** End test ** */
//POST router
router.post('/send_email', function (req, res) {    
	
	
	if( req.body.uuid!=undefined && req.body.name!=undefined && req.body.email!=undefined && req.body.phonenumber!=undefined ){
		act_User.find({"uuid":req.body.uuid, "name":req.body.name, "email": req.body.email, "mobile_num": req.body.phonenumber }, function(err, response){
			
			//console.log(response[0].activate);		
			if(response[0].activate == "1" ){

                var transporter = nodemailer.createTransport('smtps://' + config.config.email + ':' + config.config.password_email + '@smtp.gmail.com');

				// setup e-mail data with unicode symbols 
				var mailOptions = {
					from: '"Sense.City " <info@sense.city>', // sender address 
					to: 'info@sense.city', // list of receivers 
					subject: ' Αποστολή Αναφοράς από πολίτη '+req.body.subject, // Subject line 
					text: 'Όνομα :' + req.body.name + ' \n\n\n με email : ' + req.body.email + ' \n\n\n κινητό τηλέφωνο :' +  req.body.phonenumber + ' \n\n\n μήνυμα :'+req.body.comments, // plaintext body 
					html: 'Όνομα :' + req.body.name + ' \n\n<br /> με email : ' + req.body.email + ' \n\n<br /> κινητό τηλέφωνο :' +  req.body.phonenumber + '\n\n<br /> μήνυμα :'+req.body.comments // html body 
				};

				// send mail with defined transport object 
				transporter.sendMail(mailOptions, function (error, info) {
					if (error) {
						console.log('error');
						res.send(["error"]);
						return console.log(error);
						
					}
					res.send(["ok"]);
					console.log('Message sent: ' + info.response);
				});
				
				
			}else{
				res.send(["no"]);
				//console.log("response13456");
			}
			
		});
	}else{
		res.send(["no"]);
		//console.log("response13456");
	}
});



//POST router
router.post('/feelings', function (req, res) {    

    var return_var;

    if (!req.body.hasOwnProperty('issue') ||
            !req.body.hasOwnProperty('loc') ||
            !req.body.hasOwnProperty('value_desc') ||
            !req.body.hasOwnProperty('device_id'))
    {
        res.statusCode = 403;
        return res.send({"message": "Forbidden"});
    } else
    {

        Municipality.find({boundaries:
                    {$geoIntersects:
                                {$geometry: {"type": "Point",
                                        "coordinates": req.body.loc.coordinates}
                                }
                    }
        }, function (err, response) {
            
            var entry = new Issue({
                loc: {type: 'Point', coordinates: req.body.loc.coordinates},
                issue: req.body.issue,
                device_id: req.body.device_id,
                value_desc: req.body.value_desc
            });

            if (response.length > 0)
            {
                entry.municipality = response[0]["municipality"];
            } else
            {
                entry.municipality = '';
            }

            // console.log(entry);
            entry.save(function (err1, resp) {
                if (err1)
                {
                    console.log(err1);
                } else
                {
                   res.send(resp);	
                }
            });
        });
    }
});


router.get('/feelings', function (req, res) {
	
	var _startdate = new Date();
    var _enddate = new Date();
    var _coordinates;
    var _distance;
    var _feeling = [];
    var _limit;
    var _sort;
    var _city; 
	var newdate = new Date();
    var _coordinates_query;
	    
    if (!req.query.hasOwnProperty('startdate'))
    {
        _startdate.setDate(_startdate.getDate() - 3);
        _startdate.setHours(00);
        _startdate.setMinutes(00, 00);
    } else {
        _startdate = new Date(req.query.startdate);
        _startdate.setHours(00);
        _startdate.setMinutes(00, 00);
    }

    if (req.query.hasOwnProperty('enddate'))
    {
        _enddate = new Date(req.query.enddate);
        _enddate.setHours(23);
        _enddate.setMinutes(59, 59);
    } else {
        _enddate = newdate;
    }

    if (!req.query.hasOwnProperty('coordinates'))
    {
        _coordinates = '';
    } else {
        _coordinates = req.query.coordinates;
    }

    if (!req.query.hasOwnProperty('distance'))
    {
        _distance = '10000';
    } else {
        _distance = req.query.distance;
    }

    if (!req.query.hasOwnProperty('feeling') || req.query.feeling === 'all')
    {
        _feeling = ["happy", "neutral", "angry"];
    } else {


        var feeling_split = req.query.feeling.split("|");

        switch (feeling_split.length) {
            case 1:
                _feeling.push(feeling_split[0]);
                break;
            case 2:
                _feeling.push(feeling_split[0]);
                _feeling.push(feeling_split[1]);
                break;
            case 3:
                _feeling.push(feeling_split[0]);
                _feeling.push(feeling_split[1]);
                _feeling.push(feeling_split[2]);
                break;
            default:
                _feeling = ["happy", "neutral", "angry"];
                break;
        }
    }

    if (!req.query.hasOwnProperty('limit'))
    {
        _limit = 1000;
    } else {
        _limit = req.query.limit;
    }

    if (!req.query.hasOwnProperty('sort'))
    {
        _sort = -1;
    } else {
        _sort = req.query.sort;
    }
	
	if (!req.query.hasOwnProperty('city'))
    {
        _city = '';
    } else {
        _city = req.query.city;
    }
	
	if(_city==''){
		if(_coordinates!=''){
			Issue.find({ 'loc': {$nearSphere: {$geometry: {type: 'Point', coordinates: JSON.parse(req.query.coordinates)}, $maxDistance: 2000}}, "issue": {$in:_feeling},"create_at": {$gte: _startdate, $lt: _enddate} },{"user":false}, function (err, issue) {
				
				res.send(issue);
			}).sort({"create_at": _sort}).limit(_limit);
		}else{	
			Issue.find({ "issue": {$in:_feeling},"create_at": {$gte: _startdate, $lt: _enddate} },{"user":false}, function (err, issue) {
			
				res.send(issue);
			}).sort({"create_at": _sort}).limit(_limit);
		}
		
	}
	else{
		if(_coordinates!=''){
			Issue.find({ 'loc': {$nearSphere: {$geometry: {type: 'Point', coordinates: JSON.parse(req.query.coordinates)}, $maxDistance: 2000}}, "issue": {$in:_feeling},"create_at": {$gte: _startdate, $lt: _enddate}, "municipality":_city },{"user":false}, function (err, issue) {
				
				res.send(issue);
			}).sort({"create_at": _sort}).limit(_limit);
		}else{	
			Issue.find({ "issue": {$in:_feeling},"create_at": {$gte: _startdate, $lt: _enddate}, "municipality":_city  },{"user":false}, function (err, issue) {
				
				res.send(issue);
			}).sort({"create_at": _sort}).limit(_limit);
		}
	}
	
});


router.get('/mobilemap', function (req, res) {

    Issue.find({'loc': {$nearSphere: {$geometry: {type: 'Point', coordinates: JSON.parse(req.query.coordinates)}, $maxDistance: 2000}}}, {'image_name': false}, function (err, issue) {
        res.send(issue);
    }).sort({create_at: 1}).limit(40);

});

router.get('/city_policy', function (req, res) {    
    var _coordinates = req.query.coordinates;
    var _issue = req.query.issue;
    Municipality.find({ boundaries: { $geoIntersects: { $geometry: { "type": "Point", "coordinates": JSON.parse(req.query.coordinates) } } } }, { "municipality": 1 }, function (err, response) { 
        if (response[0] != undefined) {
            cityPolicy.find({ "city": response[0].municipality, "category": req.query.issue }, { "policy_desc": 1, "anonymous": 1, "city": 1 }, function (err, city_policy) {
                //console.log(city_policy);
                res.send(city_policy);
            });
        } else {
            res.send([{ "policy_desc":"Η πόλη που βρίσκεστε δεν υποστηρίζετε από το Sense.City. Το αίτημα σας θα καταχωριθεί ως ανώνυμο."}]);
        }
    });
});

function return_fullissue_resp(body, callback) {
    
    callback("OK");
}

router.get('/fullissue/:id', function (req, res) {

    var id = req.params.id;
    var split_alias = id.split("|");
    var issue_rtrn;
    var alias_array = '';

    for (var k = 0; k < split_alias.length; k++) {
        console.log(split_alias[k]);
        if (k > 0) {
            alias_array += "&";
        }
        alias_array += "alias=" + split_alias[k];
    }

    var bugParams1 = "?" + alias_array + "&include_fields=id,component,alias,status,cf_city_address,product,cf_issues,creation_ts";

    request({
        url: bugUrlRest + "/rest/bug" + bugParams1,
        method: "GET"
    }, function (error, response, body) {
        console.log("length ===>>>" + JSON.parse(body).bugs.length);
        console.log("length ===>>>" + JSON.parse(body).bugs.id);
        console.log("length ===>>>" + JSON.parse(body).bugs.alias[0]);













































        return_fullissue_resp(body, function (callback) {
            
            res.send(callback);

        });


    });
   












    

    


    /*
    try {
        response = await async_request(bugUrlRest + "/rest/bug", { method: 'GET', data: bugParams1 });
        console.log("response=====>>>>" + JSON.stringify(response));

    } catch (e) {
        console.log(e);
    }*/

        /*var result1 = await(
            async_request({
                url: bugUrlRest + "/rest/bug" + bugParams1,
                method: "GET"
            }, function (error, response, body) {
                console.log(JSON.parse(body));
                return body;

            })
        );*/


        
    

            /*
            if (body_var.bugs.length !== 0) {

                if (body_var.length < 1) {

                    return [];

                } else {

                    //for
                    var counter_alias = 0;
                    var counter_alias_pev = -1;

                    console.log(body_var.bugs.length + "<=>" + counter_alias);

                    console.log("<===========>" + counter_alias);
                    if (counter_alias > counter_alias_pev) {
                        isseu_rtn_function(body_var.bugs[counter_alias].alias[0], body_var.bugs[counter_alias].id, body_var.bugs[counter_alias].cf_city_address, body_var.bugs[counter_alias].status, function (callback) {
                            issue_rtrn += callback;
                            counter_alias++;
                            console.log("counter_alias===" + counter_alias);


                            if (counter_alias == (body_var.bugs.length - 1)) {

                                res.send(issue_rtrn);
                            } else {
                                counter_alias++;
                            }

                        });

                        console.log("counter_alias_pev==" + counter_alias_pev);
                        counter_alias_pev++;
                    }



                    for (var q = 0; q < body_var.bugs.length; q++) {

                        console.log("body_var.bugs[0]====" + JSON.stringify(body_var.bugs[q]));
                        console.log("id=========>>>>>>>>" + body_var.bugs[q].id);
                        var allias_issue = body_var.bugs[q].alias[0];

                        request({
                            url: bugUrlRest + "/rest/bug/" + body_var.bugs[q].alias[0] + "/comment",
                            method: "GET"
                        }, function (error1, response1, body1) {
                            if (error1)
                                cosnole.log("/fullissue/:id error :" + error1);


                            console.log("allias_issue=========>>>>>>>>" + allias_issue);

                            isseu_rtn_function(allias_issue, body_var.bugs[0].id, body_var.bugs[0].cf_city_address, body_var.bugs[0].status, body1, function (callback) {
                                issue_rtrn += callback;
                                counter++;
                                console.log(counter);

                                if (counter == (body_var.bugs.length - 1)) {

                                    return issue_rtrn;
                                }

                            });


                        }).end();
                        console.log("OK" + q);
                    }
                }
            }
            else {
                return [];
            }

            })*/               
    


    


    /*
    getissue_details(bugParams1)
        .then(function (body_var) {
            console.log('There are ' + resultA + ' files in ');
        })
        .catch(function (err) {
            console.log('Something went wrong: ' + err);
        });*/
/*
    console.log(req);

    
    var id = req.params.id;
    var issue_rtrn;
    console.log(id);
    var split_alias = id.split("|");

    console.log(split_alias.length);

    var alias_array = '';

    var allpromise = Promise.all([]);
    for (var k = 0; k < split_alias.length; k++) {
        console.log(split_alias[k]);
        if (k > 0) {
            alias_array += "&";
        }
        alias_array += "alias=" + split_alias[k];


    }

    var bugParams1 = "?" + alias_array + "&include_fields=id,component,alias,status,cf_city_address";   

            request({
                url: bugUrlRest +"/rest/bug"+ bugParams1,
                method: "GET"
            }, function (error, response, body) {

                console.log(JSON.parse(body));

                var body_var = JSON.parse(body);
                console.log("body_var ====>>>>>> " + JSON.stringify(body_var));
                console.log("body_var.length ====>>>>>> " + body_var.length);
                console.log("body_var.bugs.length ====>>>>>> " + body_var.bugs.length);
                if (body_var.bugs.length !== 0){
			
                    if (body_var.length < 1) {

				res.send([{}]);

                    } else {

                    //for
                        var counter_alias = 0;
                        var counter_alias_pev = -1;

                        console.log(body_var.bugs.length + "<=>" + counter_alias);
                        
                            console.log("<===========>" + counter_alias);
                            if (counter_alias > counter_alias_pev) {
                                isseu_rtn_function(body_var.bugs[counter_alias].alias[0], body_var.bugs[counter_alias].id, body_var.bugs[counter_alias].cf_city_address, body_var.bugs[counter_alias].status, function (callback) {
                                    issue_rtrn += callback;
                                    counter_alias++;
                                    console.log("counter_alias===" + counter_alias);
                                    

                                    if (counter_alias == (body_var.bugs.length - 1)) {

                                        res.send(issue_rtrn);
                                    } else {
                                        counter_alias++;
                                    }

                                });

                                console.log("counter_alias_pev==" + counter_alias_pev);
                                counter_alias_pev++;
                            }

                   
                        /*
                        for (var q = 0; q < body_var.bugs.length; q++) {
                            
                            console.log("body_var.bugs[0]====" + JSON.stringify(body_var.bugs[q]));
                            console.log("id=========>>>>>>>>" + body_var.bugs[q].id);
                            var allias_issue = body_var.bugs[q].alias[0];
                            
                            request({
                                url: bugUrlRest + "/rest/bug/" + body_var.bugs[q].alias[0] + "/comment",
                                method: "GET"
                            }, function (error1, response1, body1) {
                                if (error1)
                                    cosnole.log("/fullissue/:id error :" + error1);


                                console.log("allias_issue=========>>>>>>>>" + allias_issue);
                                
                                isseu_rtn_function(allias_issue, body_var.bugs[0].id, body_var.bugs[0].cf_city_address, body_var.bugs[0].status, body1, function (callback) {
                                    issue_rtrn += callback;
                                    counter++;
                                    console.log(counter);

                                    if (counter == (body_var.bugs.length -1)) {
                                        
                                        res.send(issue_rtrn);
                                    }
                                   
                                });

                               
                                }).end();
                            console.log("OK" + q);
                        }

                        //$q.all(promises).then(res.send(promises));
                            //end for

                        

			}
		}
		else{
			res.send([]);
		}
	});
	*/
});



function isseu_rtn_function(allias_issue, myid, cf_city_address, status, callback) {
    //var allias_issue = body_var.bugs[q].alias[0];

    request({
        url: bugUrlRest + "/rest/bug/" + allias_issue + "/comment",
        method: "GET"
    }, function (error1, response1, body1) {
        if (error1)
            cosnole.log("/fullissue/:id error :" + error1);


        console.log("allias_issue=========>>>>>>>>" + allias_issue);

        Issue.find({ "_id": allias_issue }, { "user": 0 }, function (err, issue) {

            console.log("issue" + JSON.stringify(issue));

            if (issue.length != 0) {
                var issue_rtrn = '[{"_id":"' + issue[0]._id + '","municipality":"' + issue[0].municipality + '","image_name":"' + issue[0].image_name + '","issue":"' + issue[0].issue + '","device_id":"' + issue[0].device_id + '","value_desc":"' + issue[0].value_desc + '","comments":"' + issue[0].comments + '","create_at":"' + issue[0].create_at + '","loc":{"type":"Point","coordinates":[' + issue[0].loc.coordinates + ']},"status":"' + status + '", "city_address":"' + cf_city_address + '","bug_id":"' + myid + '"},' + body1 + ']';
                console.log("issue_rtrn====>>>" + issue_rtrn);

                callback(issue_rtrn);

            }
            else {
                callback([]);
            }

        });
    });
    
    
}

router.post('/is_activate_user', function (req, res) {

    var _activate_email = '';
    var _activate_sms = '';
    console.log(req);

    if (req.body.email != undefined || req.body.email != '') {
        act_email.find({ "email": req.body.email }, { "activate": 1 }, function (req8, res8) {
            console.log("res8" + res8.length);
            if (res8.length>0) {
                _activate_email = res8[0].activate;
            } 

            if (req.body.mobile_num != undefined || req.body.mobile_num != '') {

                act_mobile.find({ "mobile_num": req.body.mobile }, { "activate": 1 }, function (req9, res9) {
                    console.log("res9" + res9);        
                    if (res9.length > 0) {
                        _activate_sms = res9[0].activate;
                    }
                    console.log([{ "activate_email": _activate_email, "activate_sms": _activate_sms }]);

                    res.send([{ "activate_email": _activate_email, "activate_sms": _activate_sms }]);

                });
            }
        });
    }

    
    /*
    if (req.body.email != undefined || req.body.email != '') {
        console.log("1");
        act_User.find({ "uuid": "web-site", "email": req.body.email }, { "activate": 1 }, function (req8, res8) {
            var _res8 = JSON.stringify(res8);
            console.log(JSON.stringify(res8));

            if (_res8.length != '2') {
                _activate_email = res8[0].activate;
            }

            if (req.body.mobile_num != undefined || req.body.mobile_num != '') {

                act_User.find({ "uuid": "web-site", "mobile_num": req.body.mobile }, { "activate_sms": 1 }, function (req9, res9) {
                    var _res9 = JSON.stringify(res9);

                    if (_res9.length != '2') {
                        _activate_sms = res9[0].activate_sms;
                    } 

                    res.send([{ "activate_email": _activate_email, "activate_sms": _activate_sms}]);
                });
            }
        });
    }
    */
});

router.post('/activate_user', function (req, res) {
   // console.log(req);
    if (req.query.uuid != undefined) {
        console.log("7");
        if (req.query.hasOwnProperty('uuid')) {
            if (req.query.uuid == "web-site") {
                if (req.query.email != undefined) {
                    //check email
                    act_email.find({ "email": req.query.email }, function (err, resp1) {

                        console.log("resp1===>" + resp1);
                        if (resp1.length > 0) {
                            var text_act = '';
                            var possible = "0123456789";

                            for (var i = 0; i < 4; i++) {
                                text_act += possible.charAt(Math.floor(Math.random() * possible.length));
                            }

                            act_email
                            
                            
                            act_email.update({ "email": req.query.email }, { $set: { "activate": text_act, } }, function (err2, resp2) {

                                if (err2)
                                    console.log(err2);

                                console.log("resp2===>" + JSON.stringify(resp2));
                                // create reusable transporter object using the default SMTP transport 
                                var transporter = nodemailer.createTransport('smtps://' + config.config.email + ':' + config.config.password_email + '@smtp.gmail.com');

                                // setup e-mail data with unicode symbols 
                                var mailOptions = {
                                    from: '"Sense.City " <info@sense.city>', // sender address 
                                    to: req.query.email, // list of receivers 
                                    subject: 'Αποστολή κωδικού ενεργοποίησης ', // Subject line 
                                    text: 'Κωδικός ενεργοποίησης : ', // plaintext body 
                                    html: 'Κωδικός ενεργοποίησης :' + text_act // html body 
                                };

                                // send mail with defined transport object 
                                transporter.sendMail(mailOptions, function (error, info) {
                                    if (error) {
                                        return console.log(error);
                                    }
                                    res.send([{ "Status": "send" }]);

                                    //console.log('Message sent: ' + info.response);
                                });
                            });
                        } else {//insert email to collection
                            var text_act = '';
                            var possible = "0123456789";

                            for (var i = 0; i < 4; i++)
                                text_act += possible.charAt(Math.floor(Math.random() * possible.length));

                            var activate_email = new act_email({
                                email: req.query.email,
                                activate: text_act
                            });

                            activate_email.save(function (err1, resp) {
                                // create reusable transporter object using the default SMTP transport 
                                var transporter = nodemailer.createTransport('smtps://' + config.config.email + ':' + config.config.password_email + '@smtp.gmail.com');

                                // setup e-mail data with unicode symbols 
                                var mailOptions = {
                                    from: '"Sense.City " <info@sense.city>', // sender address 
                                    to: req.query.email, // list of receivers 
                                    subject: 'Αποστολή κωδικού ενεργοποίησης ', // Subject line 
                                    text: 'Κωδικός ενεργοποίησης : ', // plaintext body 
                                    html: 'Κωδικός ενεργοποίησης :' + text_act // html body 
                                };

                                // send mail with defined transport object 
                                transporter.sendMail(mailOptions, function (error, info) {
                                    if (error) {
                                        return console.log(error);
                                    }
                                    res.send([{ "Status": "send" }]);
                                });



                            });

                        }
                    });
                }

                if (req.query.mobile != undefined) {
                    //Check mobile number
                    act_mobile.find({ "mobile_num": req.query.mobile }, function (err, resp1) {
                        console.log(JSON.stringify(resp1));
                        if (resp1.length > 0) {
                            console.log("1");
                            request({
                                url: "https://api.theansr.com/v1/sms/verification_pin",
                                method: "POST",
                                form: { 'sender': mob_municipality, 'recipients': '30' + req.query.mobile },
                                headers: { "Authorization": 'Basic ' + mob_sms_key_fibair_base64 }
                            }, function (err1, response) {
                                act_mobile.update({ "_id": resp1._id }, { $set: { "mobile_num": req.query.mobile, "activate_sms": JSON.parse(response.body).verification_pin } }, { "upsert": true }, function (err1, resp1) {
                                    res.send({ "status": "send sms" });
                                });

                            });

                        } else {//insert send sms

                            console.log("2");
                            var mob_municipality = '';
                            var mob_sms_key_fibair = '';

                            if (req.query.lat != undefined && req.query.long != undefined) {
                                Municipality.find({ boundaries: { $geoIntersects: { $geometry: { "type": "Point", "coordinates": [req.query.long, req.query.lat] } } } }, { "municipality": 1, "sms_key_fibair": 1 }, function (req_mun, res_mun) {
                                    if (res_mun != undefined) {
                                        if (res_mun[0].sms_key_fibair != undefined) {
                                            mob_municipality = res_mun[0].municipality;
                                            mob_sms_key_fibair = res_mun[0].sms_key_fibair;

                                            if (mob_sms_key_fibair != '') {
                                                
                                              //  act_mobile.find({ "uuid": req.query.uuid, "name": req.query.name/*, "mobile_num": req.query.mobile*/ }, function (err, resp) {
                                                    var mob_sms_key_fibair_base64 = new Buffer(mob_sms_key_fibair + ":").toString("base64");

                                                    request({
                                                        url: "https://api.theansr.com/v1/sms/verification_pin",
                                                        method: "POST",
                                                        form: { 'sender': mob_municipality, 'recipients': '30' + req.query.mobile },
                                                        headers: { "Authorization": 'Basic ' + mob_sms_key_fibair_base64 }
                                                    }, function (err1, response) {
                                                    
                                                        var activate_mobile = new act_mobile({
                                                            mobile_num: req.query.mobile,
                                                            activate: JSON.parse(response.body).verification_pin
                                                        });

                                                        activate_mobile.save(function (err1, resp) {
                                                            res.send({ "status": "send sms" });
                                                        });

                                                        });

                                               // });
                                            }
                                        }
                                    }
                                });
                            }



                            

                        }
                    });


                }




            }
        }



        console.log("9");


        if (req.query.hasOwnProperty('uuid') && req.query.hasOwnProperty('name') && req.query.hasOwnProperty('email')) {

            if (req.query.uuid != "web-site") {
                act_User.find({ "uuid": req.query.uuid }, function (err, resp) {

                    if (err) {
                        throw err;
                    }
                    var text_act = "";
                    var possible = "0123456789";

                    for (var i = 0; i < 4; i++)
                        text_act += possible.charAt(Math.floor(Math.random() * possible.length));

                    if (resp != '') {
                        act_User.update({ "_id": resp[0]._id }, { $set: { "name": req.query.name, "email": req.query.email, "permission.communicate_with.email": "true", "activate": text_act, } }, function (err1, resp1) {
                            if (resp1.ok == 1 && req.query.email != "") {
                                console.log("Send mail verify code");


                                // create reusable transporter object using the default SMTP transport 
                                var transporter = nodemailer.createTransport('smtps://' + config.config.email + ':' + config.config.password_email + '@smtp.gmail.com');

                                // setup e-mail data with unicode symbols 
                                var mailOptions = {
                                    from: '"Sense.City " <info@sense.city>', // sender address 
                                    to: req.query.email, // list of receivers 
                                    subject: 'Αποστολή κωδικού ενεργοποίησης ', // Subject line 
                                    text: 'Κωδικός ενεργοποίησης : ', // plaintext body 
                                    html: 'Κωδικός ενεργοποίησης :' + text_act // html body 
                                };

                                // send mail with defined transport object 
                                transporter.sendMail(mailOptions, function (error, info) {
                                    if (error) {
                                        return console.log(error);
                                    }
                                    res.send([{ "Status": "send" }]);
                                    transporter.close();
                                    //console.log('Message sent: ' + info.response);
                                });

                            } else {
                                res.send([{ "Status": "saved" }]);
                            }
                        });

                    } else {


                        var text_act = "";
                        var possible = "0123456789";

                        for (var i = 0; i < 4; i++)
                            text_act += possible.charAt(Math.floor(Math.random() * possible.length));

                        var entry_active_user = new act_User({
                            uuid: req.query.uuid,
                            name: req.query.name,
                            email: req.query.email,
                            mobile_num: '',
                            permission: { send_issues: "true", communicate_with: { email: true, sms: false } },
                            activate: text_act,
                            activate_sms: ''
                        });

                        entry_active_user.save(function (err1, resp) {
                            if (req.query.email != '') {
                                // create reusable transporter object using the default SMTP transport 
                                var transporter = nodemailer.createTransport('smtps://' + config.config.email + ':' + config.config.password_email + '@smtp.gmail.com');

                                // setup e-mail data with unicode symbols 
                                var mailOptions = {
                                    from: '"Sense.City " <info@sense.city>', // sender address 
                                    to: req.query.email, // list of receivers 
                                    subject: 'Αποστολή κωδικού ενεργοποίησης ', // Subject line 
                                    text: 'Κωδικός ενεργοποίησης : ', // plaintext body 
                                    html: 'Κωδικός ενεργοποίησης :' + text_act // html body 
                                };

                                // send mail with defined transport object 
                                transporter.sendMail(mailOptions, function (error, info) {
                                    if (error) {
                                        return console.log(error);
                                    }
                                    res.send([{ "Status": "send" }]);
                                    transporter.close();
                                });
                            } else {
                                res.send([{ "Status": "saved" }]);
                            }

                        });

                    }

                });


            }
        }
        else if (req.query.hasOwnProperty('uuid') && req.query.hasOwnProperty('name') && req.query.hasOwnProperty('mobile')) {
            console.log("sms");
            var mob_municipality = '';
            var mob_sms_key_fibair = '';

            if (req.query.lat != undefined && req.query.long != undefined) {
                Municipality.find({ boundaries: { $geoIntersects: { $geometry: { "type": "Point", "coordinates": [req.query.long, req.query.lat] } } } }, { "municipality": 1, "sms_key_fibair": 1 }, function (req_mun, res_mun) {
                    if (res_mun != undefined) {
                        if (res_mun[0].sms_key_fibair != undefined) {
                            mob_municipality = res_mun[0].municipality;
                            mob_sms_key_fibair = res_mun[0].sms_key_fibair;

                            if (mob_sms_key_fibair != '') {
                                console.log("pre resp");
                                act_User.find({ "uuid": req.query.uuid, "name": req.query.name/*, "mobile_num": req.query.mobile*/ }, function (err, resp) {
                                    console.log("resp" + JSON.stringify(resp));
                                    var mob_sms_key_fibair_base64 = new Buffer(mob_sms_key_fibair + ":").toString("base64");
                                    if (err)
                                        throw err;

                                    if (resp != '') {

                                        request({
                                            url: "https://api.theansr.com/v1/sms/verification_pin",
                                            method: "POST",
                                            form: { 'sender': mob_municipality, 'recipients': '30' + req.query.mobile },
                                            headers: { "Authorization": 'Basic ' + mob_sms_key_fibair_base64 }
                                        }, function (err1, response) {

                                            console.log(JSON.stringify(response));

                                            act_User.update({ "_id": resp[0]._id }, { $set: { "name": req.query.name, "mobile_num": req.query.mobile, "permission.communicate_with.sms": "true", "activate_sms": JSON.parse(response.body).verification_pin } }, { "upsert": true }, function (err1, resp1) {
                                                res.send({ "status": "send sms" });
                                            });

                                        });

                                    } else {

                                        request({
                                            url: "https://api.theansr.com/v1/sms/verification_pin",
                                            method: "POST",
                                            form: { 'sender': mob_municipality, 'recipients': '30' + req.query.mobile },
                                            headers: { "Authorization": 'Basic ' + mob_sms_key_fibair_base64 }/*'content-type': 'application/form-data'*/
                                        }, function (err1, response) {
                                            if (err)
                                                console.log(err1);

                                            var entry_active_user = new act_User({
                                                uuid: req.query.uuid,
                                                name: req.query.name,
                                                email: '',
                                                mobile_num: req.query.mobile,
                                                permission: { send_issues: "true", communicate_with: { email: false, sms: true } },
                                                activate: '',
                                                activate_sms: JSON.parse(response.body).verification_pin
                                            });

                                            entry_active_user.save(function (err2, resp2) {
                                                if (err2)
                                                    console.log(err2);

                                                res.send([{ "status": "send sms" }]);
                                            });
                                        });
                                    }
                                });
                            }
                        } else {
                            res.send([{}]);
                        }
                    } else {
                        res.send([{}]);
                    }
                });
            }

        }
    }
});

router.post('/activate_city_policy', function (req, res) {
    if (req.query.long == undefined) {
        res.send([{}]);
    }

    if (req.query.lat == undefined) {
        res.send([{}]);
    }

    Municipality.find({ boundaries: { $geoIntersects: { $geometry: { "type": "Point", "coordinates": [req.query.long, req.query.lat] } } } }, { "municipality": 1, "mandatory_sms": 1, "mandatory_email": 1, "active_sms_service":1 }, function (req1, res1) {
        res.send(res1);
    });
    
});

router.post('/activate_email', function (req, res) {
    console.log(req);
    if (req.query.uuid != "web-site") {

        act_User.update({ "uuid": req.query.uuid, "email": req.query.email, "activate": req.query.code }, {
            $set: {
                "activate": "1", "permission.communicate_with.email": "true"
            }
        }, function (error, activate_user) {

            console.log(error);
            res.send(activate_user);
        });
    } else if (req.query.uuid == "web-site") {
        console.log("activate email");

        console.log("email" + req.query.email + "activate" + req.query.code);

        act_email.update({ "email": req.query.email.toString(), "activate": req.query.code.toString() }, {
            $set: {
                "activate": "1"
            }
        }, function (error, activate_user) {

            console.log(error);
            console.log(activate_user.nModified);

            if (activate_user.nModified == 1) {
                res.send(activate_user);
            } else {
                res.send("");
            }
        });
    } else {
        res.send([{}]);
    }
});

router.post('/activate_mobile', function (req, res) {
    if (req.query.uuid != "web-site") {
        act_User.update({ "uuid": req.query.uuid, "mobile_num": req.query.mobile, "activate_sms": req.query.code }, {
            $set: {
                "activate_sms": "1", "permission.communicate_with.sms": "true" 
            }
        }, function (error, activate_user) {

            console.log(error);
            res.send(activate_user);
        });
    } else if (req.query.uuid == "web-site") {
        act_mobile.update({ "mobile_num": req.query.mobile, "activate": req.query.code }, {
            $set: {
                "activate": "1"
            }
        }, function (error, activate_user) {

            console.log(error);
            res.send(activate_user);
        });
    } else {
        res.send([{}]);
    }

});



router.post('/active_users', function (req, res) {

    if (req.body.hasOwnProperty('uuid') && req.body.hasOwnProperty('name') && req.body.hasOwnProperty('email'))
    {
        if (req.body.uuid == "web-site") { //web use

            act_User.find({"email": req.body.email, "activate": "1"}, function (error, resp) {

                if (error)
                    throw error;

				
                if (resp.length > 0) {
					
                    act_User.findOneAndUpdate({"email": req.body.email}, {
                        name: req.body.name,
                        mobile_num: req.body.mobile_num,
                        permission: {communicate_with: {email: req.body.permission.communicate_with.email, sms: req.body.permission.communicate_with.sms}}
                    }, function (err, resp) {
                        if (err)
                            throw err;
                        res.send({"user_exist": "1"});
                    });

                } else {

                    var text_act = "";
                    var possible = "0123456789";

                    for (var i = 0; i < 4; i++)
                        text_act += possible.charAt(Math.floor(Math.random() * possible.length));

                    var entry_active_user = new act_User({
                        uuid: req.body.uuid,
                        name: req.body.name,
                        email: req.body.email,
                        mobile_num: req.body.mobile_num,
                        permission: {send_issues: req.body.permission.send_issues, communicate_with: {email: req.body.permission.communicate_with.email, sms: req.body.permission.communicate_with.sms}},
                        activate: text_act
                    });

                    entry_active_user.save(function (err1, resp) {
                        if (err1)
                            throw err1;
                        res.send(resp);
                        // create reusable transporter object using the default SMTP transport 
                        var transporter = nodemailer.createTransport('smtps://' + config.config.email + ':' + config.config.password_email + '@smtp.gmail.com');

                        // setup e-mail data with unicode symbols 
                        var mailOptions = {
                            from: '"Sense.City " <info@sense.city>', // sender address 
                            to: req.body.email, // list of receivers 
                            subject: 'Αποστολή κωδικού ενεργοποίησης ', // Subject line 
                            text: 'Κωδικός ενεργοποίησης : ', // plaintext body 
                            html: 'Κωδικός ενεργοποίησης :' + text_act // html body 
                        };

                        // send mail with defined transport object 
                        transporter.sendMail(mailOptions, function (error, info) {
                            if (error) {
                                return console.log(error);
                            }
                            console.log('Message sent: ' + info.response);
                        });
                    });
                }
            });
        } else { // Mobile use
            act_User.find({"uuid": req.body.uuid, "email": req.body.email}, function (error, resp) {
				
                if (error)
                    throw error;
				
				var text_act = "";
				var possible = "0123456789";
				
                if (resp.length > 0) {
					
					if (resp[0].activate == "1") {
						text_act="1";
					}
					else{
						for (var i = 0; i < 4; i++)
							text_act += possible.charAt(Math.floor(Math.random() * possible.length));
					}
						act_User.findOneAndUpdate({"uuid": req.body.uuid, "email": req.body.email}, {
							name: req.body.name,
							email: req.body.email,
							mobile_num: req.body.mobile_num,
							activate:text_act,
							permission: {communicate_with: {email: req.body.permission.communicate_with.email, sms: req.body.permission.communicate_with.sms}}
						}, function (err, resp1) {
							if (err)
                                throw err;

							if(resp1.activate != "1"){
								
                                var transporter = nodemailer.createTransport('smtps://' + config.config.email + ':' + config.config.password_email + '@smtp.gmail.com');

								// setup e-mail data with unicode symbols 
								var mailOptions = {
									from: '"Sense.City " <info@sense.city>', // sender address 
									to: req.body.email, // list of receivers 
									subject: ' Αποστολή κωδικού ενεργοποίησης ', // Subject line 
									text: 'Κωδικός ενεργοποίησης :' + text_act, // plaintext body 
									html: 'Κωδικός ενεργοποίησης :' + text_act // html body 
								};

								// send mail with defined transport object 
								transporter.sendMail(mailOptions, function (error, info) {
									if (error) {
										return console.log(error);
									}
									console.log('Message sent: ' + info.response);
								});
							
							}
							// we have the updated user returned to us
							res.send(resp1);

						});					
				}else {

						var text_act = "";
						var possible = "0123456789";

						for (var i = 0; i < 4; i++)
							text_act += possible.charAt(Math.floor(Math.random() * possible.length));

						var entry_active_user = new act_User({
							uuid: req.body.uuid,
							name: req.body.name,
							email: req.body.email,
							mobile_num: req.body.mobile_num,
							permission: {send_issues: req.body.permission.send_issues, communicate_with: {email: req.body.permission.communicate_with.email, sms: req.body.permission.communicate_with.sms}},
							activate: text_act
						});

						entry_active_user.save(function (err1, resp) {
							if (err1)
								throw err1;
							res.send(resp);
							// create reusable transporter object using the default SMTP transport 
                            var transporter = nodemailer.createTransport('smtps://' + config.config.email + ':' + config.config.password_email + '@smtp.gmail.com');

							// setup e-mail data with unicode symbols 
							var mailOptions = {
								from: '"Sense.City " <info@sense.city>', // sender address 
								to: req.body.email, // list of receivers 
								subject: ' Αποστολή κωδικού ενεργοποίησης ', // Subject line 
								text: 'Κωδικός ενεργοποίησης :' + text_act, // plaintext body 
								html: 'Κωδικός ενεργοποίησης :' + text_act // html body 
							};

							// send mail with defined transport object 
							transporter.sendMail(mailOptions, function (error, info) {
								if (error) {
									return console.log(error);
								}
								console.log('Message sent: ' + info.response);
							});
						});
					}
            }).sort({"create_at":-1}).limit(1);
        }
    }
});

router.get('/policy', function (req, res) {
    res.send({ "policy": "<div class=\"container text- center\" style=\"padding- top: 100px;\"><div class=\"call- to - action\"><h1 class=\"text- primary\" style=\"color:#808080;\">Όροι και Προϋποθέσεις</h1></div><div class=\"row\" style=\"margin- left:0px;margin-right:0px; padding-top:50px; \"><div class=\"col- lg - 10 col-lg - offset - 1\"><div class=\"row\" style=\"margin- left:0px;margin-right:0px; \"><h2 style=\"color:#808080;text-align:left\">Εισαγωγή</h2><p style=\"color: #808080;text-align:justify\">Το λογισμικό SenseCity αποτελεί ένα ολοκληρωμένο πληροφοριακό σύστημα όπου οι χρήστες αποστέλλουν ηλεκτρονικά πληροφορίες σε ένα διακομιστή (server). Οι χρήστες έχουν ταυτοποιηθεί μέσω του κινητού τηλεφώνου ή το email τους και αποδέχονται κάθε φορά να στείλουν τα δεδομένα όπως όνομα, email &amp; αριθμό τηλεφώνου τους. Επίσης περιλαμβάνονται πληροφορίες δεδομένα γεωτοποθεσίας, φωτογραφικό υλικό και αλφαριθμητικά δεδομένα (κείμενο) . Ο διακομιστής συλλέγει αυτά τα δεδομένα και τα διατηρεί με ασφάλεια. Πρόσβαση παρέχεται σε πιστοποιημένο προσωπικό της εταιρίας καθώς και σε νομικά πρόσωπα (ΟΤΑ) που ως πιστοποιημένοι χρήστες έχουν αποδεχτεί του όρους χρήσης με την χρήση της πλατφόρμας.Ειδικό πληροφοριακό υποσύστημα (διαχειριστικό σύστημα) παρέχει πρόσβαση μέσω σύνδεσης στο διαδίκτυο στα δεδομένα που αποθηκεύει ο διακομιστής. Πρόσβαση έχουν Νομικά Πρόσωπα Δημοσίου Δικαίου και εξουσιοδοτημένοι εκπρόσωποι τους . ΝΠΔΔ δύναται να αποτελούν Δήμοι, Δημοτικές Επιχειρήσεις, Υπουργεία κ.α. </p><h2 style=\"color: #808080;text-align:left\">Πολιτική Προστασίας Προσωπικών Δεδομένων</h2><p style=\"color: #808080;text-align:justify\">Σκοπός της παρούσας Πολιτικής Προστασίας Προσωπικών Δεδομένων είναι να περιγραφεί η διαχείριση της παρούσας ιστοσελίδας και διαδικτυακών εφαρμογών φορητών συσκευών (mobile applications) με την εμπορική ονομασία SenseCity που ανήκει στην Ομάδα Αρχιτεκτονικής και Διαχείρισης Δικτύων του Τμ. ΗΜΤΥ του Παν. Πατρών (Η Εταιρία) αναφορικά με την αποθήκευση και επεξεργασία των προσωπικών δεδομένων των χρηστών της ιστοσελίδας και των εφαρμογών φορητών συσκευών. Η εταιρία εγγυάται το απόρρητο και την ασφάλεια των προσωπικών δεδομένων των χρηστών σύμφωνα με τους νόμους 2471/1997 και 3471/2006 όπως ισχύουν τροποποιημένοι.</p><h2 style=\"color: #808080;text-align:left\">Δεδομένα Πλοήγησης</h2><p style=\"color: #808080;text-align:justify\">Κατά τη διάρκεια της κανονικής λειτουργίας της παρούσας ιστοσελίδας και των εφαρμογών φορητών συσκευών το λογισμικό που χρησιμοποιείται για την ομαλή λειτουργία των συστημάτων και υποσυστημάτων του SenseCity συλλέγουν δεδομένα που αφορούν τα κάτωθι: τύπο φυλλομετρητή, λειτουργικό σύστημα, όνομα ιστοτόπου από τον οποίο εισήλθαν στην παρούσα ιστοσελίδα, πληροφορίες για τις σελίδες που επισκέπτεται ο χρήστης εντός του παρούσας ιστοσελίδας, η ώρα πρόσβασης, ο χρόνος πλοήγησης, η γλώσσα πλοήγησης. Τα δεδομένα αυτά συλλέγονται ανώνυμα με σκοπό την βελτίωση της ποιότητας και χρηστικότητας της υπηρεσίας και την συλλογή στατιστικών πληροφοριών που αφορούν την χρήση της υπηρεσίας.</p><h2 style=\"color: #808080;text-align:left\">Δεδομένα Γεωγραφικής Θέσης</h2><p style=\"color: #808080;text-align:justify\">Με τη συναίνεση του χρήστη η υπηρεσία (ιστοσελίδα-κινητές εφαρμογές) δύναται να επεξεργάζεται δεδομένα γεωγραφικής θέσης με μη συνεχόμενο τρόπο ώστε να παρέχει τις υπηρεσίες που ζητάει ο χρήστης.</p><h2 style=\"color: #808080;text-align:left\">Ασφάλεια Δεδομένων</h2><p style=\"color: #808080;text-align:justify\">H&nbsp;Εταιρία προστατεύει αυστηρά την ασφάλεια των προσωπικών δεδομένων και τις επιλογές των υποκειμένων των δεδομένων για την προοριζόμενη χρήση τους. Χρησιμοποιεί σύγχρονα τεχνολογικά και βιομηχανικά πρότυπα για την τήρηση της εμπιστευτικότητας και της ακρίβειας των πληροφοριών που της παρέχονται. Ωστόσο, το Διαδίκτυο δεν είναι ένα ασφαλές μέσο, έτσι ώστε η Εταιρία να μπορεί να εγγυηθεί ότι οι πληροφορίες, που υποβάλλονται σε αυτή θα είναι απαλλαγμένες από μη εξουσιοδοτημένη παρεμβολή τρίτων.</p><h2 style=\"color: #808080;text-align:left\">Κανόνες Επεξεργασίας Δεδομένων</h2><p style=\"color: #808080;text-align:justify\">Η επεξεργασία&nbsp; δεδομένων εκτελείται μέσω αυτοματοποιημένων μέσων (ήτοι χρησιμοποιώντας ηλεκτρονικές διαδικασίες) και / ή χειροκίνητα (ήτοι εγγράφως) για το χρόνο που απαιτείται ώστε να επιτευχθούν οι σκοποί για τους οποίους τα δεδομένα έχουν συλλεχθεί και σύμφωνα με την ισχύουσα νομοθεσία για τα προσωπικά δεδομένα.</p><h2 style=\"color: #808080;text-align:left\">Χρήση Δεδομένων από τους Δήμους</h2><p style=\"color: #808080;text-align:justify\">Ο Δήμος σύμφωνα και την σχετική σύμβαση που υπογράφει με την Εταιρία, επιτρέπεται σύμφωνα με το Άρθρο 20 του ν. &nbsp;3979/2011 να προβαίνει στη στατιστική επεξεργασία των δεδομένων που θα συλλέγει από τους χρήστες των εφαρμογών κινητών συσκευών που καταχωρούν αναφορές στο χωρικό πλαίσιο δράσης και ευθύνης του. Η συλλογή και επεξεργασία των δεδομένων από την πλευρά του Δήμου τελείται με σεβασμό του δικαιώματος προστασίας δεδομένων προσωπικού χαρακτήρα και της ιδιωτικότητας των φυσικών προσώπων σύμφωνα με το άρθρο 7 του ν. &nbsp;3979/2011 παρ. 1. Απαγορεύεται ρητά η λήψη, αποθήκευση, μεταβίβαση, αποστολή και αναπαραγωγή οπτικοακουστικών μηνυμάτων ή εγγράφων, που περιέχουν ευαίσθητα δεδομένα προσωπικού χαρακτήρα, σύμφωνα με τις διατάξεις της κείμενης νομοθεσίας για την προστασία ατόμων από την επεξεργασία δεδομένων προσωπικού χαρακτήρα.</p> <h2 style=\"color: #808080;text-align:left\">Αλλαγές Πολιτικής και Όρων</h2><p style=\"color: #808080;text-align:justify\">Οι παρόντες όροι διέπουν τις μεθόδους για την επεξεργασία προσωπικών δεδομένων που παρέχονται από τους χρήστες/ επισκέπτες κατά την πλοήγηση στην ιστοσελίδα μας και τις εφαρμογές φορητών συσκευών. Αυτές οι μέθοδοι μπορεί να χρειαστεί να τροποποιηθούν, ως αποτέλεσμα νέων νόμων που εισέρχονται σε ισχύ ή μετά από εξέταση και ενημέρωση των υπηρεσιών Χρήστη. Ως εκ τούτου, οι όροι μπορεί να τροποποιηθούν με την πάροδο του χρόνου και προτρέπουμε τους επισκέπτες να συμβουλεύονται περιοδικά αυτή τη σελίδα.</p><h2 style=\"color: #808080;text-align:left\">Δήλωση Αποδοχής Όρων Χρήσης Λογισμικού SenseCity</h2><p style=\"color: #808080;text-align:justify\">Ο χρήστης της υπηρεσίας SenseCity δηλώνει τη συγκατάθεσή τους στους παραπάνω όρους χρήσης και ειδικότερα συμφωνεί: Ότι χρησιμοποιεί την υπηρεσία SenseCity με σκοπό να αποστέλλει δεδομένα σχετικά με τη διαχείριση προβλημάτων αρμοδιότητας του Δήμου του. Ότι γνωρίζει πως ο Δήμος επιτρέπεται σύμφωνα με το Άρθρο 20 του ν. &nbsp;3979/2011 να προβαίνει στη στατιστική επεξεργασία των δεδομένων που θα συλλέγει με σεβασμό του δικαιώματος προστασίας δεδομένων προσωπικού χαρακτήρα και της ιδιωτικότητας των φυσικών προσώπων. Ότι η φωτογράφηση, η κατηγοριοποίηση, ο σχολιασμός και η αποστολή συντεταγμένων εκ μέρους του θα γίνεται, λαμβάνοντας υπόψη το δικαίωμα προστασίας των προσωπικών δεδομένων και την ανάγκη να διασφαλίζεται η επεξεργασία όσο το δυνατόν λιγότερων δεδομένων προσωπικού χαρακτήρα.</p></div></div></div></div>"});
});

router.get('/bugidtoalias/:id', function (req, res) {
    var bugParams1 = "?f1=bug_id&o1=equals&v1=" + req.params.id + "&include_fields=id,alias,product";

    request({
        url: bugUrlRest + "/rest/bug" + bugParams1,
        method: "GET"
    }, function (error, response, body) {
        //console.log(body);
        res.send(body);
        });

});

router.get('/active_users', function (req, res) {


    act_User.find({"uuid": req.query.uuid}, function (error, actice_user) {
        //console.log(actice_user);
        res.send(actice_user);

    }).sort({"create_at": -1}).limit(1);




});

router.post('/activate_users', function (req, res) {

    act_User.findOneAndUpdate({"_id": req.body.id1, "uuid": req.body.id2, "activate": req.body.id3}, {
        "activate": "1"
    }, function (error, activate_user) {
        
		console.log(error);
        res.send(activate_user);
    });

});

router.post('/admin/bugs/search', authorization, function (req, res) {
    request({
        url: bugUrlRest + "/rest/bug?" + querystring.stringify(req.body),
        method: "GET"
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {

            if (response.body.result !== null)
            {
                res.send(JSON.parse(body).bugs);
            } else
            {
                res.send([response.body.error]);
            }

        }
    });
});

router.post('/admin/bugs/update', authorization, function (req, res) {
    req.body.token = bugToken;

    request({
        url: bugUrlRest + "/rest/bug/" + req.body.ids[0],
        method: "PUT",
        json: req.body
    }, function (error, response, body) {

        /*if (req.body.cf_city_address != undefined) {
            if (req.body.cf_city_address != '') {                
                request({
                    url: "https://maps.googleapis.com/maps/api/geocode/json?address=" + encodeURI(req.body.cf_city_address) + "&key=" + config.config.key_geocoding,
                    method: "GET"
                }, function (error, response) {*/
        if (req.body.cf_city_address == undefined) {
            req.body.cf_city_address = "";
        }

        var lat = req.body.lat; //JSON.parse(response.body).results[0].geometry.location.lat;
        var lng = req.body.lng; //JSON.parse(response.body).results[0].geometry.location.lng;

        var bugParams1 = "?f1=bug_id&o1=equals&v1=" + req.body.ids[0] + "&include_fields=alias";

                    request({
                        url: bugUrlRest + "/rest/bug" + bugParams1,
                        method: "GET"
                    }, function (error1, response, body) {

                        console.log(JSON.stringify(response));

                        var object_id = JSON.parse(body).bugs[0].alias[0];

                        Issue.update({ "_id": JSON.parse(body).bugs[0].alias[0] }, { $set: { "loc": { "type": "Point", "coordinates": [lng, lat] }, "city_address": req.body.cf_city_address } }, function (err, resp) {
                            if (err) { console.log(err); }
                            if (!error && response.statusCode === 200) {

                                if (response.body.result !== null) {

                                    bodyParam_Update = { "token": bugToken, "ids": [req.body.ids[0]], "cf_city_address": req.body.cf_city_address };

                                    request({
                                        url: bugUrlRest + "/rest/bug/" + req.body.ids[0],
                                        method: "PUT",
                                        json: bodyParam_Update
                                    }, function (error1, response1, body1) {

                                        res.send("ok");
                                    });
                                } else {
                                    res.send([response.body.error]);
                                }

                            }

                        });
                    });
                    
                //});
          //  }
       // }

        
    });
});

router.post('/admin/bugs/comment', authorization, function (req, res) {
    req.body.token = bugToken;
    request({
        url: bugUrlRest + "/rest/bug/" + req.body.id + " /comment",
        method: "GET"
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {

            if (response.body.result !== null)
            {
                res.send(JSON.parse(body));
            } else
            {
                res.send([response.body.error]);
            }

        }
    });
});

router.post('/admin/bugs/comment/add', authorization, function (req, res) {
   
    req.body.token = bugToken;
    request({
        url: bugUrlRest + "/rest/bug/" + req.body.id + " /comment",
        method: "POST",
        json: req.body
    }, function (error, response, body) {

        
        var bugParams1 = "?f1=bug_id&o1=equals&v1=" + req.body.id + "&include_fields=alias,status,product,cf_mobile,cf_cc_mobile";

        request({
            url: bugUrlRest + "/rest/bug" + bugParams1,
            method: "GET"
        }, function (error, response, body) {
        
            var _status_field = ' ';
            if (JSON.parse(body).bugs[0].status == "IN_PROGRESS") {
                _status_field = ' ΕΙΝΑΙ ΣΕ ΕΞΕΛΙΞΗ';
            }
            else if (JSON.parse(body).bugs[0].status == "RESOLVED") {
                _status_field = ' ΟΛΟΚΛΗΡΩΘΗΚΕ';
            }

            Municipality.find({ "municipality": JSON.parse(body).bugs[0].product }, { "sms_key_fibair": 1 }, function (req11, res11) {
                
                var mob_sms_key_fibair_base64 = new Buffer(res11[0].sms_key_fibair + ":").toString("base64");

                if (mob_sms_key_fibair_base64 != undefined) {

                    if (mob_sms_key_fibair_base64 != '') {
                        console.log("send sms (add comment)");
                        console.log("- - - - - - - - - - - - - - - - - - - - - -");
                        console.log("- - - - - - - - - - - - - - - - - - - - - -");
                        console.log("product  ===>>  " + JSON.parse(body).bugs[0].product);
                        console.log("cf_mobile  ===>>  " + JSON.parse(body).bugs[0].cf_mobile);
                        console.log("id  ===>>  " + req.body.id);
                        console.log("_status_field  ===>>  " + _status_field);
                        console.log("'sender': " + JSON.parse(body).bugs[0].product + ", 'recipients': '30'" + JSON.parse(body).bugs[0].cf_mobile + ", 'body':" + JSON.parse(body).bugs[0].product + "'.sense.city! ΤΟ ΑΙΤΗΜΑ ΣΑΣ ΜΕ ΚΩΔΙΚΟ '" + req.body.id + _status_field + "'. ΛΕΠΤΟΜΕΡΕΙΕΣ: http://'" + JSON.parse(body).bugs[0].product + "'.sense.city/bugid.html?issue='" + req.body.id);
                        console.log("- - - - - - - - - - - - - - - - - - - - - -");
                        console.log("- - - - - - - - - - - - - - - - - - - - - -");

                        request({
                            url: "https://api.theansr.com/v1/sms",
                            method: "POST",
                            form: { 'sender': JSON.parse(body).bugs[0].product, 'recipients': '30' + JSON.parse(body).bugs[0].cf_mobile, 'body': JSON.parse(body).bugs[0].product + '.sense.city! ΤΟ ΑΙΤΗΜΑ ΣΑΣ ΜΕ ΚΩΔΙΚΟ ' + req.body.id + _status_field + '. ΛΕΠΤΟΜΕΡΕΙΕΣ: http://' + JSON.parse(body).bugs[0].product + '.sense.city/bugid.html?issue=' + req.body.id },
                            headers: { "Authorization": 'Basic ' + mob_sms_key_fibair_base64, 'content-type': 'application/form-data' }
                        }, function (err, response) {
                            console.log(JSON.stringify("response=====>>>>" + response));
                        });

                        if (JSON.parse(body).bugs[0].cf_cc_mobile != '') {
                            var mobile_array = JSON.parse(body).bugs[0].cf_cc_mobile.split(",");
                            for (var j = 0; j < mobile_array.length; j++) {
                                console.log("send sms list (add comment)");
                                console.log("- - - - - - - - - - - - - - - - - - - - - -");
                                console.log("- - - - - - - - - - - - - - - - - - - - - -");
                                console.log("'sender': " + JSON.parse(body).bugs[0].product + ", 'recipients': '30'" + mobile_array[j] + ", 'body':" + JSON.parse(body).bugs[0].product + "'.sense.city! ΤΟ ΑΙΤΗΜΑ ΣΑΣ ΜΕ ΚΩΔΙΚΟ '" + req.body.id + _status_field + "'. ΛΕΠΤΟΜΕΡΕΙΕΣ: http://'" + JSON.parse(body).bugs[0].product + "'.sense.city/bugid.html?issue='" + req.body.id);
                                console.log("- - - - - - - - - - - - - - - - - - - - - -");
                                console.log("- - - - - - - - - - - - - - - - - - - - - -");
                                request({
                                    url: "https://api.theansr.com/v1/sms",
                                    method: "POST",
                                    form: { 'sender': JSON.parse(body).bugs[0].product, 'recipients': '30' + mobile_array[j], 'body': JSON.parse(body).bugs[0].product + '.sense.city! ΤΟ ΑΙΤΗΜΑ ΣΑΣ ΜΕ ΚΩΔΙΚΟ ' + req.body.id + _status_field + '. ΛΕΠΤΟΜΕΡΕΙΕΣ: http://' + JSON.parse(body).bugs[0].product + '.sense.city/bugid.html?issue=' + req.body.id },
                                    headers: { "Authorization": 'Basic ' + mob_sms_key_fibair_base64, 'content-type': 'application/form-data' }
                                }, function (err, response) {
                                    console.log(JSON.stringify("response=====>>>>" + response));
                               });
                            }
                        }
                    }
                }
            });

        });

        if (!error && response.statusCode === 201) {
            if (response.body.result !== null)
            {
                res.send(body);
            } else
            {
                res.send([response.body.error]);
            }

        }
    });
});

router.post('/admin/bugs/comment/tags', authorization, function (req, res) {
    req.body.token = bugToken;

    req.body.add[0] = "STATUS:" + req.body.add[0];
    req.body.add[1] = "DEPARTMENT:" + req.body.add[1];
    

    request({
        url: bugUrlRest + "/rest/bug/comment/" + req.body.id + "/tags",
        method: "PUT",
        json: req.body
    }, function (error, response, body) {

        console.log(JSON.stringify(response));
        console.log(response);

        if (!error && response.statusCode === 200) {

            if (response.body.result !== null)
            {
                res.send(body);
            } else
            {
                res.send([response.body.error]);
            }
        }
    });
});

router.post('/dashboard', function (req, res) {
  //  Role.find({ username: req.body.username, password: req.body.password, city: req.body.city }, function (err, response) {

        
   // var wordArray = '';
    var uuid = '';

   // console.log(req.body.username);
   // console.log(req.body.password);
    var currentdate1 = new Date();
    if (req.body.username != '' && req.body.password != '') {
        //console.log(currentdate1.getTime());
        //wordArray = currentdate.toString('base64');
        //console.log(wordArray);
        var currentdate = currentdate1.toString();
        var buffer = new Buffer(req.body.username + req.body.password + currentdate);
        var toBase64 = buffer.toString('base64');

        //uuid = new Buffer(currentdate.toString('base64'));
        uuid = toBase64;
        console.log(uuid);
        Role.findOneAndUpdate({ "username": req.body.username, "password": req.body.password, "city": req.body.city }, { $set: { "uuid": uuid, "timestamp": Date.now() * 1000 * 3600 } }, {"new":true}, function (err, doc) {
            if (err)
                    console.log(err);
            //console.log("---------"); console.log("doc=====>>>>" + JSON.stringify(doc)); console.log("---------"); console.log("---------");
           // console.log(wordArray); console.log("---------");
            if (doc != null) {
                res.send([doc]);
            } else {
                res.send("failure");
            }
        });
    } else {
        res.send("failure");
    }

        /*} else {
            res.send("failure");
        }*/
    //});
});

router.get('/get', authentication, function (req, res) {
    res.send("success");
});

router.get('/logout', authentication, function (req, res) {
    Role.update({uuid: req.get('x-uuid')}, {$unset: {"uuid": 1, "timestamp": 1}}, function (err, response) {
        res.send("logout");
    });
});

function is_authenticate(req, res) {
    if (req.uuid != undefined && req.role != undefined) {
        Role.find({ "uuid": req.uuid, "role": req.role }, function (request, response) {     
        });
    }    
    return true;
}


// Subscribe citizen to issue
router.post('/issue_subscribe', function (req, res) {
    
    if (req.body.bug_id != undefined && req.body.email != undefined && req.body.mobile_num != undefined) {
        if (req.body.bug_id != '' && (req.body.email != '' || req.body.mobile_num != '')) {
            console.log("1");
            var bugParams1 = "?f1=bug_id&o1=equals&v1=" + req.body.bug_id + "&include_fields=cf_email,cf_mobile,product,cf_cc_mobile,cf_cc_name,cc,cf_creator,status";

            request({
                url: bugUrlRest + "/rest/bug" + bugParams1,
                method: "GET"
            }, function (error, response, body) {
                console.log(body);
                console.log(JSON.parse(body).bugs);
                console.log(JSON.parse(body).bugs[0].cc[0].length);
                console.log(body.cf_mobile);
                if (JSON.parse(body).bugs[0].cf_email != req.body.email) {
                    for (var i = 0; i < JSON.parse(body).bugs[0].cc.length; i++) {
                        if (JSON.parse(body).bugs[0].cc[i] != req.body.email) {
                            var bodyParams_add = { "token": bugToken, "ids": [req.body.bug_id], "cc": { "add": [req.body.email] } };

                            request({
                                url: bugUrlRest + "/rest/bug/" + req.body.bug_id,
                                method: "PUT",
                                json: bodyParams_add
                            }, function (error1, response1, body1) {
                                console.log("add cc");
                            });
                        }
                    }
                }

                if (JSON.parse(body).bugs[0].cf_mobile != req.body.mobile_num) {
                    console.log("1");
                    if (JSON.parse(body).bugs[0].cf_cc_mobile != req.body.mobile_num) {
                        console.log("2");
                        if (JSON.parse(body).bugs[0].cf_cc_mobile != "") {
                            console.log("3");

                            var mobile_cc = JSON.parse(body).bugs[0].cf_cc_mobile;
                            console.log(mobile_cc);
                            console.log(req.body.mobile_num);
                            console.log(mobile_cc.indexOf(req.body.mobile_num));
                            if (mobile_cc.indexOf(req.body.mobile_num) == -1) {
                                console.log("4");
                                var bodyParams_add_2 = { "token": bugToken, "ids": [req.body.bug_id], "cf_cc_mobile": (JSON.parse(response.body).bugs[0].cf_cc_mobile + "," + req.body.mobile_num) };
                                request({
                                    url: bugUrlRest + "/rest/bug/" + req.body.bug_id,
                                    method: "PUT",
                                    json: bodyParams_add_2
                                }, function (error1, response1, body1) {
                                    console.log("add cf_cc_mobile 1");
                                });
                            }
                        } else {
                            console.log("5");
                            var bodyParams_add_2 = { "token": bugToken, "ids": [req.body.bug_id], "cf_cc_mobile": req.body.mobile_num};
                            request({
                                url: bugUrlRest + "/rest/bug/" + req.body.bug_id,
                                method: "PUT",
                                json: bodyParams_add_2
                            }, function (error1, response1, body1) {
                                console.log(JSON.stringify(body1));

                                console.log("add cf_cc_mobile 2");
                            });
                        }
                    }
                }

                if (JSON.parse(body).bugs[0].cf_creator != req.body.name) {
                    if (JSON.parse(body).bugs[0].cf_cc_name != req.body.name) {
                        if (JSON.parse(body).bugs[0].cf_cc_name != "") {
                            var name_cc = JSON.parse(body).bugs[0].cf_cc_name;
                            if (name_cc.indexOf(req.body.name) == -1) {
                                var bodyParams_add_2 = { "token": bugToken, "ids": [req.body.bug_id], "cf_cc_name": (JSON.parse(response.body).bugs[0].cf_cc_name + "," + req.body.name) };
                                request({
                                    url: bugUrlRest + "/rest/bug/" + req.body.bug_id,
                                    method: "PUT",
                                    json: bodyParams_add_2
                                }, function (error1, response1, body1) {
                                    console.log("add cf_cc_name 1");
                                });
                            }
                        } else {
                            var bodyParams_add_2 = { "token": bugToken, "ids": [req.body.bug_id],  "cf_cc_name": req.body.name };
                            request({
                                url: bugUrlRest + "/rest/bug/" + req.body.bug_id,
                                method: "PUT",
                                json: bodyParams_add_2
                            }, function (error1, response1, body1) {
                                console.log("add cf_cc_name 2");
                            });
                        }
                    }
                }


                var bugComment1 = { "token": bugToken, "id": req.body.bug_id, "comment": req.body.comment };

                request({
                    url: bugUrlRest + "/rest/bug/" + req.body.bug_id + "/comment",
                    method: "POST",
                    json: bugComment1
                }, function (error2, bugResponse2, body2) {

                    if (req.body.name != undefined) {
                        tag_name = "name:" + req.body.name;
                    } else {
                        tag_name = "name:undefined";
                    }
                    if (req.body.email != undefined) {
                        tag_email = "email:" + req.body.email;
                    } else {
                        tag_email = "email:undefined";
                    }
                    if (req.body.mobile_num != undefined) {
                        tag_mobile = "mobile:" + req.body.mobile_num;
                    } else {
                        tag_mobile = "mobile:undefined";
                    }

                    var json_data = { "add": [tag_name, tag_email, tag_mobile], "id": bugResponse2.body.id, "token": bugToken };
                    console.log("json_data=>" + JSON.stringify(json_data));

                    request({
                        url: bugUrlRest + "/rest/bug/comment/" + bugResponse2.body.id + "/tags",
                        method: "PUT",
                        json: json_data
                    }, function (error4, response4, body4) {

                        var _status_gr = ' ΑΛΛΑΞΕ';
                        

                        Municipality.find({ "municipality": JSON.parse(body).bugs[0].product }, { "sms_key_fibair": 1 }, function (req11, res11) {
                            var mob_sms_key_fibair_base64 = new Buffer(res11[0].sms_key_fibair + ":").toString("base64");
                            
                            if (mob_sms_key_fibair_base64 != undefined) {
                                



                                if (mob_sms_key_fibair_base64 != '') {
                                    //elegxos gia apostoli sms
                                    
                                    if (JSON.parse(body).bugs[0].cf_mobile != '') {
                                        //send sms
                                        sendsms_function(JSON.parse(body).bugs[0].cf_mobile, JSON.parse(body).bugs[0].product, _status_gr, req.body.bug_id, mob_sms_key_fibair_base64, function (send_sms) {
                                            console.log(send_sms);
                                        });
                                    }

                                    var bugParams3 = "?f1=bug_id&o1=equals&v1=" + req.body.bug_id + "&include_fields=cf_cc_mobile";

                                    request({
                                        url: bugUrlRest + "/rest/bug" + bugParams3,
                                        method: "GET"
                                    }, function (error3, response3, body3) {
                                        if (JSON.parse(body3).bugs[0].cf_cc_mobile != '') {
                                            var str = JSON.parse(body3).bugs[0].cf_cc_mobile;
                                            var mobile_ = str.split(",");

                                            for (var j = 0; j < mobile_.length; j++) {
                                                sendsms_function(mobile_[j], JSON.parse(body).bugs[0].product, _status_gr, req.body.bug_id, mob_sms_key_fibair_base64, function (send_sms) {
                                                    console.log(send_sms);
                                                });
                                            }

                                        }
                                    });
                                    //sendsms_function(JSON.parse(body).bugs[0].product, function (send_sms) {
                                    //  console.log(send_sms);
                                    //});

                                    res.send("OK");
                                } else {
                                    //not send
                                }
                            } else {
                                //not send
                            }
                        });

                    });


                });


            });         
        } else {
            res.status(400).send('Bad Request');
        }

    } else {
        res.status(400).send('Bad Request');
    }
});

function sendsms_function(req_mobile, req_product, req_status, req_bugid, mob_sms_key_fibair_base64, callback) {
    
                console.log("send sms (add comment)");
                console.log("- - - - - - - - - - - - - - - - - - - - - -");
                console.log("product  ===>>  " + req_product);
                console.log("- - - - - - - - - - - - - - - - - - - - - -");
                console.log("cf_mobile  ===>>  " + req_mobile);
                console.log("- - - - - - - - - - - - - - - - - - - - - -");
                console.log("id  ===>>  " + req_bugid);
                console.log("- - - - - - - - - - - - - - - - - - - - - -");
                console.log("_status_field  ===>>  " + req_status);
                console.log("- - - - - - - - - - - - - - - - - - - - - -");
                console.log("'sender': " + req_product + ", 'recipients': '30'" + req_mobile + ", 'body':" + req_product + "'.sense.city! ΤΟ ΑΙΤΗΜΑ ΣΑΣ ΜΕ ΚΩΔΙΚΟ '" + req_bugid + "' '" + req_status + "'. ΛΕΠΤΟΜΕΡΕΙΕΣ: http://'" + req_product + "'.sense.city/bugid.html?issue='" + req_bugid);
                console.log("- - - - - - - - - - - - - - - - - - - - - -");
                console.log("mob_sms_key_fibair_base64 ====>>>" + mob_sms_key_fibair_base64);
                console.log("- - - - - - - - - - - - - - - - - - - - - -");

                request({
                    url: "https://api.theansr.com/v1/sms",
                    method: "POST",
                    form: { 'sender': req_product, 'recipients': '30' + req_mobile, 'body': req_product + '.sense.city! ΤΟ ΑΙΤΗΜΑ ΣΑΣ ΜΕ ΚΩΔΙΚΟ ' + req_bugid + ' ' + req_status + '. ΛΕΠΤΟΜΕΡΕΙΕΣ: http://' + req_product + '.sense.city/bugid.html?issue=' + req_bugid },
                    headers: { "Authorization": 'Basic ' + mob_sms_key_fibair_base64, 'content-type': 'application/form-data' }
                }, function (err, response) {
                    console.log(JSON.stringify("response=====>>>>" + response));
                });

                callback("OK");
            
}

// Recommend issue
router.post('/issue_recommendation', function (req, res) {
// ->req.query.lat
// ->req.query.long
// ->req.query.issue

    var mydate = new Date();
    var my_year = mydate.getFullYear();
    var my_month = mydate.getMonth() + 1;
    if (my_month == 1) {
        my_month = 12;
    } else {
        my_month = my_month - 1;
    }    
    if (my_month < 10) {
        my_month = "0" + my_month;
    }

    var my_date = mydate.getDate();
    

    if (my_date < 10) {
        my_date = "0" + my_date;
    }
    
    Issue.find({
        "issue": req.body.issue, "create_at": {
            $gte: my_year.toString() + "-" + my_month.toString() + "-" + my_date.toString()
        }, "loc": {
            $nearSphere: {
                $geometry: {
                    type: "Point", coordinates: [req.body.long, req.body.lat]
                }, $minDistance: 10
            }
        }
    }, function (req, resp) {
        
        if (resp != undefined) {

            var bugParams1 = "?f1=OP&j1=OR&f2=bug_status&o2=equals&v2=CONFIRMED&f3=bug_status&o3=equals&v3=IN_PROGRESS&f4=CP&f5=OP&j5=OR";

            for (var i = 0; i < resp.length; i++) {
                console.log(i);
                bugParams1 += "&f" + (i + 6) + "=alias&o" + (i + 6) + "=equals&v" + (i + 6) + "=" + resp[i]._id;
            }
            bugParams1 += "&include_fields=alias,status,id,url,cf_city_address";




            request({
                url: bugUrlRest + "/rest/bug" + bugParams1,
                method: "GET"
            }, function (error, resp1, body) {
                if (error) { console.log(error); }

                //console.log(JSON.stringify(resp1));
                //console.log("==>" + body);
                res.send(body);
            });


        } else {
            res.send([{}]);
        }
    });
    
});

router.get('/city_coordinates', function (req, res) {
    console.log(req);
    var city = req.query.city;
    console.log(city);
    Municipality.find({ "municipality": city }, { "boundaries": 1 }, function (req1, res1) {
        console.log("=====>>>" + req1);
        res.send(res1);
    });
});

// Return router
module.exports = router;
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

var config = require('app-config');

mongoose.connect('mongodb://' + config.config.my_hostname + '/' + config.config.database);

// Models
var Issue = require('../models/issue');
var act_User = require('../models/active_user');
var Role = require('../models/roles.js');
var Municipality = require('../models/municipality');
var cityPolicy = require('../models/citypolicy');

// Routes
//Issue.methods(['get', 'put', 'post', 'delete']);
//Issue.register(router, '/issues');

var bugUrlRest=config.config.bugUrlRest;

//Authorization middleware
function authorization(req, res, next) {


    // /admin [email,mobile], [GET,POST,PUT,DELETE], [admin], allow
    // /admin [email,mobile], [POST,PUT,DELETE], [departmentUser], forbidden
    // /admin, [GET,POST,PUT,DELETE], [all], forbidden


	
    Role.find({uuid: req.get('x-uuid')}, function (err, response) {
        if (response.length > 0 && response[0]["timestamp"] >= Date.now()) {
            var mypath = req.path;
            console.log("----------------------"); console.log("----------------------"); console.log("----------------------"); console.log("----------------------");
            console.log("===========================>>>>>>>>>>>>>>>>>>>>>>>>>>>>" + req.path);
            console.log("----------------------"); console.log("----------------------"); console.log("----------------------"); console.log("----------------------");
            if (mypath.indexOf("admin") != -1){ //req.path === '/admin/bugs/search' || req.path === '/admin/bugs/update' || req.path === '/admin/bugs/comment' || req.path === '/admin/bugs/comment/tags' || req.path === '/admin/bugs/comment/add') {
				//console.log("x-role"+req.get('x-role'));
                if (req.get('x-role') === 'departmentAdmin' || req.get('x-role') === 'sensecityAdmin' || req.get('x-role') === 'departmentUser' || req.get('x-role') === 'cityAdmin') {
					//console.log("success");
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
    Role.find({uuid: req.get('x-uuid')}, function (err, response) {
        if (response.length > 0 && response[0]["timestamp"] >= Date.now()) {
            next();
        } else {
            res.send("failure");
        }
    });
}

//Bugzilla login
var bugUrl = config.config.bugUrl;

var loginData1 = "?login=" + config.config.login + "&password=" + config.config.pwd;

/* var loginData 
        {
            "method": "User.login",
            "params": [{"login": config.config.login, "password": config.config.pwd}],
            "id": 1
        };

var bugToken = "";
request({
    url: bugUrl,
    method: "POST",
    json: loginData
}, function (error, response, body) {*/
var bugToken = "";
request({
    url: bugUrlRest + "/rest/login" + loginData1,
    method: "GET"
}, function (error, response, body) {

    console.log(JSON.stringify(body));
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

//POST router
router.post('/issue', function (req, res) {

    var anonymous_status = "true";

    var return_var;
	var city_name='';
	
	
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
            // console.log(err);
            // console.log(response.length);
            var entry = new Issue({
                loc: {type: 'Point', coordinates: req.body.loc.coordinates},
                issue: req.body.issue,
                device_id: req.body.device_id,
                value_desc: req.body.value_desc,
                comments: req.body.comments
            });


            entry.image_name = req.body.image_name;

            if (response.length > 0)
            {
                entry.municipality = response[0]["municipality"];
				/*console.log(JSON.stringify(response[0]["municipality"]));
				console.log(JSON.stringify(response[0].municipality));
				console.log(JSON.stringify(response[0].municipality_desc));
				console.log(JSON.stringify(response[0]["municipality_desc"]));*/
				city_name = response[0].municipality_desc;
            } else
            {
                entry.municipality = '';
				city_name ='';
            }
			//console.log("city_name ==== " + city_name);
            // console.log(entry);
            entry.save(function (err1, resp) {
                if (err1)
                {
                    console.log(err1);
                } else
                {
					//console.log("bug.url =====>" + bugUrl);
                    if (resp.issue == "garbage" || resp.issue == "road-constructor" || resp.issue == "lighting" || resp.issue == "plumbing" || resp.issue == "protection-policy" || resp.issue == "green" || resp.issue == "environment" )
                    {
                        if (response.length > 0)
                        {

                            var bugData1 = {"token": bugToken ,"summary" : resp.issue ,"priority" : "normal","bug_severity":"normal","cf_city_name" : city_name,"alias" : [resp._id.toString() ],"url" : resp.value_desc,"product" : response[0]["municipality"],"component" : config.config.bug_component,"version": "unspecified"}; 
            
                                            /*var bugData =
                                    {
                                        "method": "Bug.create",
                                        "params": [{"token": bugToken, "summary": resp.issue, "bug_severity": "normal" ,"cf_city_name" : city_name, "alias": resp._id.toString(), "url": resp.value_desc, "product": response[0]["municipality"], "component": config.config.bug_component, "version": "unspecified", "op_sys": "All"}],
                                        "id": 1
                                    };
                                    */

                            
                            request({
                                url: bugUrlRest+"/rest/bug",
                                method: "POST",
                                json: bugData1
                            }, function (error, bugResponse, body) {

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

                    ///* Check the policy
                    /*
					if (response.length > 0){
						cityPolicy.find({"city": response[0]["municipality"], "category": resp.issue}, function (err_2, result) {
							console.log('err2: '+ err_2);
							//console.log('result: '+ result);
							if (result.length == 1) {
								return_var = {"_id": resp._id, "anonymous": result[0].anonymous, "policy_description": result[0].policy_desc};
							} else {
								return_var = {"_id": resp._id, "anonymous": "true", "policy_description": ""};
							}
							res.send(return_var);
						});
					}
					else{
						return_var = {"_id": resp._id, "anonymous": "true", "policy_description": ""};
						res.send(return_var);
                    }
                    */
                    

                }
                return_var = { "_id": resp._id };                
                    res.send(return_var);
            });
        });
    }
});

router.post('/issue/:id', function (req, res) {
    var bodyParams;
    if (req.body.uuid != '' && req.body.name != '' && req.body.email != '') {

        Issue.findOneAndUpdate({"_id": req.params.id}, {
            user: {uuid: req.body.uuid, name: req.body.name, email: req.body.email, phone: req.body.mobile_num}
        }, function (err, resp) {           
			console.log("Update Issue with name,email & mobile num!");
			
            if (err)
                throw err;

            ///* Create user acount to bugzilla			
            var bugCreateuser1 = {"token": bugToken, "email": req.body.email.toString()};
            
            request({
                url: bugUrlRest+"/rest/user",
                method: "POST",
                json: bugCreateuser1
            }, function (error, response, body) {
				if(error){
					console.log("User doesnot created! Error : "+error);
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

                                    request({
                                        url: bugUrlRest + "/rest/bug/comment/" + body2.id + "/tags",
                                        method: "PUT",
                                        json: { "add": ["all", "CONFIRMED"], "id": body2.id, "token": bugToken }
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
            

            res.send({"description": "ok"});

        });
    } else {
        res.send({"description": "no-update"});
    }

});

/* ** Test ** */

router.get('/issue', function (req, res) {

    req.send_user = 0;
    req.send_component = 0;
    req.send_severity = 0;
    req.send_priority = 0;

    get_issues(req, function (result) {        
        res.send(result);
    });

});

router.get('/admin/issue', authentication, function (req, res) {

    req.send_user = 1;
    req.send_component = 1;
    req.send_severity = 1;
    req.send_priority = 1;


    get_issues(req, function (result) {
        res.send(result);
    });

});

var get_issues = function (req, callback) {

    var _bug_extra="";
    var _user_extra = 0;
    console.log("--------------------");
    console.log("--------------------");
    console.log(req);
    console.log("--------------------");
    console.log("--------------------");

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
        _bug_extra += ",bug_severity";
    } else {
        _bug_extra += "";
    }

    console.log(_bug_extra);
    
    

    var x_uuid = req.get('x-uuid');
    if ((req.query.hasOwnProperty("bug_id") || req.query.hasOwnProperty("mobile") || req.query.hasOwnProperty("email"))) {
        if (req.query.bug_id == "" && req.query.mobile == "" && req.query.email == "") {
            callback([{}]);
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

            var bugParams1 = "?f1=bug_id&o1=equals&f2=cf_mobile&o2=equals&f3=cf_email&o3=equals&limit=" + _limit + _sort + _offset + "&include_fields=id,alias,status,cf_authedicated" + _bug_extra;

            if (_bug_id != undefined) {
                bugParams1 += "&v1=" + _bug_id;
            }
            if (_mobile != undefined) {
                bugParams1 += "&v2=" + _mobile;
            }
            if (_email != undefined) {
                bugParams1 += "&v3=" + _email;
            }

            if (!req.query.hasOwnProperty('image_field')) {
                _image = 0;
                //_image = true;
                //console.log("1 _image=" + _image);
            } else {
                if (req.query.image_field == 0) {
                    _image = 0;
                    //_image = false;
                    //console.log("2 _image=" + _image);
                } else {
                    _image = 1;
                    //_image = true;
                    //console.log("2 _image=" + _image);
                }
            }

            console.log(bugParams1);

            var ids = [];
            var bugzilla_results = [];
            var issue_return = [];

            request({
                url: bugUrlRest + "/rest/bug" + bugParams1,
                method: "GET"
            }, function (error, response, body) {
                var i_count = 0;
                var bugs_length = 0;

                console.log("-------------------------------------------------");
                console.log(JSON.parse(body));
                console.log("-------------------------------------------------");
                if (JSON.parse(body).bugs != undefined) {
                    bugs_length = JSON.parse(body).bugs.length;
                }
                console.log(bugs_length);
                for (i_count = 0; i_count < bugs_length; i_count++) {                    
                    ids.push(JSON.parse(body).bugs[i_count].alias[0]);
                    bugzilla_results = JSON.parse(body).bugs;
                }

                if (_image == 0) {
                    Issue.find({ "_id": { $in: ids } }, { "user": 0, "image_name": _image }, function (err, issue) {

                        //new start
                        if (err != null) { console.log("err   =   " + err); }

                        console.log("234567890----====    "+JSON.stringify(issue));
                        console.log("*******************************************"); console.log("*******************************************"); console.log("*******************************************");
                        console.log(issue.length);
                        console.log("*******************************************"); console.log("*******************************************"); console.log("*******************************************");
                        issue_return += '[';


                        //console.log(issue);
                        for (var i = 0; i < issue.length; i++) {

                            var bug_id = 0;
                            var bug_status = "";
                            var bug_authenticate = "0";

                            var bug_component;
                            var bug_priority;
                            var bug_severity;
                            

                            for (var j = 0; j < bugzilla_results.length; j++) {
                                console.log(bugzilla_results[j]);
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
                                    if (bugzilla_results[j].bug_severity != undefined) {
                                        bug_severity = bugzilla_results[j].bug_severity;
                                    }

                                }
                            }

                            issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '","cf_authenticate":"' + bug_authenticate + '", "bug_component":"' + bug_component + '", "bug_priority":"' + bug_priority + '", "bug_severity":"' + bug_severity +'"}';
                            if (i < issue.length - 1) {
                                issue_return += ',';
                            }
                        }

                        issue_return += ']';

                        callback(issue_return);


                    }).sort({ "create_at": _sort_mongo });
                }
                else {

                    Issue.find({ "_id": { $in: ids } }, { "user": _user_extra }, function (err, issue) {

                        //new start
                        if (err != null) { console.log("err   =   " + err); }

                        console.log(JSON.stringify(issue));

                        issue_return += '[';


                        //console.log(issue);
                        for (var i = 0; i < issue.length; i++) {

                            var bug_id = 0;
                            var bug_status = "";
                            var bug_authenticate = "0";

                            var bug_component;
                            var bug_priority;
                            var bug_severity;


                            for (var j = 0; j < bugzilla_results.length; j++) {
                                if (bugzilla_results[j].alias[0] == issue[i]._id) {
                                    bug_id = bugzilla_results[j].id;
                                    bug_status = bugzilla_results[j].status;
                                    bug_authenticate = bugzilla_results[j].cf_authedicated;

                                    if (bugzilla_results[j].component != undefined) {
                                        bug_component = bugzilla_results[j].component;
                                    }
                                    if (bugzilla_results[j].cf_priority != undefined) {
                                        bug_priority = bugzilla_results[j].cf_priority;
                                    }
                                    if (bugzilla_results[j].bug_severity != undefined) {
                                        bug_severity = bugzilla_results[j].bug_severity;
                                    }


                                }
                            }

                            issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '","cf_authenticate":"' + bug_authenticate + '", "bug_component":"' + bug_component + '", "bug_priority":"' + bug_priority + '", "bug_severity":"' + bug_severity +'"}';
                            if (i < issue.length - 1) {
                                issue_return += ',';
                            }
                        }

                        issue_return += ']';

                        callback(issue_return);


                    }).sort({ "create_at": _sort_mongo });
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


        /*if (is_authenticate({ "uuid": req.get('x-uuid'), "role": req.get('x-role')})) {
            console.log("authedicate");
        }
        else {
            console.log("anonymous");
        }*/

        if (!req.query.hasOwnProperty("city") && !req.query.hasOwnProperty("coordinates")) {
            res.send([{ "response": "no-data", "message": "You don't send city - coordinates values!" }]);
        }
        else {


            if (!req.query.hasOwnProperty('startdate')) {
                //_startdate = new Date();
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
                //_startdate = new Date(req.query.startdate).toISOString();

                var partsOfStr = req.query.startdate.split('-');
                _startdate = partsOfStr[0] + "-" + partsOfStr[1] + "-" + partsOfStr[2] + "T00:00:00.000";
            }

            if (req.query.hasOwnProperty('enddate')) {
                //_enddate = new Date(req.query.enddate).toISOString();
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
                //_image = true;
                //console.log("1 _image=" + _image);
            } else {
                if (req.query.image_field == 0) {
                    _image = 0;
                    //_image = false;
                    //console.log("2 _image=" + _image);
                } else {
                    _image = 1;
                    //_image = true;
                    //console.log("2 _image=" + _image);
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
                    //console.log("response ===>" + response[0]);
                    if (response.length > 0) {

                        _product = response[0]["municipality"];

                        //var bugParams1 = "?product=" + _product + "&j_top=OR&query_format=advanced&limit=" + _limit + _status + "&v2=" + _enddate + "&f2=creation_ts&o2=lessthan&v3=" + _startdate + "&f3=creation_ts&o3=greaterthan&v4=" + _issue + "&f4=cf_issues&o4=anywordssubstr&v5=" + _cf_authedicated + _offset + "&f5=cf_authedicated&o5=" + _cf_authedicated_contition + _departments + _sort + _summary + "&include_fields=id,alias,status,cf_authedicated";
                        var bugParams1 = "?product=" + _product + "&query_format=advanced&limit=" + _limit + _status + "&v2=" + _enddate + "&f2=creation_ts&o2=lessthaneq&v3=" + _startdate + "&f3=creation_ts&o3=greaterthaneq&v5=" + _cf_authedicated + _offset + "&f5=cf_authedicated&o5=" + _cf_authedicated_contition + _departments + _sort + _summary + "&include_fields=id,alias,status,cf_authedicated" + _bug_extra;
                        //console.log(bugParams1);
                        var ids = [];
                        var bugzilla_results = [];
                        var issue_return = [];

                        request({
                            url: bugUrlRest + "/rest/bug" + bugParams1,
                            method: "GET"
                        }, function (error, response, body) {

                            //console.log("BUGZILLA ======> " + JSON.stringify(body));
                            var i_count = 0;
                            var bugs_length = 0;

                            if (JSON.parse(body).bugs != undefined) {
                                bugs_length = JSON.parse(body).bugs.length;
                            }
                            for (i_count = 0; i_count < bugs_length; i_count++) {
                                ids.push(JSON.parse(body).bugs[i_count].alias[0]);
                                bugzilla_results = JSON.parse(body).bugs;
                            }

                            //console.log("ids1 ======> "+ids);
                            if (_image == 0) {

                                Issue.find({ "_id": { $in: ids } }, { "user": _user_extra, "image_name": _image }, function (err, issue) {

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

                                    //console.log(issue);
                                    for (var i = 0; i < issue.length; i++) {

                                        var bug_id = 0;
                                        var bug_status = "";
                                        var bug_authenticate = "0";
                                        var bug_component;
                                        var bug_priority;
                                        var bug_severity;

                                        for (var j = 0; j < bugzilla_results.length; j++) {
                                            if (bugzilla_results[j].alias[0] == issue[i]._id) {
                                                bug_id = bugzilla_results[j].id;
                                                bug_status = bugzilla_results[j].status;
                                                bug_authenticate = bugzilla_results[j].cf_authedicated;

                                                if (bugzilla_results[j].component != undefined) {
                                                    bug_component = bugzilla_results[j].component;
                                                }
                                                if (bugzilla_results[j].cf_priority != undefined) {
                                                    bug_priority = bugzilla_results[j].cf_priority;
                                                }
                                                if (bugzilla_results[j].bug_severity != undefined) {
                                                    bug_severity = bugzilla_results[j].bug_severity;
                                                }

                                            }
                                        }

                                        if (_kml == 0) {
                                            issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '","cf_authenticate":"' + bug_authenticate + '", "bug_component":"' + bug_component + '", "bug_priority":"' + bug_priority + '", "bug_severity":"' + bug_severity +'"}';
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

                                Issue.find({ "_id": { $in: ids } }, { "user": _user_extra }, function (err, issue) {
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

                                        for (var j = 0; j < bugzilla_results.length; j++) {
                                            if (bugzilla_results[j].alias[0] == issue[i]._id) {
                                                bug_id = bugzilla_results[j].id;
                                                bug_status = bugzilla_results[j].status;
                                                bug_authenticate = bugzilla_results[j].cf_authedicated;

                                                if (bugzilla_results[j].component != undefined) {
                                                    bug_component = bugzilla_results[j].component;
                                                }
                                                if (bugzilla_results[j].cf_priority != undefined) {
                                                    bug_priority = bugzilla_results[j].cf_priority;
                                                }
                                                if (bugzilla_results[j].bug_severity != undefined) {
                                                    bug_severity = bugzilla_results[j].bug_severity;
                                                }

                                            }
                                        }

                                        if (_kml == 0) {
                                            issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '","cf_authenticate":"' + bug_authenticate + '", "bug_component":"' + bug_component + '", "bug_priority":"' + bug_priority + '", "bug_severity":"' + bug_severity +'"}';
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

                        });
                    } else {
                        _product = '';
                        callback([{}]);
                        //res.send([{}]); // We don't have city with that coordinates                    
                        //return [{}];
                    }
                });
                //end else if there is coordinates
            } else {

                _product = req.query.city;

                //var bugParams1 = "?product=" + _product + "&j_top=OR&query_format=advanced&limit=" + _limit + _status + "&v2=" + _enddate + "&f2=creation_ts&o2=lessthan&v3=" + _startdate + "&f3=creation_ts&o3=greaterthan&v4=" + _issue + "&f4=cf_issues&o4=anywordssubstr&v5=" + _cf_authedicated + _offset + "&f5=cf_authedicated&o5=" + _cf_authedicated_contition + _departments + _sort + _summary + "&include_fields=id,alias,status,cf_authedicated";
                var bugParams1 = "?product=" + _product + "&query_format=advanced&limit=" + _limit + _status + "&v2=" + _enddate + "&f2=creation_ts&o2=lessthaneq&v3=" + _startdate + "&f3=creation_ts&o3=greaterthaneq&v5=" + _cf_authedicated + _offset + "&f5=cf_authedicated&o5=" + _cf_authedicated_contition + _departments + _sort + _summary + "&include_fields=id,alias,status,cf_authedicated" + _bug_extra;

                var ids = [];
                var bugzilla_results = [];
                var issue_return = [];
                //console.log(bugParams1);
                request({
                    url: bugUrlRest + "/rest/bug" + bugParams1,
                    method: "GET"
                }, function (error, response, body) {
                    //console.log("BUGZILLA ======> " + JSON.stringify(body));
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
                        //console.log("ids ===>> " + ids);
                        // This query works only if is valid object ids
                        // if not we have error like {CastError: Cast to ObjectId failed for value "12345g43" at path "_id"}.

                        Issue.find({ "_id": { $in: ids } }, { "user": _user_extra, "image_name": _image }, function (err, issue) {
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

                                    for (var j = 0; j < bugzilla_results.length; j++) {
                                        if (bugzilla_results[j].alias[0] == issue[i]._id) {
                                            bug_id = bugzilla_results[j].id;
                                            bug_status = bugzilla_results[j].status;
                                            bug_authenticate = bugzilla_results[j].cf_authedicated;

                                            if (bugzilla_results[j].component != undefined) {
                                                bug_component = bugzilla_results[j].component;
                                            }
                                            if (bugzilla_results[j].cf_priority != undefined) {
                                                bug_priority = bugzilla_results[j].cf_priority;
                                            }
                                            if (bugzilla_results[j].bug_severity != undefined) {
                                                bug_severity = bugzilla_results[j].bug_severity;
                                            }


                                        }
                                    }

                                    if (_kml == 0) {
                                        issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '","cf_authenticate":"' + bug_authenticate + '", "bug_component":"' + bug_component + '", "bug_priority":"' + bug_priority + '", "bug_severity":"' + bug_severity +'"}';
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

                            //new end
                            //res.send(issue);
                        }).sort({ "create_at": _sort_mongo });//.limit(_limit);

                    } else {
                        Issue.find({ "_id": { $in: ids } }, { "user": _user_extra }, function (err, issue) {
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

                                for (var j = 0; j < bugzilla_results.length; j++) {
                                    if (bugzilla_results[j].alias[0] == issue[i]._id) {
                                        bug_id = bugzilla_results[j].id;
                                        bug_status = bugzilla_results[j].status;
                                        bug_authenticate = bugzilla_results[j].cf_authedicated;

                                        if (bugzilla_results[j].component != undefined) {
                                            bug_component = bugzilla_results[j].component;
                                        }
                                        if (bugzilla_results[j].cf_priority != undefined) {
                                            bug_priority = bugzilla_results[j].cf_priority;
                                        }
                                        if (bugzilla_results[j].bug_severity != undefined) {
                                            bug_severity = bugzilla_results[j].bug_severity;
                                        }

                                    }
                                }

                                if (_kml == 0) {
                                    issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '","cf_authenticate":"' + bug_authenticate + '", "bug_component":"' + bug_component + '", "bug_priority":"' + bug_priority + '", "bug_severity":"' + bug_severity+'"} ';

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

                });
            } //

        } //end else if no city AND coordinates
    }
    else {
        callback([{}]);
    }
}

/*
router.get('/issue/:city', function (req, res) {

    var _startdate = new Date();
    var _enddate = new Date();
    var _coordinates;
    var _distance;
    var _issue = [];
    var _limit;
    var _sort;
    var _loc_var;
    var newdate = new Date();
    var _image;
    var _list_issue;
    var _product = req.params.city;
    var _status = [];
	var _cf_authedicated=1;
	var _kml;
	var _user = false;
	var _default_issue='';
	
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

	if (!req.query.hasOwnProperty('includeAnonymous')){
		_cf_authedicated = 1;
	}
	else{
		if(req.query.includeAnonymous==1){
			_cf_authedicated = [0,1];
			_default_issue = "---";
		}else{
			_cf_authedicated = 1;
		}
		
	}
	
    if (!req.query.hasOwnProperty('issue') || req.query.issue === 'all')
    {
		if(_default_issue=="---"){
			_issue = [_default_issue,"garbage", "plumbing", "lighting", "road-contructor", "green", "protection-policy", "enviroment"];
		}else{
			_issue = ["garbage", "plumbing", "lighting", "road-contructor", "green", "protection-policy", "enviroment"];
		}
    } else {


        var issue_split = req.query.issue.split("|");

        switch (issue_split.length) {
            case 1:
				if(_default_issue=="---"){
					_issue.push("---");
				}
                _issue.push(issue_split[0]);
                break;
            case 2:
				if(_default_issue=="---"){
					_issue.push("---");
				}
                _issue.push(issue_split[0]);
                _issue.push(issue_split[1]);
                break;
            case 3:
				if(_default_issue=="---"){
					_issue.push("---");
				}
                _issue.push(issue_split[0]);
                _issue.push(issue_split[1]);
                _issue.push(issue_split[2]);
                break;
			case 4:
				if(_default_issue=="---"){
					_issue.push("---");
				}
                _issue.push(issue_split[0]);
                _issue.push(issue_split[1]);
                _issue.push(issue_split[2]);
				_issue.push(issue_split[3]);
                break;
            case 5:
				if(_default_issue=="---"){
					_issue.push("---");
				}
                _issue.push(issue_split[0]);
                _issue.push(issue_split[1]);
                _issue.push(issue_split[2]);
				_issue.push(issue_split[3]);
				_issue.push(issue_split[4]);
                break;
            case 6:
				if(_default_issue=="---"){
					_issue.push("---");
				}
				
                _issue.push(issue_split[0]);
                _issue.push(issue_split[1]);
                _issue.push(issue_split[2]);
				_issue.push(issue_split[3]);
				_issue.push(issue_split[4]);
				_issue.push(issue_split[5]);
                break;
            case 7:
				if(_default_issue=="---"){
					_issue.push("---");
				}
                _issue.push(issue_split[0]);
                _issue.push(issue_split[1]);
                _issue.push(issue_split[2]);
				_issue.push(issue_split[3]);
				_issue.push(issue_split[4]);
				_issue.push(issue_split[5]);
				_issue.push(issue_split[6]);
                break;
            default:
                if(_default_issue=="---"){
					_issue = [_default_issue,"garbage", "plumbing", "lighting", "road-contructor", "green", "protection-policy", "enviroment"];
				}else{
					_issue = ["garbage", "plumbing", "lighting", "road-contructor", "green", "protection-policy", "enviroment"];
				}
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
    if (!req.query.hasOwnProperty('image_field'))
    {
        _image = true;
        
    } else {
        if (req.query.image_field == 0)
        {
            _image = false;
        
        } else {
            _image = true;
        
        }
    }

    if (!req.query.hasOwnProperty('list_issue'))
    {
        _list_issue = false;
    } else {
        if (req.query.image_field == 0)
        {
            _list_issue = false;
        } else {
            _list_issue = true;
        }
    }

    if (!req.query.hasOwnProperty('status'))
    {
        _status = ["CONFIRMED", "IN_PROGRESS"];
    } else {
        var status_split = req.query.status.split("|");


        switch (status_split.length) {
            case 1:
                _status.push(status_split[0]);
                break;
            case 2:
                _status.push(status_split[0]);
                _status.push(status_split[1]);
                break;
            case 3:
                _status.push(status_split[0]);
                _status.push(status_split[1]);
                _status.push(status_split[2]);
                break;
            default:
                _status = ["CONFIRMED", "IN_PROGRESS"];
                break;
        }

    }
	
	
    
	if (!req.query.hasOwnProperty('kml')){
		_kml = 0;
	}
	else{
		_kml = req.query.kml;
	}	
	
	_user = false;
	
    var bugParams =
            {
                "method": "Bug.search",
                "params": [{"product": _product, "order": "bug_id DESC", "limit": _limit, "status": _status, "cf_issues": _issue, "cf_authedicated":_cf_authedicated, "f1": "creation_ts", "o1": "greaterthan", "v1": _startdate, "include_fields": ["id", "alias", "status"]}],
                "id": 1
            };

    var ids = [];
    var bugzilla_results = [];
    var issue_return = [];
	
    request({
        url: bugUrl,
        method: "POST",
        json: bugParams
    }, function (error, response, body) {
		
		
		
		//console.log("Get issues from bugzilla with city in the url!");
		
		var i_count = 0;
		
		//console.log(JSON.stringify(body));
		
        if (body==undefined || body==null || body.length < 1 )
        {
            res.send([{}]);
        } else if (body.result.bugs==undefined || body.result.bugs.length==undefined){
			res.send([{}]);
		}
		else {

            for (i_count = 0; i_count < body.result.bugs.length; i_count++)
            {
                ids.push(body.result.bugs[i_count].alias[0]);
                bugzilla_results = body.result.bugs;
            }
			console.log(ids);
            if (_list_issue) {
                
                Issue.find({'_id': {$in: ids}, 'issue': {$in: ['garbage', 'lighting', 'road-contructor', 'plumbing', 'protection-policy', 'green', 'enviroment']}}, {"user":_user}, function (err, issue) {

					//new start
                    if(err!=null){console.log("err   =   " + err);}
					if(_kml==0){
						issue_return += '[';
					}else if(_kml==1){				
						issue_return += '<?xml version="1.0" encoding="UTF-8"?> <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom"> <Document>'+
						'<name>sensecity.kml</name>'+
						'<Style id="s_ylw-pushpin_hl">'+
						'<IconStyle>'+
						'<color>ff7fffff</color>'+
						'<scale>1.3</scale>'+
						'<Icon>'+
						'<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>'+
						'</Icon>'+
						'<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>'+
						'</IconStyle>'+
						'</Style>'+
						'<StyleMap id="m_ylw-pushpin">'+
						'<Pair>'+
						'<key>normal</key>'+
						'<styleUrl>#s_ylw-pushpin</styleUrl>'+
						'</Pair>'+
						'<Pair>'+
						'<key>highlight</key>'+
						'<styleUrl>#s_ylw-pushpin_hl</styleUrl>'+
						'</Pair>'+
						'</StyleMap>'+
						'<Style id="s_ylw-pushpin">'+
						'<IconStyle>'+
						'<color>ff7fffff</color>'+
						'<scale>1.1</scale>'+
						'<Icon>'+
						'<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>'+
						'</Icon>'+
						'<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>'+
						'</IconStyle>'+
						'</Style>'+
						'<Folder>'+
						'<name>sensecity</name>'+
						'<open>1</open>';						
					}
					
                    for (var i = 0; i < issue.length; i++) {

                        var bug_id = 0;
                        var bug_status = "";

                        for (var j = 0; j < bugzilla_results.length; j++) {
                            if (bugzilla_results[j].alias[0] == issue[i]._id) {
                                bug_id = bugzilla_results[j].id;
                                bug_status = bugzilla_results[j].status;
                            }
                        }
						if(_kml==0){
							issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '"}';
							if (i < issue.length - 1) {
								issue_return += ',';
							}
						}else if(_kml==1){							
							issue_return +='<Placemark>'+
								'<name>'+issue[i].issue+' - '+issue[i].value_desc+'</name>'+
								'<description><![CDATA[<img src="'+issue[i].image_name+'"/><a href="http://'+issue[i].municipality+'.sense.city/scissuemap.html#?issue_id='+issue[i]._id+'">http://'+issue[i].municipality+'.sense.city/scissuemap.html#?issue_id='+issue[i]._id+'</a>]]></description>'+
								'<LookAt>'+
									'<longitude>'+issue[i].loc.coordinates[0]+'</longitude>'+
									'<latitude>'+issue[i].loc.coordinates[1]+'</latitude>'+
									'<altitude>0</altitude>'+
									'<heading>-176.4101948194351</heading>'+
									'<tilt>70.72955317497231</tilt>'+
									'<range>1952.786634342951</range>'+
									'<gx:altitudeMode>relativeToSeaFloor</gx:altitudeMode>'+
								'</LookAt>'+
								'<styleUrl>#m_ylw-pushpin</styleUrl>'+
								'<Point>'+
									'<gx:drawOrder>1</gx:drawOrder>'+
									'<coordinates>'+issue[i].loc.coordinates[0]+','+issue[i].loc.coordinates[1]+',0</coordinates>'+
								'</Point>'+
							'</Placemark>';
						}
                    }
					if(_kml==0){
						issue_return += ']';
						res.send(issue_return);
					}else if(_kml==1){						
						issue_return += '</Folder> </Document> </kml>';
						
						res.send(issue_return);	
					}
                    
                    //new end
					
                    //res.send(issue);
                }).sort({create_at: _sort});//.limit(_limit);
            } else {				
                if (_image) {					
                    if (_coordinates == '') {						
                        if (_issue == '')
                        {                 
                            Issue.find({"_id": {$in: ids}, "create_at": {$gte: _startdate, $lt: _enddate}}, {"user":_user}, function (err, issue) {
								//new start
								if(err!=null){console.log("err   =   " + err);}
								
								if(_kml==0){
									issue_return += '[';
								}else if(_kml==1){
									issue_return += '<?xml version="1.0" encoding="UTF-8"?> <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom"> <Document>'+
									'<name>sensecity.kml</name>'+
									'<Style id="s_ylw-pushpin_hl">'+
									'<IconStyle>'+
									'<color>ff7fffff</color>'+
									'<scale>1.3</scale>'+
									'<Icon>'+
									'<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>'+
									'</Icon>'+
									'<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>'+
									'</IconStyle>'+
									'</Style>'+	
									'<StyleMap id="m_ylw-pushpin">'+
									'<Pair>'+
									'<key>normal</key>'+
									'<styleUrl>#s_ylw-pushpin</styleUrl>'+
									'</Pair>'+
									'<Pair>'+
									'<key>highlight</key>'+
									'<styleUrl>#s_ylw-pushpin_hl</styleUrl>'+
									'</Pair>'+
									'</StyleMap>'+
									'<Style id="s_ylw-pushpin">'+
									'<IconStyle>'+
									'<color>ff7fffff</color>'+
									'<scale>1.1</scale>'+
									'<Icon>'+
									'<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>'+
									'</Icon>'+
									'<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>'+
									'</IconStyle>'+
									'</Style>'+
									'<Folder>'+
									'<name>sensecity</name>'+
									'<open>1</open>';							
								}
					
								for (var i = 0; i < issue.length; i++) {

									var bug_id = 0;
									var bug_status = "";

									for (var j = 0; j < bugzilla_results.length; j++) {
										if (bugzilla_results[j].alias[0] == issue[i]._id) {
											bug_id = bugzilla_results[j].id;
											bug_status = bugzilla_results[j].status;
										}
									}
									
									if(_kml==0){
										issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '"}';
										if (i < issue.length - 1) {
											issue_return += ',';
										}
									}else if(_kml==1){
										
										issue_return +='<Placemark>'+
											'<name>'+issue[i].issue+' - '+issue[i].value_desc+'</name>'+
											'<description><![CDATA[<img src="'+issue[i].image_name+'"/><a href="http://'+issue[i].municipality+'.sense.city/scissuemap.html#?issue_id='+issue[i]._id+'">http://'+issue[i].municipality+'.sense.city/scissuemap.html#?issue_id='+issue[i]._id+'</a>]]></description>'+
											'<LookAt>'+
												'<longitude>'+issue[i].loc.coordinates[0]+'</longitude>'+
												'<latitude>'+issue[i].loc.coordinates[1]+'</latitude>'+
												'<altitude>0</altitude>'+
												'<heading>-176.4101948194351</heading>'+
												'<tilt>70.72955317497231</tilt>'+
												'<range>1952.786634342951</range>'+
												'<gx:altitudeMode>relativeToSeaFloor</gx:altitudeMode>'+
											'</LookAt>'+
											'<styleUrl>#m_ylw-pushpin</styleUrl>'+
											'<Point>'+
												'<gx:drawOrder>1</gx:drawOrder>'+
												'<coordinates>'+issue[i].loc.coordinates[0]+','+issue[i].loc.coordinates[1]+',0</coordinates>'+
											'</Point>'+
										'</Placemark>';							
									}
								}
								
								if(_kml==0){
									issue_return += ']';
									res.send(issue_return);
								}else if(_kml==1){
						
									issue_return += '</Folder> </Document> </kml>';
						
									res.send(issue_return);	
								}
                    
							}).sort({create_at: _sort});//.limit(_limit);
                        } else {
                            Issue.find({"_id": {$in: ids}, "create_at": {$gte: _startdate, $lt: _enddate}}, {"user":_user}, function (err, issue) {
								
								
								//new start
								if(err!=null){console.log("err   =   " + err);}
								
								if(_kml == 0){
									issue_return += '[';
								}else if(_kml == 1){
						
									issue_return += '<?xml version="1.0" encoding="UTF-8"?> <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom"> <Document>'+
									'<name>sensecity.kml</name>'+
									'<Style id="s_ylw-pushpin_hl">'+
									'<IconStyle>'+
									'<color>ff7fffff</color>'+
									'<scale>1.3</scale>'+
									'<Icon>'+
									'<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>'+
									'</Icon>'+
									'<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>'+
									'</IconStyle>'+
									'</Style>'+
									'<StyleMap id="m_ylw-pushpin">'+
									'<Pair>'+
									'<key>normal</key>'+
									'<styleUrl>#s_ylw-pushpin</styleUrl>'+
									'</Pair>'+
									'<Pair>'+
									'<key>highlight</key>'+
									'<styleUrl>#s_ylw-pushpin_hl</styleUrl>'+
									'</Pair>'+
									'</StyleMap>'+
									'<Style id="s_ylw-pushpin">'+
									'<IconStyle>'+
									'<color>ff7fffff</color>'+
									'<scale>1.1</scale>'+
									'<Icon>'+
									'<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>'+
									'</Icon>'+
									'<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>'+
									'</IconStyle>'+
									'</Style>'+
									'<Folder>'+
									'<name>sensecity</name>'+
									'<open>1</open>';

								}
					
								for (var i = 0; i < issue.length; i++) {

									var bug_id = 0;
									var bug_status = "";

									for (var j = 0; j < bugzilla_results.length; j++) {
										if (bugzilla_results[j].alias[0] == issue[i]._id) {
											bug_id = bugzilla_results[j].id;
											bug_status = bugzilla_results[j].status;
										}
									}
									
									if(_kml==0){
										issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '"}';
										if (i < issue.length - 1) {
											issue_return += ',';
										}
									}else if(_kml==1){							
										issue_return +='<Placemark>'+
										'<name>'+issue[i].issue+' - '+issue[i].value_desc+'</name>'+
										'<description><![CDATA[<img src="'+issue[i].image_name+'"/><a href="http://'+issue[i].municipality+'.sense.city/scissuemap.html#?issue_id='+issue[i]._id+'">http://'+issue[i].municipality+'.sense.city/scissuemap.html#?issue_id='+issue[i]._id+'</a>]]></description>'+
										'<LookAt>'+
										'<longitude>'+issue[i].loc.coordinates[0]+'</longitude>'+
										'<latitude>'+issue[i].loc.coordinates[1]+'</latitude>'+
										'<altitude>0</altitude>'+
										'<heading>-176.4101948194351</heading>'+
										'<tilt>70.72955317497231</tilt>'+
										'<range>1952.786634342951</range>'+
										'<gx:altitudeMode>relativeToSeaFloor</gx:altitudeMode>'+
										'</LookAt>'+
										'<styleUrl>#m_ylw-pushpin</styleUrl>'+
										'<Point>'+
										'<gx:drawOrder>1</gx:drawOrder>'+
										'<coordinates>'+issue[i].loc.coordinates[0]+','+issue[i].loc.coordinates[1]+',0</coordinates>'+
										'</Point>'+
										'</Placemark>';							
									}
								}
					
								if(_kml==0){
									issue_return += ']';
									res.send(issue_return);
								}else if(_kml==1){
									issue_return += '</Folder> </Document> </kml>';
									res.send(issue_return);	
								}
                    //new end
					                                
                            }).sort({create_at: _sort});//.limit(_limit);
                        }
                    } else
                    {
                        if (_issue == '')
                        {		
                            Issue.find({"_id": {$in: ids}, "loc": {$nearSphere: {$geometry: {type: "Point", coordinates: JSON.parse(req.query.coordinates)}, $maxDistance: JSON.parse(req.query.distance)}},
                                "create_at": {$gte: _startdate, $lt: _enddate}
                            }, {"user":_user}, function (err, issue) {

								//new start
								if(err!=null){console.log("err   =   " + err);}
								
								if(_kml==0){
									issue_return += '[';
								}else if(_kml==1){
						
									issue_return += '<?xml version="1.0" encoding="UTF-8"?> <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom"> <Document>'+
									'<name>sensecity.kml</name>'+
									'<Style id="s_ylw-pushpin_hl">'+
									'<IconStyle>'+
									'<color>ff7fffff</color>'+
									'<scale>1.3</scale>'+
									'<Icon>'+
									'<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>'+
									'</Icon>'+
									'<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>'+
									'</IconStyle>'+
									'</Style>'+
									'<StyleMap id="m_ylw-pushpin">'+
									'<Pair>'+
									'<key>normal</key>'+
									'<styleUrl>#s_ylw-pushpin</styleUrl>'+
									'</Pair>'+
									'<Pair>'+
									'<key>highlight</key>'+
									'<styleUrl>#s_ylw-pushpin_hl</styleUrl>'+
									'</Pair>'+
									'</StyleMap>'+
									'<Style id="s_ylw-pushpin">'+
									'<IconStyle>'+
									'<color>ff7fffff</color>'+
									'<scale>1.1</scale>'+
									'<Icon>'+
									'<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>'+
									'</Icon>'+
									'<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>'+
									'</IconStyle>'+
									'</Style>'+
									'<Folder>'+
									'<name>sensecity</name>'+
									'<open>1</open>';
								}
					
								for (var i = 0; i < issue.length; i++) {

									var bug_id = 0;
									var bug_status = "";

									for (var j = 0; j < bugzilla_results.length; j++) {
										if (bugzilla_results[j].alias[0] == issue[i]._id) {
											bug_id = bugzilla_results[j].id;
											bug_status = bugzilla_results[j].status;
										}
									}
									
									if(_kml==0){
										issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '"}';
										
										if (i < issue.length - 1) {
											issue_return += ',';
										}
									}else if(_kml==1){
							
										issue_return +='<Placemark>'+
										'<name>'+issue[i].issue+' - '+issue[i].value_desc+'</name>'+
										'<description><![CDATA[<img src="'+issue[i].image_name+'"/><a href="http://'+issue[i].municipality+'.sense.city/scissuemap.html#?issue_id='+issue[i]._id+'">http://'+issue[i].municipality+'.sense.city/scissuemap.html#?issue_id='+issue[i]._id+'</a>]]></description>'+
										'<LookAt>'+
										'<longitude>'+issue[i].loc.coordinates[0]+'</longitude>'+
										'<latitude>'+issue[i].loc.coordinates[1]+'</latitude>'+
										'<altitude>0</altitude>'+
										'<heading>-176.4101948194351</heading>'+
										'<tilt>70.72955317497231</tilt>'+
										'<range>1952.786634342951</range>'+
										'<gx:altitudeMode>relativeToSeaFloor</gx:altitudeMode>'+
										'</LookAt>'+
										'<styleUrl>#m_ylw-pushpin</styleUrl>'+
										'<Point>'+
										'<gx:drawOrder>1</gx:drawOrder>'+
										'<coordinates>'+issue[i].loc.coordinates[0]+','+issue[i].loc.coordinates[1]+',0</coordinates>'+
										'</Point>'+
										'</Placemark>';							
									}
								}
								
								if(_kml==0){
									issue_return += ']';
									res.send(issue_return);
								}else if(_kml==1){						
									issue_return += '</Folder> </Document> </kml>';
									
									res.send(issue_return);
								}
								//new end
										
                            }).sort({create_at: _sort});//.limit(_limit);
                        } else {
                            Issue.find({"_id": {$in: ids}, "issue": {$in: _issue}, "loc": {$nearSphere: {$geometry: {type: "Point", coordinates: JSON.parse(req.query.coordinates)}, $maxDistance: JSON.parse(req.query.distance)}},
                                "create_at": {$gte: _startdate, $lt: _enddate}
						}, {"user":_user}, function (err, issue) {

								//new start
								if(err!=null){console.log("err   =   " + err);}

								if(_kml==0){
									issue_return += '[';
								}else if(_kml==1){

									issue_return += '<?xml version="1.0" encoding="UTF-8"?> <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom"> <Document>'+
									'<name>sensecity.kml</name>'+
									'<Style id="s_ylw-pushpin_hl">'+
									'<IconStyle>'+
									'<color>ff7fffff</color>'+
									'<scale>1.3</scale>'+
									'<Icon>'+
									'<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>'+
									'</Icon>'+
									'<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>'+
									'</IconStyle>'+
									'</Style>'+
									'<StyleMap id="m_ylw-pushpin">'+
									'<Pair>'+
									'<key>normal</key>'+
									'<styleUrl>#s_ylw-pushpin</styleUrl>'+
									'</Pair>'+
									'<Pair>'+
									'<key>highlight</key>'+
									'<styleUrl>#s_ylw-pushpin_hl</styleUrl>'+
									'</Pair>'+
									'</StyleMap>'+
									'<Style id="s_ylw-pushpin">'+
									'<IconStyle>'+
									'<color>ff7fffff</color>'+
									'<scale>1.1</scale>'+
									'<Icon>'+
									'<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>'+
									'</Icon>'+
									'<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>'+
									'</IconStyle>'+
									'</Style>'+
									'<Folder>'+
									'<name>sensecity</name>'+
									'<open>1</open>';
								}
					
								for (var i = 0; i < issue.length; i++) {

									var bug_id = 0;
									var bug_status = "";

									for (var j = 0; j < bugzilla_results.length; j++) {
										if (bugzilla_results[j].alias[0] == issue[i]._id) {
											bug_id = bugzilla_results[j].id;
											bug_status = bugzilla_results[j].status;
										}
									}

									if(_kml==0){
										issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '"}';
										if (i < issue.length - 1) {
											issue_return += ',';
										}
									}else if(_kml==1){
							
										issue_return +='<Placemark>'+
										'<name>'+issue[i].issue+' - '+issue[i].value_desc+'</name>'+
										'<description><![CDATA[<img src="'+issue[i].image_name+'"/><a href="http://'+issue[i].municipality+'.sense.city/scissuemap.html#?issue_id='+issue[i]._id+'">http://'+issue[i].municipality+'.sense.city/scissuemap.html#?issue_id='+issue[i]._id+'</a>]]></description>'+
										'<LookAt>'+
										'<longitude>'+issue[i].loc.coordinates[0]+'</longitude>'+
										'<latitude>'+issue[i].loc.coordinates[1]+'</latitude>'+
										'<altitude>0</altitude>'+
										'<heading>-176.4101948194351</heading>'+
										'<tilt>70.72955317497231</tilt>'+
										'<range>1952.786634342951</range>'+
										'<gx:altitudeMode>relativeToSeaFloor</gx:altitudeMode>'+
										'</LookAt>'+
										'<styleUrl>#m_ylw-pushpin</styleUrl>'+
										'<Point>'+
										'<gx:drawOrder>1</gx:drawOrder>'+
										'<coordinates>'+issue[i].loc.coordinates[0]+','+issue[i].loc.coordinates[1]+',0</coordinates>'+
										'</Point>'+
										'</Placemark>';							
									}
								}
								
								if(_kml==0){
									issue_return += ']';
									res.send(issue_return);
								}else if(_kml==1){						
									issue_return += '</Folder> </Document> </kml>';
									res.send(issue_return);
								}
								//new end					
                            }).sort({create_at: _sort});//.limit(_limit);
                        }
                    }
                } else {
                    if (_coordinates == '') {
                        if (_issue == '')
                        {
                            Issue.find({"_id": {$in: ids}, "create_at": {$gte: _startdate, $lt: _enddate}}, {"image_name": _image, "user":_user}, function (err, issue) {

								//new start
								if(err!=null){console.log("err   =   " + err);}
								if(_kml==0){
									issue_return += '[';
								}else if(_kml==1){						
									issue_return += '<?xml version="1.0" encoding="UTF-8"?> <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom"> <Document>'+
									'<name>sensecity.kml</name>'+
									'<Style id="s_ylw-pushpin_hl">'+
									'<IconStyle>'+
									'<color>ff7fffff</color>'+
									'<scale>1.3</scale>'+
									'<Icon>'+
									'<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>'+
									'</Icon>'+
									'<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>'+
									'</IconStyle>'+
									'</Style>'+
									'<StyleMap id="m_ylw-pushpin">'+
									'<Pair>'+
									'<key>normal</key>'+
									'<styleUrl>#s_ylw-pushpin</styleUrl>'+
									'</Pair>'+
									'<Pair>'+
									'<key>highlight</key>'+
									'<styleUrl>#s_ylw-pushpin_hl</styleUrl>'+
									'</Pair>'+
									'</StyleMap>'+
									'<Style id="s_ylw-pushpin">'+
									'<IconStyle>'+
									'<color>ff7fffff</color>'+
									'<scale>1.1</scale>'+
									'<Icon>'+
									'<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>'+
									'</Icon>'+
									'<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>'+
									'</IconStyle>'+
									'</Style>'+
									'<Folder>'+
									'<name>sensecity</name>'+
									'<open>1</open>';
								}
						
								for (var i = 0; i < issue.length; i++) {

									var bug_id = 0;
									var bug_status = "";

									for (var j = 0; j < bugzilla_results.length; j++) {
										if (bugzilla_results[j].alias[0] == issue[i]._id) {
											bug_id = bugzilla_results[j].id;
											bug_status = bugzilla_results[j].status;
										}
									}
									
									if(_kml==0){
										issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '"}';
								
										if (i < issue.length - 1) {
											issue_return += ',';
										}
									}else if(_kml==1){
										issue_return +='<Placemark>'+
										'<name>'+issue[i].issue+' - '+issue[i].value_desc+'</name>'+
										'<description><![CDATA[<img src="'+issue[i].image_name+'"/><a href="http://'+issue[i].municipality+'.sense.city/scissuemap.html#?issue_id='+issue[i]._id+'">http://'+issue[i].municipality+'.sense.city/scissuemap.html#?issue_id='+issue[i]._id+'</a>]]></description>'+
										'<LookAt>'+
										'<longitude>'+issue[i].loc.coordinates[0]+'</longitude>'+
										'<latitude>'+issue[i].loc.coordinates[1]+'</latitude>'+
										'<altitude>0</altitude>'+
										'<heading>-176.4101948194351</heading>'+
										'<tilt>70.72955317497231</tilt>'+
										'<range>1952.786634342951</range>'+
										'<gx:altitudeMode>relativeToSeaFloor</gx:altitudeMode>'+
										'</LookAt>'+
										'<styleUrl>#m_ylw-pushpin</styleUrl>'+
										'<Point>'+
										'<gx:drawOrder>1</gx:drawOrder>'+
										'<coordinates>'+issue[i].loc.coordinates[0]+','+issue[i].loc.coordinates[1]+',0</coordinates>'+
										'</Point>'+
										'</Placemark>';							
									}
								}
						
								if(_kml==0){
									issue_return += ']';
									res.send(issue_return);
								}else if(_kml==1){						
									issue_return += '</Folder> </Document> </kml>';
									res.send(issue_return);		
								}
								//new end
                            }).sort({create_at: _sort});//.limit(_limit);
                        } else {
                            Issue.find({"_id": {$in: ids}, "create_at": {$gte: _startdate, $lt: _enddate},
                                "issue": {$in: _issue}
                            }, {"image_name": _image, "user":_user}, function (err, issue) {

                                
								//new start
								if(err!=null){console.log("err   =   " + err);}
								
								if(_kml==0){
									issue_return += '[';
								}else if(_kml==1){
									issue_return += '<?xml version="1.0" encoding="UTF-8"?> <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom"> <Document>'+
									'<name>sensecity.kml</name>'+
									'<Style id="s_ylw-pushpin_hl">'+
									'<IconStyle>'+
									'<color>ff7fffff</color>'+
									'<scale>1.3</scale>'+
									'<Icon>'+
									'<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>'+
									'</Icon>'+
									'<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>'+
									'</IconStyle>'+
									'</Style>'+
									'<StyleMap id="m_ylw-pushpin">'+
									'<Pair>'+
									'<key>normal</key>'+
									'<styleUrl>#s_ylw-pushpin</styleUrl>'+
									'</Pair>'+
									'<Pair>'+
									'<key>highlight</key>'+
									'<styleUrl>#s_ylw-pushpin_hl</styleUrl>'+
									'</Pair>'+
									'</StyleMap>'+
									'<Style id="s_ylw-pushpin">'+
									'<IconStyle>'+
									'<color>ff7fffff</color>'+
									'<scale>1.1</scale>'+
									'<Icon>'+
									'<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>'+
									'</Icon>'+
									'<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>'+
									'</IconStyle>'+
									'</Style>'+
									'<Folder>'+
									'<name>sensecity</name>'+
									'<open>1</open>';
								}
					
								for (var i = 0; i < issue.length; i++) {

									var bug_id = 0;
									var bug_status = "";

									for (var j = 0; j < bugzilla_results.length; j++) {
										if (bugzilla_results[j].alias[0] == issue[i]._id) {
											bug_id = bugzilla_results[j].id;
											bug_status = bugzilla_results[j].status;
										}
									}
									
									if(_kml==0){
										issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '"}';
										
										if (i < issue.length - 1) {
											issue_return += ',';
										}
									}else if(_kml==1){
										issue_return +='<Placemark>'+
										'<name>'+issue[i].issue+' - '+issue[i].value_desc+'</name>'+
										'<description><![CDATA[<img src="'+issue[i].image_name+'"/><a href="http://'+issue[i].municipality+'.sense.city/scissuemap.html#?issue_id='+issue[i]._id+'">http://'+issue[i].municipality+'.sense.city/scissuemap.html#?issue_id='+issue[i]._id+'</a>]]></description>'+
										'<LookAt>'+
										'<longitude>'+issue[i].loc.coordinates[0]+'</longitude>'+
										'<latitude>'+issue[i].loc.coordinates[1]+'</latitude>'+
										'<altitude>0</altitude>'+
										'<heading>-176.4101948194351</heading>'+
										'<tilt>70.72955317497231</tilt>'+
										'<range>1952.786634342951</range>'+
										'<gx:altitudeMode>relativeToSeaFloor</gx:altitudeMode>'+
										'</LookAt>'+
										'<styleUrl>#m_ylw-pushpin</styleUrl>'+
										'<Point>'+
										'<gx:drawOrder>1</gx:drawOrder>'+
										'<coordinates>'+issue[i].loc.coordinates[0]+','+issue[i].loc.coordinates[1]+',0</coordinates>'+
										'</Point>'+
										'</Placemark>';							
									}
								}
					
								if(_kml==0){
									issue_return += ']';
									res.send(issue_return);
								}else if(_kml==1){
									issue_return += '</Folder> </Document> </kml>';
									
									res.send(issue_return);	
								}
								//new end
					
                            }).sort({create_at: _sort});//.limit(_limit);
                        }
                    } else
                    {
                        if (_issue == '')
                        {
                            Issue.find({"_id": {$in: ids}, "loc": {$nearSphere: {$geometry: {type: "Point", coordinates: JSON.parse(req.query.coordinates)}, $maxDistance: JSON.parse(req.query.distance)}},
                                "create_at": {$gte: _startdate, $lt: _enddate}
                            }, {"image_name": _image, "user":_user}, function (err, issue) {

								//new start
								if(err!=null){console.log("err   =   " + err);}
								
								if(_kml==0){
									issue_return += '[';
								}else if(_kml==1){
						
									issue_return += '<?xml version="1.0" encoding="UTF-8"?> <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom"> <Document>'+
									'<name>sensecity.kml</name>'+
									'<Style id="s_ylw-pushpin_hl">'+
									'<IconStyle>'+
									'<color>ff7fffff</color>'+
									'<scale>1.3</scale>'+
									'<Icon>'+
									'<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>'+
									'</Icon>'+
									'<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>'+
									'</IconStyle>'+
									'</Style>'+
									'<StyleMap id="m_ylw-pushpin">'+
									'<Pair>'+
									'<key>normal</key>'+
									'<styleUrl>#s_ylw-pushpin</styleUrl>'+
									'</Pair>'+
									'<Pair>'+
									'<key>highlight</key>'+
									'<styleUrl>#s_ylw-pushpin_hl</styleUrl>'+
									'</Pair>'+
									'</StyleMap>'+
									'<Style id="s_ylw-pushpin">'+
									'<IconStyle>'+
									'<color>ff7fffff</color>'+
									'<scale>1.1</scale>'+
									'<Icon>'+
									'<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>'+
									'</Icon>'+
									'<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>'+
									'</IconStyle>'+
									'</Style>'+
									'<Folder>'+
									'<name>sensecity</name>'+
									'<open>1</open>';
								}
					
								for (var i = 0; i < issue.length; i++) {

									var bug_id = 0;
									var bug_status = "";

									for (var j = 0; j < bugzilla_results.length; j++) {
										if (bugzilla_results[j].alias[0] == issue[i]._id) {
											bug_id = bugzilla_results[j].id;
											bug_status = bugzilla_results[j].status;
										}
									}

									if(_kml==0){
										issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '"}';
											
										if (i < issue.length - 1) {
											issue_return += ',';
										}
									}else if(_kml==1){
										issue_return +='<Placemark>'+
										'<name>'+issue[i].issue+' - '+issue[i].value_desc+'</name>'+
										'<description><![CDATA[<img src="'+issue[i].image_name+'"/><a href="http://'+issue[i].municipality+'.sense.city/scissuemap.html#?issue_id='+issue[i]._id+'">http://'+issue[i].municipality+'.sense.city/scissuemap.html#?issue_id='+issue[i]._id+'</a>]]></description>'+
										'<LookAt>'+
										'<longitude>'+issue[i].loc.coordinates[0]+'</longitude>'+
										'<latitude>'+issue[i].loc.coordinates[1]+'</latitude>'+
										'<altitude>0</altitude>'+
										'<heading>-176.4101948194351</heading>'+
										'<tilt>70.72955317497231</tilt>'+
										'<range>1952.786634342951</range>'+
										'<gx:altitudeMode>relativeToSeaFloor</gx:altitudeMode>'+
										'</LookAt>'+
										'<styleUrl>#m_ylw-pushpin</styleUrl>'+
										'<Point>'+
										'<gx:drawOrder>1</gx:drawOrder>'+
										'<coordinates>'+issue[i].loc.coordinates[0]+','+issue[i].loc.coordinates[1]+',0</coordinates>'+
										'</Point>'+
										'</Placemark>';							
									}
								}
					
								if(_kml==0){
									issue_return += ']';
									res.send(issue_return);
								}else if(_kml==1){						
									issue_return += '</Folder> </Document> </kml>';
									res.send(issue_return);	
								}
								//new end
					
                            }).sort({create_at: _sort});//.limit(_limit);
                        } else {

                            Issue.find({"_id": {$in: ids}, "issue": {$in: _issue}, "loc": {$nearSphere: {$geometry: {type: "Point", coordinates: JSON.parse(req.query.coordinates)}, $maxDistance: JSON.parse(req.query.distance)}},
                                "create_at": {$gte: _startdate, $lt: _enddate}
                            }, {"image_name": _image, "user":_user}, function (err, issue) {

								//new start
								if(err!=null){console.log("err   =   " + err);}
								
								if(_kml==0){
									issue_return += '[';
								}else if(_kml==1){
						
									issue_return += '<?xml version="1.0" encoding="UTF-8"?> <kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2" xmlns:kml="http://www.opengis.net/kml/2.2" xmlns:atom="http://www.w3.org/2005/Atom"> <Document>'+
									'<name>sensecity.kml</name>'+
									'<Style id="s_ylw-pushpin_hl">'+
									'<IconStyle>'+
									'<color>ff7fffff</color>'+
									'<scale>1.3</scale>'+
									'<Icon>'+
									'<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>'+
									'</Icon>'+
									'<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>'+
									'</IconStyle>'+
									'</Style>'+
									'<StyleMap id="m_ylw-pushpin">'+
									'<Pair>'+
									'<key>normal</key>'+
									'<styleUrl>#s_ylw-pushpin</styleUrl>'+
									'</Pair>'+
									'<Pair>'+
									'<key>highlight</key>'+
									'<styleUrl>#s_ylw-pushpin_hl</styleUrl>'+
									'</Pair>'+
									'</StyleMap>'+
									'<Style id="s_ylw-pushpin">'+
									'<IconStyle>'+
									'<color>ff7fffff</color>'+
									'<scale>1.1</scale>'+
									'<Icon>'+
									'<href>http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png</href>'+
									'</Icon>'+
									'<hotSpot x="20" y="2" xunits="pixels" yunits="pixels"/>'+
									'</IconStyle>'+
									'</Style>'+
									'<Folder>'+
									'<name>sensecity</name>'+
									'<open>1</open>';
								}
					
								for (var i = 0; i < issue.length; i++) {

									var bug_id = 0;
									var bug_status = "";

									for (var j = 0; j < bugzilla_results.length; j++) {
										if (bugzilla_results[j].alias[0] == issue[i]._id) {
											bug_id = bugzilla_results[j].id;
											bug_status = bugzilla_results[j].status;
										}
									}
									
									if(_kml==0){
										issue_return += '{"_id":"' + issue[i]._id + '","municipality":"' + issue[i].municipality + '","image_name":"' + issue[i].image_name + '","issue":"' + issue[i].issue + '","device_id":"' + issue[i].device_id + '","value_desc":"' + issue[i].value_desc + '","comments":"' + issue[i].comments + '","create_at":"' + issue[i].create_at + '","loc":{"type":"Point","coordinates":[' + issue[i].loc.coordinates + ']},"status":"' + bug_status + '","bug_id":"' + bug_id + '"}';
										
										if (i < issue.length - 1) {
											issue_return += ',';
										}
									}else if(_kml==1){							
										issue_return +='<Placemark>'+
											'<name>'+issue[i].issue+' - '+issue[i].value_desc+'</name>'+
											'<description><![CDATA[<img src="'+issue[i].image_name+'"/><a href="http://'+issue[i].municipality+'.sense.city/scissuemap.html#?issue_id='+issue[i]._id+'">http://'+issue[i].municipality+'.sense.city/scissuemap.html#?issue_id='+issue[i]._id+'</a>]]></description>'+
											'<LookAt>'+
											'<longitude>'+issue[i].loc.coordinates[0]+'</longitude>'+
											'<latitude>'+issue[i].loc.coordinates[1]+'</latitude>'+
											'<altitude>0</altitude>'+
											'<heading>-176.4101948194351</heading>'+
											'<tilt>70.72955317497231</tilt>'+
											'<range>1952.786634342951</range>'+
											'<gx:altitudeMode>relativeToSeaFloor</gx:altitudeMode>'+
											'</LookAt>'+
											'<styleUrl>#m_ylw-pushpin</styleUrl>'+
											'<Point>'+
											'<gx:drawOrder>1</gx:drawOrder>'+
											'<coordinates>'+issue[i].loc.coordinates[0]+','+issue[i].loc.coordinates[1]+',0</coordinates>'+
											'</Point>'+
											'</Placemark>';							
									}
								}
								
								if(_kml==0){
									issue_return += ']';
									res.send(issue_return);
								}else if(_kml==1){
									issue_return += '</Folder> </Document> </kml>';
						
									res.send(issue_return);	
								}
								//new end
					
                            }).sort({create_at: _sort});//.limit(_limit);
                        }
                    }

                }
            }


        }


    });





});
*/


/* ** End test ** */
//POST router
router.post('/send_email', function (req, res) {    
	
	
	if( req.body.uuid!=undefined && req.body.name!=undefined && req.body.email!=undefined && req.body.phonenumber!=undefined ){
		act_User.find({"uuid":req.body.uuid, "name":req.body.name, "email": req.body.email, "mobile_num": req.body.phonenumber }, function(err, response){
			
			console.log(response[0].activate);		
			if(response[0].activate == "1" ){
				
				var transporter = nodemailer.createTransport('smtps://sense.city.uop%40gmail.com:dd3Gt56Asz@smtp.gmail.com');

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
				console.log("response13456");
			}
			
		});
	}else{
		res.send(["no"]);
		console.log("response13456");
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
            cityPolicy.find({ "city": response[0].municipality, "category": req.query.issue }, { "policy_desc": 1, "anonymous": 1,"city": 1 }, function (err, city_policy) {
                res.send(city_policy);
            });
        } else {
            res.send([{ "policy_desc":"Η πόλη που βρίσκεστε δεν υποστηρίζετε από το Sense.City. Το αίτημα σας θα καταχωριθεί ως ανώνυμο."}]);
        }
    });
});


router.get('/fullissue/:id', function (req, res) {

    var id = req.params.id;
    var issue_rtrn = [];
    
    var bugParams1 = "?alias=" + id + "&include_fields=id,component,alias,status";
    
    /*var bugParams =
            {
                "method": "Bug.search",
                "params": [{"alias": id, "include_fields": ["id", "component", "alias", "status"]}],
                "id": 1
            };
            
            
       
        request({
            url: bugUrl,
            method: "POST",
            json: bugParams
        }, function (error, response, body) {*/


            request({
                url: bugUrlRest +"/rest/bug"+ bugParams1,
                method: "GET"
            }, function (error, response, body) {

                var body_var = JSON.parse(body);

                if (body_var.bugs.length !== 0){
			
                    if (body_var.length < 1) {

				res.send([{}]);

			} else {
				request({
                    url: bugUrlRest + "/rest/bug/" + body_var.bugs[0].alias[0] + "/comment",
					method: "GET"
				}, function (error1, response1, body1) {
					if(error1)
						cosnole.log("/fullissue/:id error :"+error1);
					
                    Issue.find({"_id":req.params.id}, {"user":0}, function (err, issue) {
						
						//console.log("issue      ===============>>>>>>>>    " + JSON.stringify(issue));
						if(issue != null){
                            issue_rtrn = '[{"_id":"' + issue[0]._id + '","municipality":"' + issue[0].municipality + '","image_name":"' + issue[0].image_name + '","issue":"' + issue[0].issue + '","device_id":"' + issue[0].device_id + '","value_desc":"' + issue[0].value_desc + '","comments":"' + issue[0].comments + '","create_at":"' + issue[0].create_at + '","loc":{"type":"Point","coordinates":[' + issue[0].loc.coordinates + ']},"status":"' + body_var.bugs[0].status + '","bug_id":"' + body_var.bugs[0].id + '"},' + body1 + ']';

							res.send(issue_rtrn);
						}
						else{
							res.send([]);
						}
					});
				});
			}
		}
		else{
			res.send([]);
		}
	});
	
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
                        var transporter = nodemailer.createTransport('smtps://sense.city.uop%40gmail.com:dd3Gt56Asz@smtp.gmail.com');

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
							//console.log(" Mobile use 1   =============>>>>>>>>  " + JSON.stringify(resp1));
							if(resp1.activate != "1"){
								
								var transporter = nodemailer.createTransport('smtps://sense.city.uop%40gmail.com:dd3Gt56Asz@smtp.gmail.com');

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
							var transporter = nodemailer.createTransport('smtps://sense.city.uop%40gmail.com:dd3Gt56Asz@smtp.gmail.com');

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
	res.send({"policy":"<p style=\"font-size:18px\"><b>Coming</b></p><p> soon<\p>"});
});



router.get('/active_users', function (req, res) {


    act_User.find({"uuid": req.query.uuid}, function (error, actice_user) {
        //console.log(actice_user);
        res.send(actice_user);

    }).sort({"create_at": -1}).limit(1);




});

router.post('/activate_users', function (req, res) {

    //console.log("_id   - " + req.body.id1);
    //console.log("uuid   - " + req.body.id2);
   // console.log("activate    - " + req.body.id3);

    act_User.findOneAndUpdate({"_id": req.body.id1, "uuid": req.body.id2, "activate": req.body.id3}, {
        "activate": "1"
    }, function (error, activate_user) {
        //console.log(activate_user);
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
	console.log(req.body);
    request({
        url: bugUrlRest + "/rest/bug/" + req.body.ids[0],
        method: "PUT",
        json: req.body
    }, function (error, response, body) {
        if (!error && response.statusCode === 200) {

            if (response.body.result !== null)
            {
                res.send("ok");
            } else
            {
                res.send([response.body.error]);
            }

        }
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
    request({
        url: bugUrlRest + "/rest/bug/comment/" + req.body.id + "/tags",
        method: "PUT",
        json: req.body
    }, function (error, response, body) {
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
    Role.find({username: req.body.username, password: req.body.password, city: req.body.city}, function (err, response) {
        if (response.length > 0) {
            var wordArray = crypto.enc.Utf8.parse(req.body.username, req.body.password);
            var uuid = crypto.enc.Base64.stringify(wordArray);
            Role.update({username: req.body.username, password: req.body.password}, {$set: {"uuid": uuid, "timestamp": Date.now() * 1000 * 3600}}, {multi: true}, function (err, doc) {});
            return res.send(response[0]["city"] + ";" + response[0]["role"] + ";" + response[0]["department"] + ";" + response[0]["email"] + ";" + uuid + ";" + req.body.username);
        } else {
            return res.send("failure");
        }
    });
}
);

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
            console("resp => " + response);
        });

    }
    console.log("req => " + JSON.stringify(req));
    console.log("res => " + req.uuid);

    return true;

}


// Return router
module.exports = router;
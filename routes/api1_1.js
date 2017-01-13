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

//mongoose.connect('mongodb://' + config.config.my_hostname + '/' + config.config.database);

// Models
var Issue = require('../models/issue');
var act_User = require('../models/active_user');
var Role = require('../models/roles.js');
var Municipality = require('../models/municipality');
var cityPolicy = require('../models/citypolicy');

// Routes
Issue.methods(['get', 'put', 'post', 'delete']);
Issue.register(router, '/issues');

var bugUrlRest=config.config.bugUrlRest;

//Authorization middleware
function authorization(req, res, next) {
	
    Role.find({uuid: req.get('x-uuid')}, function (err, response) {
        if (response.length > 0 && response[0]["timestamp"] >= Date.now()) {
            if (req.path === '/admin/bugs/search' || req.path === '/admin/bugs/update' || req.path === '/admin/bugs/comment' || req.path === '/admin/bugs/comment/tags' || req.path === '/admin/bugs/comment/add') {
				console.log("x-role"+req.get('x-role'));
                if (req.get('x-role') === 'departmentAdmin' || req.get('x-role') === 'sensecityAdmin' || req.get('x-role') === 'departmentUser' || req.get('x-role') === 'cityAdmin') {
					console.log("success");
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

var loginData =
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
}, function (error, response, body) {
    if (!error && response.statusCode === 200) {
        bugToken = body.result.token;

        console.log("Login in bugzilla as: " + loginData.params[0].login);
        console.log("And assigned token: " + body.result.token);
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
				console.log(JSON.stringify(response[0]["municipality"]));
				console.log(JSON.stringify(response[0].municipality));
				console.log(JSON.stringify(response[0].municipality_desc));
				console.log(JSON.stringify(response[0]["municipality_desc"]));
				city_name = response[0].municipality_desc;
            } else
            {
                entry.municipality = '';
				city_name ='';
            }
			console.log("city_name ==== " + city_name);
            // console.log(entry);
            entry.save(function (err1, resp) {
                if (err1)
                {
                    console.log(err1);
                } else
                {
                    if (resp.issue == "garbage" || resp.issue == "lighting" || resp.issue == "plumbing" || resp.issue == "protection-policy" || resp.issue == "green" || resp.issue == "road-constructor" || resp.issue == "environment")
                    {
                        if (response.length > 0)
                        {

                            var bugData =
                                    {
                                        "method": "Bug.create",
                                        "params": [{"token": bugToken, "summary": resp.issue, "bug_severity": "normal" ,"cf_city_name" : city_name, "alias": resp._id.toString(), "url": resp.value_desc, "product": response[0]["municipality"], "component": config.config.bug_component, "version": "unspecified", "op_sys": "All"}],
                                        "id": 2
                                    };

                            request({
                                url: bugUrl,
                                method: "POST",
                                json: bugData
                            }, function (error, bugResponse, body) {

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
                }
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
            var bugCreateuser =
                    {
                        "method": "User.create",
                        "params": [{"token": bugToken, "email": req.body.email.toString()}],
                        "id": 1
                    };
            
            request({
                url: bugUrl,
                method: "POST",
                json: bugCreateuser
            }, function (error, response, body) {
				if(error){
					console.log("User doesnot created! Error : "+error);
					return false;
				}
				console.log("User Created/already exist at bugzilla");
            });

            ///* Find to bugzilla the issue and return the id

            var bugParams =
                    {
                        "method": "Bug.search",
                        "params": [{"alias": req.params.id, "include_fields": ["id", "alias"]}],
                        "id": 1
                    };

            request({
                url: bugUrl,
                method: "POST",
                json: bugParams
            }, function (error, response, body) {
				
				if( body.result.bugs[0] != undefined ) {
					console.log("body bug.search in issue/:id =>"+JSON.stringify(body.result.bugs[0]));
					
					///* Update the issue with a specific id 
					///* Add cc list and move from default component to "ΤΜΗΜΑ ΕΠΙΛΥΣΗΣ ΠΡΟΒΛΗΜΑΤΩΝ" and Custom field values
					bodyParams =
							{
								"method": "Bug.update",
								"params": [{"token": bugToken, "ids": [body.result.bugs[0].id], "component": "Τμήμα επίλυσης προβλημάτων", "cc": {"add": [req.body.email]}, "cf_creator": req.body.name, "cf_email": req.body.email, "cf_mobile": req.body.mobile_num,"reset_assigned_to":true, "cf_authedicated": 1, "cf_issues": resp.issue}],
								"id": 1
							};
					console.log("bodyParams ====== > " + JSON.stringify(bodyParams));
					request({
						url: bugUrl,
						method: "POST",
						json: bodyParams
					}, function (error1, response1, body1) {

						
						if(resp.comments === null || resp.comments ===""){
							
							resp.comments = "undefined";
						}
						
							var bugComment =
								{
									"method": "Bug.add_comment",
									"params": [{"token": bugToken, "id": body.result.bugs[0].id, "comment": resp.comments}],
									"id": 1
								};
							
							request({
								url: bugUrl,
								method: "POST",
								json: bugComment
							}, function (error2, bugResponse2, body2) {
								console.log("body2" + JSON.stringify(body2));
								console.log("Insert comments to bugzilla");
								
								if(body2.result != null)
								{
																
								request({
									url: bugUrlRest + "/rest/bug/comment/" + body2.result.id + "/tags",
									method: "PUT",
									json: {"add": ["all", "CONFIRMED"], "id": body2.result.id,"token": bugToken}
								}, function (error4, response4, body4) {
									
									console.log("Insert Tags to comment");
									
								});
								}
							});

							request({
								url: "/rest/bug/" + body.result.bugs[0].id + "/comment",
								method: "GET"
							}, function (error3, bugResponse3, body3) {

							});
						
						/*}
						else{
							console.log("No comments availiable");
						}*/
					});
				
				
				}

            });

            res.send({"description": "ok"});

        });
    } else {
        res.send({"description": "no-update"});
    }

});

/* ** Test ** */

router.get('/issue', function (req, res) {

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
    var _product;
    var _status = [];
	var _cf_authedicated=1;
	var _kml;
	var _user=false;
	var _default_issue="";
	
	
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
			_issue = [_default_issue,"garbage", "plumbing", "lighting", "green", "protection-policy", "road-constructor", "environment"];
		}else{
			_issue = ["garbage", "plumbing", "lighting", "green", "protection-policy", "road-constructor", "environment"];
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
					_issue = [_default_issue,"garbage", "plumbing", "lighting", "green", "protection-policy", "road-constructor", "environment"];
				}else{
					_issue = ["garbage", "plumbing", "lighting", "green", "protection-policy", "road-constructor", "environment"];
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
        console.log("1 _image=" + _image);
    } else {
        if (req.query.image_field == 0)
        {
            _image = false;
            console.log("2 _image=" + _image);
        } else {
            _image = true;
            console.log("2 _image=" + _image);
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

    if (!req.query.hasOwnProperty('product'))
    {
        _product = req.query.product;
    } else {
        Municipality.find({boundaries: {$geoIntersects: {$geometry: {"type": "Point", "coordinates": req.query.coordinates}}}}, function (err, response) {
            if (response.length > 0)
            {
                _product = response[0]["municipality"];
            } else
            {
                _product = '';
            }
        });
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
                "params": [{"product": _product, "order": "bug_id DESC", "limit": _limit, "status": _status, "cf_authedicateds":_cf_authedicated, "cf_issues": _issue, "f1": "creation_ts", "o1": "greaterthan", "v1": _startdate, "include_fields": ["id", "alias", "status"]}],
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

        console.log("Get from bugzilla issues!");
		
		var i_count = 0;
		
        for (i_count = 0; i_count < body.result.bugs.length; i_count++)
        {            
            ids.push(body.result.bugs[i_count].alias[0]);
            bugzilla_results = body.result.bugs;
        }




        if (_list_issue) {

            Issue.find({'_id': {$in: ids}, 'issue': {$in: ['garbage', 'lighting', 'plumbing', 'protection-policy', 'green', 'road-constructor', 'environment']}},{"user":_user}, function (err, issue) {

                //new start
                console.log("err   =   " + err);
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
                if (_coordinates === '') {
                    if (_issue === '')
                    {
                        Issue.find({"_id": {$in: ids}, "create_at": {$gte: _startdate, $lt: _enddate}},{"user":_user}, function (err, issue) {

                            //new start
                            console.log("err   =   " + err);
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
                        Issue.find({"_id": {$in: ids}, "create_at": {$gte: _startdate, $lt: _enddate},
                            "issue": {$in: _issue}
                        },{"user":_user}, function (err, issue) {

                            //new start
                            console.log("err   =   " + err);
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
                    }
                } else
                {
                    if (_issue === '')
                    {
                        Issue.find({"_id": {$in: ids}, "loc": {$nearSphere: {$geometry: {type: "Point", coordinates: JSON.parse(req.query.coordinates)}, $maxDistance: JSON.parse(req.query.distance)}},
                            "create_at": {$gte: _startdate, $lt: _enddate}
                        },{"user":_user}, function (err, issue) {


                            //new start
                            console.log("err   =   " + err);
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
                        Issue.find({"_id": {$in: ids}, "issue": {$in: _issue}, "loc": {$nearSphere: {$geometry: {type: "Point", coordinates: JSON.parse(req.query.coordinates)}, $maxDistance: JSON.parse(req.query.distance)}},
                            "create_at": {$gte: _startdate, $lt: _enddate}
                        },{"user":_user}, function (err, issue) {

                            //new start
                            console.log("err   =   " + err);
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
                    }
                }

            } else {
                if (_coordinates === '') {
                    if (_issue === '')
                    {
                        Issue.find({"_id": {$in: ids}, "create_at": {$gte: _startdate, $lt: _enddate}}, {"image_name": _image, "user":_user}, function (err, issue) {

                            //new start
                            console.log("err   =   " + err);
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
                        Issue.find({"_id": {$in: ids}, "create_at": {$gte: _startdate, $lt: _enddate},
                            "issue": {$in: _issue}
                        }, {"image_name": _image, "user":_user}, function (err, issue) {

                            //new start
                            console.log("err   =   " + err);
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
                    }
                } else
                {
                    if (_issue === '')
                    {
                        Issue.find({"_id": {$in: ids}, "loc": {$nearSphere: {$geometry: {type: "Point", coordinates: JSON.parse(req.query.coordinates)}, $maxDistance: JSON.parse(req.query.distance)}},
                            "create_at": {$gte: _startdate, $lt: _enddate}
                        }, {"image_name": _image, "user":_user}, function (err, issue) {

                            //new start
                            console.log("err   =   " + err);
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
                        Issue.find({"_id": {$in: ids}, "issue": {$in: _issue}, "loc": {$nearSphere: {$geometry: {type: "Point", coordinates: JSON.parse(req.query.coordinates)}, $maxDistance: JSON.parse(req.query.distance)}},
                            "create_at": {$gte: _startdate, $lt: _enddate}
                        }, {"image_name": _image, "user":_user}, function (err, issue) {

                            //new start
                            console.log("err   =   " + err);
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
                    }
                }

            }
        }





    });
});



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
			_issue = [_default_issue,"garbage", "plumbing", "lighting", "green", "protection-policy", "road-constructor", "environment"];
		}else{
			_issue = ["garbage", "plumbing", "lighting", "green", "protection-policy", "road-constructor", "environment"];
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
					_issue = [_default_issue,"garbage", "plumbing", "lighting", "green", "protection-policy",  "road-constructor", "environment"];
				}else{
					_issue = ["garbage", "plumbing", "lighting",  "green", "protection-policy", "road-constructor", "environment"];
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
		
		console.log("Get issues from bugzilla with city in the url!");
		
		var i_count = 0;
		
		console.log(JSON.stringify(body));
		
        if (body==undefined || body==null || body.length < 1 )
        {
			console.log("-1");
            res.send([{}]);
			
        } else {

            for (i_count = 0; i_count < body.result.bugs.length; i_count++)
            {
                ids.push(body.result.bugs[i_count].alias[0]);
                bugzilla_results = body.result.bugs;
            }

			console.log("0");
            if (_list_issue) {
                
				console.log("1");
                Issue.find({'_id': {$in: ids}, 'issue': {$in: ['garbage', 'lighting', 'plumbing', 'protection-policy', 'green', 'environment', 'road-constructor']}}, {"user":_user}, function (err, issue) {

					//new start
                    console.log("err   =   " + err);
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
							console.log("2");
                            Issue.find({"_id": {$in: ids}, "create_at": {$gte: _startdate, $lt: _enddate}}, {"user":_user}, function (err, issue) {
								//new start
								console.log("err   =   " + err);
								
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
							console.log("3");
                            Issue.find({"_id": {$in: ids}, "create_at": {$gte: _startdate, $lt: _enddate}}, {"user":_user}, function (err, issue) {
								console.log("");
								console.log("");
								console.log(_startdate);
								console.log(_enddate);
								console.log("");
								console.log("");
								console.log(ids);
								console.log("");
								console.log("");
								console.log("");
								console.log("");
								console.log(_issue);
								console.log("");
								console.log("");
								console.log("");
								console.log("");
								console.log("");
								console.log("");
								console.log(issue);
								console.log("");
								console.log("");
								console.log("");
								console.log("");
								console.log("");
								
								//new start
								console.log("err   =   " + err);
								
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
							console.log("4");
                            Issue.find({"_id": {$in: ids}, "loc": {$nearSphere: {$geometry: {type: "Point", coordinates: JSON.parse(req.query.coordinates)}, $maxDistance: JSON.parse(req.query.distance)}},
                                "create_at": {$gte: _startdate, $lt: _enddate}
                            }, {"user":_user}, function (err, issue) {

								//new start
								console.log("err   =   " + err);
								
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
							console.log("5");
                            Issue.find({"_id": {$in: ids}, "issue": {$in: _issue}, "loc": {$nearSphere: {$geometry: {type: "Point", coordinates: JSON.parse(req.query.coordinates)}, $maxDistance: JSON.parse(req.query.distance)}},
                                "create_at": {$gte: _startdate, $lt: _enddate}
						}, {"user":_user}, function (err, issue) {

								//new start
								console.log("err   =   " + err);

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
							console.log("6");
                            Issue.find({"_id": {$in: ids}, "create_at": {$gte: _startdate, $lt: _enddate}}, {"image_name": _image, "user":_user}, function (err, issue) {

								//new start
								console.log("err   =   " + err);
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
							console.log("7");
                            Issue.find({"_id": {$in: ids}, "create_at": {$gte: _startdate, $lt: _enddate},
                                "issue": {$in: _issue}
                            }, {"image_name": _image, "user":_user}, function (err, issue) {

                                
								//new start
								console.log("err   =   " + err);
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
							console.log("8");
                            Issue.find({"_id": {$in: ids}, "loc": {$nearSphere: {$geometry: {type: "Point", coordinates: JSON.parse(req.query.coordinates)}, $maxDistance: JSON.parse(req.query.distance)}},
                                "create_at": {$gte: _startdate, $lt: _enddate}
                            }, {"image_name": _image, "user":_user}, function (err, issue) {

								//new start
								console.log("err   =   " + err);
								
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
							console.log("9");
                            Issue.find({"_id": {$in: ids}, "issue": {$in: _issue}, "loc": {$nearSphere: {$geometry: {type: "Point", coordinates: JSON.parse(req.query.coordinates)}, $maxDistance: JSON.parse(req.query.distance)}},
                                "create_at": {$gte: _startdate, $lt: _enddate}
                            }, {"image_name": _image, "user":_user}, function (err, issue) {

								//new start
								console.log("err   =   " + err);
								
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



/* ** End test ** */
//POST router
router.post('/send_email', function (req, res) {    
	
	console.log("sdfsdfds");
	
	console.log("1111=====>>>> " + JSON.stringify(req.body));
	
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
				console.log("1");
				res.send(issue);
			}).sort({"create_at": _sort}).limit(_limit);
		}else{	
			Issue.find({ "issue": {$in:_feeling},"create_at": {$gte: _startdate, $lt: _enddate} },{"user":false}, function (err, issue) {
				console.log("2");
				res.send(issue);
			}).sort({"create_at": _sort}).limit(_limit);
		}
		
	}
	else{
		if(_coordinates!=''){
			Issue.find({ 'loc': {$nearSphere: {$geometry: {type: 'Point', coordinates: JSON.parse(req.query.coordinates)}, $maxDistance: 2000}}, "issue": {$in:_feeling},"create_at": {$gte: _startdate, $lt: _enddate}, "municipality":_city },{"user":false}, function (err, issue) {
				console.log("3");
				res.send(issue);
			}).sort({"create_at": _sort}).limit(_limit);
		}else{	
			Issue.find({ "issue": {$in:_feeling},"create_at": {$gte: _startdate, $lt: _enddate}, "municipality":_city  },{"user":false}, function (err, issue) {
				console.log("4");
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

router.get('/fullissue/:id', function (req, res) {

    var id = req.params.id;
    var issue_rtrn = [];

    var bugParams =
            {
                "method": "Bug.search",
                "params": [{"alias": id, "include_fields": ["id", "component", "alias", "status"]}],
                "id": 1
            };

    request({
        url: bugUrl,
        method: "POST",
        json: bugParams
    }, function (error, response, body) {
			
			if( body.result.bugs.length !== 0){
			
			if (body.length < 1) {

				res.send([{}]);

			} else {
				request({
					url: "http://nam.ece.upatras.gr/bugzilla/rest/bug/" + body.result.bugs[0].alias[0] + "/comment",
					method: "GET"
				}, function (error1, response1, body1) {
					if(error1)
						cosnole.log("/fullissue/:id error :"+error1);
					
					Issue.findOne({"_id": req.params.id}, function (err, issue) {
						
						console.log("issue      ===============>>>>>>>>    " + JSON.stringify(issue));
						if(issue != null){
							issue_rtrn = '[{"_id":"' + issue._id + '","municipality":"' + issue.municipality + '","image_name":"' + issue.image_name + '","issue":"' + issue.issue + '","device_id":"' + issue.device_id + '","value_desc":"' + issue.value_desc + '","user":{"phone":"' + issue.user.phone + '","email":"' + issue.user.email + '","name":"' + issue.user.name + '","uuid":"' + issue.user.uuid + '"},"comments":"' + issue.comments + '","create_at":"' + issue.create_at + '","loc":{"type":"Point","coordinates":[' + issue.loc.coordinates + ']},"status":"' + body.result.bugs[0].status + '","bug_id":"' + body.result.bugs[0].id + '"},' + body1 + ']';

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

                        // we have the updated user returned to us


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

                //res.send(actice_user);

            });


        } else { // Mobile use
            act_User.find({"uuid": req.body.uuid, "email": req.body.email}, function (error, resp) {
				
                if (error)
                    throw error;
				
				var text_act = "";
				var possible = "0123456789";
				
				
				
                if (resp.length > 0) {
					
					console.log(" activate    =============>>>>>>>>  " + resp[0].activate);
					
					if (resp[0].activate == "1") {
						text_act="1";
					}
					else{
						for (var i = 0; i < 4; i++)
							text_act += possible.charAt(Math.floor(Math.random() * possible.length));
					}
						console.log(" Mobile use    =============>>>>>>>>  " + JSON.stringify(resp));
						console.log(" text_act    =============>>>>>>>>  " + text_act);
						
						act_User.findOneAndUpdate({"uuid": req.body.uuid, "email": req.body.email}, {
							name: req.body.name,
							email: req.body.email,
							mobile_num: req.body.mobile_num,
							activate:text_act,
							permission: {communicate_with: {email: req.body.permission.communicate_with.email, sms: req.body.permission.communicate_with.sms}}
						}, function (err, resp1) {
							if (err)
								throw err;
							console.log(" Mobile use 1   =============>>>>>>>>  " + JSON.stringify(resp1));
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

                //res.send(actice_user);

            }).sort({"create_at":-1}).limit(1);
        }
    }

    //res.send({"name":"active_users"});

});

router.get('/policy', function (req, res) {
	res.send({"policy":"<p style=\"font-size:18px\"><b>Coming</b></p><p> soon<\p>"});
});



router.get('/active_users', function (req, res) {


    act_User.find({"uuid": req.query.uuid}, function (error, actice_user) {
        console.log(actice_user);
        res.send(actice_user);

    }).sort({"create_at": -1}).limit(1);




});

router.post('/activate_users', function (req, res) {

    console.log("_id   - " + req.body.id1);
    console.log("uuid   - " + req.body.id2);
    console.log("activate    - " + req.body.id3);

    act_User.findOneAndUpdate({"_id": req.body.id1, "uuid": req.body.id2, "activate": req.body.id3}, {
        "activate": "1"
    }, function (error, activate_user) {
        console.log(activate_user);
		console.log(error);
        res.send(activate_user);
    });

});

router.post('/admin/bugs/search', authorization, function (req, res) {
	console.log("sdfsdfsd======================================="+querystring.stringify(req.body)+"------->>>>>"+bugUrl);
    request({
        url: bugUrlRest + "/rest/bug?" + querystring.stringify(req.body),
        method: "GET"
    }, function (error, response, body) {
		
		console.log(JSON.stringify(response));
		console.log(JSON.stringify(body));
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
                console.log(body);
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
    console.log(req.body);
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
	console.log("dfdsgdfgfdg");
	console.log(req);
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


// Return router
module.exports = router;

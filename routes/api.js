// Dependencies
var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var fs = require('fs');
var request = require('request');

var config = require('app-config');

mongoose.connect('mongodb://'+config.config.my_hostname+'/'+config.config.database);

// Models
var Issue = require('../models/issue');
var act_User = require('../models/active_user');
var Municipality = require('../models/municipality');

// Routes
Issue.methods(['get', 'put', 'post', 'delete']);
Issue.register(router,'/issues');

//Bugzilla login
var bugUrl = config.config.bugUrl;

var loginData =
{
"method": "User.login",
"params": [{"login":config.config.login,"password":config.config.pwd}],
"id": 1
};

var bugToken="";
request({
    url: bugUrl,
    method: "POST",
    json: loginData
}, function (error, response, body) {
        if (!error && response.statusCode === 200) {
						bugToken = body.result.token;
						
						console.log("Login in bugzilla as: "+loginData.params[0].login);
						console.log("And assigned token: "+body.result.token);
        }
        else {
            console.log("error: " + error);
            console.log("response.statusCode: " + response.statusCode);
            console.log("response.statusText: " + response.statusText);
        }
});

//POST router
router.post('/issue', function (req,res){

		console.log(req.body.image_name);

		if (!req.body.hasOwnProperty('issue') ||
		 		!req.body.hasOwnProperty('loc') ||
				!req.body.hasOwnProperty('value_desc') ||
				!req.body.hasOwnProperty('device_id'))
		{
			res.statusCode = 403;
			return res.send({"message":"Forbidden"});
		}
		else
		{

			Municipality.find({boundaries:
		                   {$geoIntersects:
		                       {$geometry:{ "type" : "Point",
		                            "coordinates" : req.body.loc.coordinates }
		                        }
		                    }
		               },function(err, response){
			// console.log(err);
			// console.log(response.length);
					var entry = new Issue({
						loc : {type:'Point', coordinates: req.body.loc.coordinates},
						issue: req.body.issue,
						device_id: req.body.device_id,
						value_desc: req.body.value_desc,
					});

					/*var prefix = "data:image/jpeg;base64,";
					var base64 = new Buffer(req.body.image_upload, 'binary').toString('base64');
					var data = prefix + base64;*/

					//console.log("municipality = " + response[0]["municipality"]);
					console.log("response length = " + response.length);

					//entry.image_name = new Buffer(req.body.image_upload, "base64");

					entry.image_name = req.body.image_name;

					if (response.length>0)
						{
							entry.municipality = response[0]["municipality"];
						}
						else
						{
							entry.municipality = '';
						}

					//console.log("entry: %j", entry);

					// console.log(entry);
					entry.save(function (err1,resp){
						if (err1)
						{
							console.log(err1);
						}
						else
						{
							if (resp.issue == "garbage" || resp.issue =="road-contructor" || resp.issue =="lighting" || resp.issue =="plumbing")
							{
							console.log("resp.issue OK");
							console.log("response length = -->" + response.length);
									//if (resp.municipality=="Patras")
									if (response.length>0)
									{
							console.log("resp.municipality==Patras OK");
										var bugData=
										{
											"method": "Bug.create",
											"params": [{"token":bugToken ,"summary": resp.issue,"alias":resp._id,"url":resp.value_desc,"product": response[0]["municipality"],"component": config.config.bug_component,"version": "unspecified","cc":config.config.bug_cc,"op_sys":"All"}],
											"id": 2
										};
										request({
										    url: bugUrl,
										    method: "POST",
										    json: bugData
										}, function (error, bugResponse, body) {
										        if (!error && bugResponse.statusCode === 200) {
																//console.log("New Bugzilla Entry with id: "+body.result.id);
																console.log(body);
										        }
										        else {
										            console.log("error: " + error);
										            console.log("bugResponse.statusCode: " + bugResponse.statusCode);
										            console.log("bugResponse.statusText: " + bugResponse.statusText);
										        }
										});
									}
							}
							console.log('saved: ', resp);
							res.send(resp);
						}
					});
				});
		}
});

router.post('/issue/:id', function (req,res){
	
	console.log("------------------");
	console.log(req.params.id);
	console.log(req.body.uuid);
	console.log(req.body.name);
	
	var bodyParams;
	
	Issue.findOneAndUpdate({"_id":req.params.id}, {	
			user : {uuid: req.body.uuid,	name: req.body.name,	email: req.body.email,	phone: req.body.mobile_num }
		}, function(err, resp){
			if (err) throw err;

					// we have the updated user returned to us
			console.log(resp);
					
			var bugParams =
			{
				"method": "Bug.search",
				"params": [{"alias": req.params.id, "include_fields": ["id","alias"] }],
				"id": 1
			};
					
			request({
				url: bugUrl,
				method: "POST",
				json: bugParams
				}, function (error, response, body) {			
						
					console.log("-------------------------");
					console.log("=========================");
					
					//console.log(body.result.bugs[0].id);
					console.log(bugToken);
                    
					bodyParams =
					{
						"method": "Bug.update",
						"params": [{"token":bugToken, "ids": [body.result.bugs[0].id], "cc": {"add":[req.body.email]}}],
						"id": 1
					};
					
					request({
						url: bugUrl,
						method: "POST",
						json: bodyParams
						}, function (error, response, body) {	
							console.log(body);
					});						
					
			});
			
			
			
			res.send({"description" : "update dane!"});
					
	});
	
});

router.get('/issue', function(req, res) {


	//return res.send(req.query.startdate);
	var _startdate=new Date();
	var _enddate=new Date();
	var _coordinates;
	var _distance;
	var _issue;
	var _limit;
	var _sort;
	var _loc_var;
	var newdate = new Date();
	var _image;
	var _list_issue;
	if (!req.query.hasOwnProperty('startdate'))
	{
		_startdate.setDate(_startdate.getDate() -3);
		_startdate.setHours(00);
		_startdate.setMinutes(00,00);
	}
	else{
		_startdate = new Date(req.query.startdate);
		_startdate.setHours(00);
		_startdate.setMinutes(00,00);
	}

	if (req.query.hasOwnProperty('enddate'))
	{
		_enddate = new Date(req.query.enddate);
		_enddate.setHours(23);
		_enddate.setMinutes(59,59);
	}
	else{
		_enddate=newdate;
	}

	if (!req.query.hasOwnProperty('coordinates'))
	{
		_coordinates = '';
	}
	else{
		_coordinates = req.query.coordinates;
	}

	if (!req.query.hasOwnProperty('distance'))
	{
		_distance = '10000';
	}
	else{
		_distance = req.query.distance;
	}

	if (!req.query.hasOwnProperty('issue') || req.query.issue === 'all')
	{
		_issue = '';
	}
	else{
		_issue = req.query.issue;
	}

	if (!req.query.hasOwnProperty('limit'))
	{
		_limit = 1000;
	}
	else{
		_limit = req.query.limit;
	}

	if (!req.query.hasOwnProperty('sort'))
	{
		_sort = -1;
	}
	else{
		_sort = req.query.sort;
	}
	if (!req.query.hasOwnProperty('image_field'))
	{
		_image =true;
		console.log("1 _image="+_image);
	}
	else{
		if(req.query.image_field==0)
		{
			_image = false;
			console.log("2 _image="+_image);
		}else{
			_image = true;
			console.log("2 _image="+_image);
		}


	}

	if (!req.query.hasOwnProperty('list_issue'))
	{
		_list_issue =false;
	}
	else{
		if(req.query.image_field==0)
		{
			_list_issue = false;
		}else{
			_list_issue = true;
		}


	}
	console.log(_list_issue);

	if(_list_issue){

		Issue.find({'issue': { $in: [ 'garbage', 'lighting', 'road-contructor', 'plumbing' ]}},function(err, issue){
					res.send(issue);
				  }).sort({create_at:_sort}).limit(_limit);
	}
	else{
		if(_image){
			if(_coordinates === ''){
			  if( _issue === '')
			  {
				  Issue.find({"create_at":{$gte:_startdate, $lt:_enddate}},function(err, issue){
					res.send(issue);
				  }).sort({create_at:_sort}).limit(_limit);
			  }
			  else{
				  //Issue.find({"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
				Issue.find({"create_at":{$gte:_startdate, $lt:_enddate},
									 "issue":_issue
									}, function(err, issue){
					res.send(issue);
				  }).sort({create_at:_sort}).limit(_limit);

			  }
			}
			else
			{
				if(_issue === '')
				{
					Issue.find({"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
							"create_at":{$gte:_startdate, $lt:_enddate}
						}, function(err, issue){
						res.send(issue);
					}).sort({create_at:_sort}).limit(_limit);
				}
				else{
					Issue.find({"issue":_issue,"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
							"create_at":{$gte:_startdate, $lt:_enddate}
						}, function(err, issue){
							res.send(issue);
						}).sort({create_at:_sort}).limit(_limit);
				}
			}

		}else{

			if(_coordinates === ''){
				
			  if( _issue === '')
			  {
				  Issue.find({"create_at":{$gte:_startdate, $lt:_enddate}},{"image_name":_image},function(err, issue){
					res.send(issue);
				  }).sort({create_at:_sort}).limit(_limit);
			  }
			  else{
				Issue.find({"create_at":{$gte:_startdate, $lt:_enddate},
									 "issue":_issue
									},{"image_name":_image}, function(err, issue){
					res.send(issue);
				  }).sort({create_at:_sort}).limit(_limit);

			  }
			}
			else
			{
				if(_issue === '')
				{
					Issue.find({"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},					
							"create_at":{$gte:_startdate, $lt:_enddate}
						},{"image_name":_image}, function(err, issue){
						res.send(issue);
					}).sort({create_at:_sort}).limit(_limit);
				}
				else{
						Issue.find({"issue":_issue,"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
							"create_at":{$gte:_startdate, $lt:_enddate}
						},{"image_name":_image}, function(err, issue){
							res.send(issue);
						}).sort({create_at:_sort}).limit(_limit);
						
				}
			}

		}
	}
});

router.get('/issue/:city', function(req, res) {


	//return res.send(req.query.startdate);
	var _startdate=new Date();
	var _enddate=new Date();
	var _coordinates;
	var _distance;
	var _issue;
	var _limit;
	var _sort;
	var _loc_var;
	var newdate = new Date();
	var _image;
	var _list_issue;
	var city_name = req.params.city;
	
	
	if (!req.query.hasOwnProperty('startdate'))
	{
		_startdate.setDate(_startdate.getDate() -3);
		_startdate.setHours(00);
		_startdate.setMinutes(00,00);
	}
	else{
		_startdate = new Date(req.query.startdate);
		_startdate.setHours(00);
		_startdate.setMinutes(00,00);
	}

	if (req.query.hasOwnProperty('enddate'))
	{
		_enddate = new Date(req.query.enddate);
		_enddate.setHours(23);
		_enddate.setMinutes(59,59);
	}
	else{
		_enddate=newdate;
	}

	if (!req.query.hasOwnProperty('coordinates'))
	{
		_coordinates = '';
	}
	else{
		_coordinates = req.query.coordinates;
	}

	if (!req.query.hasOwnProperty('distance'))
	{
		_distance = '10000';
	}
	else{
		_distance = req.query.distance;
	}

	if (!req.query.hasOwnProperty('issue') || req.query.issue === 'all')
	{
		_issue = '';
	}
	else{
		_issue = req.query.issue;
	}

	if (!req.query.hasOwnProperty('limit'))
	{
		_limit = 1000;
	}
	else{
		_limit = req.query.limit;
	}

	if (!req.query.hasOwnProperty('sort'))
	{
		_sort = -1;
	}
	else{
		_sort = req.query.sort;
	}
	if (!req.query.hasOwnProperty('image_field'))
	{
		_image =true;
	}
	else{
		if(req.query.image_field==0)
		{
			_image = false;
		}else{
			_image = true;
		}
	}

	if (!req.query.hasOwnProperty('list_issue'))
	{
		_list_issue =false;
	}
	else{
		if(req.query.image_field==0)
		{
			_list_issue = false;
		}else{
			_list_issue = true;
		}


	}
	
	if(_list_issue){
		Issue.find({'municipality':city_name, 'issue': { $in: [ 'garbage', 'lighting', 'road-contructor', 'plumbing' ]}},function(err, issue){
					res.send(issue);
				  }).sort({create_at:_sort}).limit(_limit);
	}
	else{
		if(_image){
			if(_coordinates === ''){
			  if( _issue === '')
			  {
				  Issue.find({'municipality':city_name,'create_at':{$gte:_startdate, $lt:_enddate}},function(err, issue){
					res.send(issue);
				  }).sort({create_at:_sort}).limit(_limit);
			  }
			  else{
				Issue.find({'municipality':city_name,'create_at':{$gte:_startdate, $lt:_enddate},
									 "issue":_issue
									}, function(err, issue){
					res.send(issue);
				  }).sort({create_at:_sort}).limit(_limit);

			  }
			}
			else
			{
				if(_issue === '')
				{
					
					Issue.find({'municipality':city_name, 'loc':{$nearSphere:{$geometry:{type:'Point',coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
							'create_at':{$gte:_startdate, $lt:_enddate}
						}, function(err, issue){
						res.send(issue);
					}).sort({create_at:_sort}).limit(_limit);
				}
				else{
					Issue.find({'municipality':city_name,'issue':_issue,'loc':{$nearSphere:{$geometry:{type:'Point',coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
							'create_at':{$gte:_startdate, $lt:_enddate}
						}, function(err, issue){
							res.send(issue);
						}).sort({create_at:_sort}).limit(_limit);
				}
			}

		}else{

			if(_coordinates === ''){
			  if( _issue === '')
			  {
				  Issue.find({'create_at':{$gte:_startdate, $lt:_enddate},'municipality':city_name}, {'image_name':_image}, function(err, issue){
					res.send(issue);
				  }).sort({create_at:_sort}).limit(_limit);
			  }
			  else{
				Issue.find({'create_at':{$gte:_startdate, $lt:_enddate},
									 'issue':_issue, 'municipality':city_name
									},{'image_name':_image}, function(err, issue){
					res.send(issue);
				  }).sort({create_at:_sort}).limit(_limit);

			  }
			}
			else
			{
				if(_issue === '')
				{
					Issue.find({'loc':{$nearSphere:{$geometry:{type:'Point',coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
							'create_at':{$gte:_startdate, $lt:_enddate}, 'municipality':city_name
						},{'image_name':_image} , function(err, issue){
						res.send(issue);
					}).sort({create_at:_sort}).limit(_limit);
				}
				else{
					Issue.find({'issue':_issue,'loc':{$nearSphere:{$geometry:{type:'Point',coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
							'create_at':{$gte:_startdate, $lt:_enddate}, 'municipality':city_name
						},{'image_name':_image}, function(err, issue){
							res.send(issue);
						}).sort({create_at:_sort}).limit(_limit);
				}
			}

		}
	}
});




/* ** Test ** */

router.get('/issue_test', function(req, res) {
	
	
	
	var bugParams =
	{
	    /*"method": "Bug.get",
	    "params": [{"include_fields":["component","cf_sensecityissue","status","id","alias","summary","creation_time","whiteboard","resolution","last_change_time"]}],
	    "id": 1*/
		"method": "Bug.search",
		"params": [{"product": "testweb","order":"bug_id DESC","status":["CONFIRMED","IN_PROGRESS","RESOLVED"],"resolution":["---","FIXED"],"f1":"creation_ts","o1":"greaterthan","v1":"2016-01-01","include_fields":["id","alias"]}],
		"id": 1
	};
	
	var ids;
	
	request({
		url: bugUrl,
		method: "POST",
		json: bugParams
	}, function (error, response, body) {			
		
		console.log("-------------------------");
		console.log("=========================");

		var i_count=0;
		
		
		for(i_count=0;i_count<body.result.bugs.length;i_count++)
		{
			//console.log(i_count + "<=====>" + body.result.bugs[i_count].alias);
			ids += '"'+body.result.bugs[i_count].alias+'"';
			if(i_count<body.result.bugs.length-1)
			{
				ids +=' , ';
			}
		}
		
		
		Issue.find({"_id": {$in : [ "57fe2f6659ed960e3c0cb850" , "57fe296459ed960e3c0cb84f" , "57fe235c59ed960e3c0cb84e"]}} , function(err, issue){
				
				console.log("err   =   "+err);
				console.log(issue);
				res.send(issue);
			});
		
		//console.log(ids);
		
		console.log("-------------------------");
		console.log("=========================");
		/*Issue.find({'_id': {$in: JSON.parse("[" + ids + "]")}} , function(err, issue){
		//Issue.find({"_id": {$in : [ "57fe2f6659ed960e3c0cb850" , "57fe296459ed960e3c0cb84f" , "57fe235c59ed960e3c0cb84e"]}} , function(err, issue){
				
				console.log("err   =   "+err);
				console.log(issue);
				res.send(issue);
			});*/
			
		console.log("-------------------------");
		console.log("=========================");
			
			/*if (!error && response.statusCode === 200) {
							bugToken = body.result.token;
							
							console.log("Login in bugzilla as: "+loginData.params[0].login);
							console.log("And assigned token: "+body.result.token);
			}
			else {
				console.log("error: " + error);
				console.log("response.statusCode: " + response.statusCode);
				console.log("response.statusText: " + response.statusText);
			}*/
	});

	
	
	
	
	
	/*
	
	
	
	//return res.send(req.query.startdate);
	var _startdate=new Date();
	var _enddate=new Date();
	var _coordinates;
	var _distance;
	var _issue;
	var _limit;
	var _sort;
	var _loc_var;
	var newdate = new Date();
	var _image;
	var _list_issue;
	if (!req.query.hasOwnProperty('startdate'))
	{
		_startdate.setDate(_startdate.getDate() -3);
		_startdate.setHours(00);
		_startdate.setMinutes(00,00);
	}
	else{
		_startdate = new Date(req.query.startdate);
		_startdate.setHours(00);
		_startdate.setMinutes(00,00);
	}

	if (req.query.hasOwnProperty('enddate'))
	{
		_enddate = new Date(req.query.enddate);
		_enddate.setHours(23);
		_enddate.setMinutes(59,59);
	}
	else{
		_enddate=newdate;
	}

	if (!req.query.hasOwnProperty('coordinates'))
	{
		_coordinates = '';
	}
	else{
		_coordinates = req.query.coordinates;
	}

	if (!req.query.hasOwnProperty('distance'))
	{
		_distance = '10000';
	}
	else{
		_distance = req.query.distance;
	}

	if (!req.query.hasOwnProperty('issue') || req.query.issue === 'all')
	{
		_issue = '';
	}
	else{
		_issue = req.query.issue;
	}

	if (!req.query.hasOwnProperty('limit'))
	{
		_limit = 1000;
	}
	else{
		_limit = req.query.limit;
	}

	if (!req.query.hasOwnProperty('sort'))
	{
		_sort = -1;
	}
	else{
		_sort = req.query.sort;
	}
	if (!req.query.hasOwnProperty('image_field'))
	{
		_image =true;
		console.log("1 _image="+_image);
	}
	else{
		if(req.query.image_field==0)
		{
			_image = false;
			console.log("2 _image="+_image);
		}else{
			_image = true;
			console.log("2 _image="+_image);
		}


	}

	if (!req.query.hasOwnProperty('list_issue'))
	{
		_list_issue =false;
	}
	else{
		if(req.query.image_field==0)
		{
			_list_issue = false;
		}else{
			_list_issue = true;
		}


	}
	console.log(_list_issue);

	if(_list_issue){

		Issue.find({'issue': { $in: [ 'garbage', 'lighting', 'road-contructor', 'plumbing' ]}},function(err, issue){
					res.send(issue);
				  }).sort({create_at:_sort}).limit(_limit);
	}
	else{
		if(_image){
			if(_coordinates === ''){
			  if( _issue === '')
			  {
				  Issue.find({"create_at":{$gte:_startdate, $lt:_enddate}},function(err, issue){
					res.send(issue);
				  }).sort({create_at:_sort}).limit(_limit);
			  }
			  else{
				  //Issue.find({"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
				Issue.find({"create_at":{$gte:_startdate, $lt:_enddate},
									 "issue":_issue
									}, function(err, issue){
					res.send(issue);
				  }).sort({create_at:_sort}).limit(_limit);

			  }
			}
			else
			{
				if(_issue === '')
				{
					Issue.find({"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
							"create_at":{$gte:_startdate, $lt:_enddate}
						}, function(err, issue){
						res.send(issue);
					}).sort({create_at:_sort}).limit(_limit);
				}
				else{
					Issue.find({"issue":_issue,"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
							"create_at":{$gte:_startdate, $lt:_enddate}
						}, function(err, issue){
							res.send(issue);
						}).sort({create_at:_sort}).limit(_limit);
				}
			}

		}else{

			if(_coordinates === ''){
				
			  if( _issue === '')
			  {
				  Issue.find({"create_at":{$gte:_startdate, $lt:_enddate}},{"image_name":_image},function(err, issue){
					res.send(issue);
				  }).sort({create_at:_sort}).limit(_limit);
			  }
			  else{
				Issue.find({"create_at":{$gte:_startdate, $lt:_enddate},
									 "issue":_issue
									},{"image_name":_image}, function(err, issue){
					res.send(issue);
				  }).sort({create_at:_sort}).limit(_limit);

			  }
			}
			else
			{
				if(_issue === '')
				{
					Issue.find({"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},					
							"create_at":{$gte:_startdate, $lt:_enddate}
						},{"image_name":_image}, function(err, issue){
						res.send(issue);
					}).sort({create_at:_sort}).limit(_limit);
				}
				else{
						Issue.find({"issue":_issue,"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
							"create_at":{$gte:_startdate, $lt:_enddate}
						},{"image_name":_image}, function(err, issue){
							res.send(issue);
						}).sort({create_at:_sort}).limit(_limit);
						
				}
			}

		}
	}
	
	*/
	
	
	
	
});


/* ** End test ** */




router.get('/mobilemap', function(req, res) {
	
	Issue.find({'loc':{$nearSphere:{$geometry:{type:'Point',coordinates:JSON.parse(req.query.coordinates)},$maxDistance:2000}}}, {'image_name':false}, function(err, issue){
		res.send(issue);
	}).sort({create_at:1}).limit(40);
	
});

router.get('/fullissue/:id', function(req, res){
	var id = req.params.id;

	Issue.findOne({"_id":req.params.id},function(err, issue){
		res.send(issue);
	});
});




router.post('/active_users', function(req, res) {
	
	
	/*
!req.body.hasOwnProperty('issue') ||
		 		!req.body.hasOwnProperty('loc') ||
				!req.body.hasOwnProperty('value_desc') ||
				!req.body.hasOwnProperty('device_id'))
*/				
					
					
	if(req.body.hasOwnProperty('uuid') && req.body.hasOwnProperty('name') && req.body.hasOwnProperty('email'))
	{
		
		act_User.find({"uuid":req.body.uuid}, function(error, resp){
			
			if (error) throw error;
			 
			if(resp.length > 0){
				console.log("2. email  => "+resp[0].email);
				/*
				var entry_active_user = new act_User({					
					name: req.body.name,	
					email: req.body.email,
					mobile_num: req.body.mobile_num,
					permission :  { communicate_with: {email : req.body.permission.communicate_with.email, sms : req.body.permission.communicate_with.sms}}
				});*/
				
				act_User.findOneAndUpdate({"uuid":req.body.uuid}, {					
					name: req.body.name,	
					email: req.body.email,
					mobile_num: req.body.mobile_num,
					permission :  { communicate_with: {email : req.body.permission.communicate_with.email, sms : req.body.permission.communicate_with.sms}}
				}, function(err, resp){
					 if (err) throw err;

					// we have the updated user returned to us
					console.log(resp);
					
					res.send({"description" : "update dane!"});
					
				});
				
				/*
				resp[0].email = resp[0].email;
				resp[0].name = req.body.name;
				resp[0].mobile_num = req.body.mobile_num;
				resp[0].permission.communicate_with.email = req.body.permission.communicate_with.email;
				resp[0].permission.communicate_with.sms = req.body.permission.communicate_with.sms;
				*/
				/*
				var entry_active_user = new act_User({					
					name: req.body.name,	
					email: req.body.email,
					mobile_num: req.body.mobile_num,
					permission :  { send_issues: req.body.permission.send_issues , communicate_with: {email : req.body.permission.communicate_with.email, sms : req.body.permission.communicate_with.sms}}
				});
				*/
				/*
				resp.save(function(err){
					if (err) throw err;
					console.log('User successfully updated!');
					
				});
				
				console.log(entry_active_user);
				entry_active_user.update({"uuid" :  req.body.uuid}, {$set: entry_active_user}, function(err, resp){
					console.log(resp);
					res.send(resp);
					
				} );
				*/
				
			}
			else{
				var entry_active_user = new act_User({
					uuid :  req.body.uuid,
					name: req.body.name,	
					email: req.body.email,
					mobile_num: req.body.mobile_num,
					permission :  { send_issues: req.body.permission.send_issues , communicate_with: {email : req.body.permission.communicate_with.email, sms : req.body.permission.communicate_with.sms}}
				});
				
				entry_active_user.save(function (err1,resp){
					if (err1) throw err1;
					res.send(resp);
				});
			}
			
			//res.send(actice_user);
		
		});
		
		
	

	}
					
					
	//res.send({"name":"active_users"});
	
});

router.get('/active_users', function(req, res) {
	
	console.log(req.query.uuid);
	console.log(res);
	
	act_User.find({"uuid":req.query.uuid}, function(error, actice_user){
		
		res.send(actice_user);
		
	});
	
	
	
	
});




// Return router
module.exports = router;

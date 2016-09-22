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
																console.log("New Bugzilla Entry with id: "+body.result.id);
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
	console.log(_list_issue);

	if(_list_issue){
		//,{"create_at":{$gte:_startdate, $lt:_enddate}}
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
					//http://api.sense.city:3005/api/issue?startdate=2016-01-22T00:00:00:000Z&enddate=2016-03-28T00:00:00:000Z&coordinates=[21.734574,38.2466395]&distance=1000&issue=garbage
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
				  Issue.find({},{"image_name":_image},{"create_at":{$gte:_startdate, $lt:_enddate}},function(err, issue){
					res.send(issue);
				  }).sort({create_at:_sort}).limit(_limit);
			  }
			  else{

				//Issue.find({"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
				Issue.find({},{"image_name":_image},{"create_at":{$gte:_startdate, $lt:_enddate},
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
					//http://api.sense.city:3005/api/issue?startdate=2016-01-22T00:00:00:000Z&enddate=2016-03-28T00:00:00:000Z&coordinates=[21.734574,38.2466395]&distance=1000&issue=garbage
					Issue.find({},{"image_name":_image},{"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
							"create_at":{$gte:_startdate, $lt:_enddate}
						}, function(err, issue){
						res.send(issue);
					}).sort({create_at:_sort}).limit(_limit);
				}
				else{
					Issue.find({},{"image_name":_image},{"issue":_issue,"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
							"create_at":{$gte:_startdate, $lt:_enddate}
						}, function(err, issue){
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
	console.log(_list_issue);

	if(_list_issue){
		//,{"create_at":{$gte:_startdate, $lt:_enddate}}
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

				//Issue.find({"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
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
					//http://api.sense.city:3005/api/issue?startdate=2016-01-22T00:00:00:000Z&enddate=2016-03-28T00:00:00:000Z&coordinates=[21.734574,38.2466395]&distance=1000&issue=garbage
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
				  Issue.find({},{'municipality':city_name, 'image_name':_image},{'create_at':{$gte:_startdate, $lt:_enddate}},function(err, issue){
					res.send(issue);
				  }).sort({create_at:_sort}).limit(_limit);
			  }
			  else{

				//Issue.find({"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
				Issue.find({},{'municipality':city_name, 'image_name':_image},{'create_at':{$gte:_startdate, $lt:_enddate},
									 'issue':_issue
									}, function(err, issue){
					res.send(issue);
				  }).sort({create_at:_sort}).limit(_limit);

			  }
			}
			else
			{
				if(_issue === '')
				{
					//http://api.sense.city:3005/api/issue?startdate=2016-01-22T00:00:00:000Z&enddate=2016-03-28T00:00:00:000Z&coordinates=[21.734574,38.2466395]&distance=1000&issue=garbage
					Issue.find({},{'municipality':city_name, 'image_name':_image},{'loc':{$nearSphere:{$geometry:{type:'Point',coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
							'create_at':{$gte:_startdate, $lt:_enddate}
						}, function(err, issue){
						res.send(issue);
					}).sort({create_at:_sort}).limit(_limit);
				}
				else{
					Issue.find({},{'municipality':city_name, 'image_name':_image},{'issue':_issue,'loc':{$nearSphere:{$geometry:{type:'Point',coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
							'create_at':{$gte:_startdate, $lt:_enddate}
						}, function(err, issue){
							res.send(issue);
						}).sort({create_at:_sort}).limit(_limit);
				}
			}

		}
	}
});


router.get('/fullissue/:id', function(req, res){
	var id = req.params.id;

	Issue.findOne({"_id":req.params.id},function(err, issue){
		res.send(issue);
	});
});







// Return router
module.exports = router;

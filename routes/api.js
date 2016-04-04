// Dependencies

var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var fs = require('fs');



mongoose.connect('mongodb://localhost/sensecity');

// Models

var Issue = require('../models/issue');

// Routes
Issue.methods(['get', 'put', 'post', 'delete']);
Issue.register(router,'/issues');




router.get('/issue', function(req, res){

	
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
	

	/*
	if (!req.query.hasOwnProperty('startdate') || !req.query.hasOwnProperty('enddate') || !req.query.hasOwnProperty('coordinates') || !req.query.hasOwnProperty('distance')  || !req.query.hasOwnProperty('issue')) {
		res.statusCode = 400;
		return res.send({"message" : "Error 400: Incorrect syntax"});
	}*/

  /*var startdate = new Date(req.query.startdate);
  var enddate = new Date(req.query.enddate);
   
   console.log(startdate);
   console.log(enddate);*/
   
   //db.issues.find({create_at:{$gt: new ISODate('2016-01-22T00:00:00:000Z'), $lt: new ISODate('2016-03-31T00:00:00:000Z')}}).sort({create_at:-1}).limit(5)

   
   
  if(_coordinates === ''){
	  if( _issue === '')
	  {
		  /*var xxxx= new Date();
		  var yyyy= new Date();
		  xxxx.setDate(xxxx.getDate() -50); 
		  */
		  console.log('_coordinates null 1 '+_startdate+' - '+_enddate+' - '+_sort+' - '+_limit);
		  //http://api.sense.city:3005/api/issue?startdate=2016-01-22T00:00:00:000Z&enddate=2016-03-28T00:00:00:000Z&coordinates=[21.734574,38.2466395]&distance=1000&issue=garbage
		  //Issue.find({"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
		  //{create_at:{$gte:_startdate, $lt:_enddate}}
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
		  }).sort({"create_at":_sort}).limit(_limit);
		  
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
		  }).sort({"create_at":_sort}).limit(_limit);
	  }
	  else{
		  console.log("trhyrtytr");
		Issue.find({"issue":_issue,"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
							 "create_at":{$gte:_startdate, $lt:_enddate}							 
							}, function(err, issue){
			res.send(issue);
		  }).sort({"create_at":_sort}).limit(_limit);
		  
	  }
  }
  /*
  if(!req.query.hasOwnProperty('issue') || req.query.issue==='all' || _issue === '')
  {
	  //http://api.sense.city:3005/api/issue?startdate=2016-01-22T00:00:00:000Z&enddate=2016-03-28T00:00:00:000Z&coordinates=[21.734574,38.2466395]&distance=1000&issue=garbage
	  //Issue.find({"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
	  Issue.find({_loc_var,
						 "create_at":{$gte:_startdate, $lte:_enddate}
						}, function(err, issue){
		res.send(issue);
	  }).sort({"create_at":_sort}).limit(_limit);
  }
  else{
	//Issue.find({"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
	Issue.find({_loc_var,
						 "create_at":{$gte:startdate, $lte:_enddate},
						 "issue":_issue
						}, function(err, issue){
		res.send(issue);
	  }).sort({"create_at":_sort}).limit(_limit);
	  
  }
  */
  
}); 





// Return router
module.exports = router;
  

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
	var _startdate="";
	var _enddate="";
	var _coordinates;
	var _distance;
	var _issue;
	var _limit;
	var _sort;
	var _loc_var;
	var newdate = new Date();
	
	if (!req.query.hasOwnProperty('startdate'))
	{
		if(newdate.getMonth()<10){
			_startdate = newdate.getFullYear()+'-0'+(newdate.getMonth()+1)+'-'+(newdate.getDate()-3)+'T00:00:00:000Z';
		}else{
			_startdate = newdate.getFullYear()+'-'+(newdate.getMonth()+1)+'-'+(newdate.getDate()-3)+'T00:00:00:000Z';
		}
	}
	else{
		_startdate = req.query.startdate;
	}
	
	if (!req.query.hasOwnProperty('enddate'))
	{
		if(newdate.getMonth()<10){
			_enddate = newdate.getFullYear()+'-0'+(newdate.getMonth()+1)+'-'+newdate.getDate()+'T23:59:59:000Z';
		}
		else{
			_enddate = newdate.getFullYear()+'-'+(newdate.getMonth()+1)+'-'+newdate.getDate()+'T23:59:59:000Z';
		}
	}
	else{
		_enddate = req.query.enddate;
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
		  console.log('_coordinates null 1 '+Date(_startdate)+' - '+Date(_enddate)+' - '+_sort+' - '+_limit);
		  //http://api.sense.city:3005/api/issue?startdate=2016-01-22T00:00:00:000Z&enddate=2016-03-28T00:00:00:000Z&coordinates=[21.734574,38.2466395]&distance=1000&issue=garbage
		  //Issue.find({"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
		  //{create_at:{$gte:_startdate, $lt:_enddate}}
		  Issue.find({"create_at":{$gte:Date(_startdate), $lt:Date(_enddate)}
							},function(err, issue){
			res.send(err);
		  });//.sort({create_at:_sort}).limit(_limit);
	  }
	  else{
		console.log('_coordinates null 2');
		//Issue.find({"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
		Issue.find({"create_at":{$gte:'"'+_startdate+'"', $lt:'"'+_enddate+'"'},
							 "issue":_issue
							}, function(err, issue){
			res.send(err);
		  }).sort({"create_at":_sort}).limit(_limit);
		  
	  }	  
  }
  else
  {
		 console.log('_coordinates not null');
	  if(!req.query.hasOwnProperty('issue') || req.query.issue==='all' || _issue === '')
	  {
		  //http://api.sense.city:3005/api/issue?startdate=2016-01-22T00:00:00:000Z&enddate=2016-03-28T00:00:00:000Z&coordinates=[21.734574,38.2466395]&distance=1000&issue=garbage
		  Issue.find({"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
		  
							 "create_at":{$gte:_startdate, $lt:_enddate}
							}, function(err, issue){
			res.send(issue);
		  }).sort({"create_at":_sort}).limit(_limit);
	  }
	  else{
		Issue.find({"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
							 "create_at":{$gte:startdate, $lt:_enddate},
							 "issue":_issue
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
  

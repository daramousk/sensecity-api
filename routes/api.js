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
	var _image;
	
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
				Issue.find({"issue":_issue,"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
						"create_at":{$gte:_startdate, $lt:_enddate}							 
					}, function(err, issue){
						res.send(issue);
					}).sort({"create_at":_sort}).limit(_limit);
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
			  }).sort({"create_at":_sort}).limit(_limit);
			  
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
				}).sort({"create_at":_sort}).limit(_limit);
			}
			else{			
				Issue.find({},{"image_name":_image},{"issue":_issue,"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
						"create_at":{$gte:_startdate, $lt:_enddate}							 
					}, function(err, issue){
						res.send(issue);
					}).sort({"create_at":_sort}).limit(_limit);
			}
		}
	
	}
  
}); 





// Return router
module.exports = router;
  

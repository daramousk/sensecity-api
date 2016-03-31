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
	
	
	if (!req.query.hasOwnProperty('startdate') || !req.query.hasOwnProperty('enddate') || !req.query.hasOwnProperty('coordinates') || !req.query.hasOwnProperty('distance') /* || !req.query.hasOwnProperty('issue')*/) {
		res.statusCode = 400;
		return res.send({"message" : "Error 400: Incorrect syntax"});
	}

  var startdate = new Date(req.query.startdate);
  var enddate = new Date(req.query.enddate);
   
   console.log(startdate);
   console.log(enddate);

   //db.issues.find().sort({create_at:-1}).limit(5)

  if(!req.query.hasOwnProperty('issue') || req.query.issue==='all')
  {
	  //http://api.sense.city:3005/api/issue?startdate=2016-01-22T00:00:00:000Z&enddate=2016-03-28T00:00:00:000Z&coordinates=[21.734574,38.2466395]&distance=1000&issue=garbage
	  Issue.find({"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
						 "create_at":{$gte:startdate}
						}, function(err, issue){
		res.send(issue);
	  }).sort({create_at:-1}).limit(5);
  }
  else{
	Issue.find({"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
						 "create_at":{$gte:startdate},
						 "issue":req.query.issue
						}, function(err, issue){
		res.send(issue);
	  }).sort({create_at:-1}).limit(5);
	  
  }
  
  
}); 





// Return router
module.exports = router;
  

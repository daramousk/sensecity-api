
var express = require('express');
var static_router = express.Router();
var mongoose = require('mongoose');
var fs = require('fs');


// Models

var Static_data = require('../models/staticData');



static_router.get('/data', function(req, res){		
	Static_data.find({}, function(err, issue){
		res.send(issue);
  });
}); 

static_router.get('/garbage', function(req, res){		
	Static_data.find({type:"garbage"}, function(err, issue){
		res.send(issue);
  });
}); 

static_router.get('/fotistiko', function(req, res){		
	Static_data.find({}, function(err, issue){
		res.send(issue);
  });
}); 



// Return router
module.exports = static_router;
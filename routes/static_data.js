
var express = require('express');
var static_router = express.Router();
var mongoose = require('mongoose');
var fs = require('fs');


// Models

var static_data = require('../models/static_data');



static_router.get('/data', function(req, res){		
	static_data.find({}, function(err, issue){
		res.send(issue);
  });
}); 

static_router.get('/garbage', function(req, res){		
	console.log("garbage");
	static_data.find({type:"garbage"},function(err, issue){
		res.send(issue);
  });
}); 

static_router.get('/fotistiko', function(req, res){		
	static_data.find({type:"fotistiko"}, function(err, issue){
		res.send(issue);
  });
}); 



// Return router
module.exports = static_router;
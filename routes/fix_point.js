
var express = require('express');
var static_router = express.Router();
var mongoose = require('mongoose');
var fs = require('fs');


// Models

var static_data = require('../models/fix_point');



static_router.get('/:long/:lat/:dist/data', function(req, res){		
	static_data.find(function(err, issue){
		res.send(issue);
  });
}); 

static_router.get('/:long/:lat/:dist/garbage', function(req, res){		
	console.log("garbage");
	static_data.find(function(err, issue){
		res.send(issue);
  });
}); 

static_router.get('/:long/:lat/:dist/fotistiko', function(req, res){		
	static_data.find(function(err, issue){
		res.send(issue);
  });
}); 



// Return router
module.exports = static_router;
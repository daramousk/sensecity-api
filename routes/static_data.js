
var express = require('express');
var static_router = express.Router();
var mongoose = require('mongoose');
var fs = require('fs');


// Models

var static_data = require('../models/static_data');



static_router.get('/:long/:lat/:dist/data', function(req, res){		
	static_data.find({Dimos:req.params.city}, function(err, issue){
		res.send(issue);
  });
}); 

static_router.get('/:long/:lat/:dist/garbage', function(req, res){		
	console.log("garbage");
	static_data.find({Dimos:req.params.city,type:"garbage"},function(err, issue){
		res.send(issue);
  });
}); 

static_router.get('/:long/:lat/:dist/fotistiko', function(req, res){		
	static_data.find({Dimos:req.params.city,type:"fotistiko"}, function(err, issue){
		res.send(issue);
  });
}); 



// Return router
module.exports = static_router;
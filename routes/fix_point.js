
var express = require('express');
var static_router = express.Router();
var mongoose = require('mongoose');
var fs = require('fs');


// Models

var static_data = require('../models/fix_point');



static_router.get('/:long/:lat/:dist/data', function(req, res){		
	static_data.find(loc:{$nearSphere:{$geometry:{type:"Point",coordinates:[parseFloat(req.params._long)+','+parseFloat(req.params._lat)]},$maxDistance:req.params._dist}}
			},function(err, issue){
		res.send(issue);
  });
}); 

static_router.get('/:_long/:_lat/:_dist/garbage', function(req, res){		
	console.log("garbage");
	static_data.find({loc:{$nearSphere:{$geometry:{type:"Point",coordinates:[parseFloat(req.params._long),parseFloat(req.params._lat)]},$maxDistance:req.params._dist}}
			},function(err, issue){
		res.send(issue);
  });
}); 

static_router.get('/:long/:lat/:dist/fotistiko', function(req, res){		
	static_data.find(loc:{$nearSphere:{$geometry:{type:"Point",coordinates:[parseFloat(req.params._long),parseFloat(req.params._lat)]},$maxDistance:req.params._dist}}
			},function(err, issue){
		res.send(issue);
  });
}); 



// Return router
module.exports = static_router;
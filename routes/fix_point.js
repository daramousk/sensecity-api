
var express = require('express');
var static_router = express.Router();
var mongoose = require('mongoose');
var fs = require('fs');


// Models

var static_data = require('../models/fix_point');
console.log("fix point");

/*
static_router.get('/:_long/:_lat/:_dist/data', function(req, res){		
	static_data.createIndex({"loc.coordinates":1, "notes.ANAKIKLOSI":1});
	
	static_data.find({ loc:{$nearSphere:{$geometry:{type:"Point",coordinates:[parseFloat(req.params._long),parseFloat(req.params._lat)]},$maxDistance:parseFloat(req.params._dist)}}
			}, { "loc.coordinates": 1, type: 1, "notes.ANAKIKLOSI": 1, _id: 0 } ,function(err, issue){
		res.send(issue);
  });
}); */

static_router.get('/:_long/:_lat/:_dist/data', function (req, res) {		
    console.log(req.params);
	static_data.find({ loc:{$nearSphere:{$geometry:{type:"Point",coordinates:[parseFloat(req.params._long),parseFloat(req.params._lat)]},$maxDistance:parseFloat(req.params._dist)}}
			}, { "loc.coordinates": 1, type: 1, "notes.ANAKIKLOSI": 1, _id: 0 } ,function(err, issue){
		res.send(issue);
	});

}); 


static_router.get('/:_long/:_lat/:_dist/garbage', function(req, res){			
	static_data.find({type:"garbage", loc:{$nearSphere:{$geometry:{type:"Point",coordinates:[parseFloat(req.params._long),parseFloat(req.params._lat)]},$maxDistance:parseFloat(req.params._dist)}}
			}, { "loc.coordinates": 1, type: 1, "notes.ANAKIKLOSI": 1, _id: 0 } ,function(err, issue){
		res.send(issue);
  });
}); 

static_router.get('/:_long/:_lat/:_dist/fotistiko', function(req, res){		
	static_data.find({type:"fotistiko", loc:{$nearSphere:{$geometry:{type:"Point",coordinates:[parseFloat(req.params._long),parseFloat(req.params._lat)]},$maxDistance:parseFloat(req.params._dist)}}
			}, { "loc.coordinates": 1, type: 1, "notes.ANAKIKLOSI": 1, _id: 0 } ,function(err, issue){
		res.send(issue);
  });
}); 



// Return router
module.exports = static_router;
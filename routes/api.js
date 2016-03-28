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

  if (!req.query.hasOwnProperty('startdate') || !req.query.hasOwnProperty('enddate') || !req.query.hasOwnProperty('coordinates') || !req.query.hasOwnProperty('distance') || !req.query.hasOwnProperty('issue')) {
    res.statusCode = 400;
    return res.send({"message" : "Error 400: Incorrect syntax"});
  }
  /*
  fs.readdirSync('./models').forEach(function(filename){
    if(~filename.indexOf('.js')) require('../models/' + filename)
  });*/

  var startdate = new Date(req.query.startdate);
  var enddate = new Date(req.query.enddate);
   
   console.log(startdate);
   console.log(enddate);

   
   
  Issue.find({"loc":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
                     "create_at":{$gte:startdate,$lte:enddate},
                     "issue":req.query.issue
                    }, function(err, issue){
    res.send(issue);
  });
  /*
  collection('issues', function(err,collection) {
    collection.ensureIndex({position:"2dsphere"});
    collection.find({"position":{$nearSphere:{$geometry:{type:"Point",coordinates:JSON.parse(req.query.coordinates)},$maxDistance:JSON.parse(req.query.distance)}},
                     "created_at":{$gte:startdate,$lte:enddate},
                     "issue":req.query.issue
                    }).toArray(function(err, item) {
                                                    console.log(item);
                                                    return res.send(item);
                                                   });
  });
  */
  
}); 

router.get('/last_3_days', function(req, res){
	
	var returnDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
	
	return res.send(returnDate);
		

	
	/*Issue.find({create_at:{$gt:ISODate("2016-03-22T13:18:38.658Z")}}, function(err, issue){
		res.send(issue);
	});*/
	
	
	
	
});

// Return router
module.exports = router;
  

// Dependencies
var express = require('express');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var crypto = require('crypto-js');
var request = require('request');

// Mongo Db
//mongoose.connect('mongodb://localhost/sensecity');

// Express
var app = express();
app.use(bodyParser.urlencoded({limit: '50mb'},{extended: true}));
app.use(bodyParser.json({limit: '50mb'}));

var config = require('app-config');

//headers
app.use(function (req, res, next) {

    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
	res.header('Access-Control-Allow-Headers', 'Content-Type,Content-Length,x-uuid,Cookie,Set-Cookie,Host,Accept,User-Agent,x-role');
	res.header('Access-Control-Expose-Headers', 'Content-Type,Content-Length,x-uuid,Cookie,Set-Cookie,Host,Accept,User-Agent,x-role');
//    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});

var bugUrl = config.config.bugUrl;


function authorization(req, res, next) {
   Role.find({uuid: req.get('x-uuid')}, function (err, response) {
        if (response.length > 0 && response[0]["timestamp"] >= Date.now()) {
            if (req.path === '/admin/bugs/search') {
                if (req.get('x-role') === 'departmentAdmin' || req.get('x-role') === 'sensecityAdmin' || req.get('x-role') === 'departmentUser' || req.get('x-role') === 'cityAdmin') {
                    next();
                } else {
                    res.send("failure");
                }
            }
        } else {
            res.send("failure");
        }
   });

}



var Role = require('./models/roles.js');
  
function authentication(req,res,next) {
	Role.find({uuid: req.get('x-uuid')}, function(err, response) {
		if (response.length > 0 && response[0]["timestamp"] >= Date.now()) {
			next();
		} else { 
			 res.send("failure");  
		}
	});
}



mongoose.connection.once('open', function () {
	app.post('/dashboard', function (req, res) { 
	Role.find({username: req.body.username, password: req.body.password}, function (err, response) { 
		if (response.length > 0) { 
			var wordArray = crypto.enc.Utf8.parse(req.body.username, req.body.password); 
			var uuid = crypto.enc.Base64.stringify(wordArray); app.use('/mobilemap', require('./routes/api'));
			Role.update({username: req.body.username, password: req.body.password}, {$set: {"uuid": uuid, "timestamp": Date.now() * 1000 * 3600}}, {multi: true}, function (err, doc) {});
			return res.send(response[0]["city"] + ";" + response[0]["role"] + ";" + response[0]["department"] + ";" + response[0]["email"] + ";" + uuid + ";" + req.body.username); 
			} else {
				return res.send("failure"); 
			}
		});
	});
	app.get('/get', authentication, function (req, res) {
		res.send("success");
	});
	app.get('/logout', authentication, function (req, res) {
		
		console.log("fsdlghfksdlghfdlk");
		console.log(req.get('x-uuid'));

		Role.update({uuid: req.get('x-uuid')},{$unset: {"uuid": 1, "timestamp": 1}}, function(err, response) {
			res.send("logout");
		});
	});

                    app.post('/admin/bugs/search', authorization, function (req, res) {
                        var bugToken = "";
                        var loginData = {"method": "User.login", "params": [{"login": config.config.login, "password": config.config.pwd}],"id": 1 };
                        request({
                            url: bugUrl,
                            method: "POST",
                            json: loginData
                        }, function (error, response, body) {
                            if (!error && response.statusCode === 200) {
                                bugToken = body.result.token;
                                req.body.params[0].token = bugToken;
                                request({
                                    url: config.config.bugUrl,
                                    method: "POST",
                                    headers: {'content-type': 'application/json'},
                                    json: req.body
                                }, function (error, response, body) {
                                    if (!error && response.statusCode === 200) {
                                        console.log(req.body);
                                        if (response.body.result !== null)
                                        {
                                            console.log("problem reported " + response.body.result.bugs.length);
                                            res.send(response.body.result.bugs);
                                        } else
                                        {
                                            console.log(response.body.error);
                                            res.send([response.body.error]);
                                        }
                                    } else {
                                        console.log("error: " + error);
                                    }
                                });
                            } else {
                                console.log("error: " + error);
                               // console.log("response.statusCode: " + response.statusCode);
                               // console.log("response.statusText: " + response.statusText);
                            }
                        });
                    });

});




// Routes 
app.use('/api/1.0', require('./routes/api'));
 
app.use('/fixed-point',require('./routes/lighting')); 

app.use('/api/1.0/issue',require('./routes/image_return')); 
app.use('/fix_point', require('./routes/fix_point')); 
app.use('/api/1.0/mobilemap', require('./routes/api')); 

// start server 
app.listen(config.config.port); 
console.log('API is running on port '+config.config.port); 

/*app.listen(config.config.port); console.log('API is running on port '+config.config.port);*/

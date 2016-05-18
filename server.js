// Dependencies
var express = require('express');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');

// Mongo Db
//mongoose.connect('mongodb://localhost/sensecity');

// Express
var app = express();

app.use(bodyParser.json({limit: '10mb'}));

app.use(bodyParser.urlencoded({     
        extended: true,
        keepExtensions: true,
        limit: '10mb', 
        defer: true
    }));



//headers
app.use(function (req, res, next) {
 
    // Website you wish to allow to connect
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Request methods you wish to allow
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');

    // Request headers you wish to allow
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    // Set to true if you need the website to include cookies in the requests sent
    // to the API (e.g. in case you use sessions)
    res.setHeader('Access-Control-Allow-Credentials', true);

    // Pass to next layer of middleware
    next();
});

// Routes
app.use('/api', express.bodyParser({keepExtensions: true, limit: 53000000000, defer: true }, require('./routes/api'));

app.use('/fixed-point',require('./routes/lighting'));

app.use('/api/issue',require('./routes/image_return'));

app.use('/fix_point', require('./routes/fix_point'));

// start server
app.listen(3000);
console.log('API is running on port 3000');
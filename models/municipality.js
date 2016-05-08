// Dependencies
var restful = require('node-restful');
var mongoose = restful.mongoose;

// Schema
var municipalitySchema = new mongoose.Schema({
	municipality: String,
	boundaries: {coordinates:Number}
});


// Return model
module.exports = restful.model('municipality', municipalitySchema);

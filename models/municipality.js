// Dependencies
var restful = require('node-restful');
var mongoose = restful.mongoose;

// Schema
var municipalitySchema = new mongoose.Schema({
	municipality: String,
	municipality_desc: String,
    boundaries: { coordinates: Number },
    sms_key_fibair: { type: String, default: "" }
});


// Return model
module.exports = restful.model('municipality', municipalitySchema);

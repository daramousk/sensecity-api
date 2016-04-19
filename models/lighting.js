// Dependencies
var restful = require('node-restful');
var mongoose = restful.mongoose;

// Schema
var lightingSchema = new mongoose.Schema({
	loc :  { type: {type:String}, coordinates: [Number]},
	title: String,
	description: String
});

lightingSchema.index({loc: "2dsphere"});

// Return model
module.exports = restful.model('Lighting', lightingSchema);


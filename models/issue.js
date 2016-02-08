// Dependencies
var restful = require('node-restful');
var mongoose = restful.mongoose;

// Schema
var issueSchema = new mongoose.Schema({
	loc :  { type: {type:String}, coordinates: [Number]},
	issue: String,
	create_at: {type: Date, default: Date.now},
  device_id: String 
});

issueSchema.index({loc: "2dsphere"});

// Return model
module.exports = restful.model('Issues', issueSchema);


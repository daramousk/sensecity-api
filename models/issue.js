// Dependencies
var restful = require('node-restful');
var mongoose = restful.mongoose;

// Schema
var issueSchema = new mongoose.Schema({
	loc :  { type: {type:String}, coordinates: [Number]},
	issue: String,
	create_at: {type: Date, default: Date.now},
	device_id: String,
	value_desc: String,
	comments: {type:String, default : ""},
    /*image_name: String,*/
	municipality: String,
    user: { uuid: { type: String, default: "" }, name: { type: String, default: "" }, email: { type: String, default: "" }, phone: { type: String, default: "" } },
    city_address: { type: String, default: "" }
});

issueSchema.index({loc: "2dsphere"});

// Return model
module.exports = restful.model('Issues', issueSchema);

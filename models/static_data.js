// Dependencies
var restful = require('node-restful');
var mongoose = restful.mongoose;

// Schema
var static_dataSchema = new mongoose.Schema({
	Dimos:String,
	type:String,
	sub_type:String,
	dimos_item_id:String,
	loc:{ type: {type:String}, coordinates: [Number]},
	notes: [Object],
	create_at: {type: Date, default: Date.now}
});

static_dataSchema.index({loc: "2dsphere"});

// Return model
module.exports = restful.model('Static_data', static_dataSchema);


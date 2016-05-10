// Dependencies
var restful = require('node-restful');
var mongoose = restful.mongoose;
var Schema=mongoose.Schema;

// Schema
var static_dataSchema = new Schema({
	Dimos:String,
	type:String,
	sub_type:String,
	dimos_item_id:String,
	loc:{ type: {type:String}, coordinates: [Number]},
	notes: [],
	create_at: {type: Date, default: Date.now}
});

static_dataSchema.index({loc: "2dsphere"});

// Return model
module.exports = restful.model('fix_point', static_dataSchema);


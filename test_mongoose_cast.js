const mongoose = require('mongoose');
const schema = new mongoose.Schema({ year: { type: Number, min: 1, max: 6 } });
const Model = mongoose.model('Test', schema);
const doc = new Model({ year: "" });
const err = doc.validateSync();
console.log(err ? err.message : "Success");

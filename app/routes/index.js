const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const dayjs = require('dayjs');
const { ObjectId } = require('mongoose').Types;

// เชื่อมต่อกับ MongoDB
mongoose.connect('mongodb+srv://admin:1234@goldcluster.nf1xhez.mongodb.net/GoldRfid', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB database');
});

// สร้างโครงสร้างข้อมูล
const goldSchema = new mongoose.Schema({
  goldtype: String,
  size: String,
  weight: String,
  gold_id: ObjectId
},{ collection: 'Goldcount' });

const Gold = mongoose.model('Gold', goldSchema);

/* GET home page. */
router.get('/', async (req, res, next) => {
  try {
    let condition = {};
    if (req.query.search) {
      condition = { topic: { $regex: new RegExp(req.query.search, 'i') } };
    }

    const golds = await Gold.find(condition);
    res.render('index', { golds: golds, dayjs: dayjs });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;

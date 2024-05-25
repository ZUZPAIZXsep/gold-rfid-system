// Import required modules
const express = require('express');
const mongoose = require('mongoose');
const dayjs = require('dayjs');
const localizedFormat = require('dayjs/plugin/localizedFormat');
dayjs.extend(localizedFormat);
const { ObjectId } = require('mongoose').Types;
const rfidModule = require('./rfid_module/rfidReader'); // Assuming the module is in this path
const path = require('path');

// Initialize the Express app
const app = express();
const router = express.Router();

// Connect to MongoDB
mongoose.connect('mongodb+srv://admin:1234@goldcluster.nf1xhez.mongodb.net/GoldRfid', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB database');
});

// Define gold_tag schema and model
const goldTagSchema = new mongoose.Schema({
  gold_id: ObjectId,
  gold_type: String,
  gold_size: String,
  gold_weight: String,
  has_data: Boolean,
  gold_tray: String
}, { 
  collection: 'gold_data_tag' 
});

const GoldTag = mongoose.model('GoldTag', goldTagSchema);

// Define goldcount_history schema and model
const goldCountHistorySchema = new mongoose.Schema({
  gold_id: ObjectId,
  gold_type: String,
  gold_size: String,
  gold_weight: String,
  gold_tray: String,
  gold_timestamp: { type: Date, default: Date.now }
}, { 
  collection: 'goldcount_history'
});

const Goldhistory = mongoose.model('Goldhistory', goldCountHistorySchema);

// Define goldtags_count schema and model
const goldTagsCountSchema = new mongoose.Schema({
  gold_id: ObjectId,
  gold_type: String,
  gold_size: String,
  gold_weight: String,
  gold_tray: String,
  gold_timestamp: { type: Date, default: Date.now }
}, { 
  collection: 'goldtags_count'
});

const Goldtagscount = mongoose.model('Goldtagscount', goldTagsCountSchema);

// Function to assign tray based on gold type
function assignTray(gold_type) {
  switch(gold_type) {
    case 'สร้อยคอ':
      return 'ถาดที่ 1';
    case 'แหวน':
      return 'ถาดที่ 2';
    case 'กำไลข้อมือ':
      return 'ถาดที่ 3';
    case 'สร้อยข้อมือ':
      return 'ถาดที่ 4';
    case 'ต่างหู':
      return 'ถาดที่ 5';
    default:
      return 'ถาดอื่นๆ';
  }
}

// Middleware for static files and EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Define routes
router.get('/', async (req, res, next) => {
  try {
    let condition = {};
    const golds = await Goldtagscount.find(condition);

    // Sort data by tray order
    golds.sort((a, b) => {
      const trayOrder = {
        'ถาดที่ 1': 1,
        'ถาดที่ 2': 2,
        'ถาดที่ 3': 3,
        'ถาดที่ 4': 4,
        'ถาดที่ 5': 5,
        'ถาดอื่นๆ': 6
      };
      return trayOrder[a.gold_tray] - trayOrder[b.gold_tray];
    });

    res.render('index', { golds: golds, dayjs: dayjs, currentUrl: req.originalUrl });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/count_goldtags', async (req, res) => {
  try {
    let countgoldtags = [];
    let rfidTags = rfidModule.getRfidTags(); // ใช้ rfidModule เพื่อดึงข้อมูล rfidTags

    // ดึงข้อมูลจาก database ที่มี gold_id ตรงกับ rfidTags
    countgoldtags = await GoldTag.find({ gold_id: { $in: rfidTags } });

    // เพิ่มการจัดถาดให้กับทองคำแต่ละชนิด
    countgoldtags = countgoldtags.map(tag => {
      return {
        ...tag._doc,
        gold_tray: assignTray(tag.gold_type)
      };
    });

    // เรียงข้อมูลตามลำดับถาด
    countgoldtags.sort((a, b) => {
      const trayOrder = {
        'ถาดที่ 1': 1,
        'ถาดที่ 2': 2,
        'ถาดที่ 3': 3,
        'ถาดที่ 4': 4,
        'ถาดที่ 5': 5,
        'ถาดอื่นๆ': 6
      };
      return trayOrder[a.gold_tray] - trayOrder[b.gold_tray];
    });

    res.render('count_goldtags', {
      countgoldtags: countgoldtags,
      dayjs: dayjs, 
      currentUrl: req.originalUrl
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/save_goldtags', async (req, res) => {
  try {
    let rfidTags = rfidModule.getRfidTags(); // เรียกใช้งาน rfidTags จาก rfidModule
    let countgoldtags = await GoldTag.find({ gold_id: { $in: rfidTags } });

    let newGoldtagscount = countgoldtags.map(count_tag => ({
      gold_id: count_tag.gold_id,
      gold_type: count_tag.gold_type,
      gold_size: count_tag.gold_size,
      gold_weight: count_tag.gold_weight,
      gold_tray: assignTray(count_tag.gold_type),
      gold_timestamp: dayjs().locale('th').format('YYYY-MM-DD HH:mm:ss') // Timestamp ปัจจุบัน (รูปแบบวันที่และเวลาไทย)
    }));

    // ลบข้อมูลเก่าออกก่อน
    await Goldtagscount.deleteMany({});
    // บันทึกข้อมูลใน collection `goldtags_count`
    await Goldtagscount.insertMany(newGoldtagscount);

    // เพิ่มฟังก์ชันในการบันทึกลงใน collection `goldhistory`
    let currentDate = dayjs().locale('th').startOf('day').toDate(); // เริ่มต้นวันปัจจุบัน
    let endOfCurrentDate = dayjs().locale('th').endOf('day').toDate(); // สิ้นสุดวันปัจจุบัน

    // ลบข้อมูลเก่าที่เป็นวันเดียวกันทั้งหมดก่อน
    await Goldhistory.deleteMany({
      gold_timestamp: {
        $gte: currentDate,
        $lte: endOfCurrentDate
      }
    });

    // เพิ่มข้อมูลใหม่
    await Goldhistory.insertMany(newGoldtagscount);

    res.json({ message: 'บันทึกรายการเรียบร้อยแล้ว' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/clear_goldtags_count', async (req, res) => {
  try {
    await Goldtagscount.deleteMany({}); // ลบข้อมูลทั้งหมดใน collection `goldtags_count`
    res.json({ message: 'ลบข้อมูลการนับทั้งหมดเรียบร้อยแล้ว' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/gold_list', async (req, res, next) => {
  try {
    let condition = {};

    // ถ้ามีการเลือกประเภททองคำ
    if (req.query.select_goldType && req.query.select_goldType !== 'เลือกประเภททองคำ') {
      condition.gold_type = req.query.select_goldType;
    }

    // ถ้ามีการเลือกขนาดทองคำ
    if (req.query.select_goldSize && req.query.select_goldSize !== 'เลือกขนาดทองคำ') {
      condition.gold_size = req.query.select_goldSize;
    }

    const goldslist = await Goldtagscount.find(condition);

    // เรียงข้อมูลตามลำดับถาด
    goldslist.sort((a, b) => {
      const trayOrder = {
        'ถาดที่ 1': 1,
        'ถาดที่ 2': 2,
        'ถาดที่ 3': 3,
        'ถาดที่ 4': 4,
        'ถาดที่ 5': 5,
        'ถาดอื่นๆ': 6
      };
      return trayOrder[a.gold_tray] - trayOrder[b.gold_tray];
    });

    res.render('gold_list', { 
      goldslist: goldslist, 
      dayjs: dayjs, 
      select_goldType: req.query.select_goldType, 
      select_goldSize: req.query.select_goldSize, 
      currentUrl: req.originalUrl
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// Use the router
app.use('/', router);

// Set the port
const port = process.env.PORT || 3000;

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

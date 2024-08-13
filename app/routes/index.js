const express = require('express');
const axios = require('axios');
const router = express.Router();
const mongoose = require('mongoose');
const dayjs = require('dayjs');
const localizedFormat = require('dayjs/plugin/localizedFormat');
dayjs.extend(localizedFormat);
const { ObjectId } = require('mongoose').Types;
const rfidModule = require('../rfid_module/rfidReader');
const jwt = require('jsonwebtoken');
const secretCode = 'your_secret_code';

// เชื่อมต่อกับ MongoDB
mongoose.connect('mongodb+srv://admin:1234@goldcluster.nf1xhez.mongodb.net/GoldRfid', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB database');
});

// สร้างโครงสร้างข้อมูล gold_data_tag
const goldTagSchema = new mongoose.Schema({
 
  gold_id: ObjectId,
  gold_type: String,
  gold_size: String,
  gold_weight: String,
  has_data: Boolean,
  gold_tray: String
},{ 
  collection: 'gold_data_tag' 
});

const GoldTag = mongoose.model('GoldTag', goldTagSchema);

// สร้างโครงสร้างข้อมูล goldcount_history
const goldCountHistorySchema = new mongoose.Schema({

  gold_id: ObjectId,
  gold_type: String,
  gold_size: String,
  gold_weight: String,
  gold_tray: String,
  gold_timestamp: { type: Date, default: Date.now },
  gold_status: String,
  gold_outDateTime: Date,
  customer_name: String,
  customer_surname: String,
  customer_phone: String,
  gold_price: String

},{ 
  collection: 'goldcount_history'
});

const Goldhistory = mongoose.model('Goldhistory', goldCountHistorySchema);

// สร้างโครงสร้างข้อมูล goldtags_count
const goldTagsCountSchema = new mongoose.Schema({

  gold_id: ObjectId,
  gold_type: String,
  gold_size: String,
  gold_weight: String,
  gold_tray: String,
  gold_timestamp: { type: Date, default: Date.now },
  gold_status: String,
  gold_outDateTime: Date,
  gold_price: String
  
},{ 
  collection: 'goldtags_count'
});

const Goldtagscount = mongoose.model('Goldtagscount', goldTagsCountSchema);

// สร้างโครงสร้างข้อมูล gold_user
const goldUserSchema = new mongoose.Schema({

  usr_id: ObjectId,
  usr: String,
  pwd: String,
  email: String,
  phone: String,
  name: String,
  role: String
  
},{ 
  collection: 'gold_user'
});

const Golduser = mongoose.model('Golduser', goldUserSchema);

// ฟังก์ชันสำหรับจัดถาด
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

/* GET login page. */
router.get('/', isnotLogin, async (req, res, next) => {
  try {
    res.render('login', { errorMessage: '' });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/login', isnotLogin , async (req, res) => {
  try {
    const { usr, pwd } = req.body;
    
    // Find user in MongoDB
    const foundUser = await Golduser.findOne({ usr: usr, pwd: pwd });
    
    if (foundUser) {
      // Login successful
      const token = jwt.sign({ id: foundUser._id, name: foundUser.name, role: foundUser.role }, secretCode);

      req.session.token = token;
      req.session.name = foundUser.name;
      req.session.role = foundUser.role;

      res.redirect('/home');
    } else {
      res.render('login', { errorMessage: 'Incorrect username or password' });
      /*res.status(401).send('username or password invalid');*/
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

router.get('/login', isnotLogin, (req, res) => {
  res.render('login', { errorMessage: '' });
});

function isLogin(req, res, next) {
  if (req.session.token != undefined) {
    next();
  } else {
    res.redirect('/');
  }
}

function isnotLogin(req, res, next) {
  if (req.session.token != undefined) {
    res.redirect('/home');
  } else {
    next();
  }
}

router.get('/logout', isLogin, (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

/* GET home page. */
router.get('/home', async (req, res, next) => {
  try {
    let condition = { gold_status: 'in stock' };
    const golds = await Goldtagscount.find(condition);

    const dataUrl = 'http://www.thaigold.info/RealTimeDataV2/gtdata_.txt';

        const response = await axios.get(dataUrl);
        const data = response.data;

        // console.log('Data from API:', data);

        const pricePerGram = parseFloat(data[5]?.bid); // ราคาเสนอซื้อของทองคำ 96.5%

        if (isNaN(pricePerGram)) {
            console.error('pricePerGram is not a valid number:', pricePerGram);
            res.status(500).send('Invalid price data from API');
            return;
        }

        // คำนวณราคาทองคำตามน้ำหนักต่างๆ
        //ราคาต้นทุน
        const cost_prices = {
          cost_halfSalung: pricePerGram * 3.81 / 15.244 / 2,
          cost_oneSalung: pricePerGram * 3.81 / 15.244,
          cost_twoSalung: pricePerGram * 3.81 * 2 / 15.244,
          cost_oneBaht: pricePerGram,
          cost_twoBaht: pricePerGram * 2,
          cost_threeBaht: pricePerGram * 3
        };

        //ราคาขายออก
        const prices = {
          halfSalung: (pricePerGram * 3.81 / 15.244 / 2) + 400,
          oneSalung: (pricePerGram * 3.81 / 15.244) + 400,
          twoSalung: (pricePerGram * 3.81 * 2 / 15.244) + 400,
          oneBaht: (pricePerGram) + 400,
          twoBaht: (pricePerGram * 2) + (400*2),
          threeBaht: (pricePerGram * 3) + (400*3)
        };

        const updateTime = data[0]?.ask; // เวลาที่แสดงในดัชนีที่ [0] และคีย์ 'ask'

    // เรียงข้อมูลตามลำดับถาด
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

    res.render('index', { 
      golds: golds, 
      dayjs: dayjs, 
      currentUrl: req.originalUrl, 
      cost_prices, 
      prices,
      updateTime});
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/count_page', async (req, res) => {
  try {
    res.render('count_page');
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/count_tosellpage', async (req, res) => {
  try {
    let countgoldtags = [];
    let rfidTags = rfidModule.getRfidTags(); // เรียกใช้งาน rfidTags จาก rfidModule
    
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

    res.render('count_tosellpage', {
      countgoldtags: countgoldtags,
      dayjs: dayjs, 
      currentUrl: req.originalUrl
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/ready_to_sell', async (req, res) => {
  try {
    let rfidTags = rfidModule.getRfidTags(); // เรียกใช้งาน rfidTags จาก rfidModule
    let countgoldtags = await GoldTag.find({ gold_id: { $in: rfidTags } });

    // สร้าง object ที่จะบันทึกลงใน collection `goldtags_count`
    let newGoldtagscount = countgoldtags.map(count_tag => ({
      gold_id: count_tag.gold_id,
      gold_type: count_tag.gold_type,
      gold_size: count_tag.gold_size,
      gold_weight: count_tag.gold_weight,
      gold_tray: assignTray(count_tag.gold_type),
      gold_timestamp: dayjs().locale('th').format('YYYY-MM-DD HH:mm:ss'), // Timestamp ปัจจุบัน (รูปแบบวันที่และเวลาไทย)
      gold_status: 'ready to sell' // เปลี่ยนสถานะเป็น ready to sell
    }));

    // อัปเดตข้อมูล สถานะใน collection `Goldtagscount` สำหรับตัวที่อ่านได้
    await Goldtagscount.updateMany(
      {
        gold_id: { $in: rfidTags }, // เฉพาะรายการที่อ่านได้จาก rfidTags
        gold_status: 'in stock' // เปลี่ยนจากสถานะ 'in stock' เท่านั้น
      },
      {
        $set: { 
          gold_status: 'ready to sell',
          gold_timestamp: dayjs().locale('th').format('YYYY-MM-DD HH:mm:ss') // เปลี่ยนเวลาตามสถานะใหม่
        } 
      }
    );

    // อัปเดตข้อมูล สถานะใน collection `Goldhistory` สำหรับตัวที่อ่านได้ในวันเดียวกัน
    let currentDate = dayjs().locale('th').startOf('day').toDate(); // เริ่มต้นวันปัจจุบัน
    let endOfCurrentDate = dayjs().locale('th').endOf('day').toDate(); // สิ้นสุดวันปัจจุบัน

    await Goldhistory.updateMany(
      {
        gold_timestamp: {
          $gte: currentDate,
          $lte: endOfCurrentDate
        },
        gold_id: { $in: rfidTags }, // เฉพาะรายการที่อ่านได้จาก rfidTags
        gold_status: 'in stock' // เปลี่ยนจากสถานะ 'in stock' เท่านั้น
      },
      {
        $set: { 
          gold_status: 'ready to sell', // เปลี่ยนสถานะเป็น 'ready to sell'
        }
      }
    );

    res.json({ message: 'บันทึกข้อมูลเรียบร้อยแล้ว' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


router.get('/count_goldtags', async (req, res) => {
  try {
    let countgoldtags = [];
    let rfidTags = rfidModule.getRfidTags(); // เรียกใช้งาน rfidTags จาก rfidModule
    
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

// router.post('/save_goldtags', async (req, res) => {
//   try {
//       let rfidTags = rfidModule.getRfidTags(); // Get RFID tags
//       let countgoldtags = await GoldTag.find({ gold_id: { $in: rfidTags } });

//       // Create objects to be inserted into `goldtags_count`
//       let newGoldtagscount = countgoldtags.map(count_tag => ({
//           gold_id: count_tag.gold_id,
//           gold_type: count_tag.gold_type,
//           gold_size: count_tag.gold_size,
//           gold_weight: count_tag.gold_weight,
//           gold_tray: assignTray(count_tag.gold_type),
//           gold_timestamp: dayjs().locale('th').format('YYYY-MM-DD HH:mm:ss'), // Current timestamp (Thai date and time format)
//           gold_status: 'in stock' // Change status to 'in stock'
//       }));

//       // Delete old records first
//       await Goldtagscount.deleteMany({});
//       // Insert new records into `goldtags_count`
//       await Goldtagscount.insertMany(newGoldtagscount);

//       let currentDate = dayjs().locale('th').startOf('day').toDate(); // Start of the current day
//       let endOfCurrentDate = dayjs().locale('th').endOf('day').toDate(); // End of the current day

//       // Update the status in `Goldhistory` for records read on the same day
//       await Goldhistory.updateMany(
//         {
//           gold_timestamp: {
//             $gte: currentDate,
//             $lte: endOfCurrentDate
//           },
//           gold_id: { $in: rfidTags } // Only update records matching the RFID tags
//         },
//         {
//           $set: { gold_status: 'in stock' } // Change status to 'in stock'
//         }
//       );

//       res.json({ message: 'Records updated successfully' });
//   } catch (error) {
//       console.error(error);
//       res.status(500).json({ error: 'Internal Server Error' });
//   }
// });

router.post('/save_goldtags', async (req, res) => {
  try {
    let rfidTags = rfidModule.getRfidTags(); // Get RFID tags
    let countgoldtags = await GoldTag.find({ gold_id: { $in: rfidTags } });
    let currentDate = dayjs().locale('th').startOf('day').toDate(); // Start of the current day
    let endOfCurrentDate = dayjs().locale('th').endOf('day').toDate(); // End of the current day
    let newTimestamp = dayjs().locale('th').format('YYYY-MM-DD HH:mm:ss'); // Current timestamp (Thai date and time format)

    // Create or update records in `Goldtagscount`
    for (let tag of countgoldtags) {
      await Goldtagscount.updateOne(
        { gold_id: tag.gold_id },
        {
          $set: {
            gold_id: tag.gold_id,
            gold_type: tag.gold_type,
            gold_size: tag.gold_size,
            gold_weight: tag.gold_weight,
            gold_tray: assignTray(tag.gold_type),
            gold_status: 'in stock',
            gold_timestamp: newTimestamp // Update the timestamp
          }
        },
        { upsert: true } // Create new if it doesn't exist
      );
    }

    // Update status from `ready to sell` to `in stock` in `Goldtagscount`
    await Goldtagscount.updateMany(
      {
        gold_id: { $in: rfidTags },
        gold_status: 'ready to sell'
      },
      {
        $set: { 
          gold_status: 'in stock',
          gold_timestamp: newTimestamp // Update timestamp to current time
        }
      }
    );

    // Update status from `out of stock` to `in stock` if the timestamp is not the current day
    await Goldtagscount.updateMany(
      {
        gold_id: { $in: rfidTags },
        gold_status: 'out of stock',
        gold_timestamp: { $lt: currentDate } // If timestamp is before the current day
      },
      {
        $set: {
          gold_status: 'in stock',
          gold_timestamp: newTimestamp // Update timestamp to current time
        }
      }
    );

    // Update `Goldhistory` for records read on the current day
    await Goldhistory.updateMany(
      {
        gold_timestamp: {
          $gte: currentDate,
          $lte: endOfCurrentDate
        },
        gold_id: { $in: rfidTags },
        gold_status: 'ready to sell'
      },
      {
        $set: {
          gold_status: 'in stock',
          gold_timestamp: newTimestamp // Update timestamp to current time
        }
      }
    );

    res.json({ message: 'Records updated successfully' });
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
        let condition = { gold_status: 'in stock' }; // เพิ่มเงื่อนไขการกรองโดย gold_status
  
        // ถ้ามีการเลือกประเภททองคำ
        if (req.query.select_goldType && req.query.select_goldType !== 'เลือกประเภททองคำ') {
            condition.gold_type = req.query.select_goldType;
        }
  
        // ถ้ามีการเลือกขนาดทองคำ
        if (req.query.select_goldSize && req.query.select_goldSize !== 'เลือกขนาดทองคำ') {
            condition.gold_size = req.query.select_goldSize;
        }
  
        // ถ้ามีการกรอกเลข Gold ID
        if (req.query.gold_id) {
          condition.gold_id = req.query.gold_id;
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

        const dataUrl = 'http://www.thaigold.info/RealTimeDataV2/gtdata_.txt';

        const response = await axios.get(dataUrl);
        const data = response.data;

        // console.log('Data from API:', data);

        const pricePerGram = parseFloat(data[5]?.bid); // ราคาเสนอซื้อของทองคำ 96.5%

        if (isNaN(pricePerGram)) {
            console.error('pricePerGram is not a valid number:', pricePerGram);
            res.status(500).send('Invalid price data from API');
            return;
        }

        // คำนวณราคาทองคำตามน้ำหนักต่างๆ
        //ราคาขายออก
        const prices = {
          halfSalung: (pricePerGram * 3.81 / 15.244 / 2) + 400,
          oneSalung: (pricePerGram * 3.81 / 15.244) + 400,
          twoSalung: (pricePerGram * 3.81 * 2 / 15.244) + 400,
          oneBaht: (pricePerGram) + 400,
          twoBaht: (pricePerGram * 2) + (400*2),
          threeBaht: (pricePerGram * 3) + (400*3)
        };

        const updateTime = data[0]?.ask; // เวลาที่แสดงในดัชนีที่ [0] และคีย์ 'ask'
        
        res.render('gold_list', { 
          goldslist: goldslist, 
          dayjs: dayjs, 
          select_goldType: req.query.select_goldType, 
          select_goldSize: req.query.select_goldSize,
          _id: req.query._id,
          gold_id: req.query.gold_id, 
          currentUrl: req.originalUrl,
          prices,
          updateTime
         });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
  });

  router.get('/goldsell_list', async (req, res, next) => {
    try {
        let condition = { gold_status: 'ready to sell' }; // เพิ่มเงื่อนไขการกรองโดย gold_status
  
        // ถ้ามีการเลือกประเภททองคำ
        if (req.query.select_goldType && req.query.select_goldType !== 'เลือกประเภททองคำ') {
            condition.gold_type = req.query.select_goldType;
        }
  
        // ถ้ามีการเลือกขนาดทองคำ
        if (req.query.select_goldSize && req.query.select_goldSize !== 'เลือกขนาดทองคำ') {
            condition.gold_size = req.query.select_goldSize;
        }
  
        // ถ้ามีการกรอกเลข Gold ID
        if (req.query.gold_id) {
          condition.gold_id = req.query.gold_id;
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

        const dataUrl = 'http://www.thaigold.info/RealTimeDataV2/gtdata_.txt';

        const response = await axios.get(dataUrl);
        const data = response.data;

        // console.log('Data from API:', data);

        const pricePerGram = parseFloat(data[5]?.bid); // ราคาเสนอซื้อของทองคำ 96.5%

        if (isNaN(pricePerGram)) {
            console.error('pricePerGram is not a valid number:', pricePerGram);
            res.status(500).send('Invalid price data from API');
            return;
        }

        // คำนวณราคาทองคำตามน้ำหนักต่างๆ
        //ราคาขายออก
        const prices = {
          halfSalung: (pricePerGram * 3.81 / 15.244 / 2) + 400,
          oneSalung: (pricePerGram * 3.81 / 15.244) + 400,
          twoSalung: (pricePerGram * 3.81 * 2 / 15.244) + 400,
          oneBaht: (pricePerGram) + 400,
          twoBaht: (pricePerGram * 2) + (400*2),
          threeBaht: (pricePerGram * 3) + (400*3)
        };

        const updateTime = data[0]?.ask; // เวลาที่แสดงในดัชนีที่ [0] และคีย์ 'ask'
        
        res.render('goldsell_list', { 
          goldslist: goldslist, 
          dayjs: dayjs, 
          select_goldType: req.query.select_goldType, 
          select_goldSize: req.query.select_goldSize,
          _id: req.query._id,
          gold_id: req.query.gold_id, 
          currentUrl: req.originalUrl,
          prices,
          updateTime
         });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
  });
  
//   router.post('/update_goldstatus', async (req, res) => {
//     try {
//         const { gold_id, gold_price, customer_name, customer_surname, customer_phone } = req.body;
//         const currentTimestamp = dayjs().locale('th').format('YYYY-MM-DD HH:mm:ss');

//         // Update gold_status and gold_outDateTime in Goldtagscount collection
//         const result = await Goldtagscount.updateOne(
//           { gold_id: gold_id },
//           {
//               $set: {
//                   gold_status: 'out of stock',
//                   gold_price: gold_price,
//                   gold_outDateTime: currentTimestamp
//               },
//           }
//       );

//         // Find the most recent Goldhistory document for the given gold_id
//         let existingGold = await Goldhistory.findOne({ gold_id: gold_id }).sort({ gold_timestamp: -1 });

//         if (existingGold) {
//             // Update existing document
//             existingGold.customer_name = customer_name;
//             existingGold.customer_surname = customer_surname;
//             existingGold.customer_phone = customer_phone;
//             existingGold.gold_status = 'out of stock';
//             existingGold.gold_price = gold_price;
//             existingGold.gold_outDateTime = currentTimestamp;
//             await existingGold.save();
//         } else {
//             // Create new document in Goldhistory
//             await Goldhistory.create({
//                 gold_id: gold_id,
//                 gold_status: 'out of stock',
//                 gold_outDateTime: currentTimestamp,
//                 customer_name: customer_name,
//                 customer_surname: customer_surname,
//                 customer_phone: customer_phone,
//                 gold_price: gold_price,
//                 gold_timestamp: currentTimestamp,
//             });
//         }
//         console.log(existingGold);
//         res.redirect('/gold_list'); // Redirect to the gold list page after updating

//     } catch (error) {
//         console.error(error);
//         res.status(500).send('Internal Server Error');
//     }
// });


  // //mockup id for test
  // router.get('/add_golddata', async (req,res) => {
  //   try{
  //     let addgoldsdata = [];
  //     // สร้างข้อมูลเลข tag 001 - 010
  //     for (let i = 1; i <= 10; i++) {
  //         let paddedNumber = i.toString().padStart(3, '0');
  //         addgoldsdata.push({ gold_id: paddedNumber });
  //     }
  //       res.render('add_golddata', {
  //         addgoldsdata: addgoldsdata,
  //         dayjs: dayjs
  //     });
  //   } catch (error) {
  //       console.error(error);
  //       res.status(500).send('Internal Server Error');
  //   }
  // });

  router.get('/add_golddata', async (req, res) => {
    try {
      let addgoldsdata = [];
      let rfidTags = rfidModule.getRfidTags(); // เรียกใช้งาน rfidTags จาก rfidReader.js
      for (let i = 0; i < rfidTags.length; i++) {
        // ตรวจสอบว่า gold_id นี้มีข้อมูลในระบบหรือไม่
        const existingGold = await GoldTag.findOne({ gold_id: rfidTags[i] });
        let hasData = false;
        if (existingGold) {
          hasData = true; // หากมีข้อมูลในระบบแล้วก็กำหนดให้ hasData เป็น true
        }
        addgoldsdata.push({ gold_id: rfidTags[i], has_data: hasData });
      }
      res.render('add_golddata', {
        addgoldsdata: addgoldsdata,
        dayjs: dayjs, 
        currentUrl: req.originalUrl
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  router.get('/add_dataform', async (req, res) => {
    try {
        // ดึงค่า Gold_Tag_id จาก query string
        const goldId = req.query.gold_id;

        res.render('add_dataform', { goldId: goldId });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
  });

  router.post('/add_dataform', async (req, res) => {
    try {
        // ดึงค่า Gold_Tag_id จาก body ของการส่งข้อมูลแบบ POST
        const goldId = req.body.gold_id;
        // ดำเนินการบันทึกข้อมูลทองคำโดยใช้ goldId ที่ได้มา
        const { gold_id, gold_type, gold_size, gold_weight } = req.body;

          // // สร้าง timestamp ปัจจุบัน
          // const timestamp = Date.now();

          // // แปลง timestamp เป็นวันที่และเวลาในรูปแบบที่ต้องการ (วัน เดือน ปี เวลา ไทย)
          // const gold_timestamp = dayjs(timestamp).locale('th').format('DD MMMM YYYY HH:mm:ss');

          // สร้างข้อมูลที่จะบันทึกลงในฐานข้อมูล
          const newGoldData = new GoldTag({
              gold_id,
              gold_type,
              gold_size,
              gold_weight
              // ,gold_timestamp // เพิ่ม timestamp ไปยังข้อมูล
          });
          
          // บันทึกข้อมูลลงในฐานข้อมูล
          await newGoldData.save();

          res.redirect('/add_golddata?success=true');
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
  });

  router.get('/clear_rfid_tags', (req, res) => {
    try {
        rfidModule.resetRfidTags(); // เรียกใช้งานฟังก์ชัน resetRfidTags() เพื่อล้างค่า rfidTags
        res.json({ message: 'RFID Tags cleared successfully' }); // ส่งข้อความกลับไปยัง client เพื่อแสดงว่าล้างค่าสำเร็จ
        console.log('RFID Tags cleared successfully');
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  router.get('/edit_goldTagData', async (req, res) => {
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

      // ถ้ามีการกรอกเลข Gold ID
      if (req.query.gold_id) {
        condition.gold_id = req.query.gold_id;
      }

      const goldsedit = await GoldTag.find(condition);

      const dataUrl = 'http://www.thaigold.info/RealTimeDataV2/gtdata_.txt';

        const response = await axios.get(dataUrl);
        const data = response.data;

        // console.log('Data from API:', data);

        const pricePerGram = parseFloat(data[5]?.bid); // ราคาเสนอซื้อของทองคำ 96.5%

        if (isNaN(pricePerGram)) {
            console.error('pricePerGram is not a valid number:', pricePerGram);
            res.status(500).send('Invalid price data from API');
            return;
        }

        // คำนวณราคาทองคำตามน้ำหนักต่างๆ
        //ราคาขายออก
        const prices = {
          halfSalung: (pricePerGram * 3.81 / 15.244 / 2) + 400,
          oneSalung: (pricePerGram * 3.81 / 15.244) + 400,
          twoSalung: (pricePerGram * 3.81 * 2 / 15.244) + 400,
          oneBaht: (pricePerGram) + 400,
          twoBaht: (pricePerGram * 2) + (400*2),
          threeBaht: (pricePerGram * 3) + (400*3)
        };

        const updateTime = data[0]?.ask; // เวลาที่แสดงในดัชนีที่ [0] และคีย์ 'ask'
      res.render('edit_goldTagData', {
        goldsedit: goldsedit,
        dayjs: dayjs,
        select_goldType: req.query.select_goldType,
        select_goldSize: req.query.select_goldSize, 
        gold_id: req.query.gold_id,
        currentUrl: req.originalUrl,
        prices,
        updateTime
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  });

  // GET route เพื่อดึงข้อมูลทองคำที่ต้องการแก้ไข
  router.get('/edit_dataform', async (req, res) => {
      try {
          const goldId = req.query.gold_id; // รับ Gold_Tag_id ที่ต้องการแก้ไขจาก query parameter
          const goldData = await GoldTag.findOne({ gold_id: goldId }); // ค้นหาข้อมูลทองคำที่ต้องการแก้ไขในฐานข้อมูล

          if (!goldData) {
              return res.status(404).send('Gold data not found'); // หากไม่พบข้อมูลทองคำที่ต้องการแก้ไข
          }

          // ส่งข้อมูลทองคำไปยังหน้าแก้ไขข้อมูล
          res.render('edit_dataform', { goldId: goldData.gold_id, goldType: goldData.gold_type, goldSize: goldData.gold_size, goldWeight: goldData.gold_weight, select_goldType: goldData.gold_type, select_goldSize: goldData.gold_size });
          
      } catch (error) {
          console.error(error);
          res.status(500).send('Internal Server Error');
      }
  });

  // POST route เพื่ออัปเดตข้อมูลทองคำ
  router.post('/update_data', async (req, res) => {
      try {
          const { gold_id, gold_type, gold_size, gold_weight } = req.body; // รับข้อมูลที่แก้ไขจากฟอร์ม

          // ค้นหาและอัปเดตข้อมูลทองคำในฐานข้อมูล
          await GoldTag.findOneAndUpdate({ gold_id: gold_id }, { gold_type: gold_type, gold_size: gold_size, gold_weight: gold_weight });

          res.redirect('/edit_goldTagData?success=true'); // ส่งกลับไปยังหน้าหลักหลังจากทำการอัปเดตข้อมูลเสร็จสิ้น
      } catch (error) {
          console.error(error);
          res.status(500).send('Internal Server Error');
      }
  });

  //GET route เพื่อลบข้อมูลทองคำ
  router.get('/delete_goldTagData/:gold_id', async (req, res) => {
    try {
        const goldId = req.params.gold_id; // รับ Gold_Tag_id ที่ต้องการลบจาก parameter ของ URL
        await GoldTag.findOneAndDelete({ gold_id: goldId}); // ค้นหาและลบข้อมูลทองคำในฐานข้อมูล

        res.redirect('/edit_goldTagData?deleteSuccess=true'); // ส่งกลับไปยังหน้าหลักหลังจากทำการลบข้อมูลเสร็จสิ้น
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
  });

  router.get('/gold_sales', async (req, res) => {
    try {
        let goldsales = [];
        let rfidTags = rfidModule.getRfidTags(); // Retrieve RFID tags

        // Fetch gold sales data from database
        goldsales = await GoldTag.find({ gold_id: { $in: rfidTags } });

        // Add tray information
        goldsales = goldsales.map(tag => ({
            ...tag._doc,
            gold_tray: assignTray(tag.gold_type) // Function to assign tray based on gold type
        }));

        // Sort gold sales by tray
        goldsales.sort((a, b) => {
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

        // Fetch the latest gold price
        const dataUrl = 'http://www.thaigold.info/RealTimeDataV2/gtdata_.txt';
        const response = await axios.get(dataUrl);
        const data = response.data;
        const pricePerGram = parseFloat(data[5]?.bid);

        if (isNaN(pricePerGram)) {
            console.error('pricePerGram is not a valid number:', pricePerGram);
            res.status(500).send('Invalid price data from API');
            return;
        }

        // Calculate gold prices
        //ราคาขายออก
        const prices = {
          halfSalung: (pricePerGram * 3.81 / 15.244 / 2) + 400,
          oneSalung: (pricePerGram * 3.81 / 15.244) + 400,
          twoSalung: (pricePerGram * 3.81 * 2 / 15.244) + 400,
          oneBaht: (pricePerGram) + 400,
          twoBaht: (pricePerGram * 2) + (400*2),
          threeBaht: (pricePerGram * 3) + (400*3)
        };

        // Calculate total price
        let totalGoldPrice = 0;
        goldsales.forEach(item => {
            if (item.gold_size === 'ครึ่งสลึง') {
                totalGoldPrice += prices.halfSalung;
            } else if (item.gold_size === '1 สลึง') {
                totalGoldPrice += prices.oneSalung;
            } else if (item.gold_size === '2 สลึง') {
                totalGoldPrice += prices.twoSalung;
            } else if (item.gold_size === '1 บาท') {
                totalGoldPrice += prices.oneBaht;
            } else if (item.gold_size === '2 บาท') {
                totalGoldPrice += prices.twoBaht;
            } else if (item.gold_size === '3 บาท') {
                totalGoldPrice += prices.threeBaht;
            }
        });

        const updateTime = data[0]?.ask; // Time of the price update

        res.render('gold_sales', {
            goldsales,
            dayjs,
            currentUrl: req.originalUrl,
            prices,
            updateTime,
            totalGoldPrice
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});


router.post('/update_goldstatus', async (req, res) => {
  try {
      const { gold_ids, customer_name, customer_surname, customer_phone, gold_sales } = req.body;
      const currentTimestamp = dayjs().locale('th').format('YYYY-MM-DD HH:mm:ss');
      
      // Fetch the latest gold price
      const dataUrl = 'http://www.thaigold.info/RealTimeDataV2/gtdata_.txt';
      const response = await axios.get(dataUrl);
      const data = response.data;
      const pricePerGram = parseFloat(data[5]?.bid);

      if (isNaN(pricePerGram)) {
          console.error('pricePerGram is not a valid number:', pricePerGram);
          res.status(500).send('Invalid price data from API');
          return;
      }

      // Calculate gold prices
      //ราคาขายออก
      const prices = {
        halfSalung: (pricePerGram * 3.81 / 15.244 / 2) + 400,
        oneSalung: (pricePerGram * 3.81 / 15.244) + 400,
        twoSalung: (pricePerGram * 3.81 * 2 / 15.244) + 400,
        oneBaht: (pricePerGram) + 400,
        twoBaht: (pricePerGram * 2) + (400*2),
        threeBaht: (pricePerGram * 3) + (400*3)
      };

      // Update gold_status and gold_outDateTime in Goldtagscount collection
      await Goldtagscount.updateMany(
          { gold_id: { $in: gold_ids } },
          {
              $set: {
                  gold_status: 'out of stock',
                  gold_outDateTime: currentTimestamp
              }
          }
      );

      // Update or create documents in Goldhistory
      for (const gold of gold_sales) {
          let goldPrice;
          if (gold.gold_size === 'ครึ่งสลึง') {
              goldPrice = prices.halfSalung;
          } else if (gold.gold_size === '1 สลึง') {
              goldPrice = prices.oneSalung;
          } else if (gold.gold_size === '2 สลึง') {
              goldPrice = prices.twoSalung;
          } else if (gold.gold_size === '1 บาท') {
              goldPrice = prices.oneBaht;
          } else if (gold.gold_size === '2 บาท') {
              goldPrice = prices.twoBaht;
          } else if (gold.gold_size === '3 บาท') {
              goldPrice = prices.threeBaht;
          } else {
              goldPrice = 0; // Default if size not matched
          }
          
          let existingGold = await Goldhistory.findOne({ gold_id: gold.gold_id }).sort({ gold_timestamp: -1 });

          if (existingGold) {
              // Update existing document
              existingGold.customer_name = customer_name;
              existingGold.customer_surname = customer_surname;
              existingGold.customer_phone = customer_phone;
              existingGold.gold_status = 'out of stock';
              existingGold.gold_price = goldPrice.toFixed(2);
              existingGold.gold_outDateTime = currentTimestamp;
              await existingGold.save();
          } else {
              // Create new document in Goldhistory
              await Goldhistory.create({
                  gold_id: gold.gold_id,
                  gold_status: 'out of stock',
                  gold_outDateTime: currentTimestamp,
                  customer_name: customer_name,
                  customer_surname: customer_surname,
                  customer_phone: customer_phone,
                  gold_price: goldPrice,
                  gold_timestamp: currentTimestamp,
              });
          }
      }

      res.json({ message: 'Data saved successfully' });

  } catch (error) {
      console.error('Error:', error);
      res.status(500).send('Internal Server Error');
  }
});


  const ITEMS_PER_PAGE = 15;

  router.get('/gold_salesHistory', async (req, res, next) => {
    try {
        let condition = { gold_status: 'out of stock' }; // Initial condition for out of stock items

        // Filter conditions based on query parameters
        if (req.query.select_goldType && req.query.select_goldType !== 'เลือกประเภททองคำ') {
            condition.gold_type = req.query.select_goldType;
        }
        if (req.query.select_goldSize && req.query.select_goldSize !== 'เลือกขนาดทองคำ') {
            condition.gold_size = req.query.select_goldSize;
        }
        if (req.query.gold_id && req.query.gold_id.trim().length > 0) {
            condition.gold_id = req.query.gold_id.trim();
        }
        if (req.query.start_date && req.query.end_date) {
            const startDate = new Date(req.query.start_date);
            const endDate = new Date(req.query.end_date);
            condition.gold_outDateTime = {
                $gte: startDate,
                $lt: dayjs(endDate).endOf('day').toDate() // End of day for endDate
            };
        } else if (req.query.start_date) {
            const startDate = new Date(req.query.start_date);
            condition.gold_outDateTime = { $gte: startDate };
        } else if (req.query.end_date) {
            const endDate = new Date(req.query.end_date);
            condition.gold_outDateTime = { $lt: dayjs(endDate).endOf('day').toDate() };
        }

        // Pagination logic
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * ITEMS_PER_PAGE;

        const allRecords = await Goldhistory.find(condition)
            .sort({ gold_outDateTime: -1 })
            .skip(skip)
            .limit(ITEMS_PER_PAGE);

        const totalItems = await Goldhistory.countDocuments(condition);

        // Create query parameters string without the page parameter
        const queryParams = new URLSearchParams(req.query);
        queryParams.delete('page');

        res.render('gold_salesHistory', {
          goldshistory: allRecords,
          dayjs: dayjs,
          select_goldType: req.query.select_goldType,
          select_goldSize: req.query.select_goldSize,
          startDate: req.query.start_date,
          endDate: req.query.end_date,
          gold_id: req.query.gold_id,
          currentUrl: req.originalUrl,
          totalPages: Math.ceil(totalItems / ITEMS_PER_PAGE),
          currentPage: page,
          queryParams: queryParams.toString(),
      });

    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

router.get('/gold_saleDetails', async (req, res, next) => {
  try {
      const goldId = req.query.gold_id;
      console.log("Gold ID:", goldId);  // ตรวจสอบว่า gold_id ถูกส่งมาถูกต้องหรือไม่

      const saleDetails = await Goldhistory.findOne({ _id: goldId, gold_status: 'out of stock' });

      if (saleDetails) {
          console.log("Sale Details:", saleDetails);  // ตรวจสอบผลลัพธ์จากฐานข้อมูล

          res.json({
              customer_name: saleDetails.customer_name,
              customer_surname: saleDetails.customer_surname,
              customer_phone: saleDetails.customer_phone,
              gold_outDateTime: dayjs(saleDetails.gold_outDateTime).locale('th').format('DD-MM-YYYY HH:mm:ss'),
              gold_price: saleDetails.gold_price
          });
      } else {
          res.status(404).json({ error: 'Sale details not found' });
      }
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/gold_history', async (req, res, next) => {
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

      if (req.query.gold_id && req.query.gold_id.trim().length > 0) {
          condition.gold_id = req.query.gold_id.trim();
      }

      // ถ้ามีการเลือกวันที่เริ่มต้นและสิ้นสุด
      if (req.query.start_date && req.query.end_date) {
          const startDate = new Date(req.query.start_date);
          const endDate = new Date(req.query.end_date);

          // ถ้าวันที่เริ่มต้นและสิ้นสุดเป็นวันเดียวกัน
          if (startDate.toDateString() === endDate.toDateString()) {
              condition.gold_timestamp = {
                  $gte: startDate,
                  $lt: dayjs(endDate).add(1, 'day').toDate() // เพิ่ม 1 วันเพื่อให้ครอบคลุมทั้งวัน
              };
          } else {
              // ถ้าวันที่เริ่มต้นและสิ้นสุดเป็นคนละวัน
              condition.gold_timestamp = {
                  $gte: startDate,
                  $lt: dayjs(endDate).add(1, 'day').toDate() // เพิ่ม 1 วันเพื่อให้ครอบคลุมทั้งวันสิ้นสุด
              };
          }
      } else if (req.query.start_date) {
          // ถ้ามีการเลือกแค่วันที่เริ่มต้น
          const startDate = new Date(req.query.start_date);
          condition.gold_timestamp = { $gte: startDate };
      } else if (req.query.end_date) {
          // ถ้ามีการเลือกแค่วันที่สิ้นสุด
          const endDate = new Date(req.query.end_date);
          condition.gold_timestamp = { $lt: dayjs(endDate).add(1, 'day').toDate() };
      }

      // Get the latest date in the database
      const latestRecord = await Goldhistory.findOne().sort({ gold_timestamp: -1 }).exec();
      const latestDate = latestRecord ? latestRecord.gold_timestamp : null;

      // Pagination logic
      const page = parseInt(req.query.page) || 1;
      const skip = (page - 1) * ITEMS_PER_PAGE;

      // เพิ่มการค้นหาทองที่มีสถานะเป็น in stock ในแต่ละวัน
      const allRecords = await Goldhistory.find(condition)
          .sort({ gold_timestamp: -1, gold_tray: 1 })  // เรียงตาม gold_timestamp และ gold_tray
          .skip(skip)
          .limit(ITEMS_PER_PAGE);

      const totalItems = await Goldhistory.countDocuments(condition);

      // Create query parameters string without the page parameter
      const queryParams = new URLSearchParams(req.query);
      queryParams.delete('page');

      // นับจำนวนทองคำที่มีสถานะเป็น in stock ในแต่ละวัน
      const allInStockRecords = await Goldhistory.find({ gold_status: 'in stock' });

      const dailyInStockMap = {};
      allInStockRecords.forEach(item => {
          const dateKey = `${item.gold_timestamp.getFullYear()}-${item.gold_timestamp.getMonth() + 1}-${item.gold_timestamp.getDate()}`;
          if (!dailyInStockMap[dateKey]) {
              dailyInStockMap[dateKey] = 0;
          }
          dailyInStockMap[dateKey] += 1;
      });

      res.render('gold_history', { 
          goldshistory: allRecords, 
          dayjs: dayjs, 
          select_goldType: req.query.select_goldType, 
          select_goldSize: req.query.select_goldSize,
          gold_id: req.query.gold_id,
          startDate: req.query.start_date,
          endDate: req.query.end_date,
          currentUrl: req.originalUrl,
          totalPages: Math.ceil(totalItems / ITEMS_PER_PAGE),
          currentPage: page,
          latestDate: latestDate,
          queryParams: queryParams.toString(),
          dailyInStockMap: dailyInStockMap // ส่งข้อมูลจำนวนทองคำไปยัง EJS
      });

  } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
  }
});


module.exports = router;


// router.get('/gold_history', async (req, res, next) => {
//   try {
//       let condition = {};

//       // ถ้ามีการเลือกประเภททองคำ
//       if (req.query.select_goldType && req.query.select_goldType !== 'เลือกประเภททองคำ') {
//           condition.gold_type = req.query.select_goldType;
//       }

//       // ถ้ามีการเลือกขนาดทองคำ
//       if (req.query.select_goldSize && req.query.select_goldSize !== 'เลือกขนาดทองคำ') {
//           condition.gold_size = req.query.select_goldSize;
//       }

//       // ถ้ามีการเลือกวันที่เริ่มต้นและสิ้นสุด
//       if (req.query.start_date && req.query.end_date) {
//           const startDate = new Date(req.query.start_date);
//           const endDate = new Date(req.query.end_date);

//           // ถ้าวันที่เริ่มต้นและสิ้นสุดเป็นวันเดียวกัน
//           if (startDate.toDateString() === endDate.toDateString()) {
//               condition.gold_timestamp = {
//                   $gte: startDate,
//                   $lt: dayjs(endDate).add(1, 'day').toDate() // เพิ่ม 1 วันเพื่อให้ครอบคลุมทั้งวัน
//               };
//           } else {
//               // ถ้าวันที่เริ่มต้นและสิ้นสุดเป็นคนละวัน
//               condition.gold_timestamp = {
//                   $gte: startDate,
//                   $lt: dayjs(endDate).add(1, 'day').toDate() // เพิ่ม 1 วันเพื่อให้ครอบคลุมทั้งวันสิ้นสุด
//               };
//           }
//       } else if (req.query.start_date) {
//           // ถ้ามีการเลือกแค่วันที่เริ่มต้น
//           const startDate = new Date(req.query.start_date);
//           condition.gold_timestamp = { $gte: startDate };
//       } else if (req.query.end_date) {
//           // ถ้ามีการเลือกแค่วันที่สิ้นสุด
//           const endDate = new Date(req.query.end_date);
//           condition.gold_timestamp = { $lt: dayjs(endDate).add(1, 'day').toDate() };
//       }

//       const page = parseInt(req.query.page) || 1; // หากไม่ได้ระบุหน้า ให้เริ่มจากหน้าที่ 1
//       const perPage = 15; // จำนวนรายการต่อหน้า
//       const skip = (page - 1) * perPage; // คำนวณหาจำนวนรายการที่ต้องข้าม

//       // ดึงข้อมูลทองคำจากฐานข้อมูลโดยใช้เงื่อนไข condition และจัดกลุ่มตามวันและถาด
//       const aggregateQuery = [
//           { $match: condition },
//           { $sort: { gold_timestamp: -1, gold_tray: 1 } }, // เรียงลำดับจากวันที่ล่าสุดไปยังเก่าสุดและตามถาด
//           {
//               $group: {
//                   _id: {
//                       day: { $dayOfMonth: "$gold_timestamp" },
//                       month: { $month: "$gold_timestamp" },
//                       year: { $year: "$gold_timestamp" },
//                       gold_tray: "$gold_tray"
//                   },
//                   records: { $push: "$$ROOT" },
//                   trayCount: { $sum: 1 }
//               }
//           },
//           {
//               $group: {
//                   _id: {
//                       day: "$_id.day",
//                       month: "$_id.month",
//                       year: "$_id.year"
//                   },
//                   trays: { $push: "$$ROOT" },
//                   totalCount: { $sum: "$trayCount" }
//               }
//           },
//           { $sort: { "_id.year": -1, "_id.month": -1, "_id.day": -1 } },
//       ];

//       const allRecords = await Goldhistory.aggregate(aggregateQuery);

//       // Flatten the grouped data into a single array
//       let flatRecords = [];
//       allRecords.forEach(group => {
//           group.trays.forEach(tray => {
//               tray.records.forEach(record => {
//                   flatRecords.push({
//                       ...record,
//                       trayCount: tray.trayCount,
//                       totalCount: group.totalCount,
//                       groupDate: new Date(group._id.year, group._id.month - 1, group._id.day)
//                   });
//               });
//           });
//       });

//       // Sorting flat records by date and tray within each day
//       flatRecords.sort((a, b) => {
//           if (a.groupDate > b.groupDate) return -1;
//           if (a.groupDate < b.groupDate) return 1;
//           if (a.gold_tray > b.gold_tray) return 1;
//           if (a.gold_tray < b.gold_tray) return -1;
//           return 0;
//       });

//       const totalRecords = flatRecords.length;
//       const totalPages = Math.ceil(totalRecords / perPage);
//       const paginatedRecords = flatRecords.slice(skip, skip + perPage);

//       res.render('gold_history', { 
//           goldshistory: paginatedRecords, 
//           dayjs: dayjs, 
//           select_goldType: req.query.select_goldType, 
//           select_goldSize: req.query.select_goldSize,
//           startDate: req.query.start_date,
//           endDate: req.query.end_date,
//           currentPage: page,
//           totalPages: totalPages, 
//           currentUrl: req.originalUrl
//       });

//   } catch (error) {
//       console.error(error);
//       res.status(500).send('Internal Server Error');
//   }
// });
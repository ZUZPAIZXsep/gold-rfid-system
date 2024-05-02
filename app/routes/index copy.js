// MySQL Database
var express = require('express');
var router = express.Router();


let mysql = require('mysql');
let conn = mysql.createConnection({
  host: 'localhost',
  user:'root',
  password:'',
  database:'db_pay'
});

let dayjs = require('dayjs');

conn.connect((err) => {
  if (err) throw err;
  console.log('Connect to database MySQL Success');
})

/* GET home page. */
router.get('/', (req, res, next) => {
  let params = [];
  let sql = 'SELECT * FROM tb_pay';

  if(req.query.search != undefined){
    sql += ' WHERE topic LIKE(?)'
    params.push('%'+req.query.search+'%');
  }

  conn.query(sql,params, (err,result) => {
    if(err) throw err;
    res.render('index',{pays: result, dayjs: dayjs});
  })
});

router.get('/form', (req, res) => {
  res.render('form',{data: {},dayjs: dayjs});
});

router.post('/form', (req, res) => {
  conn.query('INSERT INTO tb_pay SET ?', req.body, (err, result) => {
    if(err) throw err;
    res.redirect('/');
  })
});

router.get('/delete/:id', (req, res) => {
  conn.query('DELETE FROM tb_pay WHERE id = ?', [req.params.id], (err,result) =>{
    if(err) throw err;
    res.redirect('/');
  })
});

router.get('/edit/:id', (req, res) => {
  conn.query('SELECT * FROM tb_pay WHERE id = ?', [req.params.id], (err,result) =>{
    if(err) throw err;
    res.render('form', {data: result[0] , dayjs: dayjs});
  })
});

router.post('/edit/:id', (req, res) => {
  conn.query('UPDATE tb_pay SET ? WHERE id = ?',[req.body,req.params.id], (err,result) =>{
    if(err) throw err;
    res.redirect('/');
  })
});

module.exports = router;




//MongoDB Database
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const dayjs = require('dayjs');
const { ObjectId } = require('mongoose').Types;

// เชื่อมต่อกับ MongoDB
mongoose.connect('mongodb+srv://admin:1234@dbpaytest.vu2utcw.mongodb.net/db_pay', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB database');
});

// สร้างโครงสร้างข้อมูล
const paySchema = new mongoose.Schema({
  topic: String,
  total: Number,
  pay_date: Date
},{ collection: 'tb_pay' });

const Pay = mongoose.model('Pay', paySchema);

/* GET home page. */
router.get('/', async (req, res, next) => {
  try {
    let condition = {};
    if (req.query.search) {
      condition = { topic: { $regex: new RegExp(req.query.search, 'i') } };
    }

    const pays = await Pay.find(condition);
    res.render('index', { pays: pays, dayjs: dayjs });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/form', (req, res) => {
  res.render('form', { data: {}, dayjs: dayjs });
});

router.post('/form', async (req, res) => {
  try {
    const newPay = new Pay(req.body);
    await newPay.save();
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/delete/:id', async (req, res) => {
  try {
    await Pay.findByIdAndDelete(req.params.id);
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/edit/:id', async (req, res) => {
  try {
    const pay = await Pay.findById(req.params.id);
    res.render('form', { data: pay, dayjs: dayjs });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

router.post('/edit/:id', async (req, res) => {
  try {
    await Pay.findByIdAndUpdate(req.params.id, req.body);
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;

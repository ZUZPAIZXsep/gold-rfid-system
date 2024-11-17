var HID = require('node-hid');
var devices = HID.devices();

// console.log('devices:', HID.devices());  //list USB-HID

var deviceInfo = devices.find(function (d) {
    var isTeensy = d.vendorId === 0x1a86 && d.productId === 0xe010;  //Our HID VID=0x1A86 and PID=0xE010 เช็ครหัสอุปกรณ์
    var isKbd = d.path.includes('kbd');
    if (isTeensy && isKbd === false)  //สำหรับเครื่องสแกนเท่านั้นไม่ใช่คีย์บอร์ด
        return d.path;
    else return null;
});

function sleep(delay) {
    return new Promise((resolve) => setTimeout(resolve, delay));
}

var seenTags = {}; // เก็บรหัสของแท็กที่เห็นแล้ว

var rfidTags = []; // เก็บรหัสของแท็กที่เห็นแล้ว

function ShowTagData(data) {
    var tagID = data.slice(19, 31).toString('hex'); // แปลงข้อมูลใน Buffer เป็นรหัสฐาน 16
    if (!rfidTags.includes(tagID)) { // ถ้ารหัสแท็กยังไม่เคยเห็น
        rfidTags.push(tagID); // เพิ่มรหัสแท็กลงในอาร์เรย์
        // console.log('tag:', tagID); // แสดงรหัสแท็กเป็นรหัสฐาน 16
    }
}

// // เพิ่มฟังก์ชันเพื่อรับข้อมูล RFID สำหรับเว็บแอปพลิเคชัน
// function getRfidData() {
//     return rfidData;
// }

function getRfidTags() {
    return rfidTags; //คืนค่า rfidTags
}

function resetRfidTags() {
    rfidTags = []; //เคลียร์ค่า rfidTags
  }

async function run() {
    if (deviceInfo) {
        var device = new HID.HID(deviceInfo.path); //ตำแหน่งอุปกรณ์
        try {
            console.log("Open Rfid Reader Success");
            device.sendFeatureReport([0x00, 0xFF, 0xC7, 0x83, 0xCC, 0x30, 0x00]);  //Open USB-Hid must set usb feature value first
        } catch (err) {
            
        }

        await sleep(200);
        //กำหนดการตั้งค่า
        device.write([0x00, 0x09, 0x53, 0x57, 0x00, 0x05, 0xFF, 0x24, 0x05, 0x07, 0x22]);    //Set RF Power RF = 0x07 / 7 dbm
        await sleep(200);

        device.write([0x00, 0x09, 0x53, 0x57, 0x00, 0x05, 0xFF, 0x24, 0x02, 0x01, 0x2B]);    //Set ActiveMode
        await sleep(200);

        device.write([0x00, 0x09, 0x53, 0x57, 0x00, 0x05, 0xFF, 0x3F, 0x31, 0x80, 0x62]);   //Set Freq.  US band
        await sleep(200);

        device.write([0x00, 0x09, 0x53, 0x57, 0x00, 0x05, 0xFF, 0x24, 0x0A, 0x01, 0x23]);   //ScanArea :  TID
        await sleep(200);

        device.on('data', function (data) { //ดักข้อมูลที่อ่านได้
            if (data[0] !== 0 && data[1] === 0x43 && data[2] === 0x54 && data[6] === 0x45) {
                ShowTagData(data);
            }
        });
    }
}

run();

module.exports = {
    //getRfidData // ส่งฟังก์ชัน getRfidData ออกไปให้ Express.js ใช้งาน
    getRfidTags,
    resetRfidTags,
};



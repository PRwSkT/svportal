# วิธีสร้าง Page Access Token (แบบไม่มีวันหมดอายุ) ผ่าน Meta Business Suite

หากคุณต้องการโพสต์ผ่าน API ลงหลายๆ เพจใน Business Portfolio ของคุณ วิธีที่ง่ายและเสถียรที่สุดคือการใช้ **System User** ครับ

### ขั้นตอนที่ 1: ตั้งค่า System User
1. เข้าไปที่ **Meta Business Settings** (https://business.facebook.com/settings)
2. เลือกธุรกิจของคุณ
3. ที่เมนูด้านซ้าย ไปที่ **Users (ผู้ใช้)** -> **System Users (ผู้ใช้ระบบ)**
4. หากยังไม่มี ให้คลิก **Add (เพิ่ม)** สร้างชื่อว่า "Auto Post System" และเลือก Role เป็น **Admin (ผู้ดูแล)**
5. คลิกที่ชื่อ System User ที่เพิ่งสร้าง

### ขั้นตอนที่ 2: เพิ่มสิทธิ์ให้ System User เข้าถึงเพจ
1. คลิกที่ปุ่ม **Add Assets (เพิ่มสินทรัพย์)**
2. เลือกหมวดหมู่ **Pages (เพจ)** ด้านซ้าย
3. ติ๊กเลือกเพจทั้ง 4 เพจ (สมคิดวิทยา, Somkid+, SV Lion, SV Aquatics)
4. ทางขวามือ ให้เลื่อนสวิตช์เปิดสิทธิ์ **Full Control (การควบคุมโดยสมบูรณ์)**
5. กดบันทึก (Save Changes)

### ขั้นตอนที่ 3: สร้าง Token
1. กลับมาที่หน้าจอ System User เดิม คลิกปุ่ม **Generate New Token (สร้างโทเค็นใหม่)**
2. ในหน้าต่างที่เด้งขึ้นมา เลือกแอปพลิเคชันของคุณ (ถ้ายังไม่มี ต้องสร้างแอปกดเลือกประเภท Business ก่อน)
3. **เลื่อนลงมาที่หมวด Permissions (สิทธิ์การเข้าถึง)** คุณ **ต้องติ๊กเลือก** สิทธิ์เหล่านี้:
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `pages_manage_metadata`
   - `instagram_basic` (ถ้าแอปนี้เชื่อมกับ IG ของเพจหลัก)
   - `instagram_content_publish` (ถ้าโพสต์รูปลง IG)
4. กด **Generate Token** ด้านล่าง
5. **ก๊อปปี้ Token ตัวยาวๆ** ที่ปรากฏขึ้นมาเก็บไว้ (สำคัญมาก เพราะมันจะไม่โชว์อีกแล้ว) 

### ขั้นตอนที่ 4: นำ Token ไปใส่ในโค้ด
นำ Token ที่เพิ่งได้ มาแทนที่ในไฟล์ `Code.gs` บรรทัดนี้ครับ:
```javascript
token: "ใส่ Token ใหม่ที่นี่...",
```

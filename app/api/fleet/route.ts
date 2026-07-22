// ไฟล์: app/api/fleet/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 🌟 ส่งหุ่นยนต์ไปดูดข้อมูลจากเซิร์ฟเวอร์ Thai GPS
    const response = await fetch('https://gps.thaigpstracker.co.th/api2/map/getRealTimeData', {
      method: 'POST', // สังเกตจาก cURL ของบอสใช้ --data-raw แปลว่าเป็น POST ครับ
      headers: {
        'accept': 'application/json, text/javascript, */*; q=0.01',
        'authorization': 'Basic TnpReE1DNVVSMVF1YldGNE1ERmZZblF1VkVkVUxqUXVWRWRVTG5Sb0xsUkhWQzR4ZEdna2MzQm5LZ1prTE1weDJR',
        'content-type': 'application/json; charset=UTF-8',
        // 👇 กุญแจหลักของบอสอยู่ตรงนี้ครับ!
        'cookie': 'username=max01_bt; _username=max01_bt; PHPSESSID=r92o64ju6sergmgca8up7t53m2; token=TnpReE1DNVVSMVF1YldGNE1ERmZZblF1VkVkVUxqUXVWRWRVTG5Sb0xsUkhWQzR4ZEdna2MzQm5LZ1prTE1weDJR; asset=2967; cookie_max01_bt={"isShowAllMarkers":false,"isAlertSound":true,"isTracking":true}',
        'origin': 'https://gps.thaigpstracker.co.th',
        'referer': 'https://gps.thaigpstracker.co.th/map2',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest'
      },
      body: JSON.stringify({
        imei: null,
        asset: "2967",
        sub_asset: ""
      })
    });

    // 🌟 ได้ข้อมูลมาแล้ว ส่งกลับไปให้หน้าจอเรดาร์ของเรา
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('🔥 แฮกข้อมูล GPS พลาด:', error);
    return NextResponse.json({ error: 'ดึงข้อมูลไม่สำเร็จ' }, { status: 500 });
  }
}
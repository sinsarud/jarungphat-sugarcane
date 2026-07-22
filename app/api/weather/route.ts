import { NextResponse } from 'next/server';

// 🌟 พจนานุกรมแปลชื่อจังหวัด (ช่วยให้ยิง API อุตุฯ ได้เร็วขึ้น 10 เท่า ไม่ติดบั๊กภาษาไทย)
const PROVINCE_MAP: Record<string, string> = {
  'กรุงเทพมหานคร': 'Bangkok',
  'กรุงเทพ': 'Bangkok',
  'สุพรรณบุรี': 'Suphan Buri',
  'กาญจนบุรี': 'Kanchanaburi',
  'นครปฐม': 'Nakhon Pathom',
  'ราชบุรี': 'Ratchaburi',
  'อุทัยธานี': 'Uthai Thani',
  'นครสวรรค์': 'Nakhon Sawan',
  'ลพบุรี': 'Lop Buri',
  'ชัยภูมิ': 'Chaiyaphum',
  'ขอนแก่น': 'Khon Kaen',
  'อุดรธานี': 'Udon Thani',
  'นครราชสีมา': 'Nakhon Ratchasima',
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const thaiProvince = searchParams.get('province') || 'กรุงเทพมหานคร';
  
  // แปลงเป็นชื่ออังกฤษ (ถ้าไม่มีในตาราง ให้ใช้ชื่อเดิมไปก่อน)
  const queryProvince = PROVINCE_MAP[thaiProvince] || thaiProvince;
  
  const apiKey = process.env.NEXT_PUBLIC_TMD_API_KEY;

  if (!apiKey || apiKey.includes('ใส่_Token')) {
    return NextResponse.json({ error: 'WAITING_KEY' }, { status: 400 });
  }

  try {
    // 🌟 ยิงไปขอแค่จังหวัดเดียวด้วยชื่อภาษาอังกฤษ (Bangkok) ข้อมูลเบาหวิว โหลดเสร็จใน 300ms!
    const url = `https://data.tmd.go.th/api/WeatherForecast7Days/v2/?province=${encodeURIComponent(queryProvince)}`;
    
    console.log(`\n📡 [API] กำลังดึงสภาพอากาศ: "${queryProvince}" (${thaiProvince})...`);
    
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${apiKey}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      cache: 'no-store' 
    });

    const rawText = await response.text();
    
    if (!response.ok) {
      console.log(`❌ [API Error] กรมอุตุฯ ตอบกลับ Status: ${response.status}`);
      throw new Error(`เซิร์ฟเวอร์กรมอุตุฯ ขัดข้องชั่วคราว (Status: ${response.status})`);
    }

    if (!rawText) {
      throw new Error('เซิร์ฟเวอร์กรมอุตุฯ ไม่ส่งข้อมูลกลับมา');
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseError) {
      throw new Error('รูปแบบข้อมูลจากกรมอุตุฯ ผิดปกติ');
    }

    const provinceData = data?.WeatherForecast7Days?.Provinces?.[0];
    if (!provinceData) {
      throw new Error(`ไม่พบข้อมูลสภาพอากาศของ "${thaiProvince}" จากกรมอุตุฯ`);
    }

    console.log(`✅ [API Success] ได้ข้อมูล "${provinceData.ProvinceNameThai}" เรียบร้อยอย่างไว!`);
    
    return NextResponse.json(data);
    
  } catch (error: any) {
    console.error("🔥 [Route Error]:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
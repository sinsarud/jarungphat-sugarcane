import { NextResponse } from 'next/server';

async function handleHistoryFetch(params: URLSearchParams | any) {
  const imei = params.get ? params.get('imei') : params.imei || '867747070163595';
  const mode = params.get ? params.get('mode') : params.mode || 'history';
  
  const rawStartDate = (params.get ? params.get('startDate') : params.startDate) || new Date().toISOString().split('T')[0];
  const rawEndDate = (params.get ? params.get('endDate') : params.endDate) || new Date().toISOString().split('T')[0];
  const [sYear, sMonth, sDay] = rawStartDate.split('-');
  const [eYear, eMonth, eDay] = rawEndDate.split('-');
  const formattedStartDate = `${sDay}/${sMonth}/${sYear}`;
  const formattedEndDate = `${eDay}/${eMonth}/${eYear}`;
  
  const startTime = (params.get ? params.get('startTime') : params.startTime) || '00:00';
  const endTime = (params.get ? params.get('endTime') : params.endTime) || '23:59';

  try {
    let url = 'https://gps.thaigpstracker.co.th/api2/map/getHistory';
    let bodyData: any = {
      imei: imei,
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      startTime: startTime,
      endTime: endTime,
      dataAll: 1
    };

    if (mode === 'parking') {
      url = 'https://gps.thaigpstracker.co.th/api2/map/getHistoryParking';
      bodyData = {
        imei: imei,
        dateStart: formattedStartDate,
        dateEnd: formattedEndDate,
        timeStart: startTime,
        timeEnd: endTime,
        dataAll: 1
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'accept': 'application/json, text/javascript, */*; q=0.01',
        'accept-language': 'th-TH,th;q=0.9,en-TH;q=0.8,en;q=0.7',
        'authorization': 'Basic TnpReE1DNVVSMVF1YldGNE1ERmZZblF1VkVkVUxqUXVWRWRVTG5Sb0xsUkhWQzR4ZEdna2MzQm5LZ1prTE1weDJR',
        'content-type': 'application/json; charset=UTF-8',
        'cookie': 'username=max01_bt; _username=max01_bt; enAlert_max01_bt=enAlert_max01_bt; PHPSESSID=1cvo2ikt4m26j3mmb48lvl2rak; locale=th; token=TnpReE1DNVVSMVF1YldGNE1ERmZZblF1VkVkVUxqUXVWRWRVTG5Sb0xsUkhWQzR4ZEdna2MzQm5LZ1prTE1weDJR; map_type=esri; api=%2Fapi2; _group=4; _add_by=phondee; _notification_expire=1; asset=2967',
        'origin': 'https://gps.thaigpstracker.co.th',
        'referer': 'https://gps.thaigpstracker.co.th/history',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest'
      },
      body: JSON.stringify(bodyData),
      next: { revalidate: 0 } 
    });

    if (!res.ok) throw new Error(`Server responded with status ${res.status}`);
    const rawData = await res.json();

    // 🌟 1. ดึง Array รายการจริง (เจาะทะลุทั้ง data.data, data, หรือ root)
    let list: any[] = [];
    if (rawData.data && rawData.data.data && Array.isArray(rawData.data.data)) {
      list = rawData.data.data; // ชี้ตรงไปที่ก้อน 5 จุดจอดใน JSON ของบอส!
    } else if (rawData.data && Array.isArray(rawData.data)) {
      list = rawData.data;
    } else if (Array.isArray(rawData)) {
      list = rawData;
    }

    // 🌟 2. ดึงยอดสรุปจริง (ชี้ไปที่ data.summary ใน JSON ของบอส!)
    let totalDist = 0;
    let totalTimeText = '-';

    if (rawData.data && rawData.data.summary) {
      totalDist = parseFloat(rawData.data.summary.totalDistance || 0);
      totalTimeText = rawData.data.summary.timeDurationText || '-';
    } else if (rawData.summary) {
      totalDist = parseFloat(rawData.summary.totalDistance || 0);
      totalTimeText = rawData.summary.timeDurationText || '-';
    } else if (list.length > 0 && list[0].timeDuration) {
      totalTimeText = list[0].timeDuration;
    }

    // ถ้าไม่มีค่า distance ใน summary ให้บวกเพิ่มจากรายการย่อย
    if (!totalDist || isNaN(totalDist)) {
      list.forEach((item: any) => {
        const d = parseFloat(item.distance || item.dist || 0);
        if (!isNaN(d)) totalDist += d;
      });
    }

    return NextResponse.json({
      success: true,
      data: list,
      summary: {
        totalDistance: totalDist.toFixed(2),
        totalStops: mode === 'parking' ? list.length : (rawData.data_total || list.length),
        totalDuration: totalTimeText
      }
    });

  } catch (error: any) {
    console.error('❌ History Scraper Error:', error.message || error);
    return NextResponse.json({ success: false, message: 'ไม่สามารถดึงข้อมูลย้อนหลังได้', data: [] }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return handleHistoryFetch(searchParams);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return handleHistoryFetch(body);
  } catch (e) {
    const { searchParams } = new URL(request.url);
    return handleHistoryFetch(searchParams);
  }
}
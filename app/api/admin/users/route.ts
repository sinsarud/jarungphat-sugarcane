import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // ใช้ Service Role Key เพื่อให้มีสิทธิ์ระดับแอดมินในการจัดการ User
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  try {
    const body = await request.json();
    const { action, username, password, email, auth_id, is_banned } = body;

    // 1. ดึงข้อมูล User ทั้งหมด
    if (action === 'fetch') {
      const { data: mappings } = await supabaseAdmin.from('user_mappings').select('*');
      const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (authError) throw authError;

      const combined = (mappings || []).map(m => ({
        ...m,
        auth_id: users.find(u => u.email === m.email)?.id,
        is_banned: users.find(u => u.email === m.email)?.banned_until != null
      }));
      return NextResponse.json({ users: combined });
    }
    
    // 2. สร้างบัญชีใหม่
    if (action === 'create') {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({ 
        email, 
        password, 
        email_confirm: true 
      });
      
      if (authError) throw authError;

      const { error: dbError } = await supabaseAdmin.from('user_mappings').insert([{ 
        username, 
        email 
      }]);

      if (dbError) throw dbError;

      return NextResponse.json({ success: true });
    }

    // 3. ลบบัญชี
    if (action === 'delete') {
      if (auth_id) {
        await supabaseAdmin.auth.admin.deleteUser(auth_id);
      }
      await supabaseAdmin.from('user_mappings').delete().eq('username', username);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Action not found' }, { status: 400 });
  } catch (error: any) {
    console.error('API Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
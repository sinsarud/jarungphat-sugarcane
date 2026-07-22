// 🌟 สูตรโกง: สั่งให้ Node.js เพิกเฉยต่อ Error เรื่อง SSL Certificate (แก้ปัญหา SELF_SIGNED_CERT_IN_CHAIN)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    let rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const cleanSupabaseUrl = rawUrl.replace(/[\n\r\s]/g, '').trim(); 
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || '';

    if (!cleanSupabaseUrl || !serviceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(cleanSupabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    if (action === 'master_reset') {
      const { username, new_password, master_pin } = body;
      const envPin = process.env.MASTER_RESET_PIN?.trim() || '2569';
      if (master_pin !== envPin) return NextResponse.json({ error: 'รหัสผิด' }, { status: 401 });

      const { data: mappingData } = await supabaseAdmin.from('user_mappings').select('email').eq('username', username.trim().toLowerCase()).maybeSingle();
      if (!mappingData) return NextResponse.json({ error: 'ไม่พบผู้ใช้' }, { status: 404 });

      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
      const authUser = users.find(u => u.email === mappingData.email);
      if (!authUser) return NextResponse.json({ error: 'ไม่พบบัญชี' }, { status: 404 });

      const { error } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, { password: new_password });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'fetch') {
      const { data: mappings } = await supabaseAdmin.from('user_mappings').select('*').order('username');
      const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (authError) throw authError;

      const combined = (mappings || []).map(m => {
        const authUser = users.find(u => u.email === m.email);
        return {
          username: m.username,
          email: m.email,
          auth_id: authUser?.id || null,
          is_banned: authUser?.banned_until != null,
        };
      });

      if (combined.length === 0 && users.length > 0) {
          const fallbackUsers = users.map(u => ({
            username: u.email?.split('@')[0] || 'Unknown',
            email: u.email,
            auth_id: u.id,
            is_banned: u.banned_until != null
          }));
          return NextResponse.json({ users: fallbackUsers });
      }
      return NextResponse.json({ users: combined });
    }

    if (action === 'create') {
      const { username, password, email } = body;
      const cleanUsername = username.trim().toLowerCase();
      const finalEmail = email ? email.trim() : `${cleanUsername}@jarungphat.com`;

      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: finalEmail, password: password, email_confirm: true,
      });
      if (authError) throw authError;

      await supabaseAdmin.from('user_mappings').insert([{ username: cleanUsername, email: finalEmail }]);
      return NextResponse.json({ success: true, user: { auth_id: authData.user?.id } });
    }

    if (action === 'update') {
      const { auth_id, username, password, email } = body;
      const updates: any = {};
      if (email && email.trim() !== '') updates.email = email.trim();
      if (password && password.trim() !== '') updates.password = password.trim(); 

      if (auth_id && Object.keys(updates).length > 0) {
         const { error } = await supabaseAdmin.auth.admin.updateUserById(auth_id, updates);
         if (error) throw error;
      }
      if (updates.email) {
         const { error } = await supabaseAdmin.from('user_mappings').update({ email: updates.email }).eq('username', username);
         if (error) throw error;
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'toggle_status') {
      const { auth_id, is_banned } = body;
      const { error } = await supabaseAdmin.auth.admin.updateUserById(auth_id, { ban_duration: is_banned ? 'none' : '876000h' });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'delete') {
      const { auth_id, username } = body;
      if (auth_id) {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(auth_id);
        if (error) throw error;
      }
      await supabaseAdmin.from('user_mappings').delete().eq('username', username);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Action not found' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
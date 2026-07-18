import { supabase } from './supabase';

export type AuditActionType = 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'LOGIN'  
  | 'LOGOUT' 
  | 'EXPORT' 
  | 'VIEW'   
  | 'APPROVE'
  | 'REJECT' 
  | 'SECURITY';

interface LogParams {
  module: string;            
  action: AuditActionType;   
  details: string;           
  username?: string;         
}

export const logAudit = async ({ module, action, details, username }: LogParams): Promise<void> => {
  try {
    let currentUser = username;

    if (!currentUser) {
      const { data: { session } } = await supabase.auth.getSession();
      currentUser = session?.user?.user_metadata?.username 
        || session?.user?.email?.split('@')[0] 
        || 'System_Guest';
    }

    await supabase.from('activity_logs').insert([{
      username: currentUser,
      module: module,
      action: action,
      details: details,
      created_at: new Date().toISOString()
    }]);

  } catch (error) {
    console.error('🚨 Audit Logger Error:', error);
  }
};
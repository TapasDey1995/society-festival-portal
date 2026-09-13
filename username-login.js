import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import './export-reports.js?v=20260916';

const SUPABASE_URL='https://suvwxkjytbmpxaqovulq.supabase.co';
const SUPABASE_KEY='sb_publishable_lY775k5ntfdC5TnfhfBJLg_ioQaD1iY';
const USERNAME_EMAILS={
  tapas:'tapas@meenaorchid.local',
  committee:'committee@meenaorchid.local'
};
const authClient=createClient(SUPABASE_URL,SUPABASE_KEY);

const form=document.getElementById('authForm');
if(form){
  form.onsubmit=async event=>{
    event.preventDefault();
    const username=document.getElementById('loginUser').value.trim().toLowerCase();
    const password=document.getElementById('password').value;
    const message=document.getElementById('authMessage');
    const button=form.querySelector('button[type="submit"]');
    const email=USERNAME_EMAILS[username];

    if(!email){
      message.textContent='Invalid username or password.';
      return;
    }

    button.disabled=true;
    message.textContent='Signing in…';
    try{
      const {error}=await authClient.auth.signInWithPassword({email,password});
      if(error) throw error;
      message.textContent='Login successful.';
      document.getElementById('authPanel').classList.add('hidden');
      // Let the existing portal auth/session logic refresh the UI.
      window.dispatchEvent(new Event('portal-auth-changed'));
      if(typeof window.refreshAuth==='function') await window.refreshAuth();
      else window.location.reload();
    }catch(error){
      console.error('Committee login failed:',error);
      message.textContent='Invalid username or password.';
    }finally{
      button.disabled=false;
    }
  };
}

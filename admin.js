/* RM Veículos — painel Spark com Firebase Auth + Firestore.
   A autenticação depende do Firebase e das regras do banco; não existe senha no código. */
import {configured,auth,db,persistenceReady} from './firebase-client.js';
import {signInWithEmailAndPassword,signOut,onAuthStateChanged,sendPasswordResetEmail} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js';
import {collection,doc,getDoc,query,orderBy,onSnapshot,setDoc,updateDoc,deleteDoc,serverTimestamp} from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';

const U=globalThis.RMStore;
const el=id=>document.getElementById(id);
const {escapeHtml:esc,safePhoto,priceBRL,parsePrice,toast,PLACEHOLDER}=U;
const dashboard=el('admin-content'),login=el('admin-login'),logout=el('admin-logout');
const loginErr=el('admin-login-error');
const IDLE_MS=3*60*1000;
let activeUser=null,editingId=null,pendingLogin=false,closing=false,lastWrite=0;
let unsubCars=null,unsubLeads=null,interval=null,initialLeads=true,vehicles=[],leads=[];
const DESKTOP_NOTIFICATIONS_KEY='rm_desktop_alerts_on';
const fields={brand:'nv-brand',model:'nv-model',condition:'nv-condition',category:'nv-category',year:'nv-year',km:'nv-km',transmission:'nv-transmission',fuel:'nv-fuel',color:'nv-color',description:'nv-desc'};
const lastKey=uid=>`rm_admin_last_activity_${uid}`;
const sessionTime=uid=>Number(localStorage.getItem(lastKey(uid)))||0;

function showError(message){loginErr.textContent=message;loginErr.hidden=false;}
function showLogin(){dashboard.hidden=true;login.hidden=false;logout.hidden=true;el('session-info').hidden=true;}
function renderDashboard(){
  const available=vehicles.filter(c=>!c.sold),sold=vehicles.filter(c=>c.sold);
  el('stat-available-cars').textContent=String(available.length);
  el('stat-sold-cars').textContent=String(sold.length);
  el('stat-stock-value').textContent=priceBRL(available.reduce((acc,c)=>acc+parsePrice(c.price),0));
  el('stat-total-leads').textContent=String(leads.length);
  renderCars();renderLeads();
}
function renderCars(){
  const search=el('admin-search').value.toLocaleLowerCase('pt-BR').trim();
  const list=vehicles.filter(c=>`${c.brand} ${c.model} ${c.year}`.toLocaleLowerCase('pt-BR').includes(search));
  el('admin-vehicles-list').innerHTML=list.length?list.map(c=>`<article class="admin-car-item"><img class="admin-car-img" src="${esc(safePhoto(c.photo))}" alt="${esc(`${c.brand} ${c.model}`)}" loading="lazy" onerror="this.onerror=null;this.src='${PLACEHOLDER}'"><div class="admin-car-content"><span class="vehicle-brand">${esc(c.brand)} • ${esc(c.sold?'VENDIDO':c.condition)}</span><h3>${esc(c.model)}</h3><p>${esc(c.year)} · ${esc(c.km)} · ${esc(c.category)}</p><strong class="admin-car-price">${esc(priceBRL(c.price))}</strong><div class="inventory-admin-actions"><button type="button" data-car-action="edit" data-id="${esc(c.id)}">Editar</button><button type="button" class="mark-sold" data-car-action="sold" data-id="${esc(c.id)}">${c.sold?'Reativar':'Vendido'}</button><button type="button" class="remove-car" data-car-action="delete" data-id="${esc(c.id)}">Excluir</button></div></div></article>`).join(''):'<div class="admin-empty">Nenhum veículo cadastrado ou encontrado.</div>';
}
function dateText(value){return value?.toDate?.().toLocaleString('pt-BR')||'Agora';}
function renderLeads(){
  const count=leads.filter(l=>l.status==='Novo').length;
  const badge=el('new-leads-badge');badge.textContent=`${count} ${count===1?'nova':'novas'}`;badge.hidden=count===0;
  el('admin-leads-list').innerHTML=leads.length?leads.map(l=>{
    const phone=String(l.phone||'').replace(/\D/g,'');
    const message=`Olá, ${l.name}! Aqui é da RM Veículos. Recebemos sua proposta para ${l.vehicle}. Podemos conversar?`;
    const url=phone.length>=10&&phone.length<=11?`https://wa.me/55${phone}?text=${encodeURIComponent(message)}`:'#';
    return `<article class="admin-lead-item ${l.status==='Novo'?'lead-unread':''}"><div class="lead-header"><div><strong>${esc(l.name)}</strong><small>${esc(l.phone)} · ${esc(l.status||'Novo')}</small></div><time>${esc(dateText(l.createdAt))}</time></div><p><b>Veículo:</b> ${esc(l.vehicle)}</p><p><b>Entrada:</b> ${esc(l.entry||'A combinar')} · <b>Troca:</b> ${esc(l.trade||'Não')}</p>${l.notes?`<p><b>Observação:</b> ${esc(l.notes)}</p>`:''}<div class="lead-actions"><a href="${url}" target="_blank" rel="noopener noreferrer" ${url==='#'?'aria-disabled="true"':''}>Responder ↗</a><button type="button" class="finish-lead" data-lead-action="finish" data-id="${esc(l.id)}">${l.status==='Concluído'?'Reabrir':'Concluir'}</button><button type="button" class="delete-lead" data-lead-action="delete" data-id="${esc(l.id)}">Excluir</button></div></article>`;
  }).join(''):'<div class="admin-empty">Nenhuma proposta recebida até agora.</div>';
}
function showDesktopAlert(count){
  // Apenas enquanto a pagina do painel estiver aberta e com sessao valida.
  if(!activeUser||closing||localStorage.getItem(DESKTOP_NOTIFICATIONS_KEY)!=='yes')return;
  if(!('Notification' in window)||Notification.permission!=='granted')return;
  try{
    const n=new Notification('RM Veículos • Nova proposta', {
      body: count===1?'Uma proposta chegou pelo site. Abra o painel para conferir.':`${count} propostas chegaram pelo site.`,
      icon:'assets/favicon.svg', tag:'rm-new-proposals'
    });
    n.onclick=()=>{window.focus();n.close();};
  }catch(err){console.warn('Aviso do navegador indisponível:',err);}
}
function syncAlertButton(){
  const button=el('enable-notifications');
  if(!('Notification' in window)){
    button.textContent='🔔 Avisos apenas no painel';button.disabled=true;return;
  }
  button.textContent=localStorage.getItem(DESKTOP_NOTIFICATIONS_KEY)==='yes'&&Notification.permission==='granted'
    ? '🔔 Avisos ativados (desativar)' : '🔔 Avisar neste navegador';
}
function stopListening(){unsubCars?.();unsubLeads?.();unsubCars=null;unsubLeads=null;if(interval)clearInterval(interval);interval=null;}
function startListening(){
  stopListening();initialLeads=true;
  const listeningSince=Date.now();
  unsubCars=onSnapshot(collection(db,'vehicles'),snap=>{
    vehicles=snap.docs.map(d=>({...d.data(),id:d.id}));
    vehicles.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    renderDashboard();
  },err=>{console.error(err);toast('Erro ao carregar o estoque. Verifique as regras do Firebase.');});
  unsubLeads=onSnapshot(query(collection(db,'leads'),orderBy('createdAt','desc')),snap=>{
    const arrivals=initialLeads?[]:snap.docChanges().filter(change =>
      change.type==='added' && change.doc.data().status==='Novo' &&
      (change.doc.data().createdAt?.toMillis?.() || 0) >= listeningSince
    );
    leads=snap.docs.map(d=>({...d.data(),id:d.id}));
    renderDashboard();
    if(arrivals.length){
      toast(arrivals.length===1?'🔔 Nova proposta recebida no site!':`🔔 ${arrivals.length} novas propostas recebidas!`);
      showDesktopAlert(arrivals.length);
    }
    initialLeads=false;
  },err=>{console.error(err);toast('Erro ao carregar as propostas. Confira as permissões do Firebase.');});
}
function recordActivity(force=false){
  if(!activeUser||closing)return;
  const now=Date.now(),timestamp=sessionTime(activeUser.uid);
  if(!timestamp||now-timestamp>=IDLE_MS){expireSession();return;}
  if(force||now-lastWrite>2000){localStorage.setItem(lastKey(activeUser.uid),String(now));lastWrite=now;}
}
function tick(){
  if(!activeUser||closing)return;
  const remaining=IDLE_MS-(Date.now()-sessionTime(activeUser.uid));
  if(remaining<=0){expireSession();return;}
  const seconds=Math.ceil(remaining/1000);
  el('session-remaining').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
}
async function expireSession(){
  if(closing)return;closing=true;stopListening();
  if(activeUser)localStorage.removeItem(lastKey(activeUser.uid));
  activeUser=null;
  try{await signOut(auth);}catch(err){console.error('Erro ao encerrar sessão:',err);}
  window.location.replace('index.html?adminSession=expired');
}
function bindActivity(){
  for(const event of ['pointerdown','keydown','touchstart','scroll'])window.addEventListener(event,()=>recordActivity(),{passive:true});
  window.addEventListener('focus',()=>{tick();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)tick();});
  window.addEventListener('storage',event=>{
    if(activeUser && event.key===lastKey(activeUser.uid)){if(event.newValue===null)expireSession();else tick();}
  });
}
async function enterPanel(user){
  if(closing)return;
  const adminDoc=await getDoc(doc(db,'admins',user.uid));
  if(!adminDoc.exists() || adminDoc.data().active!==true){
    await signOut(auth);showLogin();showError('Esta conta não tem acesso administrativo. Autorize o UID na coleção admins do Firebase.');return;
  }
  if(pendingLogin){localStorage.setItem(lastKey(user.uid),String(Date.now()));pendingLogin=false;}
  const last=sessionTime(user.uid);
  if(!last || Date.now()-last>=IDLE_MS){
    await expireSession();return;
  }
  activeUser=user;
  login.hidden=true;dashboard.hidden=false;logout.hidden=false;el('session-info').hidden=false;
  el('admin-pass').value='';loginErr.hidden=true;
  startListening();tick();interval=setInterval(tick,1000);
  syncAlertButton();
}
if(!configured){
  el('admin-config-warning').hidden=false;
  showError('Preencha firebase-config.js antes de utilizar o painel.');
  el('admin-login-submit').disabled=true;
}else{
  bindActivity();
  await persistenceReady;
  onAuthStateChanged(auth,async user=>{
    if(closing)return;
    if(!user){stopListening();activeUser=null;showLogin();return;}
    try{if(!activeUser||activeUser.uid!==user.uid)await enterPanel(user);}
    catch(err){console.error(err);showLogin();showError('Não foi possível verificar a permissão do administrador. Confira a configuração e as regras do Firebase.');}
  });
}
el('admin-login-form').addEventListener('submit',async ev=>{
  ev.preventDefault();if(!configured)return;
  loginErr.hidden=true;
  const email=el('admin-email').value.trim(),password=el('admin-pass').value;
  const button=el('admin-login-submit');button.disabled=true;pendingLogin=true;
  try{await persistenceReady;await signInWithEmailAndPassword(auth,email,password);}
  catch(err){pendingLogin=false;console.warn('Falha no login:',err.code);showError('E-mail ou senha incorretos, ou conta indisponível.');}
  finally{button.disabled=false;el('admin-pass').value='';}
});
el('admin-reset-pass').addEventListener('click',async()=>{
  if(!configured)return;
  const email=el('admin-email').value.trim();
  if(!email){showError('Digite o e-mail administrativo para solicitar a troca de senha.');return;}
  try{await sendPasswordResetEmail(auth,email);toast('Se o e-mail estiver cadastrado, você receberá as instruções de redefinição.');}
  catch(err){console.error(err);toast('Não foi possível solicitar a redefinição. Tente novamente.');}
});
logout.addEventListener('click',async()=>{if(activeUser)localStorage.removeItem(lastKey(activeUser.uid));closing=true;stopListening();try{await signOut(auth);}finally{window.location.replace('index.html');}});
el('admin-search').addEventListener('input',renderCars);
el('admin-vehicles-list').addEventListener('click',async ev=>{
  const button=ev.target.closest('[data-car-action]');if(!button||!activeUser)return;
  const {carAction:action,id}=button.dataset;
  const car=vehicles.find(c=>c.id===id);if(!car)return;
  if(action==='edit')return startEdit(car);
  button.disabled=true;
  try{
    if(action==='sold') {await updateDoc(doc(db,'vehicles',id),{sold:!car.sold,updatedAt:serverTimestamp()});toast('Disponibilidade atualizada!');}
    if(action==='delete'&&confirm(`Excluir permanentemente ${car.brand} ${car.model}?`)){
      await deleteDoc(doc(db,'vehicles',id));if(editingId===id)cancelEdit();toast('Anúncio excluído!');
    }
  }catch(err){console.error(err);toast('Não foi possível atualizar o veículo.');}
  finally{button.disabled=false;}
});
el('admin-leads-list').addEventListener('click',async ev=>{
  const button=ev.target.closest('[data-lead-action]');if(!button||!activeUser)return;
  const lead=leads.find(l=>l.id===button.dataset.id);if(!lead)return;
  button.disabled=true;
  try{
    if(button.dataset.leadAction==='finish')await updateDoc(doc(db,'leads',lead.id),{status:lead.status==='Concluído'?'Novo':'Concluído'});
    if(button.dataset.leadAction==='delete'&&confirm('Excluir esta proposta definitivamente?'))await deleteDoc(doc(db,'leads',lead.id));
  }catch(err){console.error(err);toast('Erro ao atualizar a proposta.');}finally{button.disabled=false;}
});
function startEdit(car){
  editingId=car.id;
  for(const [field,id] of Object.entries(fields))el(id).value=car[field]||'';
  el('nv-price').value=String(parsePrice(car.price));
  el('nv-photo-url').value=/^https:\/\//.test(car.photo||'')?car.photo:'';
  el('form-title').textContent='Editar veículo';
  el('save-car-btn').innerHTML='Salvar alterações <span aria-hidden="true">→</span>';
  el('cancel-edit').hidden=false;el('vehicle-form').scrollIntoView({behavior:'smooth',block:'center'});
  el('nv-brand').focus({preventScroll:true});
}
function cancelEdit(){
  editingId=null;el('vehicle-form').reset();el('form-title').textContent='Adicionar veículo';
  el('save-car-btn').innerHTML='Publicar veículo <span aria-hidden="true">→</span>';
  el('cancel-edit').hidden=true;
}
el('cancel-edit').addEventListener('click',cancelEdit);
el('vehicle-form').addEventListener('submit',async ev=>{
  ev.preventDefault();if(!activeUser)return;
  const button=el('save-car-btn');button.disabled=true;
  try{
    const previous=editingId?vehicles.find(c=>c.id===editingId):null;
    if(editingId&&!previous)throw new Error('O veículo não foi encontrado.');
    const payload=Object.fromEntries(Object.entries(fields).map(([field,id])=>[field,el(id).value.trim()]));
    const price=Number(el('nv-price').value);
    if(!Number.isFinite(price)||price<=0)throw new Error('Informe um preço válido.');
    const record=editingId?doc(db,'vehicles',editingId):doc(collection(db,'vehicles'));
    let photo=previous?.photo||PLACEHOLDER;
    const url=el('nv-photo-url').value.trim();
    if(url){if(!/^https:\/\//i.test(url))throw new Error('A foto precisa usar URL HTTPS.');photo=url;}
    const data={...payload,price,photo,sold:previous?.sold||false,updatedAt:serverTimestamp()};
    if(previous)await updateDoc(record,data);
    else await setDoc(record,{...data,createdAt:serverTimestamp()});
    cancelEdit();toast(previous?'Veículo atualizado com sucesso!':'Veículo cadastrado com sucesso!');
  }catch(err){console.error(err);toast(err.message||'Não foi possível salvar o veículo.');}
  finally{button.disabled=false;}
});
// Avisos de escritorio sao opcionais e so funcionam enquanto esta pagina estiver aberta.
el('enable-notifications').addEventListener('click',async()=>{
  if(!('Notification' in window))return toast('Seu navegador não oferece notificações de página. Os avisos internos continuam ativos.');
  if(localStorage.getItem(DESKTOP_NOTIFICATIONS_KEY)==='yes'){
    localStorage.removeItem(DESKTOP_NOTIFICATIONS_KEY);
    syncAlertButton();
    return toast('Avisos do navegador desativados. Os avisos no painel continuam.');
  }
  try{
    const status=await Notification.requestPermission();
    if(status!=='granted')throw new Error('Permissão de notificações não concedida.');
    localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY,'yes');
    syncAlertButton();
    toast('Avisos deste navegador ativados enquanto o painel estiver aberto!');
  }catch(err){syncAlertButton();toast(err.message||'Não foi possível ativar os avisos.');}
});

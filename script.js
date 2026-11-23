/* RM Veículos — vitrine pública. Dados vindos do Firebase Firestore em tempo real. */
(() => {
  'use strict';
  const PHONE = '5595981120335';
  const PLACEHOLDER = 'assets/car-placeholder.svg';
  let memoryStock = [];
  let toastTimeout;
  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safePhoto = value => {
    const text = String(value ?? '').trim();
    if (/^https:\/\//i.test(text)) return text;
    if (/^data:image\/(?:jpeg|png|webp);base64,[a-z\d+/=\s]+$/i.test(text)) return text;
    if (text === PLACEHOLDER) return text;
    return PLACEHOLDER;
  };
  const parsePrice = value => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    let text = String(value ?? '').replace(/[^\d,.-]/g, '').trim();
    if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
    const n = Number(text);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const priceBRL = value => new Intl.NumberFormat('pt-BR', {style:'currency',currency:'BRL',maximumFractionDigits:0}).format(parsePrice(value));
  const whatsappURL = message => `https://wa.me/${PHONE}?text=${encodeURIComponent(message)}`;
  const toast = message => {
    const el = byId('site-toast');
    if (!el) { alert(message); return; }
    el.textContent = message;
    el.classList.add('active');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => el.classList.remove('active'), 4200);
  };
  function getVehicles() {return memoryStock;}
  function setRemoteVehicles(cars) {
    memoryStock=Array.isArray(cars)?cars.filter(car=>car&&car.id):[];
    window.dispatchEvent(new Event('rm-vehicles-change'));
  }
  window.RMStore={PHONE,PLACEHOLDER,escapeHtml,safePhoto,parsePrice,priceBRL,whatsappURL,toast,getVehicles,setRemoteVehicles};

  const grid = byId('vehicles-grid');
  if (!grid) return; // admin.html usa admin.js e os utilitários compartilhados.
  let activeCarId = null;
  const modal = byId('vehicle-modal');
  const defaultError = `this.onerror=null;this.src='${PLACEHOLDER}'`;

  function renderLeadOptions() {
    const select = byId('lead-vehicle');
    if (!select) return;
    const previous = select.value;
    const options = getVehicles().filter(car => !car.sold);
    select.innerHTML = '<option value="">Selecione o veículo</option>' + options.map(car => `<option value="${escapeHtml(car.id)}">${escapeHtml(car.brand)} ${escapeHtml(car.model)} (${escapeHtml(car.year)}) — ${escapeHtml(priceBRL(car.price))}</option>`).join('');
    if (options.some(car => String(car.id) === previous)) select.value=previous;
    if (!options.length) select.innerHTML='<option value="">Nenhum veículo disponível; converse pelo WhatsApp</option>';
  }
  function createCard(car) {
    const sold = !!car.sold;
    return `<article class="vehicle-card ${sold ? 'is-sold' : ''}">
      <div class="vehicle-photo"><img loading="lazy" src="${escapeHtml(safePhoto(car.photo))}" alt="${escapeHtml(`${car.brand} ${car.model}`)}" onerror="${defaultError}"><span class="vehicle-tag ${sold?'sold':''}">${sold?'VENDIDO':escapeHtml(car.condition)}</span><span class="vehicle-category">${escapeHtml(car.category)}</span></div>
      <div class="vehicle-info"><span class="vehicle-brand">${escapeHtml(car.brand)}</span><h3>${escapeHtml(car.model)}</h3><div class="vehicle-specs"><div><small>ANO / MODELO</small><strong>${escapeHtml(car.year)}</strong></div><div><small>QUILOMETRAGEM</small><strong>${escapeHtml(car.km)}</strong></div><div><small>CÂMBIO</small><strong>${escapeHtml(car.transmission)}</strong></div></div><p class="vehicle-desc">${escapeHtml(car.description)}</p><div class="vehicle-bottom"><div class="vehicle-price"><small>VALOR ANUNCIADO</small><strong>${escapeHtml(priceBRL(car.price))}</strong></div><button type="button" class="vehicle-details" data-open-car="${escapeHtml(car.id)}" aria-label="Ver detalhes de ${escapeHtml(`${car.brand} ${car.model}`)}">↗</button></div></div>
      </article>`;
  }
  function renderVehicles() {
    const query = (byId('filter-search')?.value || '').toLocaleLowerCase('pt-BR').trim();
    const cat = byId('filter-category')?.value || 'ALL';
    const condition = byId('filter-condition')?.value || 'ALL';
    const showSold = !!byId('filter-sold')?.checked;
    const sort = byId('filter-sort')?.value || 'recent';
    const all = getVehicles();
    const filtered = all.filter(car => {
      if (!showSold && car.sold) return false;
      const searchable = `${car.brand} ${car.model} ${car.year} ${car.color} ${car.fuel}`.toLocaleLowerCase('pt-BR');
      return (!query || searchable.includes(query)) && (cat === 'ALL' || car.category === cat) && (condition === 'ALL' || car.condition === condition);
    });
    if (sort === 'price-asc') filtered.sort((a,b) => parsePrice(a.price)-parsePrice(b.price));
    if (sort === 'price-desc') filtered.sort((a,b) => parsePrice(b.price)-parsePrice(a.price));
    if (sort === 'name') filtered.sort((a,b) => `${a.brand} ${a.model}`.localeCompare(`${b.brand} ${b.model}`,'pt-BR'));
    grid.innerHTML = filtered.length ? filtered.map(createCard).join('') : '<div class="empty-state"><span aria-hidden="true">⌕</span><h3>Nenhum veículo encontrado</h3><p>Experimente ajustar os filtros ou converse com nossa equipe para encontrar uma opção.</p><button type="button" class="button button-primary" id="empty-reset">Limpar filtros →</button></div>';
    byId('vehicles-count-label').textContent = `${filtered.length} ${filtered.length === 1 ? 'veículo encontrado' : 'veículos encontrados'}`;
    const disclaimer = document.querySelector('.inventory-disclaimer');
    if (disclaimer && !all.some(car => car.demo)) disclaimer.innerHTML='<span aria-hidden="true">ⓘ</span> Consulte preço, opcionais e disponibilidade diretamente com a loja.';
  }
  function resetFilters() {
    byId('filter-search').value='';byId('filter-category').value='ALL';byId('filter-condition').value='ALL';byId('filter-sold').checked=false;byId('filter-sort').value='recent';renderVehicles();
  }
  function openVehicle(carId) {
    const car = getVehicles().find(v=>String(v.id) === String(carId));
    if (!car || !modal) return;
    activeCarId=car.id;
    const img = byId('modal-img'); img.src=safePhoto(car.photo); img.onerror=()=>{img.onerror=null;img.src=PLACEHOLDER;};
    img.alt=`${car.brand} ${car.model}`;
    const fields={'modal-badge':car.sold?'VEÍCULO VENDIDO':`${car.condition} • ${car.category}`,'modal-brand-cat':`${car.brand} • ${car.category}`,'modal-title':car.model,'modal-price':priceBRL(car.price),'modal-year':car.year,'modal-km':car.km,'modal-transmission':car.transmission,'modal-fuel-color':`${car.fuel} / ${car.color}`,'modal-desc':car.description};
    for (const [id,value] of Object.entries(fields)) byId(id).textContent=value;
    const contact=byId('modal-whatsapp-btn');
    contact.href=whatsappURL(`Olá, RM Veículos! Tenho interesse no ${car.brand} ${car.model} (${car.year}), anunciado por ${priceBRL(car.price)}. Está disponível?`);
    contact.setAttribute('aria-disabled',car.sold?'true':'false');
    contact.tabIndex=car.sold?-1:0;
    const proposal=byId('modal-simulate-btn');proposal.disabled=!!car.sold;proposal.style.opacity=car.sold?'.45':'1';
    if (!modal.open) modal.showModal();
    document.body.classList.add('modal-open');
  }
  function closeVehicle() { if (modal?.open) modal.close(); document.body.classList.remove('modal-open'); }
  grid.addEventListener('click',e => {
    const button=e.target.closest('[data-open-car]');
    if (button) openVehicle(button.dataset.openCar);
    if (e.target.closest('#empty-reset')) resetFilters();
  });
  byId('modal-close')?.addEventListener('click',closeVehicle);
  modal?.addEventListener('close',()=>document.body.classList.remove('modal-open'));
  modal?.addEventListener('click',e=>{if(e.target===modal) closeVehicle();});
  byId('modal-simulate-btn')?.addEventListener('click',()=>{
    const carId=activeCarId;closeVehicle();renderLeadOptions();
    const select=byId('lead-vehicle');if(select && getVehicles().some(v=>v.id===carId && !v.sold))select.value=carId;
    byId('financiamento').scrollIntoView({behavior:'smooth'});
    setTimeout(()=>byId('lead-name')?.focus({preventScroll:true}),250);
  });
  ['filter-search','filter-category','filter-condition','filter-sold','filter-sort'].forEach(id=>byId(id)?.addEventListener(id==='filter-search'?'input':'change',renderVehicles));
  byId('search-form')?.addEventListener('submit',e=>{e.preventDefault();renderVehicles();byId('estoque').scrollIntoView({behavior:'smooth'});});
  byId('clear-filters')?.addEventListener('click',resetFilters);
  const phoneInput=byId('lead-phone');
  phoneInput?.addEventListener('input',()=>{
    const digits=phoneInput.value.replace(/\D/g,'').slice(0,11);
    phoneInput.value=digits.length>10?`(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`:digits.length>6?`(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`:digits.length>2?`(${digits.slice(0,2)}) ${digits.slice(2)}`:digits;
  });
  byId('lead-form')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const form=e.currentTarget;
    const name=byId('lead-name').value.trim(), phone=byId('lead-phone').value.trim(),digits=phone.replace(/\D/g,''),carId=byId('lead-vehicle').value;
    const car=getVehicles().find(v=>String(v.id)===carId && !v.sold);
    if (name.length<2 || !/^\d{10,11}$/.test(digits)) {toast('Informe seu nome e um WhatsApp válido com DDD.');return;}
    if (!car) {toast('Selecione um veículo disponível no estoque.');return;}
    if (!byId('lead-consent').checked) {toast('Confirme que está ciente do envio dos dados.');return;}
    const entry=byId('lead-entry').value.trim(),trade=byId('lead-trade').value,notes=byId('lead-notes').value.trim();
    const title=`${car.brand} ${car.model} (${car.year})`;
    const message=`Olá, RM Veículos! Quero conversar sobre uma proposta:\n\n*Nome:* ${name}\n*WhatsApp:* ${phone}\n*Veículo:* ${title}\n*Preço anunciado:* ${priceBRL(car.price)}\n*Entrada desejada:* ${entry||'A combinar'}\n*Carro na troca:* ${trade}${notes?`\n*Observações:* ${notes}`:''}`;
    const submitButton=form.querySelector('[type="submit"]');
    if(submitButton)submitButton.disabled=true;
    // Abre uma aba como resultado direto do clique; após salvar, redireciona para WhatsApp.
    const popup=window.open('about:blank','_blank');
    try {
      if(!window.RMRemote?.submitLead) throw new Error('A conexão com o Firebase ainda está carregando. Tente novamente.');
      await window.RMRemote.submitLead({name,phone,vehicle:title,vehicleId:car.id,entry:entry||'A combinar',trade,notes});
      toast('Proposta recebida pela loja! Confira a mensagem no WhatsApp.');
      form.reset();renderLeadOptions();
      if(popup){popup.opener=null;popup.location.replace(whatsappURL(message));}
      else {window.location.assign(whatsappURL(message));}
    } catch(error) {
      if(popup)popup.close();
      console.error('Erro ao receber proposta:',error);
      toast(error?.message?.includes('Firebase')?error.message:'Não foi possível enviar a proposta. Tente novamente ou entre em contato pelo WhatsApp.');
    } finally {if(submitButton)submitButton.disabled=false;}
  });
  const menuButton=document.querySelector('.menu-toggle'),mobileNav=byId('mobile-nav');
  const closeMenu=()=>{if(!menuButton||!mobileNav)return;mobileNav.hidden=true;menuButton.setAttribute('aria-expanded','false');menuButton.setAttribute('aria-label','Abrir menu');};
  menuButton?.addEventListener('click',()=>{mobileNav.hidden=!mobileNav.hidden;menuButton.setAttribute('aria-expanded',String(!mobileNav.hidden));menuButton.setAttribute('aria-label',mobileNav.hidden?'Abrir menu':'Fechar menu');});
  mobileNav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
  byId('current-year').textContent=new Date().getFullYear();
  renderVehicles();renderLeadOptions();
  window.addEventListener('rm-vehicles-change',()=>{renderVehicles();renderLeadOptions();});
})();

/* Leitura em tempo real da vitrine e envio de propostas para o Firestore. */
import { configured, db } from './firebase-client.js';
import { collection, addDoc, onSnapshot, serverTimestamp } from 'https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js';
const U = globalThis.RMStore;
if (!configured) {
  U?.setRemoteVehicles([]);
  const label = document.getElementById('vehicles-count-label');
  if (label) label.textContent = 'Estoque aguardando configuração do Firebase';
  console.warn('Configure firebase-config.js antes de publicar.');
} else {
  onSnapshot(collection(db, 'vehicles'), snapshot => {
    const cars = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    cars.sort((a,b) => (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
    U?.setRemoteVehicles(cars);
  }, err => {
    console.error('Erro ao carregar veículos:',err);
    const label = document.getElementById('vehicles-count-label');
    if (label) label.textContent='Não foi possível carregar o estoque. Tente novamente.';
  });
}
globalThis.RMRemote = {
  configured,
  async submitLead(lead) {
    if (!configured) throw new Error('O site ainda não está conectado ao Firebase.');
    const payload = {
      name: String(lead.name).trim().slice(0,100),
      phone: String(lead.phone).trim().slice(0,25),
      vehicle: String(lead.vehicle).slice(0,160),
      vehicleId: String(lead.vehicleId).slice(0,120),
      entry: String(lead.entry || 'A combinar').slice(0,100),
      trade: String(lead.trade || 'Não').slice(0,60),
      notes: String(lead.notes || '').slice(0,1000),
      status: 'Novo',
      createdAt: serverTimestamp()
    };
    return addDoc(collection(db,'leads'),payload);
  }
};

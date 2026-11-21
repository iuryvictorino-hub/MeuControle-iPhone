'use strict';
const $ = selector => document.querySelector(selector);
const F = window.Finance;
const KEY = 'meu-controle-v3';
const OLD_KEY = 'meu-controle-v2';
const LEGACY_KEY = 'meu-controle-v1';
const COLORS = ['#6d32bb','#9a66d5','#bda0e6','#d6bcef','#8e78ca','#b8a0d0','#d9c2e8','#d7c6f2'];
const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const viewCopy = {
  home:['Seu dinheiro, do seu jeito.','Veja o que você tem, recebeu e gastou.'],
  food:['Seu vale-alimentação.','Recargas e gastos separados da conta principal.'],
  transactions:['Suas movimentações.','Tudo o que entrou, saiu ou ainda está planejado.'],
  annual:['Planeje os próximos meses.','Acompanhe o saldo acumulado do ano inteiro.'],
  limits:['Gaste com consciência.','Organize seus limites por categoria.'],
  tools:['Simule seu dinheiro.','Atrasos, investimentos, financiamentos e consórcios em um só lugar.'],
  settings:['Ajustes e segurança.','Configure seu saldo inicial e proteja os registros.']
};
let state = {version:3,entries:[],budgets:{},openingBalances:{main:0,food:0}};
let editId = null;
let storageLocked = false;
let activeView = 'home';
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), n=>n.toString(16).padStart(2,'0')).join('');
}
function load() {
  try {
    let raw = localStorage.getItem(KEY);
    if (raw !== null) {
      const parsed=JSON.parse(raw);
      if (!F.stateValid(parsed)) throw Error('Formato inválido');
      state=parsed;
      return;
    }
    raw=localStorage.getItem(OLD_KEY);
    if (raw !== null) {
      state=F.normalizeBackup(JSON.parse(raw));
      localStorage.setItem(KEY,JSON.stringify(state));
      return;
    }
    raw=localStorage.getItem(LEGACY_KEY);
    if (raw !== null) {
      const old=JSON.parse(raw);
      state=F.normalizeBackup({version:1,entries:old});
      localStorage.setItem(KEY,JSON.stringify(state));
    }
  } catch (_) {
    storageLocked=true;
    alert('Não foi possível ler os dados existentes. Por segurança, novos registros ficam bloqueados até restaurar uma cópia JSON válida. Seus dados anteriores não foram apagados.');
  }
}
function toast(text) {
  const box=$('#toast');box.textContent=text;box.style.display='block';
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>box.style.display='none',3500);
}
function save(next, restoring=false) {
  if(!F.stateValid(next)){alert('Dados inválidos ou limite de registros atingido.');return false;}
  if(storageLocked&&!restoring){alert('Armazenamento bloqueado. Restaure uma cópia JSON antes de continuar.');return false;}
  try {
    localStorage.setItem(KEY,JSON.stringify(next));state=next;storageLocked=false;
    render();return true;
  } catch (_) {alert('Não foi possível salvar no aparelho. Verifique o espaço disponível.');return false;}
}
function currentMonth(){return $('#month').value;}
function money(value){return F.money(value);}
function formatDate(date){return `${date.slice(8)}/${date.slice(5,7)}/${date.slice(0,4)}`;}
function td(row,content,className){const cell=document.createElement('td');if(className)cell.className=className;if(typeof content==='string')cell.textContent=content;row.append(cell);return cell;}
function btn(label,callback,className=''){const button=document.createElement('button');button.type='button';button.textContent=label;if(className)button.className=className;button.onclick=callback;return button;}
function isAccount(e,account){return F.accountOf(e)===account;}
function accountName(account){return account==='food'?'Vale-alimentação':'Conta principal';}
function paymentName(e){return F.paymentName(e.paymentMethod);}
function bankName(e){return e.bank ? ` • ${e.bank}` : ''; }
function byDate(items){return items.slice().sort((a,b)=>b.date.localeCompare(a.date)||a.description.localeCompare(b.description));}
function amountText(entry){return (entry.type==='expense'?'− ':'+ ')+money(entry.amount);}
function monthAccount(month,account){return state.entries.filter(e=>isAccount(e,account)&&e.date.slice(0,7)===month);}
function deleteEntry(e){
  if(!state.entries.some(x=>x.id===e.id)){toast('Lançamento não encontrado.');return false;}
  if(!confirm(`Excluir somente “${e.description}” de ${formatDate(e.date)}?`))return false;
  if(!save({...state,entries:state.entries.filter(x=>x.id!==e.id)}))return false;
  toast('Lançamento excluído.');return true;
}
function deleteSeries(e){
  if(!e.seriesId)return false;
  const count=state.entries.filter(x=>x.seriesId===e.seriesId).length;
  if(!count){toast('Série não encontrada.');return false;}
  if(!confirm(`Excluir TODOS os ${count} lançamentos desta série, inclusive nos outros meses?`))return false;
  if(!save({...state,entries:state.entries.filter(x=>x.seriesId!==e.seriesId)}))return false;
  toast('Série excluída.');return true;
}
function switchView(view){
  if(!viewCopy[view])return;
  activeView=view;
  document.querySelectorAll('.screen').forEach(section=>section.hidden=section.id!==`view-${view}`);
  document.querySelectorAll('[data-view]').forEach(button=>{
    const selected=button.dataset.view===view;
    button.classList.toggle('active',selected);
    if(selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  });
  $('#screenTitle').textContent=viewCopy[view][0];
  $('#screenSubtitle').textContent=viewCopy[view][1];
  $('#monthToolbar').hidden=view==='settings'||view==='tools';
  window.scrollTo({top:0,behavior:'auto'});
}
function render(){renderMonth();renderAnnual();renderBudgets();renderOpening();}
function renderMonth(){
  const month=currentMonth();
  const main=F.monthTotals(state.entries,month,'main');
  const food=F.monthTotals(state.entries,month,'food');
  $('#summaryMonth').textContent=MONTH_NAMES[Number(month.slice(5))-1].toLowerCase();
  $('#balance').textContent=money(F.cumulativeBalance(state.entries,month,'main',state.openingBalances.main));
  $('#forecastBalance').textContent=money(F.cumulativeBalance(state.entries,month,'main',state.openingBalances.main,true));
  $('#openingMonth').textContent=money(F.openingMonthBalance(state.entries,month,'main',state.openingBalances.main));
  $('#income').textContent=money(main.income);$('#expense').textContent=money(main.expense);
  $('#received').textContent=money(main.received);$('#paid').textContent=money(main.paid);
  $('#realizedBalance').textContent=money(main.realized);
  $('#incomeCount').textContent='Já recebido: '+money(main.received);
  $('#expenseCount').textContent='Já pago: '+money(main.paid);
  $('#foodBalance').textContent=money(F.cumulativeBalance(state.entries,month,'food',state.openingBalances.food));
  $('#foodForecast').textContent=money(F.cumulativeBalance(state.entries,month,'food',state.openingBalances.food,true));
  $('#foodStart').textContent=money(F.openingMonthBalance(state.entries,month,'food',state.openingBalances.food));
  $('#foodPreviewBalance').textContent=$('#foodBalance').textContent;
  $('#foodIncome').textContent=money(food.income);$('#foodExpense').textContent=money(food.expense);
  renderRecent($('#homeRecent'),byDate(monthAccount(month,'main')).slice(0,5),false);
  const foodEntries=byDate(monthAccount(month,'food'));
  renderRecent($('#foodRows'),foodEntries,true);
  $('#foodEmpty').hidden=foodEntries.length>0;
  $('#foodCount').textContent=`${foodEntries.length} movimentação(ões) • ${food.done} realizada(s), ${food.pending} planejada(s)`;
  renderTransactions();renderCategoryChart();
}
function renderRecent(target,items,editable){
  target.replaceChildren();
  if(!items.length&&!editable){const p=document.createElement('p');p.className='quiet-empty';p.textContent='Ainda não há movimentações neste mês.';target.append(p);}
  for(const e of items){
    const row=document.createElement('div');row.className='recent-row';
    const icon=document.createElement('span');icon.className='recent-icon'+(e.type==='income'?' is-income':'');icon.textContent=e.type==='income'?'↓':'↑';
    const body=document.createElement('div');body.className='recent-body';
    const name=document.createElement('b');name.textContent=e.description;
    const detail=document.createElement('small');detail.textContent=`${formatDate(e.date)} • ${e.category} • ${paymentName(e)}${bankName(e)}${e.status==='planned'?' • Planejado':''}`;
    body.append(name,detail);
    const amount=document.createElement('div');amount.className='recent-amount '+(e.type==='income'?'positive':'negative');amount.textContent=amountText(e);
    if(editable){const action=document.createElement('small');action.append(btn('Editar',()=>openForm(e),'text-btn'));amount.append(action);}
    row.append(icon,body,amount);target.append(row);
  }
}
function renderTransactions(){
  const month=currentMonth(), account=$('#extractAccount').value;
  const monthly=state.entries.filter(e=>e.date.slice(0,7)===month&&(account==='all'||isAccount(e,account)));
  const term=$('#search').value.toLocaleLowerCase('pt-BR');
  const list=byDate(monthly.filter(e=>($('#filter').value==='all'||e.type===$('#filter').value)&&
    ($('#statusFilter').value==='all'||e.status===$('#statusFilter').value)&&
    ($('#paymentFilter').value==='all'||(e.paymentMethod||'unspecified')===$('#paymentFilter').value)&&
    (e.description.toLocaleLowerCase('pt-BR').includes(term)||e.category.toLocaleLowerCase('pt-BR').includes(term)||(e.bank||'').toLocaleLowerCase('pt-BR').includes(term))));
  $('#rows').replaceChildren();
  for(const e of list){
    const row=document.createElement('tr'),description=td(row,e.description);
    const detail=document.createElement('small');
    let extra=`${accountName(F.accountOf(e))} • ${e.category} • ${paymentName(e)}${bankName(e)}`;
    if(e.installmentNo)extra+=` • Parcela ${e.installmentNo}/${e.installmentTotal}`;
    if(e.paymentMethod==='credit' && e.creditInterestPercent>0)extra+=` • Juros totais ${String(e.creditInterestPercent).replace('.',',')}%`;
    else if(e.repeatKind==='fixed')extra+=' • Fixo mensal';
    detail.textContent=extra;description.append(detail);
    td(row,formatDate(e.date));
    const status=td(row,'');const badge=document.createElement('span');
    badge.className='status '+(e.status==='done'?'status-done':'status-planned');
    badge.textContent=e.status==='done'?(e.type==='income'?'Recebido':'Pago'):'Planejado';status.append(badge);
    td(row,amountText(e),e.type==='income'?'positive':'negative');
    const action=td(row,'','action-cell');
    action.append(btn(e.status==='done'?'Desfazer realização':(e.type==='income'?'Marcar recebido':'Marcar pago'),()=>{
      const updated=state.entries.map(x=>x.id===e.id?{...x,status:e.status==='done'?'planned':'done'}:x);
      if(save({...state,entries:updated}))toast('Situação atualizada.');
    },'mark-btn'));
    if(e.type==='expense' && e.status==='planned' && e.date<today()) {
      action.append(btn('Calcular atraso',()=>{
        $('#latePrincipal').value=(e.amount/100).toFixed(2).replace('.',',');
        $('#lateDue').value=e.date;
        $('#latePaid').value=today();
        switchView('tools');runLateCalculation();
      },'late-shortcut'));
    }
    action.append(btn('Editar',()=>openForm(e)));
    action.append(btn('Excluir',()=>deleteEntry(e),'delete-btn'));
    if(e.seriesId)action.append(btn('Excluir série',()=>deleteSeries(e),'delete-series-btn'));
    $('#rows').append(row);
  }
  $('#empty').hidden=list.length>0;
  if(!list.length){
    $('#empty h3').textContent=monthly.length?'Nada encontrado':'Seu extrato começa aqui';
    $('#empty p').textContent=monthly.length?'Experimente alterar a busca ou os filtros.':'Adicione uma movimentação para acompanhar o dinheiro.';
  }
  const done=monthly.filter(e=>e.status==='done').length;
  $('#count').textContent=`${list.length} de ${monthly.length} lançamento(s) • ${done} realizado(s), ${monthly.length-done} planejado(s)`;
}
function renderCategoryChart(){
  const month=currentMonth(),expenses=monthAccount(month,'main').filter(e=>e.type==='expense');
  const total=expenses.reduce((s,e)=>s+e.amount,0);
  const categories=F.expenseCategories.map(cat=>({cat,value:expenses.filter(e=>e.category===cat).reduce((s,e)=>s+e.amount,0)})).filter(v=>v.value>0).sort((a,b)=>b.value-a.value);
  let offset=0;
  const gradient=categories.map((item,i)=>{const begin=offset;offset+=100*item.value/total;return `${COLORS[i]} ${begin}% ${offset}%`;}).join(',');
  $('#chart').replaceChildren();const donut=document.createElement('div');donut.className='donut';
  donut.style.background=total?`conic-gradient(${gradient})`:'#eee8f3';
  const center=document.createElement('div');center.className='donut-center';
  const caption=document.createElement('small');caption.textContent='Despesas do mês';
  const number=document.createElement('b');number.textContent=money(total);
  center.append(caption,number);donut.append(center);$('#chart').append(donut);
  $('#legend').replaceChildren();
  if(!categories.length){const p=document.createElement('p');p.textContent='As categorias aparecem depois do primeiro gasto na conta principal.';$('#legend').append(p);}
  categories.forEach((item,i)=>{
    const row=document.createElement('div');row.className='legend-row';const dot=document.createElement('i');dot.style.background=COLORS[i];
    const name=document.createElement('span');name.textContent=item.cat;const amount=document.createElement('strong');amount.textContent=money(item.value);
    row.append(dot,name,amount);$('#legend').append(row);
  });
}
function renderAnnual(){
  const year=Number($('#year').value),account=$('#planAccount').value;
  if(!Number.isInteger(year)||year<1900||year>2100)return;
  const summary=F.yearlyTotals(state.entries,year,account,state.openingBalances[account]);
  $('#annualTotals').replaceChildren();
  [['Saldo disponível em dezembro',summary.total.endRealized],['Saldo previsto em dezembro',summary.total.endProjected],['Entradas no ano',summary.total.income],['Saídas no ano',summary.total.expense]].forEach(([label,value])=>{
    const block=document.createElement('div'),small=document.createElement('span'),strong=document.createElement('b');
    small.textContent=label;strong.textContent=money(value);block.append(small,strong);$('#annualTotals').append(block);
  });
  $('#yearGrid').replaceChildren();
  for(const [index,item] of summary.months.entries()){
    const card=document.createElement('button');card.type='button';card.className='month-card'+(item.month===currentMonth()?' selected':'');
    card.setAttribute('aria-label',`${MONTH_NAMES[index]}: saldo previsto acumulado ${money(item.runningProjected)}, disponível ${money(item.runningRealized)}. Abrir extrato.`);
    const title=document.createElement('span');title.textContent=MONTH_NAMES[index];
    const amount=document.createElement('strong');amount.textContent=money(item.runningProjected);
    const caption=document.createElement('small');caption.textContent='Saldo previsto acumulado';
    const actual=document.createElement('em');actual.textContent=`Disponível: ${money(item.runningRealized)}`;
    card.append(title,amount,caption,actual);
    card.onclick=()=>{setMonth(item.month);$('#extractAccount').value=account;switchView('transactions');};
    $('#yearGrid').append(card);
  }
}
function renderBudgets(){
  const month=currentMonth(),limits=state.budgets[month]||{},spent={};
  monthAccount(month,'main').filter(e=>e.type==='expense').forEach(e=>spent[e.category]=(spent[e.category]||0)+e.amount);
  $('#budgetList').replaceChildren();
  const categories=F.expenseCategories.filter(c=>limits[c]);
  if(!categories.length){const p=document.createElement('p');p.className='note';p.textContent='Nenhum limite definido neste mês. Selecione uma categoria para começar.';$('#budgetList').append(p);}
  for(const cat of categories){
    const used=spent[cat]||0,limit=limits[cat],ratio=used/limit;
    const row=document.createElement('div');row.className='budget-row';const line=document.createElement('div');line.className='budget-line';
    const name=document.createElement('b');name.textContent=cat;
    const amounts=document.createElement('span');amounts.textContent=`${money(used)} / ${money(limit)} (${Math.round(ratio*100)}%)`;
    line.append(name,amounts);
    const track=document.createElement('div');track.className='budget-track';track.setAttribute('role','progressbar');
    track.setAttribute('aria-label',cat);track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',String(Math.min(100,Math.round(ratio*100))));
    const fill=document.createElement('div');fill.className='budget-fill'+(ratio>1?' over':'');fill.style.width=`${Math.min(100,ratio*100)}%`;
    track.append(fill);row.append(line,track);
    if(ratio>1){const warning=document.createElement('small');warning.className='over-warning';warning.textContent=`Acima do limite em ${money(used-limit)}.`;row.append(warning);}
    $('#budgetList').append(row);
  }
  updateBudgetInput();
}
function updateBudgetInput(){
  const amount=state.budgets[currentMonth()]?.[$('#budgetCategory').value];
  $('#budgetAmount').value=amount===undefined?'':(amount/100).toFixed(2).replace('.',',');
}
function renderOpening(){
  $('#mainOpening').value=(state.openingBalances.main/100).toFixed(2).replace('.',',');
  $('#foodOpening').value=(state.openingBalances.food/100).toFixed(2).replace('.',',');
}
function setCats(preferred){
  const select=$('#category');select.replaceChildren();
  const categories=F.categoriesFor($('#type').value,$('#account').value);
  categories.forEach(cat=>select.add(new Option(cat,cat)));
  if(categories.includes(preferred))select.value=preferred;
  if($('#type').value==='income'&&$('#recurrence').value==='installment')$('#recurrence').value='single';
  updateRepeatControls();
}
function setPaymentMethods(preferred) {
  const select=$('#paymentMethod'); select.replaceChildren();
  const allowed=F.paymentMethodsFor($('#type').value,$('#account').value);
  for(const key of allowed)select.add(new Option(F.paymentName(key),key));
  const fallback=$('#account').value==='food'?'food':($('#type').value==='income'?'pix':'debit');
  select.value=allowed.includes(preferred)?preferred:fallback;
  updatePaymentHelp();
}
function isNewCredit(){return editId===null && $('#paymentMethod').value==='credit' && $('#type').value==='expense' && $('#account').value==='main';}
function updateCreditSummary(){
  const target=$('#creditSummary');
  if(!isNewCredit())return;
  const amount=F.parseCents($('#amount').value);
  const count=Number($('#creditInstallments').value);
  const rawInterest=$('#hasInterest').checked?F.parsePercent($('#creditInterest').value):0;
  if(amount===null){target.textContent='Digite o valor da compra para calcular as parcelas.';return;}
  if(rawInterest===null){target.textContent='Digite uma taxa de juros válida, por exemplo 5 ou 2,5.';return;}
  try{
    const credit=F.calculateCreditPurchase(amount,count,rawInterest);
    const values=credit.values;
    const variation=values.some(v=>v!==values[0]);
    const display=variation?`${money(values[0])} na primeira parcela; ${money(values[values.length-1])} na última`:`${money(values[0])} por parcela`;
    target.textContent=`Compra: ${money(credit.principalCents)} • Juros: ${money(credit.interestCents)} • Total: ${money(credit.totalCents)} • ${credit.installments}x — ${display}.`;
  }catch(error){target.textContent=error.message||'Confira os valores.';}
}
function updatePaymentHelp(){
  const credit=$('#paymentMethod').value==='credit';
  $('#paymentHelp').hidden=!credit;
  $('#creditDetails').hidden=!credit;
  $('#creditNewFields').hidden=!credit||editId!==null;
  $('#creditEditNotice').hidden=!credit||editId===null;
  $('#creditInterestWrap').hidden=!$('#hasInterest').checked;
  $('#creditInstallments').required=isNewCredit();
  $('#creditInterest').required=isNewCredit()&&$('#hasInterest').checked;
  $('#amountLabel').textContent=credit&&!editId?'Valor original da compra (R$)':'Valor (R$)';
  $('#dateLabel').textContent=credit?(editId?'Vencimento desta parcela':'Vencimento da primeira fatura/parcela'):'Data';
  updateRepeatControls();
  updateCreditSummary();
}
function updateRepeatControls(){
  const mode=$('#recurrence').value,edit=editId!==null,credit=$('#paymentMethod').value==='credit';
  $('#recurrenceWrap').hidden=edit||credit;
  $('#untilWrap').hidden=edit||credit||mode!=='fixed';
  $('#installmentsWrap').hidden=edit||credit||mode!=='installment';
  $('#installments').required=!edit&&!credit&&mode==='installment';$('#until').required=!edit&&!credit&&mode==='fixed';
  Array.from($('#recurrence').options).find(o=>o.value==='installment').disabled=$('#type').value==='income';
}
function defaultUntil(date){return F.shiftDate(date,11).slice(0,7);}
function openForm(existing=null,options={}){
  $('#form').reset();editId=existing?.id||null;
  $('#dialogTitle').textContent=existing?'Editar movimentação':'Novo lançamento';
  $('#error').textContent='';
  const selectedAccount=$('#extractAccount').value;
  $('#account').value=existing?F.accountOf(existing):(options.account||(activeView==='food'?'food':activeView==='transactions'&&selectedAccount==='food'?'food':'main'));
  $('#type').value=existing?.type||options.type||'expense';
  $('#recurrence').value='single';
  setCats(existing?.category);
  setPaymentMethods(existing?.paymentMethod);
  if(existing && !existing.paymentMethod){
    $('#paymentMethod').add(new Option('Não informado (registro antigo)','unspecified'),0);
    $('#paymentMethod').value='unspecified';
  }
  const month=currentMonth();
  $('#date').value=existing?.date||(month===today().slice(0,7)?today():`${month}-01`);
  $('#amount').value=existing?(existing.amount/100).toFixed(2).replace('.',','):'';
  $('#description').value=existing?.description||'';
  $('#status').value=existing?.status||'done';
  $('#until').value=defaultUntil($('#date').value);
  $('#installments').value='2';
  $('#bank').value=existing?.bank||'';
  $('#creditInstallments').value='1';
  $('#hasInterest').checked=false;
  $('#creditInterest').value='0';
  $('#editHint').hidden=!existing;$('#deleteEntry').hidden=!existing;$('#deleteSeries').hidden=!existing?.seriesId;
  updatePaymentHelp();$('#dialog').showModal();
}
function setMonth(month){
  if(F.monthValid(month)){$('#month').value=month;$('#year').value=month.slice(0,4);render();}
}
function shiftMonth(delta){
  const [year,month]=currentMonth().split('-').map(Number),next=new Date(Date.UTC(year,month-1+delta,1));
  if(next.getUTCFullYear()<1900||next.getUTCFullYear()>2100)return;
  setMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth()+1).padStart(2,'0')}`);
}
function download(content,type,name){
  const url=URL.createObjectURL(new Blob([content],{type}));
  const link=document.createElement('a');link.href=url;link.download=name;link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function csvQuote(value){return '"'+String(value).replace(/^[=+@-]/,"'$&").replace(/"/g,'""')+'"';}
function restoreBackupText(text){
  try{
    if(text.length>15000000)throw Error('Arquivo grande');
    const backup=F.normalizeBackup(JSON.parse(text));
    if(confirm(`Restaurar ${backup.entries.length} lançamentos, saldos iniciais e limites? Os dados atuais serão substituídos. Guarde uma cópia antes, se necessário.`)){
      if(save(backup,true))toast('Backup restaurado com sucesso.');
    }
  }catch(_){alert('Arquivo inválido. Escolha um backup JSON válido do Meu Controle (versão 1, 2 ou 3).');}
}
window.restoreBackupText=restoreBackupText;
window.onUpdateResult=function(result){
  const status=$('#updateStatus'),download=$('#downloadUpdate');
  $('#checkUpdates').disabled=false;
  download.hidden=true;
  $('#releaseNotes').hidden=true;
  if(!result||result.error){status.textContent=result?.error||'Não foi possível consultar as atualizações.';return;}
  $('#installedVersion').textContent='v'+result.current;
  if(!result.available){status.textContent=`Tudo atualizado! Versão instalada: ${result.current}. Última publicada: ${result.latest}.`;return;}
  status.textContent=`Nova versão ${result.latest} disponível! Instalada: ${result.current}.`;
  const notes=(result.notes||'').trim().slice(0,700);
  if(notes){$('#releaseNotes').textContent=notes;$('#releaseNotes').hidden=false;}
  if(result.hasApk)download.hidden=false;
  else status.textContent+=' O APK ainda não foi publicado nesta versão.';
};
function runLateCalculation(){
  $('#lateError').textContent='';$('#lateResult').hidden=true;
  try {
    const principal=F.parseCents($('#latePrincipal').value);
    const fine=F.parsePercent($('#latePenalty').value);
    const interest=F.parsePercent($('#lateInterest').value);
    const result=F.calculateLateFee(principal,$('#lateDue').value,$('#latePaid').value,fine,interest);
    $('#lateTotal').textContent=money(result.totalCents);
    $('#lateDays').textContent=String(result.days);
    $('#lateOriginal').textContent=money(result.principalCents);
    $('#lateFine').textContent=money(result.fineCents);
    $('#lateInterestTotal').textContent=money(result.interestCents);
    $('#lateResult').hidden=false;
  } catch(error){$('#lateError').textContent=error.message||'Verifique os dados de atraso.';}
}
function runInvestmentSimulation(){
  $('#investmentError').textContent='';$('#investmentResult').hidden=true;
  try {
    const initial=F.parseBalanceCents($('#investmentInitial').value);
    const contribution=F.parseBalanceCents($('#investmentContribution').value);
    const rate=F.parsePercent($('#investmentRate').value);
    const months=Number($('#investmentMonths').value);
    const result=F.simulateInvestment(initial,contribution,rate,months);
    $('#investmentFinal').textContent=money(result.balanceCents);
    $('#investmentDeposited').textContent=money(result.contributedCents);
    $('#investmentEarnings').textContent=(result.earningsCents<0?'− ':'+ ')+money(Math.abs(result.earningsCents));
    const target=$('#investmentRows');target.replaceChildren();
    for(const row of result.rows){
      const tr=document.createElement('tr');
      td(tr,String(row.month));td(tr,money(row.earningsCents));td(tr,money(row.contributionCents));td(tr,money(row.balanceCents));
      target.append(tr);
    }
    $('#investmentResult').hidden=false;
  } catch(error){$('#investmentError').textContent=error.message||'Confira os dados de investimento.';}
}

function runFinancingSimulation(){
  $('#financingError').textContent='';$('#financingResult').hidden=true;
  try {
    const asset=F.parseCents($('#finAsset').value);
    const down=F.parseBalanceCents($('#finDown').value);
    const rate=F.parsePercent($('#finRate').value);
    const months=Number($('#finMonths').value);
    const result=F.simulateFinancing(asset,down,rate,months,$('#finSystem').value);
    $('#finFirst').textContent=money(result.firstPaymentCents);
    $('#finLast').textContent=money(result.lastPaymentCents);
    $('#finBorrowed').textContent=money(result.financedCents);
    $('#finInterestTotal').textContent=money(result.totalInterestCents);
    $('#finPaymentsTotal').textContent=money(result.totalPaidCents);
    $('#finFullCost').textContent=money(result.totalCostCents);
    const body=$('#financingRows');body.replaceChildren();
    const fragment=document.createDocumentFragment();
    for(const row of result.rows){
      const tr=document.createElement('tr');
      td(tr,String(row.month));td(tr,money(row.paymentCents));td(tr,money(row.interestCents));
      td(tr,money(row.amortizationCents));td(tr,money(row.remainingCents));fragment.append(tr);
    }
    body.append(fragment);$('#financingResult').hidden=false;
  }catch(error){$('#financingError').textContent=error.message||'Revise os dados do financiamento.';}
}
function runConsortiumSimulation(){
  $('#consortiumError').textContent='';$('#consortiumResult').hidden=true;
  try {
    const credit=F.parseCents($('#consCredit').value);
    const months=Number($('#consMonths').value);
    const admin=F.parsePercent($('#consAdmin').value);
    const reserve=F.parsePercent($('#consReserve').value);
    const result=F.simulateConsortium(credit,months,admin,reserve);
    $('#consFirst').textContent=money(result.firstPaymentCents);
    $('#consLast').textContent=money(result.lastPaymentCents);
    $('#consOriginal').textContent=money(result.creditCents);
    $('#consAdminValue').textContent=money(result.adminFeeCents);
    $('#consReserveValue').textContent=money(result.reserveFeeCents);
    $('#consTotal').textContent=money(result.totalCents);
    $('#consortiumResult').hidden=false;
  }catch(error){$('#consortiumError').textContent=error.message||'Revise os dados do consórcio.';}
}

function init(){
  load();
  const now=today();$('#month').value=now.slice(0,7);$('#year').value=now.slice(0,4);
  F.expenseCategories.forEach(cat=>$('#budgetCategory').add(new Option(cat,cat)));
  document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>switchView(button.dataset.view));
  $('#openTools').onclick=()=>switchView('tools');
  $('#latePaid').value=today();
  $('#lateForm').onsubmit=event=>{event.preventDefault();runLateCalculation();};
  $('#investmentForm').onsubmit=event=>{event.preventDefault();runInvestmentSimulation();};
  $('#financingForm').onsubmit=event=>{event.preventDefault();runFinancingSimulation();};
  $('#consortiumForm').onsubmit=event=>{event.preventDefault();runConsortiumSimulation();};
  // Exibe imediatamente a simulação inicial de exemplo, que nunca altera os registros.
  runInvestmentSimulation();
  runFinancingSimulation();
  runConsortiumSimulation();
  $('#add').onclick=()=>openForm();
  $('#addIncome').onclick=()=>openForm(null,{account:'main',type:'income'});
  $('#addExpense').onclick=()=>openForm(null,{account:'main',type:'expense'});
  $('#addFoodIncome').onclick=()=>openForm(null,{account:'food',type:'income'});
  $('#addFoodExpense').onclick=()=>openForm(null,{account:'food',type:'expense'});
  $('#goTransactions').onclick=$('#seeAll').onclick=()=>{$('#extractAccount').value='main';switchView('transactions');};
  $('#goPlan').onclick=()=>{$('#planAccount').value='main';switchView('annual');renderAnnual();};
  $('#openFood').onclick=()=>switchView('food');
  $('#first').onclick=()=>openForm();
  $('#toggleAmounts').onclick=()=>{
    const hidden=document.body.classList.toggle('hide-balances');
    $('#toggleAmounts').setAttribute('aria-pressed',String(hidden));
    $('#toggleAmounts').setAttribute('aria-label',hidden?'Exibir valores':'Ocultar valores');
    $('#toggleAmounts').textContent=hidden?'◌':'◉';
  };
  $('#close').onclick=$('#cancel').onclick=()=>$('#dialog').close();
  $('#deleteEntry').onclick=()=>{const e=state.entries.find(x=>x.id===editId);if(e&&deleteEntry(e)){editId=null;$('#dialog').close();}};
  $('#deleteSeries').onclick=()=>{const e=state.entries.find(x=>x.id===editId);if(e&&deleteSeries(e)){editId=null;$('#dialog').close();}};
  $('#account').onchange=()=>{setCats($('#category').value);setPaymentMethods();};
  $('#type').onchange=()=>{setCats($('#category').value);setPaymentMethods();};
  $('#paymentMethod').onchange=()=>{
    updatePaymentHelp();
    if($('#paymentMethod').value==='credit' && (!editId || state.entries.find(e=>e.id===editId)?.paymentMethod!=='credit'))$('#status').value='planned';
  };
  $('#recurrence').onchange=updateRepeatControls;
  $('#amount').oninput=updateCreditSummary;
  $('#creditInstallments').oninput=updateCreditSummary;
  $('#creditInterest').oninput=updateCreditSummary;
  $('#hasInterest').onchange=()=>{updatePaymentHelp();};
  $('#date').onchange=()=>{if(!editId&&F.dateValid($('#date').value))$('#until').value=defaultUntil($('#date').value);};
  $('#form').onsubmit=event=>{
    event.preventDefault();
    const amount=F.parseCents($('#amount').value);
    const bank=$('#bank').value.trim();
    const base={id:editId||uid(),account:$('#account').value,type:$('#type').value,amount,
      description:$('#description').value.trim(),date:$('#date').value,
      category:$('#category').value,status:$('#status').value,paymentMethod:$('#paymentMethod').value};
    if(bank)base.bank=bank;
    let creditPurchase=null;
    if(isNewCredit()) {
      const percent=$('#hasInterest').checked?F.parsePercent($('#creditInterest').value):0;
      try{creditPurchase=F.calculateCreditPurchase(amount,Number($('#creditInstallments').value),percent);}
      catch(error){$('#error').textContent=error.message;return;}
      base.amount=creditPurchase.totalCents;
      base.status='planned';
      base.creditPrincipalCents=creditPurchase.principalCents;
      base.creditInterestCents=creditPurchase.interestCents;
      base.creditTotalCents=creditPurchase.totalCents;
      base.creditInterestPercent=creditPurchase.totalInterestPercent;
      base.creditInstallments=creditPurchase.installments;
    }
    if(editId){
      const old=state.entries.find(e=>e.id===editId);
      if(!old){$('#error').textContent='Lançamento não encontrado.';return;}
      Object.assign(base,Object.fromEntries(Object.entries(old).filter(([key])=>['seriesId','repeatKind','installmentNo','installmentTotal'].includes(key) || (base.paymentMethod==='credit' && ['creditPrincipalCents','creditInterestCents','creditTotalCents','creditInterestPercent','creditInstallments'].includes(key)))));
    }
    if(!F.entryValid(base)){$('#error').textContent='Confira conta, categoria, data, descrição e valor (maior que zero).';return;}
    let next;
    if(editId)next=state.entries.map(e=>e.id===editId?base:e);
    else{
      try{
        const mode=creditPurchase?(creditPurchase.installments===1?'single':'installment'):$('#recurrence').value;
        const created=F.makeSchedule(base,mode,{until:$('#until').value,installments:creditPurchase?creditPurchase.installments:Number($('#installments').value)},uid);
        next=[...state.entries,...created];
      }catch(error){$('#error').textContent=error.message||'Revise os dados de repetição.';return;}
    }
    if(save({...state,entries:next})){
      setMonth(base.date.slice(0,7));$('#dialog').close();
      toast('Movimentação salva com sucesso.');
    }
  };
  $('#month').onchange=()=>{if(!F.monthValid($('#month').value))$('#month').value=today().slice(0,7);$('#year').value=$('#month').value.slice(0,4);render();};
  $('#prev').onclick=()=>shiftMonth(-1);$('#next').onclick=()=>shiftMonth(1);
  $('#year').onchange=()=>{
    let y=Number($('#year').value);
    if(!Number.isInteger(y)||y<1900||y>2100){y=Number(today().slice(0,4));$('#year').value=String(y);}
    $('#month').value=`${y}-01`;render();
  };
  $('#planAccount').onchange=renderAnnual;
  $('#search').oninput=renderTransactions;
  $('#extractAccount').onchange=renderTransactions;
  $('#filter').onchange=renderTransactions;
  $('#statusFilter').onchange=renderTransactions;
  $('#paymentFilter').onchange=renderTransactions;
  $('#budgetCategory').onchange=updateBudgetInput;
  $('#budgetForm').onsubmit=event=>{
    event.preventDefault();$('#budgetError').textContent='';
    const amount=F.parseCents($('#budgetAmount').value);
    if(amount===null){$('#budgetError').textContent='Informe um valor válido maior que zero.';return;}
    const budgets=JSON.parse(JSON.stringify(state.budgets)),cat=$('#budgetCategory').value;
    const months=$('#budgetAll').checked?Array.from({length:12},(_,i)=>`${$('#year').value}-${String(i+1).padStart(2,'0')}`):[currentMonth()];
    for(const month of months)budgets[month]={...(budgets[month]||{}),[cat]:amount};
    if(save({...state,budgets}))toast('Limite salvo.');
  };
  $('#removeBudget').onclick=()=>{
    $('#budgetError').textContent='';
    const cat=$('#budgetCategory').value;
    const months=$('#budgetAll').checked?Array.from({length:12},(_,i)=>`${$('#year').value}-${String(i+1).padStart(2,'0')}`):[currentMonth()];
    if(!months.some(month=>state.budgets[month]?.[cat])){toast('Não há limite para remover.');return;}
    if(!confirm(`Remover o limite de “${cat}” ${$('#budgetAll').checked?'do ano':'deste mês'}?`))return;
    const budgets=JSON.parse(JSON.stringify(state.budgets));
    for(const month of months){if(budgets[month]){delete budgets[month][cat];if(!Object.keys(budgets[month]).length)delete budgets[month];}}
    if(save({...state,budgets}))toast('Limite removido.');
  };
  $('#openingForm').onsubmit=event=>{
    event.preventDefault();$('#openingError').textContent='';
    const main=F.parseBalanceCents($('#mainOpening').value),food=F.parseBalanceCents($('#foodOpening').value);
    if(main===null||food===null){$('#openingError').textContent='Digite valores válidos maiores ou iguais a zero.';return;}
    if(save({...state,openingBalances:{main,food}}))toast('Saldos iniciais atualizados.');
  };
  $('#export').onclick=()=>{
    const account=$('#extractAccount').value;
    const items=state.entries.filter(e=>e.date.slice(0,7)===currentMonth()&&(account==='all'||isAccount(e,account)));
    if(!items.length){toast('Nenhuma movimentação para exportar neste mês.');return;}
    const rows=[['Data','Conta','Tipo','Descrição','Categoria','Forma de pagamento','Banco/instituição','Situação','Parcela','Juros totais (%)','Valor (R$)'],...byDate(items).map(e=>[
      e.date,accountName(F.accountOf(e)),e.type==='income'?'Receita':'Despesa',e.description,e.category,paymentName(e),e.bank||'',
      e.status==='done'?'Realizado':'Planejado',e.installmentNo?`${e.installmentNo}/${e.installmentTotal}`:'',
      e.creditInterestPercent===undefined?'':String(e.creditInterestPercent).replace('.',','),
      (e.amount/100).toFixed(2).replace('.',',')])];
    download('\ufeff'+rows.map(row=>row.map(csvQuote).join(';')).join('\r\n'),'text/csv;charset=utf-8',`meu-controle-${account}-${currentMonth()}.csv`);
  };
  $('#checkUpdates').onclick=()=>{
    if(!window.AndroidUpdates){$('#updateStatus').textContent='A consulta de atualizações estará disponível no APK Android 3.1.0.';return;}
    $('#checkUpdates').disabled=true;
    $('#updateStatus').textContent='Consultando o GitHub...';
    $('#downloadUpdate').hidden=true;
    $('#releaseNotes').hidden=true;
    window.AndroidUpdates.check();
  };
  $('#downloadUpdate').onclick=()=>{
    if(window.AndroidUpdates)window.AndroidUpdates.openDownload();
  };
  $('#backup').onclick=()=>download(JSON.stringify(state,null,2),'application/json',`meu-controle-${today()}.json`);
  $('#restore').onclick=()=>$('#file').click();
  $('#file').onchange=async event=>{
    const file=event.target.files[0];if(!file)return;
    try{if(file.size>15000000)throw Error('Muito grande');restoreBackupText(await file.text());}
    catch(_){alert('Não foi possível abrir o backup JSON.');}
    event.target.value='';
  };
  render();switchView('home');
}
init();

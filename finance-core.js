/* Regras financeiras sem dependências externas. Valores monetários sempre em centavos. */
(function (root) {
  'use strict';
  const expenseCategories = ['Alimentação','Moradia','Transporte','Saúde','Educação','Lazer','Compras','Outros'];
  const incomeCategories = ['Salário','Pix recebido','Trabalho extra','Rendimentos','Outras receitas'];
  const foodIncomeCategories = ['Recarga do vale','Estorno','Outros créditos'];
  const foodExpenseCategories = ['Supermercado','Restaurante','Padaria','Lanche','Outras compras'];
  const accounts = ['main','food'];
  const paymentLabels = Object.freeze({
    pix:'Pix', debit:'Cartão de débito', credit:'Cartão de crédito', cash:'Dinheiro',
    transfer:'Transferência', boleto:'Boleto', deposit:'Depósito', food:'Vale-alimentação', other:'Outro'
  });
  function paymentMethodsFor(type, account) {
    if (account === 'food') return ['food'];
    if (type === 'income') return ['pix','transfer','cash','deposit','other'];
    return ['pix','debit','credit','cash','transfer','boleto','other'];
  }
  function paymentName(method) { return paymentLabels[method] || 'Não informado'; }
  // Juros totais cobrados uma única vez sobre a compra (não juros mensais / CET).
  // Valores sempre em centavos, com arredondamento explícito.
  function calculateCreditPurchase(principalCents, installments, totalInterestPercent = 0) {
    if (!Number.isSafeInteger(principalCents) || principalCents < 1 || principalCents > MAX_AMOUNT ||
        !Number.isInteger(installments) || installments < 1 || installments > 500 ||
        !Number.isFinite(totalInterestPercent) || totalInterestPercent < 0 || totalInterestPercent > 100 ||
        Math.round(totalInterestPercent * 10000) !== totalInterestPercent * 10000 &&
          Math.abs(Math.round(totalInterestPercent * 10000) - totalInterestPercent * 10000) > 1e-8)
      throw Error('Informe um valor válido, de 1 a 500 parcelas e juros totais entre 0% e 100%.');
    const interestCents = Math.round(principalCents * totalInterestPercent / 100);
    const totalCents = principalCents + interestCents;
    if (!Number.isSafeInteger(totalCents) || totalCents > MAX_AMOUNT || totalCents < installments)
      throw Error('Total com juros acima do limite ou inferior a um centavo por parcela.');
    const each = Math.floor(totalCents / installments);
    const remainder = totalCents % installments;
    const values = Array.from({length:installments},(_,i)=>each + (i < remainder ? 1 : 0));
    return {principalCents,interestCents,totalCents,installments,totalInterestPercent,values};
  }

  const MAX_AMOUNT = 99999999999;
  const money = cents => (cents / 100).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
  function parseCents(raw) {
    let value = String(raw).trim().replace(/\s|R\$/g, '');
    if (value.includes(',')) value = value.replace(/\./g, '').replace(',', '.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
    let [whole, fraction = ''] = value.split('.');
    try {
      const result = BigInt(whole) * 100n + BigInt((fraction + '00').slice(0, 2));
      return result > 0n && result <= BigInt(MAX_AMOUNT) ? Number(result) : null;
    } catch (_) { return null; }
  }
  function parseBalanceCents(raw) {
    const str = String(raw).trim().replace(/\s|R\$/g, '');
    if (/^0(?:[,.]0{1,2})?$/.test(str)) return 0;
    return parseCents(raw);
  }
  function accountOf(e) { return e.account === undefined ? 'main' : e.account; }
  function categoriesFor(type, account) {
    if (account === 'food') return type === 'income' ? foodIncomeCategories : foodExpenseCategories;
    return type === 'income' ? incomeCategories : expenseCategories;
  }
  function dateValid(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1) return false;
    return new Date(Date.UTC(y, m, 0)).getUTCDate() >= d;
  }
  function monthValid(m) { return typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) && +m.slice(0,4) >= 1900 && +m.slice(0,4) <= 2100; }
  function shiftDate(date, offset) {
    if (!dateValid(date) || !Number.isInteger(offset) || offset < 0 || offset > 1200) throw Error('Data inválida');
    const [year, month, day] = date.split('-').map(Number);
    const first = new Date(Date.UTC(year, month - 1 + offset, 1));
    const y = first.getUTCFullYear(), m = first.getUTCMonth() + 1;
    const d = Math.min(day, new Date(Date.UTC(y, m, 0)).getUTCDate());
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  function entryValid(e) {
    return !!e && typeof e === 'object' && typeof e.id === 'string' && e.id.length > 0 && e.id.length <= 100 &&
      ['income','expense'].includes(e.type) && Number.isSafeInteger(e.amount) && e.amount > 0 && e.amount <= MAX_AMOUNT &&
      typeof e.description === 'string' && !!e.description.trim() && e.description.length <= 100 && dateValid(e.date) &&
      accounts.includes(accountOf(e)) && categoriesFor(e.type, accountOf(e)).includes(e.category) &&
      ['planned','done'].includes(e.status) &&
      (e.paymentMethod === undefined || e.paymentMethod === 'unspecified' || paymentMethodsFor(e.type,accountOf(e)).includes(e.paymentMethod)) &&
      (e.bank === undefined || (typeof e.bank === 'string' && e.bank.length > 0 && e.bank.length <= 80 && !!e.bank.trim())) &&
      (e.creditPrincipalCents === undefined || (
        e.paymentMethod === 'credit' && Number.isSafeInteger(e.creditPrincipalCents) && e.creditPrincipalCents > 0 && e.creditPrincipalCents <= MAX_AMOUNT &&
        Number.isSafeInteger(e.creditInterestCents) && e.creditInterestCents >= 0 && e.creditInterestCents <= MAX_AMOUNT &&
        Number.isSafeInteger(e.creditTotalCents) && e.creditTotalCents === e.creditPrincipalCents + e.creditInterestCents && e.creditTotalCents <= MAX_AMOUNT &&
        Number.isFinite(e.creditInterestPercent) && e.creditInterestPercent >= 0 && e.creditInterestPercent <= 100 &&
        Number.isInteger(e.creditInstallments) && e.creditInstallments >= 1 && e.creditInstallments <= 500)) &&
      (e.seriesId === undefined || (typeof e.seriesId === 'string' && e.seriesId.length > 0 && e.seriesId.length <= 100)) &&
      (e.repeatKind === undefined || (e.seriesId && ['fixed','installment'].includes(e.repeatKind))) &&
      (e.installmentNo === undefined || (Number.isInteger(e.installmentNo) && e.installmentNo >= 1 && e.installmentNo <= 500)) &&
      (e.installmentTotal === undefined || (Number.isInteger(e.installmentTotal) && e.installmentTotal >= 2 && e.installmentTotal <= 500 && e.installmentNo <= e.installmentTotal));
  }
  function entriesValid(items) {
    return Array.isArray(items) && items.length <= 50000 && items.every(entryValid) && new Set(items.map(x => x.id)).size === items.length;
  }
  function budgetsValid(budgets) {
    return !!budgets && typeof budgets === 'object' && !Array.isArray(budgets) && Object.keys(budgets).length <= 2412 &&
      Object.entries(budgets).every(([month, limits]) => monthValid(month) && limits && typeof limits === 'object' && !Array.isArray(limits) &&
        Object.entries(limits).every(([cat, value]) => expenseCategories.includes(cat) && Number.isSafeInteger(value) && value > 0 && value <= MAX_AMOUNT));
  }
  function balancesValid(balances) {
    return !!balances && typeof balances === 'object' && !Array.isArray(balances) &&
      Object.keys(balances).length === 2 && accounts.every(a => Number.isSafeInteger(balances[a]) && balances[a] >= 0 && balances[a] <= MAX_AMOUNT);
  }
  function stateValid(data) { return !!data && data.version === 3 && entriesValid(data.entries) &&
    data.entries.every(e => accounts.includes(e.account)) && budgetsValid(data.budgets) && balancesValid(data.openingBalances); }
  function oldStateValid(data) { return !!data && data.version === 2 && entriesValid(data.entries) && budgetsValid(data.budgets); }
  function legacyValid(data) {
    return !!data && data.version === 1 && Array.isArray(data.entries) && data.entries.length <= 50000 &&
      data.entries.every(e => !!e && typeof e.id === 'string' && e.id.length > 0 && e.id.length <= 100 && ['income','expense'].includes(e.type) &&
        Number.isSafeInteger(e.amount) && e.amount > 0 && e.amount <= MAX_AMOUNT && typeof e.description === 'string' &&
        !!e.description.trim() && e.description.length <= 100 && dateValid(e.date) &&
        (e.type === 'expense' ? expenseCategories : incomeCategories).includes(e.category)) &&
      new Set(data.entries.map(e => e.id)).size === data.entries.length;
  }
  function normalizeBackup(data) {
    if (stateValid(data)) return {
      version:3, entries:data.entries.map(e => ({...e})), budgets:structuredCopy(data.budgets),
      openingBalances:{...data.openingBalances}
    };
    if (oldStateValid(data)) return {
      version:3, entries:data.entries.map(e => ({...e,account:'main'})),
      budgets:structuredCopy(data.budgets),openingBalances:{main:0,food:0}
    };
    if (legacyValid(data)) return {
      version:3, entries:data.entries.map(e => ({...e,account:'main',status:'done'})),
      budgets:{},openingBalances:{main:0,food:0}
    };
    throw Error('Arquivo de backup inválido');
  }
  function structuredCopy(value) { return JSON.parse(JSON.stringify(value)); }
  function makeSchedule(base, mode, options = {}, makeId) {
    if (!entryValid(base) || !['single','fixed','installment'].includes(mode) || typeof makeId !== 'function') throw Error('Lançamento inválido');
    if (mode === 'single') return [base];
    let count;
    if (mode === 'fixed') {
      const endMonth = options.until;
      if (!monthValid(endMonth) || endMonth < base.date.slice(0,7)) throw Error('Mês final anterior ao início');
      const [y,m] = base.date.slice(0,7).split('-').map(Number), [ey,em] = endMonth.split('-').map(Number);
      count = (ey-y)*12 + em-m+1;
      if (count < 1 || count > 120) throw Error('A repetição permite até 120 meses');
    } else {
      count = Number(options.installments);
      if (!Number.isInteger(count) || count < 2 || count > 500 || base.type !== 'expense') throw Error('Parcelamento inválido');
      if (base.amount < count) throw Error('O valor total precisa ter ao menos um centavo por parcela');
    }
    const seriesId = makeId();
    const each = mode === 'installment' ? Math.floor(base.amount/count) : base.amount;
    const remainder = mode === 'installment' ? base.amount % count : 0;
    if (!dateValid(shiftDate(base.date,count-1))) throw Error('Parcelas ultrapassam o ano 2100.');
    return Array.from({length:count},(_,i)=>{
      const e = {...base, id:i===0?base.id:makeId(), date:shiftDate(base.date,i),
        amount:mode === 'installment' ? each + (i < remainder ? 1:0) : base.amount,
        status:i===0?base.status:'planned',seriesId,repeatKind:mode};
      if (mode === 'installment') {e.installmentNo=i+1;e.installmentTotal=count;}
      return e;
    });
  }
  function monthTotals(items, month, account = 'main') {
    const matching=items.filter(e=>accountOf(e)===account && e.date.slice(0,7)===month);
    const sum=(type,done)=>matching.filter(e=>e.type===type && (!done || e.status==='done')).reduce((s,e)=>s+e.amount,0);
    const income=sum('income',false),expense=sum('expense',false),received=sum('income',true),paid=sum('expense',true);
    return {income,expense,balance:income-expense,received,paid,realized:received-paid,
      pending:matching.filter(e=>e.status==='planned').length,done:matching.filter(e=>e.status==='done').length};
  }
  function cumulativeBalance(items, month, account = 'main', openingBalance = 0, includePlanned = false) {
    if (!monthValid(month) || !accounts.includes(account) || !Number.isSafeInteger(openingBalance) || openingBalance < 0) throw Error('Saldo ou período inválido');
    return items.reduce((total, entry) => {
      if (accountOf(entry) !== account || entry.date.slice(0,7) > month || (!includePlanned && entry.status !== 'done')) return total;
      return total + (entry.type === 'income' ? entry.amount : -entry.amount);
    }, openingBalance);
  }
  function openingMonthBalance(items, month, account = 'main', openingBalance = 0, includePlanned = false) {
    if (!monthValid(month) || !accounts.includes(account)) throw Error('Período inválido');
    return items.reduce((total, entry) => {
      if (accountOf(entry) !== account || entry.date.slice(0,7) >= month || (!includePlanned && entry.status !== 'done')) return total;
      return total + (entry.type === 'income' ? entry.amount : -entry.amount);
    }, openingBalance);
  }
  function yearlyTotals(items, year, account = 'main', openingBalance = 0) {
    if (!Number.isInteger(year) || year < 1900 || year > 2100) throw Error('Ano inválido');
    const months=Array.from({length:12},(_,i)=>({month:`${year}-${String(i+1).padStart(2,'0')}`,
      ...monthTotals(items,`${year}-${String(i+1).padStart(2,'0')}`,account)}));
    const total=months.reduce((a,m)=>{a.income+=m.income;a.expense+=m.expense;a.received+=m.received;a.paid+=m.paid;return a;},{income:0,expense:0,received:0,paid:0});
    months.forEach(m=>{
      m.runningRealized = cumulativeBalance(items,m.month,account,openingBalance);
      m.runningProjected = cumulativeBalance(items,m.month,account,openingBalance,true);
    });
    return {months, total:{...total,balance:total.income-total.expense,realized:total.received-total.paid,
      endRealized:months[11].runningRealized,endProjected:months[11].runningProjected}};
  }
  // Simuladores independentes do extrato: cálculos em centavos e datas UTC para evitar fuso horário.
  function parsePercent(value) {
    const raw=String(value).trim().replace(',', '.');
    if (!/^-?\d+(?:\.\d{1,4})?$/.test(raw)) return null;
    const number=Number(raw);
    return Number.isFinite(number)?number:null;
  }
  function calculateLateFee(principalCents, dueDate, paymentDate, penaltyPercent, monthlyInterestPercent) {
    if (!Number.isSafeInteger(principalCents)||principalCents<=0||principalCents>MAX_AMOUNT||
        !dateValid(dueDate)||!dateValid(paymentDate)||
        !Number.isFinite(penaltyPercent)||penaltyPercent<0||penaltyPercent>100||
        !Number.isFinite(monthlyInterestPercent)||monthlyInterestPercent<0||monthlyInterestPercent>100)
      throw Error('Revise valor, datas e taxas entre 0% e 100%.');
    const dateUTC=date=>Date.UTC(...date.split('-').map((value,i)=>i===1?Number(value)-1:Number(value)));
    const days=Math.max(0,Math.round((dateUTC(paymentDate)-dateUTC(dueDate))/86400000));
    const fineCents=days?Math.round(principalCents*penaltyPercent/100):0;
    const interestCents=days?Math.round(principalCents*monthlyInterestPercent/100*days/30):0;
    const totalCents=principalCents+fineCents+interestCents;
    if (!Number.isSafeInteger(totalCents)||totalCents>MAX_AMOUNT) throw Error('Valor total ultrapassa o limite do simulador.');
    return {days,principalCents,fineCents,interestCents,totalCents};
  }
  function simulateInvestment(initialCents, monthlyContributionCents, monthlyRatePercent, months) {
    if (!Number.isSafeInteger(initialCents)||initialCents<0||initialCents>MAX_AMOUNT||
        !Number.isSafeInteger(monthlyContributionCents)||monthlyContributionCents<0||monthlyContributionCents>MAX_AMOUNT||
        initialCents+monthlyContributionCents===0||
        !Number.isFinite(monthlyRatePercent)||monthlyRatePercent < -100||monthlyRatePercent>100||
        !Number.isInteger(months)||months<1||months>360)
      throw Error('Informe valores válidos, de 1 a 360 meses e taxa entre -100% e 100%.');
    let balanceCents=initialCents, contributedCents=initialCents;
    const rows=[];
    for(let month=1;month<=months;month++) {
      const earningsCents=Math.round(balanceCents*monthlyRatePercent/100);
      balanceCents+=earningsCents+monthlyContributionCents;
      contributedCents+=monthlyContributionCents;
      if (!Number.isSafeInteger(balanceCents)||!Number.isSafeInteger(contributedCents)||
          balanceCents<0||balanceCents>MAX_AMOUNT||contributedCents>MAX_AMOUNT)
        throw Error('Projeção ultrapassa o limite do simulador; reduza os valores ou o prazo.');
      rows.push({month,earningsCents,contributionCents:monthlyContributionCents,balanceCents});
    }
    return {balanceCents,contributedCents,earningsCents:balanceCents-contributedCents,rows};
  }

  // Financiamento: prestação calculada pela taxa efetiva mensal informada (sem CET,
  // seguro, tarifas e reajustes). Cada linha é arredondada em centavos, e a última
  // prestação ajusta a diferença de arredondamento para zerar a dívida.
  function simulateFinancing(assetCents, downPaymentCents, monthlyRatePercent, months, system = 'price') {
    if (!Number.isSafeInteger(assetCents) || assetCents < 1 || assetCents > MAX_AMOUNT ||
        !Number.isSafeInteger(downPaymentCents) || downPaymentCents < 0 || downPaymentCents >= assetCents ||
        !Number.isFinite(monthlyRatePercent) || monthlyRatePercent < 0 || monthlyRatePercent > 100 ||
        !Number.isInteger(months) || months < 1 || months > 500 ||
        !['price','sac'].includes(system))
      throw Error('Informe valor, entrada, taxa mensal (0% a 100%) e prazo de 1 a 500 meses.');
    const financedCents = assetCents-downPaymentCents;
    if (financedCents < months) throw Error('O saldo financiado deve permitir ao menos R$ 0,01 de amortização por mês.');
    const rate=monthlyRatePercent/100;
    const approximate=rate===0?financedCents/months:
      financedCents*rate/(1-Math.pow(1+rate,-months));
    const pricePayment=Math.round(approximate);
    if (!Number.isSafeInteger(pricePayment) || pricePayment <= 0 || pricePayment > MAX_AMOUNT)
      throw Error('A prestação calculada excede o limite permitido.');
    const baseAmort=Math.floor(financedCents/months), extra=financedCents%months;
    const rows=[];
    let remainingCents=financedCents,totalPaidCents=0,totalInterestCents=0;
    for(let month=1;month<=months;month++) {
      const interestCents=Math.round(remainingCents*rate);
      let amortizationCents;
      if(system==='sac') amortizationCents=baseAmort+(month<=extra?1:0);
      else if(month===months) amortizationCents=remainingCents;
      else {
        amortizationCents=pricePayment-interestCents;
        if(amortizationCents<1) throw Error('Prazo/taxa inviáveis com o arredondamento em centavos.');
        // Reserve saldo para as próximas parcelas; evita quitação antecipada por centavos.
        if(amortizationCents>remainingCents-(months-month))
          amortizationCents=remainingCents-(months-month);
        if(amortizationCents<1) throw Error('Não foi possível distribuir as parcelas.');
      }
      const paymentCents=amortizationCents+interestCents;
      remainingCents-=amortizationCents;
      totalPaidCents+=paymentCents; totalInterestCents+=interestCents;
      if (!Number.isSafeInteger(paymentCents) || paymentCents>MAX_AMOUNT ||
          !Number.isSafeInteger(totalPaidCents) || totalPaidCents>MAX_AMOUNT)
        throw Error('O total do financiamento excede o limite permitido.');
      rows.push({month,paymentCents,interestCents,amortizationCents,remainingCents});
    }
    if(remainingCents!==0) throw Error('O saldo do financiamento não foi quitado.');
    return {system,assetCents,downPaymentCents,financedCents,months,monthlyRatePercent,
      totalInterestCents,totalPaidCents,totalCostCents:downPaymentCents+totalPaidCents,
      firstPaymentCents:rows[0].paymentCents,lastPaymentCents:rows[rows.length-1].paymentCents,rows};
  }

  // Consórcio: rateio simples de carta + taxa de administração total + fundo de reserva total.
  // Não supõe contemplação, lance, reajuste da carta, seguro ou outras tarifas contratuais.
  function simulateConsortium(creditCents, months, adminPercent, reservePercent) {
    if(!Number.isSafeInteger(creditCents)||creditCents<1||creditCents>MAX_AMOUNT||
       !Number.isInteger(months)||months<1||months>500||
       !Number.isFinite(adminPercent)||adminPercent<0||adminPercent>100||
       !Number.isFinite(reservePercent)||reservePercent<0||reservePercent>100)
      throw Error('Informe carta de crédito, prazo de 1 a 500 meses e taxas totais entre 0% e 100%.');
    const adminFeeCents=Math.round(creditCents*adminPercent/100);
    const reserveFeeCents=Math.round(creditCents*reservePercent/100);
    const totalCents=creditCents+adminFeeCents+reserveFeeCents;
    if(!Number.isSafeInteger(totalCents)||totalCents>MAX_AMOUNT||totalCents<months)
      throw Error('Total acima do limite ou insuficiente para ao menos um centavo por parcela.');
    const each=Math.floor(totalCents/months),remainder=totalCents%months;
    const firstPaymentCents=each+(remainder>0?1:0);
    const lastPaymentCents=each;
    return {creditCents,months,adminPercent,reservePercent,adminFeeCents,reserveFeeCents,
      totalCents,firstPaymentCents,lastPaymentCents,basePaymentCents:each,remainder};
  }

  root.Finance = {simulateFinancing,simulateConsortium,calculateCreditPurchase,parsePercent,calculateLateFee,simulateInvestment,paymentLabels,paymentMethodsFor,paymentName,expenseCategories,incomeCategories,foodExpenseCategories,foodIncomeCategories,accounts,categoriesFor,accountOf,MAX_AMOUNT,money,parseCents,parseBalanceCents,dateValid,monthValid,shiftDate,entryValid,entriesValid,budgetsValid,balancesValid,stateValid,oldStateValid,legacyValid,normalizeBackup,makeSchedule,monthTotals,cumulativeBalance,openingMonthBalance,yearlyTotals};
})(typeof window !== 'undefined' ? window : globalThis);

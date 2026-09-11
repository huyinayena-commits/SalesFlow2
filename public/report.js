(function(){
  'use strict';

  var DATA_KEY='sales-harian-data-v1';
  var AUTH_KEY='salesflow2-api-password';
  var STORE_NAME_KEY='salesflow2-report-store-name-v1';
  var storeSaveTimer=null;
  var reportDateSession=new Date();
  var calendarDay=reportDateSession.toDateString(),reportRemoteMonths={};
  function reportMonth(key){
    var local=getLocal().months[key];
    try{if((JSON.parse(localStorage.getItem('salesflow2-pending-months-v1'))||{})[key])return local||{}}catch(error){}
    return reportRemoteMonths[key]||local||{};
  }
  var API_BASE=window.location.origin;
  var MONTH_NAMES=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  var TEMPLATE=String.raw`Toko : {{TOKO}}
Tgl    : {{TANGGAL}}

〽️ SALES
A) sales_struk_apc:
1.{{A_1}}
2.{{A_2}}
3.{{A_3}}
4.{{A_4}}
5.{{A_5}}
6.{{A_6}}
7.{{A_7}}
8.{{A_8}}
9.{{A_9}}
10.{{A_10}}
11.{{A_11}}
12.{{A_12}}
13.{{A_13}}
14.{{A_14}}
15.{{A_15}}
16.{{A_16}}
17.{{A_17}}
18.{{A_18}}
19.{{A_19}}
20.{{A_20}}
21.{{A_21}}
22.{{A_22}}
23.{{A_23}}
24.{{A_24}}
25.{{A_25}}
26.{{A_26}}
27.{{A_27}}
28.{{A_28}}
29.{{A_29}}
30.{{A_30}}
31.{{A_31}}

B) akm sales :
{{B_AKM_SALES}}

C) Akm struk : {{C_AKM_STRUK}}
D) Spd_Std_Apc
{{D_SPD}}{{D_STD}}{{D_APC}}

E) target AKM: {{E_TARGET_AKM}}

F) target SPD_ach : {{F_ACH}}% {{F_TARGET_SPD}}

G) Spd_Std_apc bulan lalu
{{G_SPD}}{{G_STD}}{{G_APC}}

H) Growt spd_std_apc. :
{{H_SPD}} _ {{H_STD}} _ {{H_APC}}

I) margin perday : {{I_MARGIN_PERDAY}}%
J) average : {{J_AVERAGE}}

K) Target sales : {{K_TARGET_SALES}}%
L) Ach : {{L_ACH}}%

M) Spd_std_apc tahun lalu:
{{M_SPD}}{{M_STD}}{{M_APC}}

N) growth Spd_std_apc vs thun lalu:
{{N_SPD}} _ {{N_STD}} _ {{N_APC}}

Sales lpptk
Tgl_saleslpptk_mrg%_mrgRp
{{SALES_LPPTK}}
Terimakasih
🙏🏻`;

  var moneyKeys={B_AKM_SALES:1,C_AKM_STRUK:0,E_TARGET_AKM:1,F_TARGET_SPD:1,J_AVERAGE:1};
  for(var i=1;i<=31;i+=1)moneyKeys['A_'+i]=1;

  function getLocal(){
    try{var data=JSON.parse(localStorage.getItem(DATA_KEY));return data&&data.months?data:{version:1,months:{}}}catch(error){return{version:1,months:{}}}
  }
  function getStoreName(){try{return localStorage.getItem(STORE_NAME_KEY)||''}catch(error){return''}}
  function setStoreName(value){try{localStorage.setItem(STORE_NAME_KEY,value)}catch(error){}}
  function getReportDate(){return reportDateSession}
  function authHeaders(){var headers={'accept':'application/json'};try{var password=localStorage.getItem(AUTH_KEY);if(password)headers.Authorization='Bearer '+password}catch(error){}return headers}
  function saveStoreNameRemote(value){clearTimeout(storeSaveTimer);storeSaveTimer=setTimeout(function(){fetch(API_BASE+'/api/settings',{method:'PUT',headers:Object.assign({'content-type':'application/json'},authHeaders()),body:JSON.stringify({storeName:value})}).catch(function(error){console.warn('Nama toko tidak dapat disimpan ke server.',error)})},500)}
  function keyFor(date){return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')}
  function daysIn(year,month){return new Date(year,month+1,0).getDate()}
  function comparableDate(year,month,day){return new Date(year,month,Math.min(day,daysIn(year,month)))}
  function number(value){if(value===''||value===null||typeof value==='undefined')return null;var n=Number(value);return Number.isFinite(n)?n:null}
  function money(value){
    var n=number(value);return n===null?'':Math.round(n).toLocaleString('id-ID');
  }
  function metric(value){return value===null||!Number.isFinite(value)?'':Math.round(value).toLocaleString('id-ID')}
  function metricDecimal(value){
    if(value===null||!Number.isFinite(value))return'';
    return Math.floor(Number(value)).toLocaleString('id-ID');
  }
  function triple(spd,std,apc){
    if(spd===''&&std===''&&apc==='')return{spd:'',std:'',apc:''};
    return{spd:spd===''?'':spd+'_',std:std===''?'':std+'_',apc:apc||''};
  }
  function growthText(current,previous){if(current===null||previous===null||previous===0)return'';var value=(current/previous-1)*100;return(value>=0?'+':'')+value.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2})+'%'}
  function rowsFor(year,month,data){
    var count=daysIn(year,month),sales=0,struk=0,rows=[];
    data=data||{};
    for(var i=0;i<count;i+=1){
      var salesValue=number(data.salesNet&&data.salesNet[i]),strukValue=number(data.totalStruk&&data.totalStruk[i]);
      if(salesValue!==null)sales+=salesValue;
      if(strukValue!==null)struk+=strukValue;
      var hasSales=salesValue!==null,hasStruk=strukValue!==null,akmSales=hasSales?sales:null,akmStruk=hasStruk?struk:null,spd=akmSales!==null?akmSales/(i+1):null,std=akmStruk!==null?Math.floor(akmStruk/(i+1)):null;
      rows.push({sales:salesValue,struk:strukValue,akmSales:hasSales?sales:null,akmStruk:hasStruk?struk:null,spd:spd,std:std,apc:spd!==null&&std!==null&&std>0?spd/std:null});
    }
    return rows;
  }
  function lastRow(rows){for(var i=rows.length-1;i>=0;i-=1)if(rows[i].sales!==null||rows[i].struk!==null)return rows[i];return null}
  function buildValues(input){
    var now=getReportDate(),year=now.getFullYear(),month=now.getMonth(),data=reportMonth(keyFor(now)),current=rowsFor(year,month,data),last=current[now.getDate()-1]||null,values={TOKO:getStoreName(),TANGGAL:now.getDate()+' '+MONTH_NAMES[month]+' '+now.getFullYear()};
    for(var i=0;i<31;i+=1){var row=current[i];values['A_'+(i+1)]=row&&(row.sales!==null||row.struk!==null)?[money(row.sales),row.struk===null?'':metric(row.struk),metricDecimal(row.apc)].join('_'):''}
    var previousDate=comparableDate(year,month-1,now.getDate()),previousData=reportMonth(keyFor(previousDate)),previous=rowsFor(previousDate.getFullYear(),previousDate.getMonth(),previousData),previousLast=previous[Math.min(now.getDate(),previous.length)-1]||null;
    values.B_AKM_SALES=last?money(last.akmSales):'';values.C_AKM_STRUK=last?metric(last.akmStruk):'';
    var d=last?triple(metricDecimal(last.spd),metricDecimal(last.std),metricDecimal(last.apc)):triple('','','');values.D_SPD=d.spd;values.D_STD=d.std;values.D_APC=d.apc;
    values.E_TARGET_AKM=money(data.targetAkm);values.F_ACH=last&&data.targetSpd?String(Math.floor(last.spd/number(data.targetSpd)*100)):'';values.F_TARGET_SPD=money(data.targetSpd);
    var g=previousLast?triple(metricDecimal(previousLast.spd),metricDecimal(previousLast.std),metricDecimal(previousLast.apc)):triple('','','');values.G_SPD=g.spd;values.G_STD=g.std;values.G_APC=g.apc;
    values.H_SPD=last&&previousLast?growthText(last.spd,previousLast.spd):'';values.H_STD=last&&previousLast?growthText(last.std,previousLast.std):'';values.H_APC=last&&previousLast?growthText(last.apc,previousLast.apc):'';
    values.M_SPD=values.M_STD=values.M_APC='';
    values.N_SPD=values.N_STD=values.N_APC='';
    return Object.assign(values,input||{});
  }
  function formatValue(key,value){
    if(value===null||typeof value==='undefined')return'';
    var text=String(value);if(!text)return'';
    if(/^A_[0-9]+$/.test(key)&&text.indexOf('_')>=0)return text;
    return moneyKeys[key]&&text.indexOf('_')<0?money(text)||text:text;
  }
  function render(input){
    var values=buildValues(input),output=TEMPLATE.replace(/\{\{([A-Z0-9_]+)\}\}/g,function(match,key){return formatValue(key,values[key])});
    reportPre.textContent=output;
  }
  async function loadRemote(){
    var date=getReportDate(),keys=[keyFor(date),keyFor(new Date(date.getFullYear(),date.getMonth()-1,1))];
    await Promise.allSettled(keys.map(async function(key){
      var response=await fetch(API_BASE+'/api/month?month='+key,{headers:authHeaders(),cache:'no-store'});
      if(!response.ok)return;
      var remote=await response.json(),data={targetSpd:remote.targetSpd,targetAkm:remote.targetAkm,salesNet:[],totalStruk:[]};
      (remote.days||[]).forEach(function(row){data.salesNet[row.day-1]=row.salesNet;data.totalStruk[row.day-1]=row.totalStruk});
      reportRemoteMonths[key]=data;
    }));
    try{
      var before=getStoreName(),response=await fetch(API_BASE+'/api/settings',{headers:authHeaders(),cache:'no-store'});
      if(response.ok){var settings=await response.json();if(getStoreName()===before&&settings.storeName){setStoreName(settings.storeName);var input=document.getElementById('reportStoreName');if(input)input.value=settings.storeName}}
    }catch(error){}
    render();
  }

  var style=document.createElement('style');style.textContent='.report-card{margin:18px auto;max-width:900px;padding:16px;border:1px solid var(--line,#d8dee8);border-radius:18px;background:var(--surface,#fff)}.report-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.report-actions button{min-height:44px;padding:8px 14px;border:0;border-radius:12px;background:var(--blue,#1769aa);color:#fff;font-weight:800;cursor:pointer}.report-json{width:100%;min-height:80px;margin:0 0 10px;padding:10px;border:1px solid var(--line,#d8dee8);border-radius:10px;font:12px monospace}.report-output{overflow:auto;margin:0;padding:14px;border:1px solid var(--line,#d8dee8);border-radius:12px;background:var(--surface-2,#f7f9fb);white-space:pre-wrap;overflow-wrap:normal;font:13px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace}.report-store-setting input{width:100%;height:40px;margin-top:10px;padding:0 10px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);font-size:13px}html[data-skin="monochrome"] .report-actions button{background:#111;color:#fff}html[data-theme="dark"][data-skin="monochrome"] .report-actions button{background:#f1f1f1;color:#111}';document.head.appendChild(style);
  var card=document.createElement('section');card.className='report-card';card.innerHTML='<h2>Template Laporan Sales</h2><div class="report-actions"><label style="display:flex;align-items:center;gap:8px;font-weight:800">Tanggal laporan <input type="date" id="reportDate" min="2000-01-01"></label><button type="button" id="reportCopy">Copy Laporan</button></div><pre class="report-output" id="reportOutput"></pre>';var main=document.querySelector('main');if(main)main.appendChild(card);
  var settingsBody=document.querySelector('.settings-body');
  if(settingsBody){var storeCard=document.createElement('section');storeCard.className='setting-card report-store-setting';storeCard.innerHTML='<div class="setting-card-title"><h3>Nama Toko Laporan</h3></div><input id="reportStoreName" type="text" maxlength="100" placeholder="Nama toko" autocomplete="organization">';settingsBody.insertBefore(storeCard,settingsBody.firstChild);var storeInput=storeCard.querySelector('#reportStoreName');storeInput.value=getStoreName();storeInput.addEventListener('input',function(){setStoreName(storeInput.value);saveStoreNameRemote(storeInput.value);render()})}
  var reportPre=document.getElementById('reportOutput');
  var reportDateInput=document.getElementById('reportDate'),initialReportDate=getReportDate();reportDateInput.value=initialReportDate.getFullYear()+'-'+String(initialReportDate.getMonth()+1).padStart(2,'0')+'-'+String(initialReportDate.getDate()).padStart(2,'0');reportDateInput.max=initialReportDate.getFullYear()+'-'+String(initialReportDate.getMonth()+1).padStart(2,'0')+'-'+String(initialReportDate.getDate()).padStart(2,'0');reportDateInput.addEventListener('change',function(){if(!reportDateInput.value)return;var parts=reportDateInput.value.split('-').map(Number),date=new Date(parts[0],parts[1]-1,parts[2]);reportDateSession=date;render();loadRemote()});
  function checkCalendarDay(){var today=new Date();if(today.toDateString()===calendarDay)return;calendarDay=today.toDateString();reportDateSession=today;var value=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');reportDateInput.value=value;reportDateInput.max=value;render();loadRemote()}
  setInterval(checkCalendarDay,30000);
  window.addEventListener('focus',checkCalendarDay);
  document.addEventListener('visibilitychange',checkCalendarDay);
  window.addEventListener('salesflow-data-changed',function(){reportRemoteMonths={};render()});
  document.getElementById('reportCopy').addEventListener('click',async function(){try{await navigator.clipboard.writeText(reportPre.textContent);alert('Laporan berhasil disalin.')}catch(error){var area=document.createElement('textarea');area.value=reportPre.textContent;document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();alert('Laporan berhasil disalin.')}});
  window.addEventListener('salesflow-auth-changed',loadRemote);
  render();loadRemote();
})();

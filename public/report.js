(function(){
  'use strict';

  var DATA_KEY='sales-harian-data-v1';
  var AUTH_KEY='salesflow2-api-password';
  var STORE_NAME_KEY='salesflow2-report-store-name-v1';
  var YOY_KEY='salesflow2-yoy-data-v1';
  var storeSaveTimer=null;
  var reportDateSession=new Date();
  var calendarDay=reportDateSession.toDateString(),reportRemoteMonths={};
  function reportMonth(key){
    var local=getLocal().months[key];
    try{if((JSON.parse(localStorage.getItem('salesflow2-pending-months-v1'))||{})[key])return local||{}}catch(error){}
    return reportRemoteMonths[key]||local||{};
  }
  function getYoyStore(){
    try{var data=JSON.parse(localStorage.getItem(YOY_KEY));return data&&typeof data==='object'?data:{}}catch(error){return{}}
  }
  function setYoyStore(data){
    try{localStorage.setItem(YOY_KEY,JSON.stringify(data))}catch(error){}
  }
  function dateKey(date){
    return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
  }
  function getManualYoY(key){
    return getYoyStore()[key]||null;
  }
  function saveManualYoY(key,yoy){
    var store=getYoyStore();
    if(!yoy||(yoy.spd===null&&yoy.std===null&&yoy.apc===null)){
      delete store[key];
    }else{
      store[key]=yoy;
    }
    setYoyStore(store);
  }
  function parseNumber(value){
    if(value===''||value===null||typeof value==='undefined')return null;
    var clean=String(value).replace(/\s+/g,'').replace(/\./g,'').replace(/,/g,'.');
    var n=Number(clean);
    return Number.isFinite(n)?n:null;
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
      rows.push({sales:salesValue,struk:strukValue,akmSales:akmSales,akmStruk:akmStruk,spd:spd,std:std,apc:spd!==null&&std!==null&&std>0?spd/std:null,dailyApc:hasSales&&hasStruk&&strukValue>0?salesValue/strukValue:null});
    }
    return rows;
  }
  function lastRow(rows){for(var i=rows.length-1;i>=0;i-=1)if(rows[i].sales!==null||rows[i].struk!==null)return rows[i];return null}
  function buildValues(input){
    var now=getReportDate(),year=now.getFullYear(),month=now.getMonth(),data=reportMonth(keyFor(now)),current=rowsFor(year,month,data),last=current[now.getDate()-1]||null,values={TOKO:getStoreName(),TANGGAL:now.getDate()+' '+MONTH_NAMES[month]+' '+now.getFullYear()};
    for(var i=0;i<31;i+=1){var row=current[i];values['A_'+(i+1)]=row&&(row.sales!==null||row.struk!==null)?[money(row.sales),row.struk===null?'':metric(row.struk),metricDecimal(row.dailyApc)].join('_'):''}
    var previousDate=comparableDate(year,month-1,now.getDate()),previousData=reportMonth(keyFor(previousDate)),previous=rowsFor(previousDate.getFullYear(),previousDate.getMonth(),previousData),previousLast=previous[Math.min(now.getDate(),previous.length)-1]||null;
    var yearAgoDate=comparableDate(year-1,month,now.getDate()),yearAgoData=reportMonth(keyFor(yearAgoDate)),yearAgo=rowsFor(yearAgoDate.getFullYear(),yearAgoDate.getMonth(),yearAgoData),yearAgoLast=yearAgo[Math.min(yearAgoDate.getDate(),yearAgo.length)-1]||null;
    var manualYoY=getManualYoY(dateKey(now)),effectiveYearAgo=yearAgoLast;
    if(manualYoY&&(manualYoY.spd!==null||manualYoY.std!==null||manualYoY.apc!==null)){
      var manualSpd=manualYoY.spd!==null?manualYoY.spd:(yearAgoLast?yearAgoLast.spd:null);
      var manualStd=manualYoY.std!==null?manualYoY.std:(yearAgoLast?yearAgoLast.std:null);
      var manualApc=manualYoY.apc!==null?manualYoY.apc:(manualSpd!==null&&manualStd!==null&&manualStd>0?manualSpd/manualStd:(yearAgoLast?yearAgoLast.apc:null));
      effectiveYearAgo={spd:manualSpd,std:manualStd,apc:manualApc};
    }
    values.B_AKM_SALES=last?money(last.akmSales):'';values.C_AKM_STRUK=last?metric(last.akmStruk):'';
    var d=last?triple(metricDecimal(last.spd),metricDecimal(last.std),metricDecimal(last.apc)):triple('','','');values.D_SPD=d.spd;values.D_STD=d.std;values.D_APC=d.apc;
    values.E_TARGET_AKM=money(data.targetAkm);values.F_ACH=last&&data.targetSpd?String(Math.floor(last.spd/number(data.targetSpd)*100)):'';values.F_TARGET_SPD=money(data.targetSpd);
    var g=previousLast?triple(metricDecimal(previousLast.spd),metricDecimal(previousLast.std),metricDecimal(previousLast.apc)):triple('','','');values.G_SPD=g.spd;values.G_STD=g.std;values.G_APC=g.apc;
    values.H_SPD=last&&previousLast?growthText(last.spd,previousLast.spd):'';values.H_STD=last&&previousLast?growthText(last.std,previousLast.std):'';values.H_APC=last&&previousLast?growthText(last.apc,previousLast.apc):'';
    var m=effectiveYearAgo?triple(metricDecimal(effectiveYearAgo.spd),metricDecimal(effectiveYearAgo.std),metricDecimal(effectiveYearAgo.apc)):triple('','','');values.M_SPD=m.spd;values.M_STD=m.std;values.M_APC=m.apc;
    values.N_SPD=last&&effectiveYearAgo&&effectiveYearAgo.spd!==null?growthText(last.spd,effectiveYearAgo.spd):'';values.N_STD=last&&effectiveYearAgo&&effectiveYearAgo.std!==null?growthText(last.std,effectiveYearAgo.std):'';values.N_APC=last&&effectiveYearAgo&&effectiveYearAgo.apc!==null?growthText(last.apc,effectiveYearAgo.apc):'';
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
    var date=getReportDate(),keys=[keyFor(date),keyFor(new Date(date.getFullYear(),date.getMonth()-1,1)),keyFor(new Date(date.getFullYear()-1,date.getMonth(),1))];
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

  var style=document.createElement('style');style.textContent='.report-card{margin:18px auto;max-width:900px;padding:16px;border:1px solid var(--line,#d8dee8);border-radius:18px;background:var(--surface,#fff)}.report-actions{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.report-actions button{min-height:44px;padding:8px 14px;border:0;border-radius:12px;background:var(--blue,#1769aa);color:#fff;font-weight:800;cursor:pointer}.report-json{width:100%;min-height:80px;margin:0 0 10px;padding:10px;border:1px solid var(--line,#d8dee8);border-radius:10px;font:12px monospace}.report-output{overflow:auto;margin:0;padding:14px;border:1px solid var(--line,#d8dee8);border-radius:12px;background:var(--surface-2,#f7f9fb);white-space:pre-wrap;overflow-wrap:normal;font:13px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace}.report-store-setting input{width:100%;height:40px;margin-top:10px;padding:0 10px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);font-size:13px}.report-yoy-box{margin-bottom:14px;padding:12px 14px;border:1px solid var(--line,#d8dee8);border-radius:12px;background:var(--surface-2,#f7f9fb)}.report-yoy-header{display:flex;flex-direction:column;gap:3px;margin-bottom:10px}.report-yoy-title{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;font-size:13px;color:var(--ink,#182230)}.report-yoy-date{font-size:11px;font-weight:700;color:var(--blue,#245a87);padding:2px 8px;border-radius:6px;background:var(--blue-soft,#eaf2f9)}.report-yoy-desc{font-size:11px;color:var(--muted,#6b7789)}.report-yoy-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}.report-yoy-field{display:flex;flex-direction:column;gap:4px;font-size:11px;font-weight:700;color:var(--muted,#6b7789)}.report-yoy-field input{height:38px;min-height:38px;padding:0 10px;border:1px solid var(--line,#d8dee8);border-radius:8px;background:var(--surface,#fff);color:var(--ink,#182230);font-size:13px;font-weight:600;width:100%;box-sizing:border-box}.report-yoy-field input:focus{outline:0;border-color:var(--focus,#4c8fd0);box-shadow:0 0 0 2px var(--blue-soft,rgba(36,90,135,.15))}html[data-skin="monochrome"] .report-actions button{background:#111;color:#fff}html[data-theme="dark"][data-skin="monochrome"] .report-actions button{background:#f1f1f1;color:#111}html[data-skin="monochrome"] .report-yoy-box{border-radius:8px;border-color:var(--line);background:var(--surface-2)}html[data-skin="monochrome"] .report-yoy-date{background:var(--track);color:var(--ink)}html[data-skin="monochrome"] .report-yoy-field input{border-radius:6px;border-color:var(--line)}html[data-skin="luxe"] .report-yoy-box{border-radius:var(--radius-md);border-color:var(--line);background:var(--surface-2)}html[data-skin="luxe"] .report-yoy-date{background:var(--luxe-gold-glow);color:var(--luxe-gold)}html[data-skin="luxe"] .report-yoy-field input{border-radius:8px;border-color:var(--line)}';document.head.appendChild(style);
  var card=document.createElement('section');card.className='report-card';card.innerHTML='<h2>Template Laporan Sales</h2><div class="report-actions"><label style="display:flex;align-items:center;gap:8px;font-weight:800">Tanggal laporan <input type="date" id="reportDate" min="2000-01-01"></label><button type="button" id="reportCopy">Copy Laporan</button></div><div class="report-yoy-box"><div class="report-yoy-header"><div class="report-yoy-title"><strong>Data Pembanding Tahun Lalu (YoY)</strong><span class="report-yoy-date" id="reportYoyDateLabel">-</span></div><small class="report-yoy-desc">Input manual data tanggal &amp; bulan yang sama di tahun sebelumnya untuk poin M &amp; N.</small></div><div class="report-yoy-grid"><label class="report-yoy-field"><span>SPD Tahun Lalu</span><input type="text" id="reportYoySpd" inputmode="numeric" placeholder="0" autocomplete="off" aria-label="SPD Tahun Lalu"></label><label class="report-yoy-field"><span>STD Tahun Lalu</span><input type="text" id="reportYoyStd" inputmode="numeric" placeholder="0" autocomplete="off" aria-label="STD Tahun Lalu"></label><label class="report-yoy-field"><span>APC Tahun Lalu</span><input type="text" id="reportYoyApc" inputmode="numeric" placeholder="Otomatis / manual" autocomplete="off" aria-label="APC Tahun Lalu"></label></div></div><pre class="report-output" id="reportOutput"></pre>';var main=document.querySelector('main');if(main)main.appendChild(card);
  var settingsBody=document.querySelector('.settings-body');
  if(settingsBody){var storeCard=document.createElement('section');storeCard.className='setting-card report-store-setting';storeCard.innerHTML='<div class="setting-card-title"><h3>Nama Toko Laporan</h3></div><input id="reportStoreName" type="text" maxlength="100" placeholder="Nama toko" autocomplete="organization">';settingsBody.insertBefore(storeCard,settingsBody.firstChild);var storeInput=storeCard.querySelector('#reportStoreName');storeInput.value=getStoreName();storeInput.addEventListener('input',function(){setStoreName(storeInput.value);saveStoreNameRemote(storeInput.value);render()})}
  var reportPre=document.getElementById('reportOutput');
  var yoyDateLabel=document.getElementById('reportYoyDateLabel');
  var yoySpdInput=document.getElementById('reportYoySpd');
  var yoyStdInput=document.getElementById('reportYoyStd');
  var yoyApcInput=document.getElementById('reportYoyApc');
  function syncYoyInputs(){
    var now=getReportDate(),key=dateKey(now);
    var yearAgoDate=comparableDate(now.getFullYear()-1,now.getMonth(),now.getDate());
    if(yoyDateLabel){
      yoyDateLabel.textContent=yearAgoDate.getDate()+' '+MONTH_NAMES[yearAgoDate.getMonth()]+' '+yearAgoDate.getFullYear();
    }
    if(!yoySpdInput||!yoyStdInput||!yoyApcInput)return;
    var manual=getManualYoY(key);
    var yearAgoData=reportMonth(keyFor(yearAgoDate)),yearAgo=rowsFor(yearAgoDate.getFullYear(),yearAgoDate.getMonth(),yearAgoData),yearAgoLast=yearAgo[Math.min(yearAgoDate.getDate(),yearAgo.length)-1]||null;
    if(manual){
      yoySpdInput.value=manual.spd!==null?Math.round(manual.spd).toLocaleString('id-ID'):'';
      yoyStdInput.value=manual.std!==null?Math.round(manual.std).toLocaleString('id-ID'):'';
      yoyApcInput.value=manual.apc!==null?Math.round(manual.apc).toLocaleString('id-ID'):'';
    }else{
      yoySpdInput.value='';
      yoyStdInput.value='';
      yoyApcInput.value='';
      yoySpdInput.placeholder=yearAgoLast&&yearAgoLast.spd!==null?Math.round(yearAgoLast.spd).toLocaleString('id-ID'):'0';
      yoyStdInput.placeholder=yearAgoLast&&yearAgoLast.std!==null?Math.round(yearAgoLast.std).toLocaleString('id-ID'):'0';
      yoyApcInput.placeholder=yearAgoLast&&yearAgoLast.apc!==null?Math.round(yearAgoLast.apc).toLocaleString('id-ID'):'Otomatis / manual';
    }
  }
  function handleYoyChange(isBlur){
    if(!yoySpdInput||!yoyStdInput||!yoyApcInput)return;
    var now=getReportDate(),key=dateKey(now);
    var spd=parseNumber(yoySpdInput.value);
    var std=parseNumber(yoyStdInput.value);
    var apc=parseNumber(yoyApcInput.value);
    if(apc===null&&spd!==null&&std!==null&&std>0){
      yoyApcInput.placeholder=Math.round(spd/std).toLocaleString('id-ID');
    }else{
      yoyApcInput.placeholder='Otomatis / manual';
    }
    if(isBlur){
      if(spd!==null)yoySpdInput.value=Math.round(spd).toLocaleString('id-ID');
      if(std!==null)yoyStdInput.value=Math.round(std).toLocaleString('id-ID');
      if(apc!==null)yoyApcInput.value=Math.round(apc).toLocaleString('id-ID');
    }
    saveManualYoY(key,{spd:spd,std:std,apc:apc});
    render();
  }
  if(yoySpdInput&&yoyStdInput&&yoyApcInput){
    [yoySpdInput,yoyStdInput,yoyApcInput].forEach(function(input){
      input.addEventListener('input',function(){handleYoyChange(false)});
      input.addEventListener('blur',function(){handleYoyChange(true)});
    });
  }
  var reportDateInput=document.getElementById('reportDate'),initialReportDate=getReportDate();reportDateInput.value=initialReportDate.getFullYear()+'-'+String(initialReportDate.getMonth()+1).padStart(2,'0')+'-'+String(initialReportDate.getDate()).padStart(2,'0');reportDateInput.max=initialReportDate.getFullYear()+'-'+String(initialReportDate.getMonth()+1).padStart(2,'0')+'-'+String(initialReportDate.getDate()).padStart(2,'0');reportDateInput.addEventListener('change',function(){if(!reportDateInput.value)return;var parts=reportDateInput.value.split('-').map(Number),date=new Date(parts[0],parts[1]-1,parts[2]);reportDateSession=date;syncYoyInputs();render();loadRemote()});
  function checkCalendarDay(){var today=new Date();if(today.toDateString()===calendarDay)return;calendarDay=today.toDateString();reportDateSession=today;var value=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');reportDateInput.value=value;reportDateInput.max=value;if(typeof syncYoyInputs==='function')syncYoyInputs();render();loadRemote()}
  setInterval(checkCalendarDay,30000);
  window.addEventListener('focus',checkCalendarDay);
  document.addEventListener('visibilitychange',checkCalendarDay);
  window.addEventListener('salesflow-data-changed',function(){reportRemoteMonths={};render()});
  document.getElementById('reportCopy').addEventListener('click',async function(){try{await navigator.clipboard.writeText(reportPre.textContent);alert('Laporan berhasil disalin.')}catch(error){var area=document.createElement('textarea');area.value=reportPre.textContent;document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();alert('Laporan berhasil disalin.')}});
  window.addEventListener('salesflow-auth-changed',loadRemote);
  syncYoyInputs();render();loadRemote();
})();

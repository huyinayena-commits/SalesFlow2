  (function(){
    'use strict';

    var KEY='sales-harian-data-v1';
    var VIEW_KEY='sales-harian-view-v1';
    var THEME_KEY='sales-harian-theme-v1';
    var THEME_VARIANT_KEY='sales-harian-theme-variant-v1';
    var AUTH_KEY='salesflow2-api-password';
    var TELEGRAM_KEY='sales-harian-telegram-v1';
    var themeMode=loadThemeMode();
    var themeVariant=loadThemeVariant();
    document.documentElement.setAttribute('data-theme',themeMode);
    document.documentElement.style.colorScheme=themeMode;
    var now=new Date();
    var currentYear=now.getFullYear();
    var currentMonthIndex=now.getMonth();
    var viewYear=currentYear;
    var viewMonth=currentMonthIndex;
    var lastSavedAt=null;
    var saveTimer=null;
    var syncTimer=null;
    var toastTimer=null;
    var telegramTimers={};
    var telegramQueue=[];
    var telegramFailed={};
    var telegramSending=false;
    var telegramServerReady=false;
    var lastSettingsFocus=null;
    var autoTodayScroll=true;
    var names=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    var elements={
      previousMonth:document.getElementById('previousMonth'),
      nextMonth:document.getElementById('nextMonth'),
      monthButton:document.getElementById('monthButton'),
      monthPicker:document.getElementById('monthPicker'),
      monthTitle:document.getElementById('monthTitle'),
      daysLabel:document.getElementById('daysLabel'),
      dataViews:document.getElementById('dataViews'),
      horizontalView:document.getElementById('horizontalView'),
      horizontalScroll:document.querySelector('.horizontal-scroll'),
      verticalView:document.getElementById('verticalView'),
      horizontalRows:document.getElementById('horizontalRows'),
      dayList:document.getElementById('dayList'),
      horizontalToggle:document.getElementById('horizontalToggle'),
      verticalToggle:document.getElementById('verticalToggle'),
      saveState:document.getElementById('saveState'),
      targetMonth:document.getElementById('targetMonth'),
      targetSpd:document.getElementById('targetSpd'),
      targetAkm:document.getElementById('targetAkm'),
      targetsPanel:document.getElementById('targetsPanel'),
      targetsToggle:document.getElementById('targetsToggle'),
      themeColor:document.getElementById('themeColor'),
      settingsButton:document.getElementById('settingsButton'),
      settingsOverlay:document.getElementById('settingsOverlay'),
      settingsPanel:document.getElementById('settingsPanel'),
      closeSettings:document.getElementById('closeSettings'),
      themeToggle:document.getElementById('themeToggle'),
      themeTitle:document.getElementById('themeTitle'),
      themeLabel:document.getElementById('themeLabel'),
      themeVariant:document.getElementById('themeVariant'),
      exportButton:document.getElementById('exportButton'),
      importButton:document.getElementById('importButton'),
      jsonFileInput:document.getElementById('jsonFileInput'),
      importStatus:document.getElementById('importStatus'),
      importMonth:document.getElementById('importMonth'),
      telegramDot:document.getElementById('telegramDot'),
      telegramStatusTitle:document.getElementById('telegramStatusTitle'),
      telegramStatusText:document.getElementById('telegramStatusText'),
      telegramConnect:document.getElementById('telegramConnect'),
      telegramConnectLabel:document.getElementById('telegramConnectLabel'),
      telegramAutoSend:document.getElementById('telegramAutoSend'),
      telegramMessage:document.getElementById('telegramMessage'),
      authPasswordInput:document.getElementById('authPasswordInput'),
      authPasswordSave:document.getElementById('authPasswordSave'),
      authPasswordStatus:document.getElementById('authPasswordStatus'),
      toast:document.getElementById('toast')
    };
    var store=loadStore();
    var viewMode=loadViewMode();
    var telegramState=loadTelegramState();
    elements.monthPicker.max=monthKey(currentYear,currentMonthIndex);

    function loadThemeMode(){
      try{return localStorage.getItem(THEME_KEY)==='dark'?'dark':'light'}catch(error){return'light'}
    }

    function loadThemeVariant(){
      try{return localStorage.getItem(THEME_VARIANT_KEY)==='monochrome'?'monochrome':'classic'}catch(error){return'classic'}
    }

    function loadViewMode(){
      try{return localStorage.getItem(VIEW_KEY)==='vertical'?'vertical':'horizontal'}catch(error){return'horizontal'}
    }

    function loadStore(){
      try{
        var parsed=JSON.parse(localStorage.getItem(KEY));
        if(parsed&&parsed.months&&typeof parsed.months==='object')return parsed;
      }catch(error){console.warn('Data lokal tidak dapat dibaca.',error)}
      return{version:1,months:{}};
    }

    function loadLastSaved(){try{return localStorage.getItem('sales-harian-last-saved-v1')||null}catch(error){return null}}
    function saveLastSaved(value){try{localStorage.setItem('sales-harian-last-saved-v1',value)}catch(error){}}
    function updateTableInfo(status){
      var selectedDay=viewYear===currentYear&&viewMonth===currentMonthIndex?now.getDate():1;
      var dateText=new Date(viewYear,viewMonth,selectedDay).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
      elements.daysLabel.textContent=dateText+' · '+dayCount(viewYear,viewMonth)+' hari · '+status;
    }
    function markSaved(){
      var date=new Date();lastSavedAt=String(date.getHours()).padStart(2,'0')+'.'+String(date.getMinutes()).padStart(2,'0');
      saveLastSaved(lastSavedAt);updateTableInfo('Terakhir tersimpan: '+lastSavedAt);
    }

    function loadTelegramState(){
      var fallback={chatId:'',chatName:'',botUsername:'',enabled:false,messages:{}};
      try{
        var parsed=JSON.parse(localStorage.getItem(TELEGRAM_KEY));
        if(!parsed||typeof parsed!=='object')return fallback;
        var chatId=typeof parsed.chatId==='string'&&/^-?[0-9]{1,20}$/.test(parsed.chatId)?parsed.chatId:'';
        return{
          chatId:chatId,
          chatName:typeof parsed.chatName==='string'?parsed.chatName.slice(0,80):'',
          botUsername:typeof parsed.botUsername==='string'?parsed.botUsername.slice(0,40):'',
          enabled:Boolean(parsed.enabled&&chatId),
          messages:parsed.messages&&typeof parsed.messages==='object'&&!Array.isArray(parsed.messages)?parsed.messages:{}
        };
      }catch(error){return fallback}
    }

    function saveTelegramState(){
      try{localStorage.setItem(TELEGRAM_KEY,JSON.stringify(telegramState))}catch(error){}
    }

    function applyTheme(mode,persist){
      themeMode=mode==='dark'?'dark':'light';
      document.documentElement.setAttribute('data-theme',themeMode);
      document.documentElement.style.colorScheme=themeMode;
      elements.themeColor.setAttribute('content',themeMode==='dark'?'#0d131b':'#f4f6f9');
      elements.themeLabel.textContent=(themeVariant==='monochrome'?'Tema 2 — Monochrome · ':'Tema 1 — SalesFlow Klasik · ')+(themeMode==='dark'?'Mode Gelap':'Mode Terang');
      var nextTheme=themeMode==='dark'?'Terang':'Gelap';
      elements.themeToggle.setAttribute('aria-label','Aktifkan Mode '+nextTheme);
      elements.themeToggle.setAttribute('title','Aktifkan Mode '+nextTheme);
      if(persist){try{localStorage.setItem(THEME_KEY,themeMode)}catch(error){}}
    }

    function applyThemeVariant(variant,persist){
      themeVariant=variant==='monochrome'?'monochrome':'classic';
      document.documentElement.setAttribute('data-skin',themeVariant);
      elements.themeVariant.value=themeVariant;
      elements.themeTitle.textContent=themeVariant==='monochrome'?'Tema 2 — Monochrome':'Tema 1 — SalesFlow Klasik';
      applyTheme(themeMode,false);
      if(persist){try{localStorage.setItem(THEME_VARIANT_KEY,themeVariant)}catch(error){}}
    }

    applyThemeVariant(themeVariant,false);
    applyTheme(themeMode,false);
    lastSavedAt=loadLastSaved();

    function saveStore(){
      try{
        localStorage.setItem(KEY,JSON.stringify(store));
        elements.saveState.textContent='Menyimpan…';
        elements.saveState.classList.add('saving');
        updateTableInfo('Tersimpan di perangkat · Menunggu sinkronisasi');
        scheduleRemoteSync();
      }catch(error){elements.saveState.textContent='Gagal tersimpan';elements.saveState.classList.remove('saving')}
    }

    function monthKey(year,month){return String(year)+'-'+String(month+1).padStart(2,'0')}
    function dayCount(year,month){return new Date(year,month+1,0).getDate()}
    function previousMonthOf(year,month){return month===0?{year:year-1,month:11}:{year:year,month:month-1}}
    function normalize(value){if(value===''||value===null||typeof value==='undefined')return'';var number=Number(value);return Number.isFinite(number)&&number>=0?number:''}

    function ensureMonth(year,month){
      var key=monthKey(year,month);
      var count=dayCount(year,month);
      if(!store.months[key])store.months[key]={targetSpd:'',targetAkm:'',salesNet:[],totalStruk:[]};
      var data=store.months[key];
      data.targetSpd=normalize(data.targetSpd);
      data.targetAkm=normalize(data.targetAkm);
      if(!Array.isArray(data.salesNet))data.salesNet=[];
      if(!Array.isArray(data.totalStruk))data.totalStruk=[];
      data.salesNet=data.salesNet.slice(0,count).map(normalize);
      data.totalStruk=data.totalStruk.slice(0,count).map(normalize);
      while(data.salesNet.length<count)data.salesNet.push('');
      while(data.totalStruk.length<count)data.totalStruk.push('');
      return data;
    }

    function readMonth(year,month){return store.months[monthKey(year,month)]?ensureMonth(year,month):null}

    function calculateMonth(year,month,data){
      var count=dayCount(year,month),target=data?normalize(data.targetSpd):'',sales=0,struk=0,rows=[];
      for(var index=0;index<count;index+=1){
        var day=index+1;
        var salesValue=data&&index<data.salesNet.length?normalize(data.salesNet[index]):'';
        var strukValue=data&&index<data.totalStruk.length?normalize(data.totalStruk[index]):'';
        var hasSales=salesValue!=='';
        var hasStruk=strukValue!=='';
        if(hasSales)sales+=salesValue;
        if(hasStruk)struk+=strukValue;
        var akmSales=hasSales?sales:null;
        var spd=akmSales!==null?akmSales/day:null;
        var achievement=spd!==null&&target!==''&&target>0?spd/target*100:null;
        var akmStruk=hasStruk?struk:null;
        var std=akmStruk!==null?Math.floor(akmStruk/day):null;
        var apc=spd!==null&&std!==null&&std>0?spd/std:null;
        rows.push({akmSales:akmSales,spd:spd,achievement:achievement,akmStruk:akmStruk,std:std,apc:apc});
      }
      return rows;
    }

    function parseInput(value){
      var digits=String(value).replace(/[^0-9]/g,'');
      if(!digits)return'';
      var number=Number(digits);
      return Number.isSafeInteger(number)?number:'';
    }

    function formatNumber(value){return value===null||value===''||typeof value==='undefined'||!Number.isFinite(Number(value))?'—':Math.round(Number(value)).toLocaleString('id-ID')}
    function formatDecimal(value){
      if(value===null||value===''||typeof value==='undefined'||!Number.isFinite(Number(value)))return'—';
      return Math.floor(Number(value)).toLocaleString('id-ID');
    }
    function formatInput(value){return value===''||value===null||typeof value==='undefined'?'':Number(value).toLocaleString('id-ID')}
    function formatPercent(value){return value===null||!Number.isFinite(value)?'—':value.toLocaleString('id-ID',{minimumFractionDigits:1,maximumFractionDigits:1})+'%'}
    function formatGrowth(value){return value===null||!Number.isFinite(value)?'—':value.toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2})+'%'}
    function growth(current,previous){return current===null||previous===null||!Number.isFinite(current)||!Number.isFinite(previous)||previous===0?null:(current/previous-1)*100}
    function growthClass(value){return value===null||!Number.isFinite(value)?'empty':value>.0001?'positive':value<-.0001?'negative':'neutral'}

    function metric(label,column,detail,full){
      var detailHtml=detail?'<em>'+detail+'</em>':'';
      return'<div class="metric-item'+(full?' full':'')+'"><span class="metric-label">'+label+detailHtml+'</span><strong class="metric-value empty" data-column="'+column+'">—</strong></div>';
    }

    function dateLabel(day){
      return new Date(viewYear,viewMonth,day).toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'short'});
    }

    function buildCards(data){
      var count=dayCount(viewYear,viewMonth);
      var isCurrent=viewYear===currentYear&&viewMonth===currentMonthIndex;
      var html='';
      for(var index=0;index<count;index+=1){
        var day=index+1;
        var isToday=isCurrent&&day===now.getDate();
        html+='<article class="day-card'+(isToday?' today':'')+'" data-day-card="'+index+'">';
        html+='<header class="day-header"><div class="day-number"><span>Hari</span><strong>'+String(day).padStart(2,'0')+'</strong></div><div class="day-date"><strong>'+dateLabel(day)+'</strong><small>Data operasional hari ke-'+day+'</small></div><span class="today-chip">Hari ini</span></header>';
        html+='<div class="input-grid"><label class="input-box sales-input"><span>Sales NET</span><input class="number-input" data-field="salesNet" data-index="'+index+'" inputmode="numeric" autocomplete="off" placeholder="0" value="'+formatInput(data.salesNet[index])+'" aria-label="Sales NET hari '+day+'"></label><label class="input-box struk-input"><span>Total Struk</span><input class="number-input" data-field="totalStruk" data-index="'+index+'" inputmode="numeric" autocomplete="off" placeholder="0" value="'+formatInput(data.totalStruk[index])+'" aria-label="Total Struk hari '+day+'"></label></div>';
        html+='<section class="metrics-section sales"><div class="section-label">Sales NET</div><div class="metric-grid">'+metric('AKM Sales','akmSales','Akumulasi',false)+metric('SPD','spd','Sales / hari',false)+metric('Ach SPD','achievement','vs target',false)+metric('SPD Lalu','spdPast','Read-only',false)+metric('Growth','growthSpd','SPD',true)+'</div></section>';
        html+='<section class="metrics-section struk"><div class="section-label">Struk</div><div class="metric-grid">'+metric('AKM Struk','akmStruk','Akumulasi',false)+metric('STD','std','Struk / hari',false)+metric('STD Lalu','stdPast','Read-only',false)+metric('Growth','growthStd','STD',false)+'</div></section>';
        html+='<section class="metrics-section apc"><div class="section-label">APC</div><div class="metric-grid">'+metric('APC','apc','SPD / STD',false)+metric('APC Lalu','apcPast','Read-only',false)+metric('Growth','growthApc','APC',true)+'</div></section>';
        html+='</article>';
      }
      elements.dayList.innerHTML=html;
    }

    function buildHorizontalTable(data){
      var count=dayCount(viewYear,viewMonth);
      var isCurrent=viewYear===currentYear&&viewMonth===currentMonthIndex;
      var html='';
      for(var index=0;index<count;index+=1){
        var day=index+1;
        var rowClass=isCurrent&&day===now.getDate()?' class="today-row"':'';
        html+='<tr'+rowClass+' data-day-card="'+index+'">';
        html+='<td class="sticky-day">'+day+'</td>';
        html+='<td class="sales-cell"><input class="table-input number-input" data-field="salesNet" data-index="'+index+'" inputmode="numeric" autocomplete="off" placeholder="0" value="'+formatInput(data.salesNet[index])+'" aria-label="Sales NET hari '+day+'"></td>';
        html+='<td class="sales-cell"><strong class="metric-value empty" data-column="akmSales">—</strong></td>';
        html+='<td class="sales-cell"><strong class="metric-value empty" data-column="spd">—</strong></td>';
        html+='<td class="sales-cell"><strong class="metric-value empty" data-column="achievement">—</strong></td>';
        html+='<td class="sales-cell"><strong class="metric-value empty" data-column="spdPast">—</strong></td>';
        html+='<td class="sales-cell"><strong class="metric-value empty" data-column="growthSpd">—</strong></td>';
        html+='<td class="struk-cell"><input class="table-input number-input" data-field="totalStruk" data-index="'+index+'" inputmode="numeric" autocomplete="off" placeholder="0" value="'+formatInput(data.totalStruk[index])+'" aria-label="Total Struk hari '+day+'"></td>';
        html+='<td class="struk-cell"><strong class="metric-value empty" data-column="akmStruk">—</strong></td>';
        html+='<td class="struk-cell"><strong class="metric-value empty" data-column="std">—</strong></td>';
        html+='<td class="struk-cell"><strong class="metric-value empty" data-column="stdPast">—</strong></td>';
        html+='<td class="struk-cell"><strong class="metric-value empty" data-column="growthStd">—</strong></td>';
        html+='<td class="apc-cell"><strong class="metric-value empty" data-column="apc">—</strong></td>';
        html+='<td class="apc-cell"><strong class="metric-value empty" data-column="apcPast">—</strong></td>';
        html+='<td class="apc-cell"><strong class="metric-value empty" data-column="growthApc">—</strong></td>';
        html+='</tr>';
      }
      elements.horizontalRows.innerHTML=html;
    }

    function activeRoot(){return viewMode==='horizontal'?elements.horizontalRows:elements.dayList}

    function renderData(data){
      var horizontal=viewMode==='horizontal';
      elements.horizontalView.hidden=!horizontal;
      elements.verticalView.hidden=horizontal;
      elements.horizontalToggle.classList.toggle('active',horizontal);
      elements.verticalToggle.classList.toggle('active',!horizontal);
      elements.horizontalToggle.setAttribute('aria-pressed',String(horizontal));
      elements.verticalToggle.setAttribute('aria-pressed',String(!horizontal));
      if(horizontal){elements.dayList.innerHTML='';buildHorizontalTable(data)}else{elements.horizontalRows.innerHTML='';buildCards(data)}
    }

    function scrollToTodayOnOpen(){
      if(!autoTodayScroll||viewYear!==currentYear||viewMonth!==currentMonthIndex)return;
      requestAnimationFrame(function(){
        if(!autoTodayScroll)return;
        var target=viewMode==='horizontal'?elements.horizontalRows.querySelector('.today-row'):elements.dayList.querySelector('.day-card.today');
        if(!target)return;
        if(viewMode==='horizontal'){
          var scroller=elements.horizontalScroll;
          scroller.scrollTop=Math.max(0,target.offsetTop-(scroller.clientHeight-target.offsetHeight)/2);
        }else target.scrollIntoView({block:'start',behavior:'auto'});
      });
    }

    function setValue(index,column,value,type){
      var card=activeRoot().querySelector('[data-day-card="'+index+'"]');
      if(!card)return;
      var cell=card.querySelector('[data-column="'+column+'"]');
      if(!cell)return;
      cell.classList.remove('empty','positive','negative','neutral');
      cell.textContent=type==='growth'?formatGrowth(value):type==='percent'?formatPercent(value):type==='decimal'?formatDecimal(value):formatNumber(value);
      if(value===null||!Number.isFinite(Number(value)))cell.classList.add('empty');
      if(type==='growth')cell.classList.add(growthClass(value));
    }

    function paintCalculations(){
      var data=ensureMonth(viewYear,viewMonth);
      var currentRows=calculateMonth(viewYear,viewMonth,data);
      var previous=previousMonthOf(viewYear,viewMonth);
      var previousRows=calculateMonth(previous.year,previous.month,readMonth(previous.year,previous.month));
      currentRows.forEach(function(row,index){
        var old=index<previousRows.length?previousRows[index]:null;
        var oldSpd=old?old.spd:null;
        var oldStd=old?old.std:null;
        var oldApc=old?old.apc:null;
        setValue(index,'akmSales',row.akmSales,'number');
        setValue(index,'spd',row.spd,'decimal');
        setValue(index,'achievement',row.achievement,'percent');
        setValue(index,'spdPast',oldSpd,'number');
        setValue(index,'growthSpd',growth(row.spd,oldSpd),'growth');
        setValue(index,'akmStruk',row.akmStruk,'number');
        setValue(index,'std',row.std,'decimal');
        setValue(index,'stdPast',oldStd,'number');
        setValue(index,'growthStd',growth(row.std,oldStd),'growth');
        setValue(index,'apc',row.apc,'decimal');
        setValue(index,'apcPast',oldApc,'number');
        setValue(index,'growthApc',growth(row.apc,oldApc),'growth');
      });
    }

    function renderMonth(skipRemote){
      var data=ensureMonth(viewYear,viewMonth);
      var count=dayCount(viewYear,viewMonth);
      var label=names[viewMonth]+' '+viewYear;
      elements.monthPicker.value=monthKey(viewYear,viewMonth);
      elements.monthTitle.textContent=label;
      updateTableInfo(lastSavedAt?'Terakhir tersimpan: '+lastSavedAt:'Belum ada perubahan tersimpan');
      elements.targetMonth.textContent=label;
      elements.importMonth.textContent=label;
      elements.targetSpd.value=formatInput(data.targetSpd);
      elements.targetAkm.value=formatInput(data.targetAkm);
      elements.nextMonth.disabled=viewYear===currentYear&&viewMonth===currentMonthIndex;
      renderData(data);
      paintCalculations();
      scrollToTodayOnOpen();
      if(!skipRemote)loadRemoteMonth(viewYear,viewMonth);
    }

    function changeMonth(offset){
      var next=new Date(viewYear,viewMonth+offset,1);
      var year=next.getFullYear();
      var month=next.getMonth();
      if(year>currentYear||(year===currentYear&&month>currentMonthIndex))return;
      viewYear=year;
      viewMonth=month;
      renderMonth();
      window.scrollTo({top:0,behavior:'smooth'});
    }

    function focusNumeric(event){var parsed=parseInput(event.target.value);event.target.value=parsed===''?'':String(parsed);event.target.select()}
    function blurNumeric(event){event.target.value=formatInput(parseInput(event.target.value))}

    elements.previousMonth.addEventListener('click',function(){changeMonth(-1)});
    elements.nextMonth.addEventListener('click',function(){changeMonth(1)});
    elements.horizontalToggle.addEventListener('click',function(){setViewMode('horizontal')});
    elements.verticalToggle.addEventListener('click',function(){setViewMode('vertical')});
    elements.monthButton.addEventListener('click',function(){if(typeof elements.monthPicker.showPicker==='function')elements.monthPicker.showPicker();else elements.monthPicker.click()});
    elements.monthPicker.addEventListener('change',function(event){
      var parts=event.target.value.split('-');
      if(parts.length!==2)return;
      var year=Number(parts[0]);
      var month=Number(parts[1])-1;
      if(year>currentYear||(year===currentYear&&month>currentMonthIndex)){event.target.value=monthKey(viewYear,viewMonth);return}
      viewYear=year;
      viewMonth=month;
      renderMonth();
      window.scrollTo({top:0,behavior:'smooth'});
    });

    function setViewMode(mode){
      if(mode!== 'horizontal'&&mode!=='vertical')return;
      viewMode=mode;
      try{localStorage.setItem(VIEW_KEY,mode)}catch(error){}
      renderMonth();
    }

    function showToast(message){
      clearTimeout(toastTimer);
      elements.toast.textContent=message;
      elements.toast.hidden=false;
      toastTimer=setTimeout(function(){elements.toast.hidden=true},2400);
    }

    function setTelegramMessage(message,type){
      elements.telegramMessage.textContent=message||'';
      elements.telegramMessage.className='telegram-message'+(message?' visible '+type:'');
    }

    function setTelegramStatus(state,title,text){
      elements.telegramDot.dataset.state=state;
      elements.telegramStatusTitle.textContent=title;
      elements.telegramStatusText.textContent=text;
    }

    function refreshTelegramControls(){
      var connected=Boolean(telegramState.chatId);
      elements.telegramConnect.disabled=!telegramServerReady;
      elements.telegramConnectLabel.textContent=connected?'Hubungkan Ulang':'Hubungkan Bot';
      elements.telegramAutoSend.disabled=!connected||!telegramServerReady;
      elements.telegramAutoSend.checked=Boolean(connected&&telegramState.enabled);
    }

    var API_BASE=window.location.origin;

    function apiHeaders(options){
      var headers=Object.assign({},options&&options.headers||{}),password='';
      try{password=localStorage.getItem(AUTH_KEY)||''}catch(error){}
      if(password)headers.Authorization='Bearer '+password;
      return headers;
    }

    async function apiFetch(path,options){
      var request=Object.assign({},options||{},{headers:apiHeaders(options)}),response=await fetch(path,request);
      if(response.status===401){
        setAuthStatus('Kunci tidak valid atau belum dimasukkan. Buka Settings untuk mengatur kunci.','error');
      }
      return response;
    }

    function setAuthStatus(message,type){elements.authPasswordStatus.textContent=message;elements.authPasswordStatus.className='auth-status'+(type?' '+type:'')}
    function loadAuthSetting(){try{elements.authPasswordInput.value=localStorage.getItem(AUTH_KEY)||''}catch(error){}if(elements.authPasswordInput.value)setAuthStatus('Kunci tersimpan di perangkat.','success')}
    function connectionError(status){return status===401?'Kunci tidak valid.':status===503?'Kunci server belum dikonfigurasi.':status>=500?'Server atau database bermasalah.':'Permintaan gagal (HTTP '+status+').'}
    async function saveAuthSetting(){
      var password=elements.authPasswordInput.value;
      if(!password){localStorage.removeItem(AUTH_KEY);setAuthStatus('Kunci dihapus dari perangkat.','');return}
      elements.authPasswordSave.disabled=true;setAuthStatus('Memeriksa kunci ke server…','');
      try{
        var response=await fetch(API_BASE+'/api/month?month='+encodeURIComponent(monthKey(viewYear,viewMonth)),{headers:{Authorization:'Bearer '+password},cache:'no-store'});
        if(!response.ok){setAuthStatus(connectionError(response.status),'error');return}
        localStorage.setItem(AUTH_KEY,password);
        setAuthStatus('Kunci valid. Terhubung ke server D1.','success');
        await syncRemoteMonth();await loadRemoteMonth(viewYear,viewMonth);
        window.dispatchEvent(new Event('salesflow-auth-changed'));
      }catch(error){setAuthStatus('Koneksi atau penyimpanan perangkat gagal. Kunci sebelumnya tetap dipertahankan jika validasi belum berhasil.','error')}
      finally{elements.authPasswordSave.disabled=false}
    }

    async function loadRemoteMonth(year,month){
      var key=monthKey(year,month);
      try{
        if(pendingMonths()[key])return;
        var before=JSON.stringify(store.months[key]);
        var response=await apiFetch(API_BASE+'/api/month?month='+encodeURIComponent(key),{cache:'no-store'});
        if(!response.ok)throw new Error(connectionError(response.status));
        var remote=await response.json();
        if(pendingMonths()[key]||before!==JSON.stringify(store.months[key]))return;
        var data=ensureMonth(year,month);
        data.targetSpd=remote.targetSpd||'';data.targetAkm=remote.targetAkm||'';
        (remote.days||[]).forEach(function(row){if(Number.isInteger(row.day)&&row.day>=1&&row.day<=data.salesNet.length){data.salesNet[row.day-1]=row.salesNet===null?'':row.salesNet;data.totalStruk[row.day-1]=row.totalStruk===null?'':row.totalStruk}});
        try{localStorage.setItem(KEY,JSON.stringify(store))}catch(error){}
        if(key===monthKey(viewYear,viewMonth)){renderMonth(true);updateTableInfo('Data dimuat dari server')}
        window.dispatchEvent(new Event('salesflow-data-changed'));
      }catch(error){updateTableInfo('Data lokal · '+error.message)}
    }

    var PENDING_KEY='salesflow2-pending-months-v1',syncRunning=false;
    function pendingMonths(){try{return JSON.parse(localStorage.getItem(PENDING_KEY))||{}}catch(error){return{}}}
    async function syncRemoteMonth(){
      if(syncRunning||!navigator.onLine||!apiHeaders().Authorization)return;
      syncRunning=true;
      try{
        var pending=pendingMonths();
        for(var key of Object.keys(pending)){
          var snapshot=pending[key],data=snapshot.data;
          var days=data.salesNet.map(function(value,index){return{day:index+1,salesNet:value===''?null:value,totalStruk:data.totalStruk[index]===''?null:data.totalStruk[index]}});
          var response=await apiFetch(API_BASE+'/api/month',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({month:key,targetSpd:data.targetSpd===''?0:data.targetSpd,targetAkm:data.targetAkm===''?0:data.targetAkm,days:days})});
          if(!response.ok)throw new Error(connectionError(response.status));
          var latest=pendingMonths();
          if(latest[key]&&latest[key].id===snapshot.id){delete latest[key];localStorage.setItem(PENDING_KEY,JSON.stringify(latest));if(key===monthKey(viewYear,viewMonth)){markSaved();updateTableInfo('Tersinkron ke server · '+lastSavedAt)}}
        }
      }catch(error){updateTableInfo('Tersimpan di perangkat · Sinkronisasi gagal: '+error.message)}
      finally{syncRunning=false;elements.saveState.classList.remove('saving')}
    }
    function scheduleRemoteSync(){
      var pending=pendingMonths(),key=monthKey(viewYear,viewMonth);
      pending[key]={id:crypto.randomUUID(),data:JSON.parse(JSON.stringify(ensureMonth(viewYear,viewMonth)))};
      localStorage.setItem(PENDING_KEY,JSON.stringify(pending));
      window.dispatchEvent(new Event('salesflow-data-changed'));
      clearTimeout(syncTimer);syncTimer=setTimeout(syncRemoteMonth,700);
    }

    async function requestJson(path,options){
      var response=await apiFetch(path,options||{});
      var result=null;
      try{result=await response.json()}catch(error){}
      if(!response.ok){
        var message=result&&typeof result.error==='string'?result.error:'Permintaan ke server gagal.';
        throw new Error(message);
      }
      return result||{};
    }

    async function checkTelegramAvailability(){
      if(location.protocol==='file:'){
        telegramServerReady=false;
        refreshTelegramControls();
        setTelegramStatus('error','Khusus versi online','Telegram memerlukan server aman pada situs yang diterbitkan.');
        return;
      }
      try{
        var result=await requestJson('/api/telegram/status',{method:'GET',headers:{accept:'application/json'},credentials:'same-origin',cache:'no-store'});
        telegramServerReady=Boolean(result.configured);
        refreshTelegramControls();
        if(!telegramServerReady){
          setTelegramStatus('error','Token belum aktif','Tambahkan TELEGRAM_BOT_TOKEN di Environment Variables lalu terbitkan ulang.');
        }else if(telegramState.chatId){
          var destination=telegramState.chatName||'chat tersimpan';
          setTelegramStatus('connected',telegramState.enabled?'Terhubung • otomatis aktif':'Terhubung • otomatis nonaktif','Tujuan: '+destination);
        }else{
          setTelegramStatus('ready','Bot siap dihubungkan','Kirim /start ke bot, lalu tekan Hubungkan Bot.');
        }
      }catch(error){
        telegramServerReady=false;
        refreshTelegramControls();
        setTelegramStatus('error','Server tidak dapat diperiksa','Periksa koneksi internet lalu buka Pengaturan kembali.');
      }
    }

    async function connectTelegram(){
      if(!telegramServerReady)return;
      elements.telegramConnect.disabled=true;
      setTelegramMessage('','success');
      setTelegramStatus('working','Menghubungkan…','Mencari pesan /start terbaru dan mengirim pesan uji.');
      try{
        var result=await requestJson('/api/telegram/connect',{
          method:'POST',
          headers:{'content-type':'application/json',accept:'application/json'},
          credentials:'same-origin',
          body:'{}'
        });
        var newChatId=String(result.chatId||'');
        if(!/^-?[0-9]{1,20}$/.test(newChatId))throw new Error('Respons koneksi Telegram tidak valid.');
        if(telegramState.chatId&&telegramState.chatId!==newChatId)telegramState.messages={};
        telegramState.chatId=newChatId;
        telegramState.chatName=typeof result.chatName==='string'?result.chatName.slice(0,80):'';
        telegramState.botUsername=typeof result.botUsername==='string'?result.botUsername.slice(0,40):'';
        telegramState.enabled=true;
        saveTelegramState();
        refreshTelegramControls();
        var destination=telegramState.chatName||'Telegram Anda';
        setTelegramStatus('connected','Terhubung • otomatis aktif','Tujuan: '+destination);
        setTelegramMessage('Berhasil terhubung. Pesan uji sudah dikirim ke Telegram.','success');
        showToast('Telegram berhasil dihubungkan');
      }catch(error){
        refreshTelegramControls();
        setTelegramStatus('error','Belum terhubung','Kirim /start ke bot lalu coba lagi.');
        setTelegramMessage(error.message,'error');
      }
    }

    function telegramTaskKey(year,month,index){return monthKey(year,month)+'-'+String(index+1).padStart(2,'0')}

    function toTelegramNumber(value){
      return value===null||value===''||typeof value==='undefined'||!Number.isFinite(Number(value))?null:Number(value);
    }

    function buildTelegramPayload(task){
      var data=readMonth(task.year,task.month);
      if(!data)return null;
      var rows=calculateMonth(task.year,task.month,data);
      var row=rows[task.index];
      if(!row)return null;
      var previous=previousMonthOf(task.year,task.month);
      var previousRows=calculateMonth(previous.year,previous.month,readMonth(previous.year,previous.month));
      var old=task.index<previousRows.length?previousRows[task.index]:null;
      var key=telegramTaskKey(task.year,task.month,task.index);
      var storedMessageId=Number(telegramState.messages[key]);
      return{
        chatId:telegramState.chatId,
        messageId:Number.isInteger(storedMessageId)&&storedMessageId>0?storedMessageId:null,
        year:task.year,
        month:task.month+1,
        day:task.index+1,
        salesNet:toTelegramNumber(data.salesNet[task.index]),
        totalStruk:toTelegramNumber(data.totalStruk[task.index]),
        targetSpd:toTelegramNumber(data.targetSpd),
        targetAkm:toTelegramNumber(data.targetAkm),
        akmSales:toTelegramNumber(row.akmSales),
        spd:toTelegramNumber(row.spd),
        achievement:toTelegramNumber(row.achievement),
        akmStruk:toTelegramNumber(row.akmStruk),
        std:toTelegramNumber(row.std),
        apc:toTelegramNumber(row.apc),
        growthSpd:toTelegramNumber(growth(row.spd,old?old.spd:null)),
        growthStd:toTelegramNumber(growth(row.std,old?old.std:null)),
        growthApc:toTelegramNumber(growth(row.apc,old?old.apc:null))
      };
    }

    function enqueueTelegramTask(task){
      var key=telegramTaskKey(task.year,task.month,task.index);
      telegramQueue=telegramQueue.filter(function(item){return telegramTaskKey(item.year,item.month,item.index)!==key});
      telegramQueue.push(task);
      processTelegramQueue();
    }

    function queueTelegramNotification(year,month,index){
      if(!telegramServerReady||!telegramState.chatId||!telegramState.enabled)return;
      var task={year:year,month:month,index:index};
      var key=telegramTaskKey(year,month,index);
      delete telegramFailed[key];
      clearTimeout(telegramTimers[key]);
      telegramTimers[key]=setTimeout(function(){
        delete telegramTimers[key];
        enqueueTelegramTask(task);
      },1800);
    }

    async function processTelegramQueue(){
      if(telegramSending||telegramQueue.length===0)return;
      if(!telegramServerReady||!telegramState.chatId||!telegramState.enabled){telegramQueue=[];return}
      telegramSending=true;
      var task=telegramQueue.shift();
      var key=telegramTaskKey(task.year,task.month,task.index);
      var payload=buildTelegramPayload(task);
      if(!payload){telegramSending=false;setTimeout(processTelegramQueue,0);return}
      setTelegramStatus('working','Mengirim ke Telegram…','Data hari '+(task.index+1)+' sedang diamankan.');
      try{
        var result=await requestJson('/api/telegram/send',{
          method:'POST',
          headers:{'content-type':'application/json',accept:'application/json'},
          credentials:'same-origin',
          body:JSON.stringify(payload)
        });
        var messageId=Number(result.messageId);
        if(Number.isInteger(messageId)&&messageId>0){telegramState.messages[key]=messageId;saveTelegramState()}
        delete telegramFailed[key];
        var time=new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'});
        setTelegramStatus('connected','Terkirim • '+time,'Hari '+(task.index+1)+' diperbarui tanpa membuat pesan ganda.');
      }catch(error){
        telegramFailed[key]=task;
        setTelegramStatus('error','Pengiriman tertunda','Data lokal tetap aman; akan dicoba lagi saat online atau saat data berubah.');
        setTelegramMessage(error.message,'error');
      }finally{
        telegramSending=false;
        if(telegramQueue.length)setTimeout(processTelegramQueue,0);
      }
    }

    function retryFailedTelegram(){
      if(!navigator.onLine||!telegramState.enabled)return;
      Object.keys(telegramFailed).forEach(function(key){var task=telegramFailed[key];delete telegramFailed[key];enqueueTelegramTask(task)});
    }

    function openSettingsMenu(){
      lastSettingsFocus=document.activeElement;
      elements.settingsOverlay.hidden=false;
      document.body.classList.add('settings-open');
      elements.settingsButton.setAttribute('aria-expanded','true');
      if(!telegramServerReady&&location.protocol!=='file:')checkTelegramAvailability();
      requestAnimationFrame(function(){elements.closeSettings.focus()});
    }

    function closeSettingsMenu(){
      if(elements.settingsOverlay.hidden)return;
      elements.settingsOverlay.hidden=true;
      document.body.classList.remove('settings-open');
      elements.settingsButton.setAttribute('aria-expanded','false');
      if(lastSettingsFocus&&typeof lastSettingsFocus.focus==='function')lastSettingsFocus.focus();
    }

    function toggleTargets(){
      var visible=elements.targetsPanel.hidden;
      elements.targetsPanel.hidden=!visible;
      elements.targetsToggle.setAttribute('aria-expanded',String(visible));
      elements.targetsToggle.setAttribute('aria-label',visible?'Sembunyikan Target Bulanan':'Tampilkan Target Bulanan');
      elements.targetsToggle.innerHTML=visible?'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.1 12s3.6-6 9.9-6 9.9 6 9.9 6-3.6 6-9.9 6-9.9-6-9.9-6Z"></path><circle cx="12" cy="12" r="2.5"></circle></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18"></path><path d="M10.6 6.1A10.8 10.8 0 0 1 12 6c6.3 0 9.9 6 9.9 6a17.8 17.8 0 0 1-3.3 3.9M6.2 6.2C3.6 8 2.1 12 2.1 12s3.6 6 9.9 6c1.6 0 3-.4 4.2-1"></path><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path></svg>';
    }

    function setImportStatus(message,type){
      elements.importStatus.textContent=message;
      elements.importStatus.className='import-status'+(message?' visible '+type:'');
    }

    function parseImportedValue(value){
      if(value===null||value==='')return{valid:true,value:''};
      if(typeof value==='number')return{valid:Number.isSafeInteger(value)&&value>=0,value:value};
      if(typeof value!=='string')return{valid:false,value:''};
      var trimmed=value.trim();
      if(trimmed==='')return{valid:true,value:''};
      if(!/^[0-9][0-9., ]*$/.test(trimmed))return{valid:false,value:''};
      var digits=trimmed.replace(/[^0-9]/g,'');
      var parsed=Number(digits);
      return{valid:Number.isSafeInteger(parsed)&&parsed>=0,value:parsed};
    }

    function backupValue(value){return value===''||value===null||typeof value==='undefined'?null:Number(value)}

    function exportBackupJson(){
      try{
        ensureMonth(viewYear,viewMonth);
        var months={};
        Object.keys(store.months).sort().forEach(function(key){
          var match=/^([0-9]{4})-(0[1-9]|1[0-2])$/.exec(key);
          if(!match)return;
          var year=Number(match[1]);
          var month=Number(match[2])-1;
          if(year<2000||year>2200)return;
          var data=ensureMonth(year,month);
          months[key]={
            target_spd:backupValue(data.targetSpd),
            target_akm:backupValue(data.targetAkm),
            sales_net:data.salesNet.map(backupValue),
            total_struk:data.totalStruk.map(backupValue)
          };
        });
        var monthCount=Object.keys(months).length;
        if(!monthCount)throw new Error('Belum ada data yang dapat dibackup.');
        var backup={
          format:'salesflow-backup',
          version:1,
          exported_at:new Date().toISOString(),
          months:months
        };
        var blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'});
        var url=URL.createObjectURL(blob);
        var link=document.createElement('a');
        var date=new Date();
        var stamp=String(date.getFullYear())+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
        link.href=url;
        link.download='SalesFlow_Backup_'+stamp+'.json';
        link.style.display='none';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function(){URL.revokeObjectURL(url)},1200);
        setImportStatus(monthCount+' bulan berhasil dibackup ke file JSON.','success');
        showToast('Backup JSON berhasil diunduh');
      }catch(error){
        setImportStatus(error.message||'Backup JSON gagal dibuat.','error');
      }
    }

    function importCurrentMonthRows(parsed){
      var count=dayCount(viewYear,viewMonth);
      var updates={};
      var invalidRows=0;
      parsed.forEach(function(item){
        if(!item||typeof item!=='object'||Array.isArray(item)){invalidRows+=1;return}
        var no=Number(item.no);
        var hasSales=Object.prototype.hasOwnProperty.call(item,'total_net');
        var hasStruk=Object.prototype.hasOwnProperty.call(item,'total_struk');
        if(!Number.isInteger(no)||no<1||no>count||(!hasSales&&!hasStruk)){invalidRows+=1;return}
        var salesResult=hasSales?parseImportedValue(item.total_net):null;
        var strukResult=hasStruk?parseImportedValue(item.total_struk):null;
        if((salesResult&&!salesResult.valid)||(strukResult&&!strukResult.valid)){invalidRows+=1;return}
        updates[no]={hasSales:hasSales,sales:hasSales?salesResult.value:'',hasStruk:hasStruk,struk:hasStruk?strukResult.value:''};
      });
      var days=Object.keys(updates);
      if(days.length===0)throw new Error('Tidak ada baris valid yang dapat diimpor.');
      var data=ensureMonth(viewYear,viewMonth);
      days.forEach(function(day){
        var index=Number(day)-1;
        var update=updates[day];
        if(update.hasSales)data.salesNet[index]=update.sales;
        if(update.hasStruk)data.totalStruk[index]=update.struk;
      });
      return days.length+' hari berhasil diimpor'+(invalidRows?' • '+invalidRows+' baris dilewati':'')+'.';
    }

    function parseBackupArray(values,count,label){
      if(!Array.isArray(values))throw new Error(label+' pada backup tidak valid.');
      if(values.length>count)throw new Error(label+' melebihi jumlah hari dalam bulan.');
      var result=[];
      for(var index=0;index<count;index+=1){
        var parsed=parseImportedValue(index<values.length?values[index]:null);
        if(!parsed.valid)throw new Error(label+' hari '+(index+1)+' tidak valid.');
        result.push(parsed.value);
      }
      return result;
    }

    function restoreFullBackup(parsed){
      if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||parsed.format!=='salesflow-backup'||parsed.version!==1||!parsed.months||typeof parsed.months!=='object'||Array.isArray(parsed.months))throw new Error('Format backup SalesFlow tidak valid.');
      var keys=Object.keys(parsed.months);
      if(!keys.length)throw new Error('File backup tidak berisi data bulan.');
      if(keys.length>2400)throw new Error('Jumlah bulan dalam backup terlalu banyak.');
      var restored={};
      keys.forEach(function(key){
        var match=/^([0-9]{4})-(0[1-9]|1[0-2])$/.exec(key);
        if(!match)throw new Error('Identitas bulan '+key+' tidak valid.');
        var year=Number(match[1]);
        var month=Number(match[2])-1;
        if(year<2000||year>2200)throw new Error('Tahun backup berada di luar batas.');
        var item=parsed.months[key];
        if(!item||typeof item!=='object'||Array.isArray(item))throw new Error('Data bulan '+key+' tidak valid.');
        var targetSpdSource=Object.prototype.hasOwnProperty.call(item,'target_spd')?item.target_spd:item.targetSpd;
        var targetAkmSource=Object.prototype.hasOwnProperty.call(item,'target_akm')?item.target_akm:item.targetAkm;
        var targetSpd=parseImportedValue(typeof targetSpdSource==='undefined'?null:targetSpdSource);
        var targetAkm=parseImportedValue(typeof targetAkmSource==='undefined'?null:targetAkmSource);
        if(!targetSpd.valid||!targetAkm.valid)throw new Error('Target bulan '+key+' tidak valid.');
        var salesSource=Array.isArray(item.sales_net)?item.sales_net:item.salesNet;
        var strukSource=Array.isArray(item.total_struk)?item.total_struk:item.totalStruk;
        var count=dayCount(year,month);
        restored[key]={
          targetSpd:targetSpd.value,
          targetAkm:targetAkm.value,
          salesNet:parseBackupArray(salesSource,count,'Sales NET '+key),
          totalStruk:parseBackupArray(strukSource,count,'Total Struk '+key)
        };
      });
      if(!window.confirm('Pulihkan '+keys.length+' bulan dari backup? Data SalesFlow lokal saat ini akan diganti.'))return{cancelled:true,message:'Pemulihan backup dibatalkan.'};
      store={version:1,months:restored};
      return{cancelled:false,message:keys.length+' bulan berhasil dipulihkan dari backup.'};
    }

    async function importJsonFile(file){
      if(!file)return;
      setImportStatus('Membaca dan memeriksa file…','success');
      try{
        if(file.size>2*1024*1024)throw new Error('Ukuran file melebihi batas 2 MB.');
        var parsed=JSON.parse(await file.text());
        var result;
        if(Array.isArray(parsed))result={cancelled:false,message:importCurrentMonthRows(parsed)};
        else result=restoreFullBackup(parsed);
        if(result.cancelled){setImportStatus(result.message,'success');return}
        saveStore();
        renderMonth();
        setImportStatus(result.message,'success');
        showToast(Array.isArray(parsed)?'Import JSON berhasil':'Backup berhasil dipulihkan');
      }catch(error){
        setImportStatus(error instanceof SyntaxError?'File bukan JSON yang valid.':error.message,'error');
      }finally{
        elements.jsonFileInput.value='';
      }
    }

    elements.targetsToggle.addEventListener('click',toggleTargets);
    elements.settingsButton.addEventListener('click',openSettingsMenu);
    elements.closeSettings.addEventListener('click',closeSettingsMenu);
    elements.authPasswordSave.addEventListener('click',saveAuthSetting);
    elements.settingsOverlay.addEventListener('click',function(event){if(event.target.hasAttribute('data-close-settings'))closeSettingsMenu()});
    elements.themeToggle.addEventListener('click',function(){
      var next=themeMode==='dark'?'light':'dark';
      applyTheme(next,true);
      showToast(next==='dark'?'Mode Gelap aktif':'Mode Terang aktif');
    });
    elements.themeVariant.addEventListener('change',function(){applyThemeVariant(elements.themeVariant.value,true);showToast(themeVariant==='monochrome'?'Tema 2 — Monochrome aktif':'Tema 1 — SalesFlow Klasik aktif')});
    elements.exportButton.addEventListener('click',exportBackupJson);
    elements.importButton.addEventListener('click',function(){elements.jsonFileInput.click()});
    elements.jsonFileInput.addEventListener('change',function(event){importJsonFile(event.target.files&&event.target.files[0])});
    elements.telegramConnect.addEventListener('click',connectTelegram);
    elements.telegramAutoSend.addEventListener('change',function(){
      if(!telegramState.chatId)return;
      telegramState.enabled=elements.telegramAutoSend.checked;
      saveTelegramState();
      var destination=telegramState.chatName||'chat tersimpan';
      setTelegramStatus('connected',telegramState.enabled?'Terhubung • otomatis aktif':'Terhubung • otomatis nonaktif','Tujuan: '+destination);
      setTelegramMessage(telegramState.enabled?'Pengiriman otomatis diaktifkan.':'Pengiriman otomatis dinonaktifkan.','success');
      if(telegramState.enabled)retryFailedTelegram();
    });
    document.addEventListener('keydown',function(event){
      if(elements.settingsOverlay.hidden)return;
      if(event.key==='Escape'){event.preventDefault();closeSettingsMenu();return}
      if(event.key!=='Tab')return;
      var focusable=Array.prototype.slice.call(elements.settingsPanel.querySelectorAll('button:not([disabled]),input:not([disabled]):not([tabindex="-1"]),select:not([disabled])'));
      if(!focusable.length)return;
      var first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    });

    elements.dataViews.addEventListener('focusin',function(event){if(event.target.matches('.number-input'))focusNumeric(event)});
    elements.dataViews.addEventListener('focusout',function(event){if(event.target.matches('.number-input'))blurNumeric(event)});
    elements.dataViews.addEventListener('input',function(event){
      var input=event.target;
      if(!input.matches('.number-input'))return;
      var index=Number(input.dataset.index);
      ensureMonth(viewYear,viewMonth)[input.dataset.field][index]=parseInput(input.value);
      saveStore();
      paintCalculations();
      queueTelegramNotification(viewYear,viewMonth,index);
    });
    elements.dataViews.addEventListener('keydown',function(event){
      var input=event.target;
      if(!input.matches('.number-input')||!['Enter','ArrowDown','ArrowUp'].includes(event.key))return;
      event.preventDefault();
      var direction=event.key==='ArrowUp'?-1:1;
      var nextInput=activeRoot().querySelector('.number-input[data-field="'+input.dataset.field+'"][data-index="'+(Number(input.dataset.index)+direction)+'"]');
      if(nextInput){nextInput.focus();nextInput.scrollIntoView({block:'center',behavior:'smooth'})}
    });

    [elements.targetSpd,elements.targetAkm].forEach(function(input){
      input.addEventListener('focus',focusNumeric);
      input.addEventListener('blur',blurNumeric);
      input.addEventListener('input',function(){
        var data=ensureMonth(viewYear,viewMonth);
        if(input===elements.targetSpd)data.targetSpd=parseInput(input.value);else data.targetAkm=parseInput(input.value);
        saveStore();
        paintCalculations();
      });
    });

    window.addEventListener('storage',function(event){
      if(event.key===KEY){store=loadStore();renderMonth()}
      else if(event.key===VIEW_KEY){viewMode=loadViewMode();renderMonth()}
      else if(event.key===THEME_KEY)applyTheme(loadThemeMode(),false);
      else if(event.key===THEME_VARIANT_KEY)applyThemeVariant(loadThemeVariant(),false);
      else if(event.key===TELEGRAM_KEY){telegramState=loadTelegramState();refreshTelegramControls();checkTelegramAvailability()}
    });
    window.addEventListener('online',retryFailedTelegram);
    window.addEventListener('online',syncRemoteMonth);
    setInterval(syncRemoteMonth,15000);
    syncRemoteMonth();
    renderMonth();
    setTimeout(function(){autoTodayScroll=false},2500);
    loadAuthSetting();
    refreshTelegramControls();
    checkTelegramAvailability();
  })();

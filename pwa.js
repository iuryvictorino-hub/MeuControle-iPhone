/* iPhone / navegador: mesmas telas e cálculos do Android, sem ponte Java. */
'use strict';
(() => {
  const CURRENT = '3.4.0';
  const status=document.querySelector('#updateStatus');
  const check=document.querySelector('#checkUpdates');
  const apply=document.querySelector('#downloadUpdate');
  const notes=document.querySelector('#releaseNotes');
  const version=document.querySelector('#installedVersion');
  const info=document.querySelector('#updatesPanel .update-info');
  version.textContent=`v${CURRENT} · Web`;
  apply.textContent='Aplicar atualização';
  info.textContent='Atualizações da versão por link. Ao verificar, conecte-se à internet. Faça backup JSON antes de apagar dados do navegador ou mudar de aparelho.';
  let registration=null;
  let applying=false;
  const plainVersion = raw => /^\d+\.\d+\.\d+$/.test(raw||'') ? raw : null;
  const compare=(a,b)=>{
    const aa=a.split('.').map(Number), bb=b.split('.').map(Number);
    for(let i=0;i<3;i++){if(aa[i]!==bb[i])return aa[i]>bb[i]?1:-1;}return 0;
  };
  if('serviceWorker' in navigator && window.isSecureContext){
    navigator.serviceWorker.register('./sw.js', {scope:'./'}).then(reg=>registration=reg).catch(()=>{});
  }
  let reloading=false;
  if('serviceWorker' in navigator){
    navigator.serviceWorker.addEventListener('controllerchange',()=>{
      if(!applying || reloading)return;
      reloading=true;
      window.location.reload();
    });
  }
  check.onclick=async()=>{
    check.disabled=true;
    apply.hidden=true;
    notes.hidden=true;
    status.textContent='Verificando a versão do site...';
    try{
      // Use the network for metadata; the service worker deliberately does not cache it.
      const url=new URL('./version.json',location.href);
      url.searchParams.set('v',Date.now().toString());
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),12000);
      let response;
      try{response=await fetch(url,{cache:'no-store',signal:controller.signal});}
      finally{clearTimeout(timeout);}
      if(!response.ok)throw Error('Sem conexão');
      const json=await response.json();
      const remote=plainVersion(json.version);
      if(!remote)throw Error('Versão desconhecida');
      if(registration)await registration.update();
      else if('serviceWorker' in navigator)registration=await navigator.serviceWorker.ready;
      if(compare(remote,CURRENT)>0){
        status.textContent=`Nova versão ${remote} disponível! Instalada: ${CURRENT}.`;
        apply.hidden=false;
        const text=String(json.notes||'').slice(0,700);
        if(text){notes.textContent=text;notes.hidden=false;}
      }else{
        status.textContent=`Tudo atualizado! Versão instalada: ${CURRENT}. Última publicada: ${remote}.`;
      }
    }catch(e){
      status.textContent='Não foi possível consultar as atualizações. Confira sua internet e tente novamente.';
    }finally{check.disabled=false;}
  };
  apply.onclick=async()=>{
    apply.disabled=true;
    status.textContent='Preparando a atualização...';
    try{
      if(!registration && 'serviceWorker' in navigator)registration=await navigator.serviceWorker.ready;
      if(registration)await registration.update();
      if(registration?.waiting){
        applying=true;
        registration.waiting.postMessage({type:'SKIP_WAITING'});
        return;
      }
      // If no worker is waiting, reloading picks up latest files in non-PWA browsers.
      if(!navigator.serviceWorker?.controller){window.location.reload();return;}
      status.textContent='A nova versão está sendo preparada. Feche e abra o aplicativo novamente e verifique as atualizações.';
      apply.disabled=false;
    }catch(e){
      status.textContent='Não foi possível aplicar agora. Feche e reabra o aplicativo com internet.';
      apply.disabled=false;
    }
  };
  // iOS home-screen PWAs can share a file into the Files app; other browsers use a normal download.
  download = function(content, type, name){
    const blob=new Blob([content],{type});
    let shared=false;
    try {
      const file=new File([blob],name,{type:type.split(';')[0]});
      if(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]})){
        shared=true;
        navigator.share({files:[file],title:name}).catch(err=>{
          if(err?.name!=='AbortError')regularDownload(blob,name);
        });
      }
    }catch(_){}
    if(!shared)regularDownload(blob,name);
  };
  function regularDownload(blob,name){
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download=name;
    document.body.append(link);
    link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
})();

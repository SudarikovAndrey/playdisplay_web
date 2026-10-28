'use strict';
(() => {
  const dialogs = [...document.querySelectorAll('.contact-dialog')];
  const openers = new Map();
  document.querySelectorAll('[data-open-dialog]').forEach(link => link.addEventListener('click', event => {
    const dialog = document.getElementById(link.dataset.openDialog);
    if (!dialog || typeof dialog.showModal !== 'function') return;
    event.preventDefault();
    openers.set(dialog, link);
    dialog.showModal();
    document.body.classList.add('dialog-open');
    (dialog.querySelector('input[name="name"]') || dialog.querySelector('.direct-contact-links a') || dialog.querySelector('button')).focus();
  }));
  dialogs.forEach(dialog => {
    dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
    let backdropDown = false;
    const outside = event => {const r=dialog.getBoundingClientRect();return event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom;};
    dialog.addEventListener('pointerdown', event => {backdropDown=event.target===dialog && outside(event);});
    dialog.addEventListener('click', event => {if(backdropDown && event.target===dialog && outside(event)) dialog.close();backdropDown=false;});
    dialog.addEventListener('close', () => {document.body.classList.remove('dialog-open');openers.get(dialog)?.focus({preventScroll:true});});
  });
  const form=document.getElementById('quick-lead-form'), status=document.getElementById('quick-form-status'), submit=form.querySelector('[type="submit"]');
  ['name','phone'].forEach(name=>form.elements[name].addEventListener('input',()=>form.elements[name].setCustomValidity('')));
  form.addEventListener('submit', async event => {
    event.preventDefault();if(submit.disabled)return;
    const name=form.elements.name, phone=form.elements.phone, email=form.elements.email;
    name.setCustomValidity(name.value.trim()?'':'Укажите ваше имя.');
    phone.setCustomValidity(/^[+\d\s().-]+$/.test(phone.value.trim()) && phone.value.replace(/\D/g,'').length>=7?'':'Укажите телефон с кодом страны или города.');
    if(!form.reportValidity())return;
    const payload={action:'book',name:name.value.trim(),company:'',contact:phone.value.trim()+'; '+email.value.trim(),about:'Заявка из всплывающей формы AI PACK.\nТелефон: '+phone.value.trim()+'\nEmail: '+email.value.trim(),when:'AI PACK /aipack2/ — всплывающая форма',website:form.elements.website.value,agree:form.elements.agree.checked,lang:'ru'};
    submit.disabled=true;submit.textContent='Отправляем…';status.className='';status.textContent='Отправка заявки…';
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
    try{
      const response=await fetch('/api/ai.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
      const data=await response.json();if(!response.ok||!data.ok)throw new Error('send');
      status.className='success';status.textContent='Заявка отправлена. Свяжемся с вами по указанным контактам.';form.reset();
    }catch(error){status.className='error';status.textContent=error.name==='AbortError'?'Не получили подтверждение отправки. Данные сохранены. Попробуйте ещё раз или свяжитесь с нами в мессенджере.':'Не удалось отправить заявку. Данные сохранены. Попробуйте ещё раз или свяжитесь с нами в мессенджере.';}
    finally{clearTimeout(timeout);submit.disabled=false;submit.textContent='Отправить заявку';}
  });
})();

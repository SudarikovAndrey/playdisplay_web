'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const ids = ['people', 'minutes', 'days', 'rate', 'share'];
  const number = new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 1});
  let calculation = '', selectedFormat = '', isExample = false;
  function calculate() {
    if (!$('calc-form').reportValidity()) return;
    const [people, minutes, days, rate, share] = ids.map(id => Number($(id).value));
    const hours = people * minutes * days / 60 * share / 100;
    $('hours').replaceChildren(document.createTextNode(number.format(hours)));
    const caption = document.createElement('small'); caption.textContent = 'часов в месяц'; $('hours').append(caption);
    $('money').textContent = number.format(hours * rate) + ' ₽';
    $('calc-label').textContent = isExample ? 'Учебный пример — не прогноз' : 'Оценка по вашим данным';
    $('calc-message').textContent = `${people} чел. × ${minutes} мин. × ${days} дн. ÷ 60 × ${share}%. Стоимость времени: часы × ${rate} ₽. Доля ${share}% — допущение для проверки на пилоте.`;
    calculation = `${isExample ? 'Учебный пример' : 'Расчёт клиента'}: ${people} сотрудников; ${minutes} мин/день; ${days} дней; ${rate} руб/час; доля ${share}%; ${number.format(hours)} ч/мес.`;
  }
  $('calc-form').addEventListener('submit', e => {e.preventDefault(); calculate();});
  $('example').addEventListener('click', () => { [20,30,20,1000,25].forEach((v,i) => $(ids[i]).value=v); isExample=true; calculate(); });
  $('calc-form').addEventListener('input', () => {isExample=false; calculation=''; $('calc-label').textContent='Данные изменены — нажмите «Рассчитать»'; $('hours').innerHTML='—<small>часов в месяц</small>'; $('money').textContent='— ₽'; $('calc-message').textContent='Расчёт появится после заполнения всех полей и нажатия кнопки.';});
  document.querySelectorAll('[data-format]').forEach(a => a.addEventListener('click', () => {selectedFormat=a.dataset.format; $('selected-format').hidden=false; $('selected-format').textContent='Выбранный формат: '+selectedFormat;}));
  const form=$('lead-form'), status=$('form-status'), submit=form.querySelector('button[type="submit"]');
  const contact=form.elements.contact;
  contact.addEventListener('input', () => contact.setCustomValidity(''));
  form.addEventListener('submit', async e => {
    e.preventDefault(); if(submit.disabled) return;
    if(!/[@\d]|t\.me/i.test(contact.value.trim())) {contact.setCustomValidity('Укажите email, телефон или Telegram в формате @имя / t.me/имя.');contact.reportValidity();return;}
    if(!form.elements.name.value.trim()){form.elements.name.setCustomValidity('Укажите ваше имя.');form.elements.name.reportValidity();return;}
    form.elements.name.setCustomValidity('');
    if(!form.reportValidity())return;
    const about=[form.elements.task.value.trim(),form.elements.employees.value ? 'Сотрудников: '+form.elements.employees.value : '',selectedFormat ? 'Формат: '+selectedFormat : '',calculation].filter(Boolean).join('\n').slice(0,2000);
    const payload={action:'book',name:form.elements.name.value.trim(),company:form.elements.company.value.trim(),contact:contact.value.trim(),about,when:'AI PACK /aipack2/ — заявка на план автоматизации',website:form.elements.website.value,agree:form.elements.agree.checked,lang:'ru'};
    submit.disabled=true;submit.textContent='Отправляем…';status.className='';status.textContent='Отправка заявки…';
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),20000);
    try {const response=await fetch('/api/ai.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});const data=await response.json();if(!response.ok||!data.ok)throw new Error('send');status.className='success';status.textContent='Заявка отправлена. Свяжемся с вами по указанному контакту, чтобы обсудить задачу.';form.reset();selectedFormat='';$('selected-format').hidden=true;}
    catch(error){status.className='error';status.textContent=error.name==='AbortError'?'Не получили подтверждение отправки. Данные сохранены. Проверьте связь или напишите на a.sudarikov@playdisplay.ru.':'Не удалось отправить заявку. Данные сохранены — попробуйте ещё раз или напишите на a.sudarikov@playdisplay.ru.';}
    finally{clearTimeout(timeout);submit.disabled=false;submit.textContent='Получить план автоматизации';}
  });
  form.elements.name.addEventListener('input',()=>form.elements.name.setCustomValidity(''));
})();

(function () {
  'use strict';

  // --- КОНФИГУРАЦИЯ ---
  const TELEGRAM_TOKEN = '8728324632:AAGmFAmQEXR2g28nrxXsDFugLUMp0ilbZIw';
  const TELEGRAM_CHAT_ID = '8728324632'; // Убедитесь, что это правильный CHAT ID, а не токен!
  const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwXKy9ut77nQpWy8GDa5YcpUuKxrTo9tamNEo1BqgvpjvuRoyHMx61RXOJLG3OVxXZH/exec';

  // Для отладки - создадим панель с логами
  function addDebugPanel() {
    if (document.getElementById('debug-panel')) return;
    
    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 300px;
      max-height: 400px;
      overflow-y: auto;
      background: rgba(0,0,0,0.8);
      color: #0f0;
      font-family: monospace;
      font-size: 12px;
      padding: 10px;
      border-radius: 5px;
      z-index: 9999;
      display: none;
    `;
    panel.innerHTML = '<h4 style="margin:0 0 10px;color:#fff;">🔍 Лог отправки</h4><div id="debug-log"></div>';
    document.body.appendChild(panel);
  }
  
  function logToScreen(msg, type = 'info') {
    const logDiv = document.getElementById('debug-log');
    if (!logDiv) return;
    
    const colors = { info: '#0f0', error: '#f00', warning: '#ff0' };
    const entry = document.createElement('div');
    entry.style.cssText = `color: ${colors[type]}; margin: 2px 0; border-bottom: 1px solid #333; padding: 2px;`;
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;
    
    // Также пишем в консоль
    console.log(`[${type.toUpperCase()}] ${msg}`);
  }

  function showDebugPanel() {
    const panel = document.getElementById('debug-panel');
    if (panel) panel.style.display = 'block';
  }

  // --- TEA FLAVORS DATA ---
  const teaFlavors = [
    'Имбирный лимон', 'Айва с персиком', 'Манговый рай', 'Хамелеон',
    'Пина Колада', 'Пуэр Лесные ягоды', 'Таежный', 'Мишки Гамми',
    '1001 Ночь', 'Манго Улун', 'Ганпаудер', 'Анчан'
  ];

  // --- STATE ---
  let cart = [];
  let currentProduct = null;
  let selectedTeas = [];

  // --- DOM ELEMENTS ---
  const loader = document.getElementById('page-loader');
  const navToggle = document.getElementById('navToggle');
  const nav = document.getElementById('nav');
  const header = document.getElementById('header');
  const cartBtn = document.getElementById('cartBtn');
  const cartCountEl = document.getElementById('cartCount');
  const cartModal = document.getElementById('cartModal');
  const cartItemsContainer = document.getElementById('cartItemsContainer');
  const cartTotalPriceEl = document.getElementById('cartTotalPrice');
  const checkoutBtn = document.getElementById('checkoutBtn');
  const teaSelectModal = document.getElementById('teaSelectModal');
  const teaSlotsContainer = document.getElementById('teaSlotsContainer');
  const confirmTeaSelectionBtn = document.getElementById('confirmTeaSelection');
  const quantityModal = document.getElementById('quantityModal');
  const quantityProductName = document.getElementById('quantityProductName');
  const qtyInput = document.getElementById('qtyInput');
  const qtyDecrease = document.getElementById('qtyDecrease');
  const qtyIncrease = document.getElementById('qtyIncrease');
  const confirmQuantityBtn = document.getElementById('confirmQuantity');

  // Элементы формы
  const contactForm = document.getElementById('contactForm');
  const nameInput = document.getElementById('name');
  const phoneInput = document.getElementById('phone');
  const emailInput = document.getElementById('email');
  const commentInput = document.getElementById('comment');
  const submitBtn = document.getElementById('submit-btn');
  const commentCount = document.getElementById('comment-count');
  const charCounter = document.querySelector('.char-counter');

  // --- Функция отправки в Telegram ---
  async function sendToTelegram(orderData) {
    logToScreen('📤 Начинаем отправку в Telegram...');
    
    try {
      const message = 
`🆕 *НОВЫЙ ЗАКАЗ С САЙТА*
    
👤 *Клиент:* ${orderData.name}
📞 *Телефон:* ${orderData.phone}
📧 *Email:* ${orderData.email || 'не указан'}
💬 *Комментарий:* ${orderData.comment || 'нет'}

🛒 *Состав заказа:*
${orderData.items.map(item => {
  let text = `• ${item.name} x${item.quantity} — ${item.price * item.quantity}₽`;
  if (item.teaSelection && item.teaSelection.length) {
    text += `\n  Чаи: ${item.teaSelection.join(', ')}`;
  }
  return text;
}).join('\n')}

💰 *ИТОГО: ${orderData.items.reduce((sum, item) => sum + item.price * item.quantity, 0)}₽*

📅 ${new Date().toLocaleString('ru-RU')}`;

      logToScreen(`Telegram URL: https://api.telegram.org/bot${TELEGRAM_TOKEN.substring(0,10)}.../sendMessage`);
      logToScreen(`Chat ID: ${TELEGRAM_CHAT_ID}`);

      const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'Markdown'
        })
      });
      
      logToScreen(`Статус ответа Telegram: ${response.status}`);
      
      const result = await response.json();
      logToScreen(`Ответ Telegram: ${JSON.stringify(result)}`);
      
      return result;
    } catch (error) {
      logToScreen(`❌ Ошибка Telegram: ${error.message}`, 'error');
      return { ok: false, error: error.message };
    }
  }

  // --- Функция отправки в Google Sheets ---
  async function sendToGoogleSheets(orderData) {
    logToScreen('📤 Начинаем отправку в Google Sheets...');
    
    try {
      // Форматируем данные для Google Sheets
      const itemsText = orderData.items.map(item => {
        let text = `${item.name} x${item.quantity} — ${item.price * item.quantity}₽`;
        if (item.teaSelection && item.teaSelection.length) {
          text += ` (${item.teaSelection.join(', ')})`;
        }
        return text;
      }).join('; ');

      const total = orderData.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

      const sheetsData = {
        name: orderData.name,
        phone: orderData.phone,
        email: orderData.email || '',
        items: itemsText,
        total: total,
        timestamp: new Date().toISOString()
      };

      logToScreen(`Данные для Google Sheets: ${JSON.stringify(sheetsData)}`);
      logToScreen(`URL Google Sheets: ${GOOGLE_SHEETS_URL}`);

      const response = await fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sheetsData)
      });
      
      logToScreen('✅ Запрос в Google Sheets отправлен (mode: no-cors)');
      return { success: true };
      
    } catch (error) {
      logToScreen(`❌ Ошибка Google Sheets: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  // --- LOAD/SAVE CART ---
  function loadCart() {
    const saved = localStorage.getItem('teaBombsCart');
    if (saved) {
      try { cart = JSON.parse(saved); } catch (e) { cart = []; }
    }
    updateCartUI();
  }

  function saveCart() {
    localStorage.setItem('teaBombsCart', JSON.stringify(cart));
  }

  // --- SCROLL ANIMATIONS ---
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  // --- HEADER & NAV ---
  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      nav.classList.toggle('open');
      navToggle.classList.toggle('open');
    });
    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        navToggle.classList.remove('open');
      });
    });
  }

  window.addEventListener('scroll', () => {
    if (header) header.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });

  // --- CART LOGIC ---
  function updateCartUI() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    if (cartCountEl) {
      cartCountEl.textContent = totalItems;
      cartCountEl.style.display = totalItems > 0 ? 'flex' : 'none';
    }

    if (!cartItemsContainer) return;

    cartItemsContainer.innerHTML = '';
    let totalSum = 0;

    if (cart.length === 0) {
      cartItemsContainer.innerHTML = '<p class="empty-cart-msg">Корзина пуста</p>';
    } else {
      cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        totalSum += itemTotal;

        const div = document.createElement('div');
        div.className = 'cart-item';

        let details = '';
        if (item.teaSelection && item.teaSelection.length > 0) {
          details = item.teaSelection.join(', ');
        }

        div.innerHTML = `
          <div class="cart-item-info">
            <h4>${item.name}</h4>
            <p>${details}</p>
            <div class="cart-item-qty">
              <button class="qty-decrease" data-index="${index}">−</button>
              <span>${item.quantity}</span>
              <button class="qty-increase" data-index="${index}">+</button>
            </div>
            <p><strong>${itemTotal} ₽</strong></p>
          </div>
          <button class="cart-item-remove" data-index="${index}">&times;</button>
        `;
        cartItemsContainer.appendChild(div);
      });

      document.querySelectorAll('.qty-decrease').forEach(btn => {
        btn.addEventListener('click', function () {
          const index = parseInt(this.dataset.index);
          if (cart[index].quantity > 1) {
            cart[index].quantity--;
            saveCart();
            updateCartUI();
          }
        });
      });

      document.querySelectorAll('.qty-increase').forEach(btn => {
        btn.addEventListener('click', function () {
          const index = parseInt(this.dataset.index);
          if (cart[index].quantity < 99) {
            cart[index].quantity++;
            saveCart();
            updateCartUI();
          }
        });
      });

      document.querySelectorAll('.cart-item-remove').forEach(btn => {
        btn.addEventListener('click', function () {
          const index = parseInt(this.dataset.index);
          cart.splice(index, 1);
          saveCart();
          updateCartUI();
        });
      });
    }

    if (cartTotalPriceEl) {
      cartTotalPriceEl.textContent = `${totalSum} ₽`;
    }
  }

  function openCart() { if (cartModal) cartModal.style.display = 'block'; }
  function closeModal(modal) { if (modal) modal.style.display = 'none'; }

  if (cartBtn) cartBtn.addEventListener('click', openCart);

  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', () => {
      closeModal(cartModal);
      const contacts = document.getElementById('contacts');
      if (contacts) contacts.scrollIntoView({ behavior: 'smooth' });
    });
  }

  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', function () { closeModal(this.closest('.modal')); });
  });

  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) closeModal(e.target);
  });

  // --- QUANTITY MODAL ---
  function openQuantityModal(product) {
    currentProduct = product;
    currentProduct.quantity = 1;
    if (qtyInput) qtyInput.value = 1;
    if (quantityProductName) quantityProductName.textContent = product.name;
    if (quantityModal) quantityModal.style.display = 'block';
  }

  if (qtyDecrease) {
    qtyDecrease.addEventListener('click', () => {
      const val = parseInt(qtyInput.value) || 1;
      if (val > 1) {
        qtyInput.value = val - 1;
        if (currentProduct) currentProduct.quantity = val - 1;
      }
    });
  }

  if (qtyIncrease) {
    qtyIncrease.addEventListener('click', () => {
      const val = parseInt(qtyInput.value) || 1;
      if (val < 500) {
        qtyInput.value = val + 1;
        if (currentProduct) currentProduct.quantity = val + 1;
      }
    });
  }

  if (qtyInput) {
    qtyInput.addEventListener('change', () => {
      let val = parseInt(qtyInput.value);
      if (isNaN(val) || val < 1) val = 1;
      if (val > 500) val = 500;
      qtyInput.value = val;
      if (currentProduct) currentProduct.quantity = val;
    });
  }

  if (confirmQuantityBtn) {
    confirmQuantityBtn.addEventListener('click', () => {
      if (!currentProduct) return;
      currentProduct.quantity = parseInt(qtyInput.value) || 1;
      closeModal(quantityModal);
      if (currentProduct.type === 'simple') {
        addToCartDirect(currentProduct);
      } else {
        openTeaSelectionModal(currentProduct);
      }
    });
  }

  // --- TEA SELECTION LOGIC ---
  document.querySelectorAll('.js-add-to-cart').forEach(btn => {
    btn.addEventListener('click', function () {
      const card = this.closest('.product-card');
      if (!card) return;

      const type = card.dataset.type;
      const count = parseInt(card.dataset.count) || 1;

      const product = {
        id: card.dataset.id,
        name: card.querySelector('.product-name')?.textContent || 'Товар',
        price: parseInt(card.dataset.price) || 0,
        type: type,
        count: count,
        quantity: 1
      };

      openQuantityModal(product);
    });
  });

  function addToCartDirect(product) {
    const existingIndex = cart.findIndex(item =>
      item.id === product.id &&
      JSON.stringify(item.teaSelection) === JSON.stringify(product.teaSelection)
    );

    if (existingIndex > -1) {
      cart[existingIndex].quantity += product.quantity;
    } else {
      cart.push({ ...product });
    }

    saveCart();
    updateCartUI();
    openCart();
  }

  function openTeaSelectionModal(product) {
    if (!teaSlotsContainer || !teaSelectModal) return;

    teaSlotsContainer.innerHTML = '';
    selectedTeas = new Array(product.count).fill('');

    for (let i = 0; i < product.count; i++) {
      const slotDiv = document.createElement('div');
      slotDiv.className = 'tea-slot';

      let optionsHtml = '<option value="" disabled selected>Выберите вкус</option>';
      teaFlavors.forEach(flavor => {
        optionsHtml += `<option value="${flavor}">${flavor}</option>`;
      });

      slotDiv.innerHTML = `
        <h4>Бомбочка ${i + 1}</h4>
        <select class="tea-select" data-index="${i}">
          ${optionsHtml}
        </select>
      `;
      teaSlotsContainer.appendChild(slotDiv);
    }

    if (confirmTeaSelectionBtn) {
      confirmTeaSelectionBtn.onclick = () => {
        const selects = teaSlotsContainer.querySelectorAll('.tea-select');
        const selections = [];
        let allFilled = true;

        selects.forEach(select => {
          if (!select.value) {
            allFilled = false;
            select.style.borderColor = '#d9534f';
          } else {
            selections.push(select.value);
            select.style.borderColor = 'var(--color-beige)';
          }
        });

        if (!allFilled) {
          alert('Пожалуйста, выберите чай для всех бомбочек.');
          return;
        }

        currentProduct.teaSelection = selections;
        addToCartDirect(currentProduct);
        closeModal(teaSelectModal);
      };
    }

    teaSelectModal.style.display = 'block';
  }

  // --- VALIDATION FUNCTIONS ---
  function validateName(name) {
    if (!name || name.length < 2 || name.length > 100) {
      return { isValid: false, message: 'Имя должно содержать от 2 до 100 символов' };
    }
    const nameRegex = /^[A-Za-zА-Яа-яЁё\s-]+$/;
    if (!nameRegex.test(name)) {
      return { isValid: false, message: 'Имя может содержать только буквы, пробел и дефис' };
    }
    return { isValid: true, message: '' };
  }

  function validatePhone(phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 11) {
      return { isValid: false, message: 'Телефон должен содержать 11 цифр' };
    }
    if (digits[0] !== '7' && digits[0] !== '8') {
      return { isValid: false, message: 'Номер должен начинаться с 7 или 8' };
    }
    return { isValid: true, message: '' };
  }

  function validateEmail(email) {
    if (!email) return { isValid: true, message: '' };
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { isValid: false, message: 'Введите корректный email (например: name@domain.ru)' };
    }
    return { isValid: true, message: '' };
  }

  function validateComment(comment) {
    if (comment && comment.length > 300) {
      return { isValid: false, message: 'Комментарий не должен превышать 300 символов' };
    }
    return { isValid: true, message: '' };
  }

  function formatPhone(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length === 0) {
      input.value = '';
      return;
    }
    if (value[0] === '7' || value[0] === '8') {
      let formatted = '+7';
      if (value.length > 1) formatted += ' (' + value.substring(1, 4);
      if (value.length >= 4) formatted += ') ' + value.substring(4, 7);
      if (value.length >= 7) formatted += '-' + value.substring(7, 9);
      if (value.length >= 9) formatted += '-' + value.substring(9, 11);
      input.value = formatted;
    } else {
      input.value = value;
    }
  }

  // --- SETUP FORM VALIDATION ---
  function setupFormValidation() {
    if (!contactForm || !nameInput || !phoneInput || !submitBtn) {
      console.warn('⚠️ Элементы формы не найдены');
      return;
    }

    function ensureErrorElement(inputId, errorId) {
      if (!document.getElementById(errorId)) {
        const input = document.getElementById(inputId);
        if (input) {
          const errorDiv = document.createElement('div');
          errorDiv.className = 'validation-message';
          errorDiv.id = errorId;
          input.parentNode.insertBefore(errorDiv, input.nextSibling);
        }
      }
    }

    ensureErrorElement('name', 'name-error');
    ensureErrorElement('phone', 'phone-error');
    ensureErrorElement('email', 'email-error');
    ensureErrorElement('comment', 'comment-error');

    phoneInput.addEventListener('input', function () {
      formatPhone(this);
      validateField(this, validatePhone, 'phone-error');
    });

    nameInput.addEventListener('input', function () {
      validateField(this, validateName, 'name-error');
    });

    if (emailInput) {
      emailInput.addEventListener('input', function () {
        validateField(this, validateEmail, 'email-error');
      });
    }

    if (commentInput && commentCount && charCounter) {
      commentInput.addEventListener('input', function () {
        validateField(this, validateComment, 'comment-error');

        const length = this.value.length;
        commentCount.textContent = length;

        if (length > 280 && length <= 300) {
          charCounter.classList.add('warning');
          charCounter.classList.remove('danger');
        } else if (length > 300) {
          charCounter.classList.add('danger');
          charCounter.classList.remove('warning');
        } else {
          charCounter.classList.remove('warning', 'danger');
        }
      });
    }

    function validateField(input, validator, errorId) {
      const errorEl = document.getElementById(errorId);
      if (!errorEl) return;

      const result = validator(input.value);

      if (result.isValid) {
        input.classList.add('valid');
        input.classList.remove('invalid');
        errorEl.textContent = '';
        errorEl.classList.remove('visible');
      } else {
        input.classList.add('invalid');
        input.classList.remove('valid');
        errorEl.textContent = result.message;
        errorEl.classList.add('visible');

        input.style.animation = 'none';
        input.offsetHeight;
        input.style.animation = 'shake 0.3s ease-in-out';

        setTimeout(() => { input.style.animation = ''; }, 300);
      }

      updateSubmitButton();
    }

    function isFormValid() {
      const nameValid = validateName(nameInput.value).isValid;
      const phoneValid = validatePhone(phoneInput.value).isValid;
      const emailValid = emailInput ? validateEmail(emailInput.value).isValid : true;
      const commentValid = commentInput ? validateComment(commentInput.value).isValid : true;
      return nameValid && phoneValid && emailValid && commentValid;
    }

    function updateSubmitButton() {
      submitBtn.disabled = !isFormValid();
      if (nameInput.value === '') nameInput.classList.remove('valid', 'invalid');
      if (phoneInput.value === '') phoneInput.classList.remove('valid', 'invalid');
      if (emailInput && emailInput.value === '') emailInput.classList.remove('valid', 'invalid');
      if (commentInput && commentInput.value === '') commentInput.classList.remove('valid', 'invalid');
    }

    updateSubmitButton();

    contactForm.removeEventListener('submit', contactForm._submitHandler);

    const submitHandler = async (e) => {
      e.preventDefault();
      
      // Показываем панель отладки
      addDebugPanel();
      showDebugPanel();
      logToScreen('🚀 Начинаем обработку заказа...');
    
      if (!isFormValid()) {
        logToScreen('❌ Форма не прошла валидацию', 'error');
        alert('Пожалуйста, исправьте ошибки в форме');
        return;
      }

      if (cart.length === 0) {
        logToScreen('❌ Корзина пуста', 'error');
        alert('Корзина пуста. Добавьте товары перед заказом.');
        return;
      }
    
      const name = nameInput.value.trim();
      const phone = phoneInput.value.trim();
      const email = emailInput ? emailInput.value.trim() : '';
      const comment = commentInput ? commentInput.value.trim() : '';
    
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Отправка...';
    
      try {
        const orderData = {
          name: name,
          phone: phone,
          email: email,
          comment: comment,
          items: cart.map(item => ({
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            teaSelection: item.teaSelection || []
          }))
        };
    
        logToScreen(`📦 Данные заказа: ${JSON.stringify(orderData)}`);
        
        // Запускаем оба запроса параллельно
        const [telegramResult, sheetsResult] = await Promise.allSettled([
          sendToTelegram(orderData),
          sendToGoogleSheets(orderData)
        ]);
    
        const results = {
          telegram: telegramResult.status === 'fulfilled' 
            ? { success: telegramResult.value?.ok === true, data: telegramResult.value }
            : { success: false, error: telegramResult.reason?.message },
          sheets: sheetsResult.status === 'fulfilled'
            ? { success: true }
            : { success: false, error: sheetsResult.reason?.message }
        };
    
        logToScreen(`📊 Результаты: Telegram OK:${results.telegram.success}, Sheets OK:${results.sheets.success}`);
    
        if (results.telegram.success || results.sheets.success) {
          let successMessage = '✅ Спасибо! Ваш заказ принят.';
          
          if (!results.telegram.success) {
            logToScreen('⚠️ Telegram не ответил, но Sheets работает', 'warning');
            successMessage = '✅ Спасибо! Заказ принят.';
          }
          
          if (!results.sheets.success) {
            logToScreen('⚠️ Google Sheets не ответил, но Telegram работает', 'warning');
          }
          
          alert(successMessage);
    
          cart = [];
          saveCart();
          updateCartUI();
    
          contactForm.reset();
          if (commentCount) commentCount.textContent = '0';
          if (charCounter) charCounter.classList.remove('warning', 'danger');
    
          [nameInput, phoneInput, emailInput, commentInput].forEach(input => {
            if (input) {
              input.classList.remove('valid', 'invalid');
              input.style.animation = '';
            }
          });
    
          ['name-error', 'phone-error', 'email-error', 'comment-error'].forEach(id => {
            const errorEl = document.getElementById(id);
            if (errorEl) {
              errorEl.textContent = '';
              errorEl.classList.remove('visible');
            }
          });
    
          if (cartModal) closeModal(cartModal);
          
        } else {
          logToScreen('❌ Оба канала не сработали!', 'error');
          alert('❌ Произошла ошибка при отправке. Пожалуйста, попробуйте позже.');
        }
        
      } catch (error) {
        logToScreen(`❌ Критическая ошибка: ${error.message}`, 'error');
        alert('❌ Произошла ошибка при отправке. Пожалуйста, попробуйте позже.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
        updateSubmitButton();
      }
    };
    
    if (contactForm._submitHandler) {
      contactForm.removeEventListener('submit', contactForm._submitHandler);
    }
    
    contactForm._submitHandler = submitHandler;
    contactForm.addEventListener('submit', submitHandler);
  }

  // --- FAQ ACCORDION ---
  function initFaqAccordion() {
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
      const question = item.querySelector('.faq-question');
      if (!question) return;
      question.addEventListener('click', () => {
        const isActive = item.classList.contains('active');
        if (!isActive) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });
    });
  }

  // --- INITIALIZATION ---
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (loader) {
        loader.classList.add('hidden');
        setTimeout(() => loader.remove(), 500);
      }
    }, 300);
    loadCart();
  });

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.fade-in-section').forEach(section => observer.observe(section));
    initFaqAccordion();
    setupFormValidation();
    addDebugPanel(); // Добавляем панель отладки
  });

})();
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TOTAL_SPOTS = 20;

const supabaseUrl = window.__SUPABASE_URL__ || '';
const supabaseAnonKey = window.__SUPABASE_ANON_KEY__ || '';
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

/* ---------- Scroll reveal ---------- */
const revealEls = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });
revealEls.forEach((el) => revealObserver.observe(el));

/* ---------- FAQ accordion ---------- */
document.querySelectorAll('.faq-item').forEach((item) => {
  const question = item.querySelector('.faq-question');
  question.addEventListener('click', () => {
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach((openItem) => {
      openItem.classList.remove('open');
      openItem.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
    });
    if (!isOpen) {
      item.classList.add('open');
      question.setAttribute('aria-expanded', 'true');
    }
  });
});

/* ---------- Spots counter ---------- */
const spotsNumberEl = document.getElementById('spotsNumber');
const spotsLabelEl = document.getElementById('spotsLabel');
const spotsBarFillEl = document.getElementById('spotsBarFill');
const eaForm = document.getElementById('eaForm');
const eaWaitlistForm = document.getElementById('eaWaitlistForm');
const eaSuccess = document.getElementById('eaSuccess');

let currentSpotsRemaining = null;

function animateNumber(el, from, to, duration = 700) {
  const start = performance.now();
  const diff = to - from;
  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + diff * eased);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function renderSpots(remaining) {
  const clamped = Math.max(0, Math.min(TOTAL_SPOTS, remaining));
  const previous = currentSpotsRemaining === null ? clamped : currentSpotsRemaining;
  currentSpotsRemaining = clamped;

  animateNumber(spotsNumberEl, previous, clamped);
  spotsLabelEl.textContent = `of ${TOTAL_SPOTS} spots remaining`;
  spotsBarFillEl.style.width = `${(clamped / TOTAL_SPOTS) * 100}%`;

  if (clamped <= 0) {
    eaForm.style.display = 'none';
    eaWaitlistForm.style.display = 'block';
  } else {
    eaForm.style.display = 'grid';
    eaWaitlistForm.style.display = 'none';
  }
}

async function fetchSpotsRemaining() {
  if (!supabase) {
    renderSpots(TOTAL_SPOTS);
    return;
  }
  const { data, error } = await supabase.rpc('get_early_access_count');
  if (error) {
    console.error('Failed to fetch signup count', error);
    renderSpots(TOTAL_SPOTS);
    return;
  }
  renderSpots(TOTAL_SPOTS - (data ?? 0));
}

fetchSpotsRemaining();

/* Live updates via Supabase Realtime Broadcast — any client that completes
   a signup broadcasts the new remaining count to everyone else on the page. */
let spotsChannel = null;
if (supabase) {
  spotsChannel = supabase.channel('early_access_spots');
  spotsChannel
    .on('broadcast', { event: 'spots_update' }, ({ payload }) => {
      if (typeof payload?.remaining === 'number') {
        renderSpots(payload.remaining);
      }
    })
    .subscribe();
}

function broadcastSpotsRemaining(remaining) {
  if (spotsChannel) {
    spotsChannel.send({ type: 'broadcast', event: 'spots_update', payload: { remaining } });
  }
}

/* ---------- Confetti ---------- */
function fireConfetti() {
  if (typeof window.confetti !== 'function') return;
  const colors = ['#8B5CF6', '#7C3AED', '#F9FAFB', '#10B981'];
  window.confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors });
  setTimeout(() => {
    window.confetti({ particleCount: 60, spread: 100, origin: { y: 0.5 }, colors });
  }, 200);
}

function showSuccess() {
  eaForm.style.display = 'none';
  eaWaitlistForm.style.display = 'none';
  eaSuccess.style.display = 'block';
  fireConfetti();
}

/* ---------- Full early access form ---------- */
const eaSubmitBtn = document.getElementById('eaSubmitBtn');
const eaFormError = document.getElementById('eaFormError');

eaForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  eaFormError.style.display = 'none';

  if (!supabase) {
    eaFormError.textContent = 'Signups are temporarily unavailable. Please email hellokliento@gmail.com.';
    eaFormError.style.display = 'block';
    return;
  }

  const formData = new FormData(eaForm);
  const payload = {
    name: formData.get('name')?.toString().trim(),
    business_name: formData.get('businessName')?.toString().trim(),
    business_type: formData.get('businessType')?.toString().trim(),
    phone: formData.get('phone')?.toString().trim(),
    email: formData.get('email')?.toString().trim(),
    city_state: formData.get('cityState')?.toString().trim(),
    is_waitlist: false,
  };

  eaSubmitBtn.disabled = true;
  eaSubmitBtn.textContent = 'Submitting…';

  const { error } = await supabase.from('early_access').insert(payload);

  if (error) {
    console.error('Signup failed', error);
    eaFormError.textContent = 'Something went wrong. Please try again.';
    eaFormError.style.display = 'block';
    eaSubmitBtn.disabled = false;
    eaSubmitBtn.textContent = 'Claim My Free Spot →';
    return;
  }

  const newRemaining = (currentSpotsRemaining ?? TOTAL_SPOTS) - 1;
  renderSpots(newRemaining);
  broadcastSpotsRemaining(newRemaining);
  showSuccess();
});

/* ---------- Waitlist-only form (shown once spots are full) ---------- */
const waitlistSubmitBtn = document.getElementById('waitlistSubmitBtn');
const waitlistFormError = document.getElementById('waitlistFormError');

waitlistSubmitBtn?.addEventListener('click', async () => {
  const emailInput = document.getElementById('waitlistEmail');
  const email = emailInput.value.trim();
  waitlistFormError.style.display = 'none';

  if (!email || !emailInput.checkValidity()) {
    waitlistFormError.textContent = 'Please enter a valid email address.';
    waitlistFormError.style.display = 'block';
    return;
  }

  if (!supabase) {
    waitlistFormError.textContent = 'Signups are temporarily unavailable. Please email hellokliento@gmail.com.';
    waitlistFormError.style.display = 'block';
    return;
  }

  waitlistSubmitBtn.disabled = true;
  waitlistSubmitBtn.textContent = 'Joining…';

  const { error } = await supabase.from('early_access').insert({ email, is_waitlist: true });

  waitlistSubmitBtn.disabled = false;
  waitlistSubmitBtn.textContent = 'Join Waitlist';

  if (error) {
    console.error('Waitlist signup failed', error);
    waitlistFormError.textContent = 'Something went wrong. Please try again.';
    waitlistFormError.style.display = 'block';
    return;
  }

  showSuccess();
});

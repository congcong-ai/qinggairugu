const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const wave = document.querySelector('.wave');
for (let i = 0; i < 45; i++) {
  const bar = document.createElement('span');
  bar.style.setProperty('--height', `${12 + ((i * 17 + 11) % 42)}px`);
  bar.style.setProperty('--delay', `${(i % 9) * -0.13}s`);
  wave?.append(bar);
}
if ('IntersectionObserver' in window && !reducedMotion.matches) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12 },
  );
  document.querySelectorAll('.reveal').forEach((el) => {
    el.classList.add('will-reveal');
    observer.observe(el);
  });
}
const phone = document.querySelector('[data-tilt]');
const encounter = document.querySelector('.encounter');
if (window.matchMedia('(hover: hover)').matches) {
  encounter?.addEventListener('pointermove', (event) => {
    if (reducedMotion.matches) return;
    const bounds = encounter.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    phone.style.transform = `rotateY(${x * 12}deg) rotateX(${-y * 9}deg) rotate(-5deg)`;
  });
  encounter?.addEventListener('pointerleave', () => {
    phone.style.transform = '';
  });
}
const dialog = document.querySelector('#ios-dialog');
document
  .querySelector('#ios-status')
  ?.addEventListener('click', () => dialog.showModal());
dialog?.querySelectorAll('button').forEach((button) => {
  button.addEventListener('click', () => dialog.close());
});
dialog?.addEventListener('click', (event) => {
  if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
      dialog.close();
  }
});

// 版本信息来自 GitCode；不可用时保留通用下载文案，不显示过期版本。
fetch('/downloads/release.json', { cache: 'no-store' })
  .then(async (response) => {
    if (!response.ok) return;
    const release = await response.json();
    if (!/^\d+\.\d+\.\d+$/.test(release.version)) return;
    const size =
      Number.isFinite(release.bytes) && release.bytes > 0
        ? ` · ${(release.bytes / 1024 / 1024).toFixed(1)} MB`
        : '';
    document.querySelectorAll('[data-android-release]').forEach((label) => {
      label.textContent = `v${release.version}${size} · APK`;
    });
  })
  .catch(() => {});

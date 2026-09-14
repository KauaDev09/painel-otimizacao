/** Scroll to a hash target after layout, with retries for late paint. */
export function scrollToHash(hash: string, behavior: ScrollBehavior = 'smooth') {
  const id = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!id) {
    window.scrollTo({ top: 0, behavior });
    return;
  }

  let attempts = 0;
  const maxAttempts = 20;

  const run = () => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior, block: 'start' });
      return;
    }
    attempts += 1;
    if (attempts < maxAttempts) {
      requestAnimationFrame(run);
    }
  };

  requestAnimationFrame(() => requestAnimationFrame(run));
}

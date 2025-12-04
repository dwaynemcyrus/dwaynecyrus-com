document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-copy]");
  if (!btn) return;

  const value = btn.getAttribute("data-copy");
  navigator.clipboard.writeText(value).then(() => {
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = "Copy email"), 1200);
  });
});


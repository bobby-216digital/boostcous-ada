document.addEventListener('DOMContentLoaded', function () {
  var originalBtn = document.querySelector('.product-form__submit');
  var stickyBar = document.getElementById('StickyAtc');
  if (!originalBtn || !stickyBar) return;

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        stickyBar.classList.toggle('sticky-atc--visible', !entry.isIntersecting);
      });
    },
    { threshold: 0 }
  );

  observer.observe(originalBtn);
});

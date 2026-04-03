function openTab(tabName) {
  let contents = document.querySelectorAll(".tab-content");
  let buttons = document.querySelectorAll(".tab-btn");

  contents.forEach(c => c.classList.remove("active"));
  buttons.forEach(b => b.classList.remove("active"));

  document.getElementById(tabName).classList.add("active");
  event.target.classList.add("active");
}
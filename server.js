let typingTimer;

function autoComplete(inputElement, listId) {
  const value = inputElement.value;

  clearTimeout(typingTimer);

  if (value.length < 2) {
    document.getElementById(listId).innerHTML = "";
    return;
  }

  typingTimer = setTimeout(() => {
    google.script.run.withSuccessHandler(data => {
      let html = "";

      data.slice(0, 5).forEach(item => {
        html += `
          <div onclick="selectOption('${item}', '${inputElement.id}', '${listId}')"
            style="padding:8px; cursor:pointer; border-bottom:1px solid #eee;"
            onmouseover="this.style.background='#f5f5f5'"
            onmouseout="this.style.background='white'">
            ${item}
          </div>
        `;
      });

      document.getElementById(listId).innerHTML = html;
    }).getAutocomplete(value);
  }, 250); // smoother typing
}
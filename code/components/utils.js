export function createSlotElement(name) {
  const namedSlot = document.createElement('slot');
  if (typeof name === 'string') {
    namedSlot.setAttribute('name', name);
  }
  return namedSlot;
}

export function isHTMLElement(object) {
  try {
    return object instanceof HTMLElement;
  } catch (err) {
    return typeof object === 'object' && object.nodeType === 1 && typeof object.style === 'object' && typeof object.ownerDocument === 'object';
  }
}

export function escapeHTML(html) {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

export function cloneTemplate(part, parentElement = WebCardinal.state.page.loader) {
  const templateElement = parentElement.querySelector(`template#dw-${part}--template`);
  return templateElement.content.cloneNode(true);
}

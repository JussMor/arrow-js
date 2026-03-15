import { html, reactive } from '@src/index'

let hasBoundDocumentListener = false

export default function (store) {
  const d = reactive({
    trayIsOpen: false,
  })

  if (typeof document !== 'undefined' && !hasBoundDocumentListener) {
    hasBoundDocumentListener = true
    document.addEventListener('click', (e) => {
      const target = e.target
      if (!(target instanceof Element) || !target.closest('nav')) {
        d.trayIsOpen = false
      }
    })
  }

  function makeList(items) {
    return html`<ul>
      ${items.map(
        (item) => html`<li data-selected="${() => store.section === item.id}">
          <a href="${`#${item.id}`}">${() => item.title}</a>
          ${item.children && item.children.length && makeList(item.children)}
        </li>`
      )}
    </ul>`
  }
  const listOfLinks = makeList(store.navigation)

  return html`<nav class="navigation">
    <div
      class="selection"
      @click="${() => {
        d.trayIsOpen = !d.trayIsOpen
      }}"
      data-is-open="${() => d.trayIsOpen}"
    >
      ${listOfLinks}
    </div>
  </nav>`
}

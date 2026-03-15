import { reactive, watch } from '@src/index'

export default function createDocsStore() {
  const store = reactive({
    section: 'intro',
    navigation: [
      {
        title: 'Getting Started',
        id: 'getting-started',
        children: [
          { title: 'Installation', id: 'installation' },
          { title: 'Reactive (r)', id: 'reactive-data' },
          { title: 'Watch (w)', id: 'watching-data' },
          { title: 'HTML (t)', id: 'templates' },
          { title: 'Components (c)', id: 'components' },
        ],
      },
      {
        title: 'Examples',
        id: 'examples',
      },
      {
        title: 'Changelog',
        id: 'changelog',
      },
    ],
  })

  watch(() => {
    if (store.section === undefined) {
      store.section = store.navigation[0].id
    }
  })

  return store
}

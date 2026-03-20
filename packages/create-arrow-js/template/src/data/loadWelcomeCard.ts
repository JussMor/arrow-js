export interface WelcomeCardData {
  copy: string
  eyebrow: string
  title: string
}

export async function loadWelcomeCard(): Promise<WelcomeCardData> {
  await new Promise((resolve) => setTimeout(resolve, 12))

  return {
    eyebrow: 'Async component',
    title: 'SSR waits for async work and hydration reuses the result.',
    copy: 'This card resolves on the server, gets serialized into the payload, and hydrates without doing the work again on the client.',
  }
}

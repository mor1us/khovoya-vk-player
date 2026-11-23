export const vkSubscriptionMessages = {
  login: 'ВК просит снова войти, чтобы открыть подписки.',
  verification: 'ВК просит пройти проверку, чтобы открыть подписки.'
}

export type VkSubscriptionIssue = keyof typeof vkSubscriptionMessages

/** Electron может добавить к сообщению префикс вызова IPC. */
export function vkSubscriptionIssue(error: unknown): VkSubscriptionIssue | undefined {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes(vkSubscriptionMessages.login)) return 'login'
  if (message.includes(vkSubscriptionMessages.verification)) return 'verification'
}

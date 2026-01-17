export function createAzureConfigFromEnv(env) {
  const clientId = typeof env?.VITE_AZURE_CLIENT_ID === 'string'
    ? env.VITE_AZURE_CLIENT_ID.trim()
    : ''
  const tenantId = typeof env?.VITE_AZURE_TENANT_ID === 'string'
    ? env.VITE_AZURE_TENANT_ID.trim()
    : ''
  const scopes = typeof env?.VITE_AZURE_SCOPES === 'string'
    ? env.VITE_AZURE_SCOPES.trim()
    : ''

  if (!clientId || !tenantId) {
    throw new Error('AuthStore: Azure provider requires VITE_AZURE_CLIENT_ID and VITE_AZURE_TENANT_ID')
  }

  const config = { clientId, tenantId }
  if (scopes) {
    config.scopes = scopes
  }

  return config
}

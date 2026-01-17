export function resolveGoogleScopes(tokenScope, defaultScope) {
  const rawScope = tokenScope || defaultScope || ''
  return rawScope.split(' ').filter(Boolean)
}

export function buildGoogleTokens(tokenData, defaultScope, refreshTokenFallback = null) {
  const scopes = resolveGoogleScopes(tokenData?.scope, defaultScope)
  return {
    accessTokens: [
      {
        accessToken: tokenData.access_token,
        scopes,
        expiresIn: tokenData.expires_in
      }
    ],
    refreshToken: tokenData.refresh_token || refreshTokenFallback || null,
    idToken: tokenData.id_token || null
  }
}

const DEFAULT_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://ssl.gstatic.com",
  "connect-src 'self' https://oauth2.googleapis.com https://openidconnect.googleapis.com",
  "font-src 'self'",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'"
].join('; ')

export function applyCsp() {
  if (typeof document === 'undefined') {
    return
  }

  if (import.meta.env.DEV && !import.meta.env.VITE_CSP_DIRECTIVES) {
    // Garder l'expérience développeur fluide en dev si aucune directive custom n'est définie
    return
  }

  const content = (import.meta.env.VITE_CSP_DIRECTIVES || DEFAULT_CSP).trim()
  if (!content) {
    return
  }

  let meta = document.querySelector('meta[http-equiv=\"Content-Security-Policy\"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('http-equiv', 'Content-Security-Policy')
    document.head.prepend(meta)
  }

  meta.setAttribute('content', content)
}

const DEBUG_ENABLED =
  import.meta.env.DEV ||
  import.meta.env.VITE_AUTH_DEBUG_LOGS === 'true'

const PREFIX = '[auth]'

function print(method, message, context) {
  if (context !== undefined) {
    console[method](`${PREFIX} ${message}`, context)
  } else {
    console[method](`${PREFIX} ${message}`)
  }
}

export function authDebug(message, context) {
  if (!DEBUG_ENABLED) {
    return
  }
  print('debug', message, context)
}

export function authWarn(message, context) {
  print('warn', message, context)
}

export function authError(message, context) {
  print('error', message, context)
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert } from 'react-native'

// Lazy-load: @react-native-voice/voice is not bundled in Expo Go
let Voice: any = null
try { Voice = require('@react-native-voice/voice').default } catch {}

export type VoiceState = 'idle' | 'listening' | 'processing' | 'error'

interface UseVoiceSearch {
  state: VoiceState
  partialText: string
  start: () => void
  stop: () => void
  cancel: () => void
  available: boolean
}

export default function useVoiceSearch(onResult: (text: string) => void): UseVoiceSearch {
  const [state, setState]           = useState<VoiceState>('idle')
  const [partialText, setPartial]   = useState('')
  const mounted                      = useRef(true)

  const available = Voice !== null

  useEffect(() => {
    mounted.current = true
    if (!Voice) return

    Voice.onSpeechStart        = () => { if (mounted.current) setState('listening') }
    Voice.onSpeechEnd          = () => { if (mounted.current) setState('processing') }
    Voice.onSpeechPartialResults = (e: any) => {
      const partial = e?.value?.[0] ?? ''
      if (mounted.current) setPartial(partial)
    }
    Voice.onSpeechResults = (e: any) => {
      const text = e?.value?.[0] ?? ''
      if (mounted.current) {
        setState('idle')
        setPartial('')
        if (text) onResult(text)
      }
    }
    Voice.onSpeechError = (e: any) => {
      if (!mounted.current) return
      setState('error')
      setPartial('')
      // error code 7 = no match (user was silent), just reset silently
      if (e?.error?.code !== '7' && e?.error?.code !== 7) {
        setState('idle')
      } else {
        setTimeout(() => { if (mounted.current) setState('idle') }, 1200)
      }
    }

    return () => {
      mounted.current = false
      Voice.destroy().catch(() => {})
    }
  }, [onResult])

  const start = useCallback(async () => {
    if (!Voice) {
      Alert.alert(
        'Voice search unavailable',
        'Voice search requires a development build and is not supported in Expo Go.',
      )
      return
    }
    try {
      setPartial('')
      setState('listening')
      await Voice.start('en-IN')
    } catch {
      setState('idle')
    }
  }, [])

  const stop = useCallback(async () => {
    if (!Voice) return
    try { await Voice.stop() } catch {}
  }, [])

  const cancel = useCallback(async () => {
    if (!Voice) return
    try {
      await Voice.cancel()
      setState('idle')
      setPartial('')
    } catch {}
  }, [])

  return { state, partialText, start, stop, cancel, available }
}
